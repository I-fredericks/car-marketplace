const prisma = require('../config/db');
const { generateReference, PLATFORM_COMMISSION_BPS, commissionFor } = require('../config/plans');
const { initializeTransaction, verifyTransaction } = require('../services/paystack');
const { notifyAdmins } = require('./notificationController');
const { sendMail, appUrl } = require('../services/mailer');

// Purchase workflow (escrow):
//   PAYSTACK: AWAITING_PAYMENT --(webhook/verify)--> PAID_HELD --buyer confirms receipt--> COMPLETED (payout PENDING)
//   CASH:     HANDOVER_PENDING --buyer confirms handover--> DELIVERED --seller confirms cash received--> COMPLETED
// Anything pre-completion can be CANCELLED (either party), freeing the vehicle.

const VEHICLE_INCLUDE = { select: { id: true, make: true, model: true, year: true, price: true, location: true } };

/**
 * Atomically move the purchase to COMPLETED if it is in the correct source
 * status; also flips the vehicle to SOLD and marks the payout PENDING for
 * online orders (an admin releases the manual payout afterwards).
 * Returns the updated purchase, or null if already transitioned.
 */
async function completePurchase(tx, purchase, { vehicle } = {}) {
  const fromStatus = purchase.method === 'CASH' ? 'DELIVERED' : 'PAID_HELD';
  const claim = await tx.purchase.updateMany({
    where: { id: purchase.id, status: fromStatus },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      payoutStatus: purchase.method === 'CASH' ? 'NONE' : 'PENDING',
    },
  });
  if (claim.count === 0) return null;

  if (purchase.vehicleId) {
    await tx.vehicle.update({
      where: { id: vehicle?.id ?? purchase.vehicleId },
      data: { status: 'SOLD' },
    }).catch((e) => {
      // Vehicle may already be SOLD/REMOVED by admin action — non-fatal
      console.warn('Purchase complete: vehicle status flip skipped:', e.message);
    });
  }

  return tx.purchase.findUnique({ where: { id: purchase.id } });
}

/**
 * Idempotently escrow a PAYSTACK purchase once the charge is confirmed.
 * Called by both the webhook and the manual /verify fallback; the status
 * guard (AWAITING_PAYMENT -> PAID_HELD) makes concurrent calls safe.
 */
async function applyVerifiedPurchase(purchase, { channel } = {}) {
  if (purchase.status !== 'AWAITING_PAYMENT') return purchase.status === 'PAID_HELD' ? purchase : null;

  return prisma.$transaction(async (tx) => {
    const claim = await tx.purchase.updateMany({
      where: { id: purchase.id, status: 'AWAITING_PAYMENT' },
      data: {
        status: 'PAID_HELD',
        channel: channel || purchase.channel || null,
        paidAt: new Date(),
      },
    });
    if (claim.count === 0) return null;
    return tx.purchase.findUnique({ where: { id: purchase.id } });
  });
}

/** In-app notify helper (fire-and-forget): one user's bell + WS push. */
const notifyUser = ({ userId, type, title, body, data }) =>
  prisma.notification.create({
    data: { userId, type, title, body, data },
  }).catch((e) => console.error(`Notify ${type} failed:`, e.message));

const GHS = (pesewas) => `GH₵${(pesewas / 100).toLocaleString()}`;

