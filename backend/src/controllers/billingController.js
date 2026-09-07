const crypto = require('crypto');
const prisma = require('../config/db');
const { PLANS, FREE_TIER, MOMO, generateReference } = require('../config/plans');
const { initializeTransaction, verifyTransaction } = require('../services/paystack');
const { notifyAdmins } = require('./notificationController');

// Free listing allowance for sellers without an active subscription
const FREE_LISTING_LIMIT = FREE_TIER.listings;

const publicPlans = Object.values(PLANS).map(p => ({
  key: p.key,
  label: p.label,
  description: p.description,
  price: p.price,
  durationDays: p.durationDays,
  listings: p.listings ?? null,
  type: p.type,
}));

// @desc    Get pricing plans + payment details
// @route   GET /api/billing/plans
// @access  Public
const getPlans = (req, res) => {
  res.json({
    plans: publicPlans,
    freeTier: FREE_TIER,
    momo: MOMO,
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || null,
  });
};

// Helper: the seller's currently active subscription (if any)
async function getActiveSubscription(userId) {
  return prisma.subscription.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      periodEnd: { gt: new Date() },
    },
    orderBy: { periodEnd: 'desc' },
  });
}

/**
 * Idempotently activate a payment's plan (subscription allowance).
 * Used by the Paystack webhook, server-side verify, and manual admin approval.
 *
 * Race-safe: the payment row is claimed inside a transaction with a status
 * guard, so two concurrent webhook + verify calls can never double-extend.
 * Returns the updated payment, or null if another caller already applied it.
 */
async function applyVerifiedPayment(payment, { channel } = {}) {
  if (payment.status === 'VERIFIED') return payment;

  const plan = PLANS[payment.plan];

  return prisma.$transaction(async (tx) => {
    // Atomic claim: only a caller that flips PENDING -> VERIFIED proceeds.
    // Everyone else (concurrent webhook/verify/admin) sees count 0 and stops.
    const claim = await tx.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: {
        status: 'VERIFIED',
        channel: channel || payment.channel || null,
        paidAt: payment.paidAt || new Date(),
      },
    });
    if (claim.count === 0) return null;

    const now = new Date();
    const periodEnd = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    // Extend from the current period if the subscription is still active
    const existing = await tx.subscription.findUnique({ where: { userId: payment.userId } });
    const base = existing && existing.status === 'ACTIVE' && existing.periodEnd > now
      ? existing.periodEnd
      : now;
    const newEnd = new Date(base.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    await tx.subscription.upsert({
      where: { userId: payment.userId },
      create: {
        userId: payment.userId,
        plan: plan.key,
        status: 'ACTIVE',
        periodStart: now,
        periodEnd: newEnd,
      },
      update: {
        plan: plan.key,
        status: 'ACTIVE',
        periodStart: base,
        periodEnd: newEnd,
      },
    });

    // Upgrading lifts the 90-day free-listing expiry: reactivate any taken-down listings
    await tx.vehicle.updateMany({
      where: { seller: { userId: payment.userId }, expiresAt: { not: null } },
      data: { expiresAt: null },
    });

    return tx.payment.update({
      where: { id: payment.id },
      data: {
        periodStart: now,
        periodEnd,
      },
    });
  });
}

// @desc    Current seller's billing status (plan, usage, limits)
// @route   GET /api/billing/status
// @access  Private (Seller)
const getBillingStatus = async (req, res) => {
  try {
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!seller) {
      return res.status(403).json({ message: 'Only sellers have billing.' });
    }

    const subscription = await getActiveSubscription(req.user.id);

    const listingsUsed = await prisma.vehicle.count({
      where: { sellerId: seller.id, status: { in: ['PENDING', 'AVAILABLE'] } },
    });

    const plan = subscription ? PLANS[subscription.plan] : FREE_TIER;
    const limit = subscription ? (PLANS[subscription.plan].listings ?? null) : FREE_LISTING_LIMIT;

    res.json({
      plan: subscription ? { key: plan.key, label: plan.label } : { key: 'FREE', label: 'Free' },
      isSubscribed: Boolean(subscription),
      listingsUsed,
      listingLimit: limit, // null = unlimited
      renewsAt: subscription ? subscription.periodEnd : null,
      momo: MOMO,
    });
  } catch (error) {
    console.error('Error fetching billing status:', error);
    res.status(500).json({ message: 'Server error fetching billing status' });
  }
};