/** Buyer receipt email after escrow confirms — links to the site's printable receipt. */
const sendReceiptEmail = (purchase, vehicle, buyer) => {
  const receiptUrl = `${appUrl()}/purchases/${purchase.id}/receipt`;
  const lines = [
    ['Vehicle', `${vehicle.year} ${vehicle.make} ${vehicle.model}`],
    ['Order reference', purchase.reference],
    ['Amount paid', GHS(purchase.amount)],
    ['Paid via', purchase.channel ? purchase.channel.replace(/_/g, ' ') : 'Paystack'],
    ['Status', 'Paid — held in escrow until you confirm receipt'],
  ];
  const rows = lines.map(([k, v]) =>
    `<tr><td style="padding:8px 16px 8px 0;color:#64748B;vertical-align:top;">${k}</td><td style="padding:8px 0;font-weight:600;color:#1A1A1A;">${v}</td></tr>`
  ).join('');
  return sendMail({
    to: buyer.email,
    subject: `Payment confirmed — ${purchase.reference} (CarMarket Ghana)`,
    text: `Hi ${buyer.name}, your payment of ${GHS(purchase.amount)} for the ${vehicle.year} ${vehicle.make} ${vehicle.model} was received and is held safely in escrow. Only confirm receipt once you have the car in hand. Receipt: ${receiptUrl}`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <h2 style="color:#1B2A4A;margin-bottom:8px;">CarMarket Ghana</h2>
        <h3 style="color:#2F9E62;margin-top:0;">Payment confirmed</h3>
        <p style="color:#4B5563;line-height:1.6;">Hi ${buyer.name}, we received your payment. It's held safely in escrow and only goes to the seller after you confirm you have the car.</p>
        <table style="border-collapse:collapse;margin:16px 0;">${rows}</table>
        <p style="margin:24px 0;">
          <a href="${receiptUrl}" style="background:#1B2A4A;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">View &amp; Download Receipt</a>
        </p>
        <p style="color:#9CA3AF;font-size:12px;">Only confirm receipt after you have physically collected and inspected the car.</p>
      </div>`,
  }).catch((e) => console.error('Receipt email failed:', e.message));
};

/** Shared helper: resolve the current seller profile for the signed-in user. */
async function resolveSellerProfile(userId) {
  return prisma.sellerProfile.findUnique({ where: { userId } });
}

/** Load a purchase the caller may view (buyer or seller); admin passes role. */
async function loadOwnedPurchase(req, id) {
  const purchaseId = parseInt(id, 10);
  if (Number.isNaN(purchaseId)) return { status: 400, body: { message: 'Invalid purchase id.' } };

  const purchase = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: {
      vehicle: VEHICLE_INCLUDE,
      buyer: { select: { id: true, name: true, email: true } },
      seller: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  if (!purchase) return { status: 404, body: { message: 'Purchase not found.' } };

  const callerId = req.user.id;
  const isBuyer = purchase.buyerId === callerId;
  const isSeller = purchase.seller.userId === callerId;
  if (!isBuyer && !isSeller && req.user.role !== 'ADMIN') {
    return { status: 403, body: { message: 'Not your purchase.' } };
  }

  return { purchase, isBuyer, isSeller };
}

// @desc    Create a purchase order for a vehicle (starts checkout)
// @route   POST /api/purchases
// @access  Private (Buyer)
const initiatePurchase = async (req, res) => {
  try {
    const { vehicleId, method, deliveryMode, address, phone, notes } = req.body;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: parseInt(vehicleId, 10) },
      include: { seller: { include: { user: { select: { id: true } } } } },
    });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
    if (vehicle.status !== 'AVAILABLE') {
      return res.status(409).json({ message: 'This vehicle is no longer available.' });
    }
    if (vehicle.seller.user.id === req.user.id) {
      return res.status(400).json({ message: 'You cannot buy your own listing.' });
    }
    if (!['PAYSTACK', 'CASH'].includes(method)) {
      return res.status(400).json({ message: 'method must be PAYSTACK or CASH.' });
    }
    if (!['PICKUP', 'DELIVERY'].includes(deliveryMode)) {
      return res.status(400).json({ message: 'deliveryMode must be PICKUP or DELIVERY.' });
    }

    const amount = Math.round(vehicle.price * 100); // GHS -> integer pesewas
    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(500).json({ message: 'Vehicle has an invalid price; cannot start checkout.' });
    }

    const purchase = await prisma.$transaction(async (tx) => {
      // Reserve the vehicle: only succeeds if still AVAILABLE
      const reserve = await tx.vehicle.updateMany({
        where: { id: vehicle.id, status: 'AVAILABLE' },
        data: { status: 'RESERVED' },
      });
      if (reserve.count === 0) {
        throw new Error('This vehicle is no longer available.');
      }

      const methodDefaults = method === 'CASH' ? { status: 'HANDOVER_PENDING' } : {};
      return tx.purchase.create({
        data: {
          reference: generateReference(),
          buyerId: req.user.id,
          vehicleId: vehicle.id,
          sellerId: vehicle.sellerId,
          amount,
          method,
          deliveryMode,
          address: address || null,
          phone: phone || null,
          notes: notes || null,
          commissionBps: PLATFORM_COMMISSION_BPS, // snapshot at sale time
          ...methodDefaults,
        },
        include: { vehicle: VEHICLE_INCLUDE },
      });
    }, { timeout: 15000 }); // pooler round-trips can eat seconds; default 5s races them

    // Tell the seller someone is buying their car (fire-and-forget)
    notifyUser({
      userId: vehicle.seller.user.id,
      type: 'PURCHASE_NEW_ORDER',
      title: method === 'CASH' ? 'Your car is reserved' : 'A buyer is paying for your car',
      body: `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${GHS(amount)}${method === 'CASH' ? ' · Cash at handover' : ''}`,
      data: { path: `/purchases/${purchase.id}`, purchaseId: purchase.id },
    });

    if (method === 'CASH') {
      // Cash orders don't need Paystack; surface the hold state immediately.
      return res.status(201).json({ purchase, escrow: false });
    }

    res.status(201).json({ purchase, escrow: true });
  } catch (error) {
    if (error.message === 'This vehicle is no longer available.') {
      return res.status(409).json({ message: error.message });
    }
    console.error('Error initiating purchase:', error);
    res.status(500).json({ message: 'Server error starting purchase' });
  }
};

// @desc    Initialize Paystack checkout for a purchase (returns authorization URL)
// @route   POST /api/purchases/:id/initialize
// @access  Private (Buyer, own)
const initializePurchasePayment = async (req, res) => {
  try {
    const purchaseId = parseInt(req.params.id, 10);
    const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) return res.status(404).json({ message: 'Purchase not found.' });
    if (purchase.buyerId !== req.user.id) {
      return res.status(403).json({ message: 'Not your purchase.' });
    }
    if (purchase.method !== 'PAYSTACK') {
      return res.status(400).json({ message: 'This purchase is cash-on-handover; no online payment needed.' });
    }
    if (purchase.status === 'PAID_HELD' || purchase.status === 'COMPLETED') {
      return res.status(400).json({ message: 'This purchase is already paid.' });
    }

    const callbackUrl = req.body?.callbackUrl
      || process.env.PURCHASE_CALLBACK_URL
      || `${req.protocol}://${req.get('host')}/purchases/${purchase.id}/callback`;

    const init = await initializeTransaction({
      email: req.user.email,
      amountGhs: purchase.amount / 100,
      reference: purchase.reference,
      callbackUrl,
      metadata: {
        purchaseId: purchase.id,
        buyerId: purchase.buyerId,
        vehicleId: purchase.vehicleId,
      },
    });

    res.json({
      authorizationUrl: init.authorization_url,
      accessCode: init.access_code,
      reference: init.reference,
    });
  } catch (error) {
    console.error('Error initializing purchase payment:', error);
    res.status(500).json({ message: error.message || 'Server error initializing payment' });
  }
};

// @desc    Verify a purchase payment server-side (Paystack callback fallback)
// @route   GET /api/purchases/:id/verify
// @access  Private (Buyer, own)
const verifyPurchase = async (req, res) => {
  try {
    const purchaseId = parseInt(req.params.id, 10);
    const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) return res.status(404).json({ message: 'Purchase not found.' });
    if (purchase.buyerId !== req.user.id) {
      return res.status(403).json({ message: 'Not your purchase.' });
    }

    // Idempotent: already escrowed/completed just returns the state
    if (purchase.status === 'PAID_HELD' || purchase.status === 'COMPLETED' || purchase.status === 'DELIVERED') {
      return res.json({ status: 'success', purchase });
    }

    const result = await verifyTransaction(purchase.reference);
    if (result.status !== 'success') {
      return res.json({ status: result.status || 'pending', purchase });
    }
    if (result.amount < purchase.amount) {
      return res.status(400).json({ message: 'Amount paid does not match the vehicle price.', status: 'amount_mismatch' });
    }

    const updated = await applyVerifiedPurchase(purchase, { channel: result.channel });
    if (!updated) {
      return res.json({ status: 'conflict', purchase, message: 'Purchase is no longer awaiting payment.' });
    }

    // Side effects: seller notified (in-app), buyer gets email receipt,
    // admins alerted to watch the escrow (all fire-and-forget)
    const [sellerRow, buyerRow, vehicleRow] = await Promise.all([
      prisma.sellerProfile.findUnique({ where: { id: updated.sellerId }, include: { user: { select: { id: true, name: true } } } }),
      prisma.user.findUnique({ where: { id: updated.buyerId }, select: { id: true, name: true, email: true } }),
      prisma.vehicle.findUnique({ where: { id: updated.vehicleId }, select: { year: true, make: true, model: true } }),
    ]);
    if (sellerRow) {
      notifyUser({
        userId: sellerRow.user.id,
        type: 'PURCHASE_PAID',
        title: 'Payment received for your car',
        body: `${vehicleRow ? `${vehicleRow.year} ${vehicleRow.make} ${vehicleRow.model}` : 'Your listing'} · ${GHS(updated.amount)} is in escrow. Hand the car over when the buyer confirms.`,
        data: { path: `/purchases/${updated.id}`, purchaseId: updated.id },
      });
    }
    if (buyerRow && vehicleRow) sendReceiptEmail(updated, vehicleRow, buyerRow);

    notifyAdmins({
      type: 'ADMIN_PURCHASE_PAID',
      title: 'Buyer paid: money in escrow',
      body: `Purch ${updated.reference} ${GHS(updated.amount)} · vehicle #${updated.vehicleId}`,
      senderId: req.user.id,
      data: { path: '/admin?tab=purchases', purchaseId: updated.id },
    }).catch((e) => console.error('Admin purchase-paid notify failed:', e.message));

    res.json({ status: 'success', purchase: updated });
  } catch (error) {
    console.error('Error verifying purchase:', error);
    res.status(500).json({ message: error.message || 'Server error verifying purchase' });
  }
};

// @desc    Buyer confirms they received the vehicle (PAID_HELD -> COMPLETED)
// @route   POST /api/purchases/:id/confirm-received
// @access  Private (Buyer, own)
const confirmReceived = async (req, res) => {
  try {
    const purchaseId = parseInt(req.params.id, 10);
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { vehicle: { select: { id: true } } },
    });
    if (!purchase) return res.status(404).json({ message: 'Purchase not found.' });
    if (purchase.buyerId !== req.user.id) {
      return res.status(403).json({ message: 'Not your purchase.' });
    }
    if (purchase.method !== 'PAYSTACK') {
      return res.status(400).json({ message: 'Cash orders confirm via the seller handover flow.' });
    }
    if (purchase.status !== 'PAID_HELD') {
      return res.status(400).json({ message: `Cannot confirm receipt from status ${purchase.status}.` });
    }

    const updated = await prisma.$transaction((tx) => completePurchase(tx, purchase, { vehicle: purchase.vehicle }));
    if (!updated) {
      return res.json({ status: 'already-completed', purchase });
    }

    // Notify the seller their payout is queued (fire-and-forget)
    const seller = await prisma.sellerProfile.findUnique({ where: { id: purchase.sellerId } });
    if (seller) {
      notifyUser({
        userId: seller.userId,
        type: 'PURCHASE_COMPLETED',
        title: 'Sale confirmed — payout queued',
        body: `Order ${updated.reference} (${GHS(updated.amount)}) confirmed received. You'll receive ${GHS(updated.amount - commissionFor(updated))} after the ${updated.commissionBps / 100}% platform fee.`,
        data: { path: `/purchases/${updated.id}`, purchaseId: updated.id },
      });
    }

    res.json({ status: 'success', purchase: updated });
  } catch (error) {
    console.error('Error confirming receipt:', error);
    res.status(500).json({ message: 'Server error confirming receipt' });
  }
};