// @desc    Create a PENDING payment record (before redirecting to Paystack)
// @route   POST /api/billing/payments
// @access  Private (Seller)
const createPayment = async (req, res) => {
  try {
    const { planKey } = req.body;
    const plan = PLANS[planKey];

    if (!plan) {
      return res.status(400).json({ message: 'Unknown plan selected.' });
    }

    const payment = await prisma.payment.create({
      data: {
        userId: req.user.id,
        plan: plan.key,
        amount: Math.round(plan.price * 100), // integer pesewas
        reference: generateReference(),
      },
    });

    // Payment-submitted-for-review lands here (before Paystack callback
    // settles it) — alert admins to verify (fire-and-forget).
    notifyAdmins({
      type: 'ADMIN_PENDING_PAYMENT',
      title: 'Payment awaiting verification',
      body: `${plan.label} · ₵${(payment.amount / 100).toLocaleString()} · ref ${payment.reference}`,
      senderId: req.user.id,
      data: { path: '/admin?tab=payments', paymentId: payment.id },
    }).catch((e) => console.error('Admin payment notify failed:', e.message));

    res.status(201).json({ payment });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ message: 'Server error creating payment' });
  }
};

// @desc    Initialize a Paystack transaction for a payment (returns checkout URL)
// @route   POST /api/billing/payments/:id/initialize
// @access  Private (Seller)
const initializePayment = async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { user: { select: { email: true } } },
    });
    if (!payment) return res.status(404).json({ message: 'Payment not found.' });
    if (payment.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not your payment.' });
    }
    if (payment.status === 'VERIFIED') {
      return res.status(400).json({ message: 'This payment is already completed.' });
    }

    // Priority: URL sent by the frontend (its own origin) → env → derive from request host
    const callbackUrl = req.body?.callbackUrl
      || process.env.PAYSTACK_CALLBACK_URL
      || `${req.protocol}://${req.get('host')}/billing/callback`;

    const init = await initializeTransaction({
      email: payment.user.email,
      amountGhs: payment.amount / 100, // stored pesewas -> GHS for Paystack
      reference: payment.reference,
      callbackUrl,
      metadata: {
        paymentId: payment.id,
        userId: payment.userId,
        planKey: payment.plan,
      },
    });

    res.json({
      authorizationUrl: init.authorization_url,
      accessCode: init.access_code,
      reference: init.reference,
    });
  } catch (error) {
    console.error('Error initializing payment:', error);
    res.status(500).json({ message: error.message || 'Server error initializing payment' });
  }
};

// @desc    Verify a payment server-side (Paystack callback fallback)
// @route   GET /api/billing/verify/:reference
// @access  Private (Seller)
const verifyPayment = async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { reference: req.params.reference },
    });
    if (!payment) return res.status(404).json({ message: 'Payment not found.' });
    if (payment.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not your payment.' });
    }
    if (payment.status === 'VERIFIED') {
      return res.json({ status: 'success', payment });
    }

    const result = await verifyTransaction(payment.reference);
    if (result.status === 'success') {
      // Both integer pesewas — exact comparison, no epsilon
      if (result.amount < payment.amount) {
        return res.status(400).json({ message: 'Amount paid does not match the plan price.', status: 'amount_mismatch' });
      }
      const updated = await applyVerifiedPayment(payment, { channel: result.channel });
      return res.json({ status: 'success', payment: updated });
    }

    res.json({ status: result.status || 'pending', payment });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ message: error.message || 'Server error verifying payment' });
  }
};

// @desc    Paystack webhook (charge.success etc.) — no auth, signature-verified
// @route   POST /api/billing/webhook
// @access  Public (signed by Paystack)
const paystackWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(req.rawBody)
      .digest('hex');

    // timingSafeEqual guards against signature-oracle timing attacks; the
    // length check is required first or it throws on unequal buffer lengths.
    const expectedSig = Buffer.from(hash, 'utf8');
    const receivedSig = Buffer.from(String(signature || ''), 'utf8');
    const signatureValid = expectedSig.length === receivedSig.length
      && crypto.timingSafeEqual(expectedSig, receivedSig);

    if (!signatureValid) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const event = req.body;
    if (event.event === 'charge.success') {
      const data = event.data;
      const payment = await prisma.payment.findUnique({
        where: { reference: data.reference },
      });
      if (payment && payment.status !== 'VERIFIED') {
        // Both sides are integer pesewas — exact comparison, no epsilon
        const paidAmount = data.amount;
        if (paidAmount >= payment.amount) {
          await applyVerifiedPayment(payment, {
            channel: data.channel || null,
          });
          console.log(`✅ Webhook: payment ${payment.reference} verified (${payment.plan})`);
        } else {
          console.warn(`⚠️ Webhook: amount mismatch for ${payment.reference}`);
        }
      }
    }

    // Always acknowledge quickly so Paystack doesn't retry
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
};

// @desc    Seller's payment history
// @route   GET /api/billing/payments
// @access  Private (Seller)
const getMyPayments = async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { userId: req.user.id },
      include: {
        vehicle: { select: { id: true, make: true, model: true, year: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ message: 'Server error fetching payments' });
  }
};

module.exports = {
  getPlans,
  getBillingStatus,
  createPayment,
  initializePayment,
  verifyPayment,
  paystackWebhook,
  getMyPayments,
  applyVerifiedPayment,
  getActiveSubscription,
  FREE_LISTING_LIMIT,
};