// @desc    Buyer confirms they took the vehicle (CASH: HANDOVER_PENDING -> DELIVERED)
// @route   POST /api/purchases/:id/confirm-handover
// @access  Private (Buyer, own)
const confirmHandover = async (req, res) => {
  try {
    const purchaseId = parseInt(req.params.id, 10);
    const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) return res.status(404).json({ message: 'Purchase not found.' });
    if (purchase.buyerId !== req.user.id) {
      return res.status(403).json({ message: 'Not your purchase.' });
    }
    if (purchase.method !== 'CASH') {
      return res.status(400).json({ message: 'Only cash orders use the handover flow.' });
    }
    if (purchase.status !== 'HANDOVER_PENDING') {
      return res.status(400).json({ message: `Cannot confirm handover from status ${purchase.status}.` });
    }

    const updated = await prisma.purchase.update({
      where: { id: purchaseId },
      data: { status: 'DELIVERED', completedAt: new Date() }, // handed over; cash collection still pending
    });
    res.json({ status: 'success', purchase: updated });
  } catch (error) {
    console.error('Error confirming handover:', error);
    res.status(500).json({ message: 'Server error confirming handover' });
  }
};

// @desc    Seller confirms cash was collected (CASH: DELIVERED -> COMPLETED)
// @route   POST /api/purchases/:id/seller-collected
// @access  Private (Seller, own)
const sellerCollected = async (req, res) => {
  try {
    const purchaseId = parseInt(req.params.id, 10);
    const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) return res.status(404).json({ message: 'Purchase not found.' });

    const seller = await resolveSellerProfile(req.user.id);
    if (!seller || purchase.sellerId !== seller.id) {
      return res.status(403).json({ message: 'Not your sale.' });
    }
    if (purchase.method !== 'CASH') {
      return res.status(400).json({ message: 'Only cash orders use the collection flow.' });
    }
    if (purchase.status !== 'DELIVERED') {
      return res.status(400).json({ message: `Cannot confirm collection from status ${purchase.status}.` });
    }

    const updated = await prisma.$transaction((tx) => completePurchase(tx, purchase));
    if (!updated) {
      return res.json({ status: 'already-completed', purchase });
    }
    res.json({ status: 'success', purchase: updated });
  } catch (error) {
    console.error('Error confirming collection:', error);
    res.status(500).json({ message: 'Server error confirming collection' });
  }
};

// @desc    Cancel a purchase (releases the reserved vehicle)
// @route   POST /api/purchases/:id/cancel
// @access  Private (Buyer or Seller of the order)
const cancelPurchase = async (req, res) => {
  try {
    const purchaseId = parseInt(req.params.id, 10);
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: { seller: true },
    });
    if (!purchase) return res.status(404).json({ message: 'Purchase not found.' });

    const seller = await resolveSellerProfile(req.user.id);
    const isBuyer = purchase.buyerId === req.user.id;
    const isSeller = seller && purchase.sellerId === seller.id;
    if (!isBuyer && !isSeller) {
      return res.status(403).json({ message: 'Not your purchase.' });
    }

    if (!['AWAITING_PAYMENT', 'HANDOVER_PENDING', 'PAID_HELD', 'DELIVERED'].includes(purchase.status)) {
      return res.status(400).json({ message: `Cannot cancel from status ${purchase.status}.` });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const claim = await tx.purchase.updateMany({
        where: { id: purchase.id, status: { in: ['AWAITING_PAYMENT', 'HANDOVER_PENDING', 'PAID_HELD', 'DELIVERED'] } },
        data: { status: 'CANCELLED', completedAt: new Date() },
      });
      if (claim.count === 0) return null;

      // Free the vehicle for other buyers again
      await tx.vehicle.update({
        where: { id: purchase.vehicleId },
        data: { status: 'AVAILABLE' },
      }).catch((e) => console.warn('Purchase cancel: vehicle free skipped:', e.message));

      return tx.purchase.findUnique({ where: { id: purchase.id } });
    });

    if (!updated) {
      return res.json({ status: 'already-cancelled', purchase });
    }
    res.json({ status: 'success', purchase: updated });
  } catch (error) {
    console.error('Error cancelling purchase:', error);
    res.status(500).json({ message: 'Server error cancelling purchase' });
  }
};

// @desc    List purchases: orders as buyer + sales as seller (sellers wear both hats)
// @route   GET /api/purchases
// @access  Private
const listPurchases = async (req, res) => {
  try {
    const seller = await resolveSellerProfile(req.user.id);

    const purchases = await prisma.purchase.findMany({
      where: { buyerId: req.user.id },
      include: { vehicle: VEHICLE_INCLUDE },
      orderBy: { createdAt: 'desc' },
    });

    let sales = [];
    if (seller) {
      sales = await prisma.purchase.findMany({
        where: { sellerId: seller.id },
        include: { vehicle: VEHICLE_INCLUDE },
        orderBy: { createdAt: 'desc' },
      });
    }

    res.json({ purchases, sales });
  } catch (error) {
    console.error('Error listing purchases:', error);
    res.status(500).json({ message: 'Server error listing purchases' });
  }
};

// @desc    Single purchase detail (buyer/seller/admin only)
// @route   GET /api/purchases/:id
// @access  Private
const getPurchase = async (req, res) => {
  try {
    const result = await loadOwnedPurchase(req, req.params.id);
    if (result.status) return res.status(result.status).json(result.body);
    res.json({ purchase: result.purchase });
  } catch (error) {
    console.error('Error fetching purchase:', error);
    res.status(500).json({ message: 'Server error fetching purchase' });
  }
};

module.exports = {
  initiatePurchase,
  initializePurchasePayment,
  verifyPurchase,
  confirmReceived,
  confirmHandover,
  sellerCollected,
  cancelPurchase,
  listPurchases,
  getPurchase,

  // Exported for the webhook + tests
  applyVerifiedPurchase,
  resolveSellerProfile,
};
