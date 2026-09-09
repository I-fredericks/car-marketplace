const request = require('supertest');
const app = require('../src/index');

// Paystack is mocked: checkout URLs + verify results are deterministic and no
// real HTTP calls leave the suite. The escrow state machine itself runs
// against the live test database (carmarket_test), same as lifecycle.test.js.
jest.mock('../src/services/paystack', () => ({
  initializeTransaction: jest.fn(async (args) => ({
    authorization_url: 'https://paystack.test/checkout',
    access_code: 'ac_test',
    reference: args.reference,
  })),
  verifyTransaction: jest.fn(async () => ({
    status: 'success',
    amount: 0,
    channel: 'mobile_money',
  })),
}));
const { verifyTransaction } = require('../src/services/paystack');

// Receipt emails are asserted (not actually sent): capture sendMail calls.
jest.mock('../src/services/mailer', () => ({
  ...jest.requireActual('../src/services/mailer'),
  sendMail: jest.fn().mockResolvedValue(true),
}));
const { sendMail } = require('../src/services/mailer');

// Free-tier sellers are limited to ONE active listing, so each purchase flow
// needs its own seller (same split as lifecycle.test.js).
const run = Date.now();
const sellerCash = { email: `buy-seller-cash-${run}@example.com`, password: 'password123', name: 'Cash Seller' };
const sellerPay = { email: `buy-seller-pay-${run}@example.com`, password: 'password123', name: 'Pay Seller' };
const sellerCancel = { email: `buy-seller-cancel-${run}@example.com`, password: 'password123', name: 'Cancel Seller' };
const buyer = { email: `buy-buyer-${run}@example.com`, password: 'password123', name: 'Test Buyer' };
const stranger = { email: `buy-stranger-${run}@example.com`, password: 'password123', name: 'Stranger' };
const admin = { email: `buy-admin-${run}@example.com`, password: 'password123', name: 'Test Admin' };
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const tokens = {};
const ids = {};

const registerAndVerify = async (body) => {
  const res = await request(app).post('/api/auth/register').send(body);
  if (res.statusCode !== 201) return res.statusCode;
  const confirmed = await request(app)
    .get('/api/auth/verify-email')
    .query({ token: res.body.devVerificationToken });
  return confirmed.statusCode === 200 ? 201 : confirmed.statusCode;
};
const login = (email, password) =>
  request(app).post('/api/auth/login').send({ email, password });

/** Register seller, create a listing, promote admin if needed, approve -> AVAILABLE */
const makeLiveVehicle = async (seller, vehicleBody, adminToken) => {
  const token = (await login(seller.email, seller.password)).body.token;
  const created = await request(app)
    .post('/api/vehicles')
    .set('Authorization', `Bearer ${token}`)
    .send(vehicleBody);
  expect(created.statusCode).toEqual(201);
  const approve = await request(app)
    .put(`/api/admin/vehicles/${created.body.id}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'AVAILABLE' });
  expect(approve.statusCode).toEqual(200);
  return { token, vehicle: created.body };
};

describe('Vehicle purchase (escrow checkout)', () => {
  it('registers participants (three sellers, two buyers, one admin)', async () => {
    expect(await registerAndVerify({ ...sellerCash, role: 'SELLER', sellerType: 'PRIVATE' })).toEqual(201);
    expect(await registerAndVerify({ ...sellerPay, role: 'SELLER', sellerType: 'PRIVATE' })).toEqual(201);
    expect(await registerAndVerify({ ...sellerCancel, role: 'SELLER', sellerType: 'PRIVATE' })).toEqual(201);
    expect(await registerAndVerify({ ...buyer, role: 'BUYER' })).toEqual(201);
    expect(await registerAndVerify({ ...stranger, role: 'BUYER' })).toEqual(201);
    expect(await registerAndVerify({ ...admin, role: 'BUYER' })).toEqual(201);

    const prisma = require('./_db');
    try {
      await prisma.user.update({ where: { email: admin.email }, data: { role: 'ADMIN' } });
    } finally {
      
    }

    tokens.buyer = (await login(buyer.email, buyer.password)).body.token;
    tokens.stranger = (await login(stranger.email, stranger.password)).body.token;
    const staffLogin = await request(app)
      .post('/api/auth/admin-login')
      .send({ email: admin.email, password: admin.password });
    tokens.admin = (await request(app)
      .post('/api/auth/admin-verify')
      .send({ email: admin.email, code: staffLogin.body.devAdminCode })).body.token;
    expect(tokens.buyer).toBeDefined();
    expect(tokens.admin).toBeDefined();
  });

  it('approves the cash-flow listing (Camry)', async () => {
    const cash = await makeLiveVehicle(sellerCash, {
      make: 'Toyota', model: 'Camry', year: 2021, price: 120000,
      location: 'Accra', images: [{ data: PNG_1PX, isPrimary: true }],
    }, tokens.admin);
    tokens.sellerCash = cash.token; ids.vehicleCash = cash.vehicle.id;
    expect(tokens.sellerCash).toBeDefined();
  });

  it('approves the paystack-flow listing (Accord)', async () => {
    const pay = await makeLiveVehicle(sellerPay, {
      make: 'Honda', model: 'Accord', year: 2020, price: 95000,
      location: 'Kumasi', images: [{ data: PNG_1PX, isPrimary: true }],
    }, tokens.admin);
    tokens.sellerPay = pay.token; ids.vehiclePay = pay.vehicle.id;
    expect(tokens.sellerPay).toBeDefined();
  });

  it('approves the cancel-flow listing (Altima)', async () => {
    const cancel = await makeLiveVehicle(sellerCancel, {
      make: 'Nissan', model: 'Altima', year: 2022, price: 110000,
      location: 'Tema', images: [{ data: PNG_1PX, isPrimary: true }],
    }, tokens.admin);
    tokens.sellerCancel = cancel.token; ids.vehicleCancel = cancel.vehicle.id;
    expect(tokens.sellerCancel).toBeDefined();
  });

  // ── Cash flow: HANDOVER_PENDING -> DELIVERED -> COMPLETED ──────────────
  it('cash purchase starts HANDOVER_PENDING and reserves the vehicle', async () => {
    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({
        vehicleId: ids.vehicleCash, method: 'CASH', deliveryMode: 'DELIVERY',
        address: 'Osu, Accra', phone: '0244000111',
      });
    expect(res.statusCode).toEqual(201);
    expect(res.body.purchase.status).toEqual('HANDOVER_PENDING');
    expect(res.body.purchase.amount).toEqual(12000000); // 120k GHS in pesewas
    expect(res.body.purchase.method).toEqual('CASH');
    expect(res.body.purchase.commissionBps).toEqual(100); // 1% platform fee snapshot
    ids.cashPurchase = res.body.purchase.id;

    // Seller gets a new-order notification with a link to the order.
    // Notifications are emitted fire-and-forget, so poll briefly (pooler
    // latency varies run to run).
    let hasNewOrderNote = false;
    for (let attempt = 0; attempt < 5 && !hasNewOrderNote; attempt += 1) {
      const notes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokens.sellerCash}`);
      hasNewOrderNote = notes.body.notifications.some((n) => n.type === 'PURCHASE_NEW_ORDER');
      if (!hasNewOrderNote) await new Promise((r) => setTimeout(r, 400));
    }
    expect(hasNewOrderNote).toBe(true);

    const prisma = require('./_db');
    try {
      const v = await prisma.vehicle.findUnique({ where: { id: ids.vehicleCash } });
      expect(v.status).toEqual('RESERVED');
    } finally {
      
    }
  });

  it('blocks second checkout on a reserved vehicle', async () => {
    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${tokens.stranger}`)
      .send({ vehicleId: ids.vehicleCash, method: 'CASH', deliveryMode: 'PICKUP' });
    expect(res.statusCode).toEqual(409);
  });

  it('rejects invalid input and self-purchases', async () => {
    const badMethod = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ vehicleId: ids.vehiclePay, method: 'BITCOIN', deliveryMode: 'PICKUP' });
    expect(badMethod.statusCode).toEqual(400);

    const badDelivery = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ vehicleId: ids.vehiclePay, method: 'CASH', deliveryMode: 'TELEPORT' });
    expect(badDelivery.statusCode).toEqual(400);

    const selfBuy = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${tokens.sellerPay}`)
      .send({ vehicleId: ids.vehiclePay, method: 'CASH', deliveryMode: 'PICKUP' });
    expect(selfBuy.statusCode).toEqual(400);
  });

  it('gates purchase detail to buyer/seller/admin', async () => {
    const stranger = await request(app)
      .get(`/api/purchases/${ids.cashPurchase}`)
      .set('Authorization', `Bearer ${tokens.stranger}`);
    expect(stranger.statusCode).toEqual(403);

    for (const token of [tokens.buyer, tokens.sellerCash, tokens.admin]) {
      const res = await request(app)
        .get(`/api/purchases/${ids.cashPurchase}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.purchase.id).toEqual(ids.cashPurchase);
    }

    expect((await request(app).get(`/api/purchases/${ids.cashPurchase}`)).statusCode).toEqual(401);
  });

  it('buyer confirms handover, seller confirms cash, vehicle flips to SOLD', async () => {
    // Out-of-order attempts first
    expect((await request(app)
      .post(`/api/purchases/${ids.cashPurchase}/seller-collected`)
      .set('Authorization', `Bearer ${tokens.sellerCash}`)).statusCode).toEqual(400);

    const handover = await request(app)
      .post(`/api/purchases/${ids.cashPurchase}/confirm-handover`)
      .set('Authorization', `Bearer ${tokens.buyer}`);
    expect(handover.statusCode).toEqual(200);
    expect(handover.body.purchase.status).toEqual('DELIVERED');

    // Buyer cannot claim the cash-collection step
    expect((await request(app)
      .post(`/api/purchases/${ids.cashPurchase}/seller-collected`)
      .set('Authorization', `Bearer ${tokens.buyer}`)).statusCode).toEqual(403);

    const collected = await request(app)
      .post(`/api/purchases/${ids.cashPurchase}/seller-collected`)
      .set('Authorization', `Bearer ${tokens.sellerCash}`);
    expect(collected.statusCode).toEqual(200);
    expect(collected.body.purchase.status).toEqual('COMPLETED');

    const prisma = require('./_db');
    try {
      const v = await prisma.vehicle.findUnique({ where: { id: ids.vehicleCash } });
      expect(v.status).toEqual('SOLD');
      const p = await prisma.purchase.findUnique({ where: { id: ids.cashPurchase } });
      expect(p.completedAt).not.toBeNull();
    } finally {
      
    }
  });

  // ── Transfer escrow flow: AWAITING_PAYMENT -> claim -> admin confirm -> PAID_HELD -> COMPLETED ──
  it('bank transfer order: claim, admin confirm, escrow, receipt completes', async () => {
    const initiated = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ vehicleId: ids.vehiclePay, method: 'BANK_TRANSFER', deliveryMode: 'PICKUP' });
    expect(initiated.statusCode).toEqual(201);
    expect(initiated.body.purchase.status).toEqual('AWAITING_PAYMENT');
    expect(initiated.body.escrow).toEqual(true);
    // Instructions ship with the order: platform accounts + match reference
    expect(initiated.body.paymentInstructions.reference).toEqual(initiated.body.purchase.reference);
    expect(initiated.body.paymentInstructions.bank.accountNumber).toBeDefined();
    expect(initiated.body.paymentInstructions.momo.number).toBeDefined();
    const purchase = initiated.body.purchase;
    ids.payPurchase = purchase.id;

    // The instructions endpoint echoes the same details (buyer-only)
    const instr = await request(app)
      .get(`/api/purchases/${purchase.id}/instructions`)
      .set('Authorization', `Bearer ${tokens.buyer}`);
    expect(instr.statusCode).toEqual(200);
    expect(instr.body.instructions.amountPesewas).toEqual(purchase.amount);
    expect((await request(app)
      .get(`/api/purchases/${purchase.id}/instructions`)
      .set('Authorization', `Bearer ${tokens.stranger}`)).statusCode).toEqual(403);

    // Claims require a real-looking reference
    expect((await request(app)
      .post(`/api/purchases/${purchase.id}/claim-payment`)
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ paymentRef: 'ab' })).statusCode).toEqual(400);

    // Buyer reports the transfer sent
    const claimed = await request(app)
      .post(`/api/purchases/${purchase.id}/claim-payment`)
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ paymentRef: 'TRF-998877', payerName: 'Test Buyer' });
    expect(claimed.statusCode).toEqual(200);
    expect(claimed.body.purchase.claimedAt).not.toBeNull();
    expect(claimed.body.purchase.paymentRef).toEqual('TRF-998877');

    // Only admins confirm receipt of funds
    expect((await request(app)
      .put(`/api/admin/purchases/${purchase.id}/verify-payment`)
      .set('Authorization', `Bearer ${tokens.buyer}`)).statusCode).toEqual(403);

    const verified = await request(app)
      .put(`/api/admin/purchases/${purchase.id}/verify-payment`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({});
    expect(verified.statusCode).toEqual(200);
    expect(verified.body.purchase.status).toEqual('PAID_HELD');
    expect(verified.body.purchase.channel).toEqual('bank_transfer');
    expect(verified.body.purchase.paidAt).not.toBeNull();

    // Double-confirm is a safe no-op (idempotent)
    expect((await request(app)
      .put(`/api/admin/purchases/${purchase.id}/verify-payment`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({})).statusCode).toEqual(400);

    // Buyer got exactly one receipt email
    let buyerEmails = [];
    for (let i = 0; i < 5 && buyerEmails.length === 0; i += 1) {
      buyerEmails = sendMail.mock.calls.filter(([args]) => args.to === buyer.email);
      if (buyerEmails.length === 0) await new Promise((r) => setTimeout(r, 400));
    }
    expect(buyerEmails.length).toEqual(1);
    expect(buyerEmails[0][0].subject).toContain(purchase.reference);
    expect(buyerEmails[0][0].html).toContain(`/purchases/${purchase.id}/receipt`);

    // Seller got an in-app "money in escrow" ping too
    let escrowNotified = false;
    for (let i = 0; i < 5 && !escrowNotified; i += 1) {
      const notes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokens.sellerPay}`);
      escrowNotified = notes.body.notifications.some((n) => n.type === 'PURCHASE_PAID');
      if (!escrowNotified) await new Promise((r) => setTimeout(r, 400));
    }
    expect(escrowNotified).toBe(true);

    // ── Handover step: seller marks, buyer confirms ──
    // Wrong roles/statuses are fenced out
    expect((await request(app)
      .post(`/api/purchases/${purchase.id}/seller-handover`)
      .set('Authorization', `Bearer ${tokens.buyer}`)).statusCode).toEqual(403);
    expect((await request(app)
      .post(`/api/purchases/${ids.cashPurchase}/seller-handover`)
      .set('Authorization', `Bearer ${tokens.sellerCash}`)).statusCode).toEqual(400);

    const handover = await request(app)
      .post(`/api/purchases/${purchase.id}/seller-handover`)
      .set('Authorization', `Bearer ${tokens.sellerPay}`);
    expect(handover.statusCode).toEqual(200);
    expect(handover.body.purchase.sellerHandoverAt).not.toBeNull();

    // Idempotent: marking again is a safe no-op
    expect((await request(app)
      .post(`/api/purchases/${purchase.id}/seller-handover`)
      .set('Authorization', `Bearer ${tokens.sellerPay}`)).body.status).toEqual('already-marked');

    // Buyer is told to confirm receipt
    let handoverNotified = false;
    for (let i = 0; i < 5 && !handoverNotified; i += 1) {
      const notes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokens.buyer}`);
      handoverNotified = notes.body.notifications.some((n) => n.type === 'PURCHASE_HANDOVER_MARKED');
      if (!handoverNotified) await new Promise((r) => setTimeout(r, 400));
    }
    expect(handoverNotified).toBe(true);

    // Buyer confirms receipt -> COMPLETED + payout queued for admin payout
    const received = await request(app)
      .post(`/api/purchases/${purchase.id}/confirm-received`)
      .set('Authorization', `Bearer ${tokens.buyer}`);
    expect(received.statusCode).toEqual(200);
    expect(received.body.purchase.status).toEqual('COMPLETED');
    expect(received.body.purchase.payoutStatus).toEqual('PENDING');

    const prisma = require('./_db');
    try {
      const v = await prisma.vehicle.findUnique({ where: { id: ids.vehiclePay } });
      expect(v.status).toEqual('SOLD');
    } finally {
      
    }
  });

  it('rejected claim clears it and tells the buyer; PAYSTACK rejected at checkout', async () => {
    // The card gateway is listing-plans-only now
    expect((await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ vehicleId: ids.vehicleCancel, method: 'PAYSTACK', deliveryMode: 'PICKUP' })).statusCode).toEqual(400);

    const initiated = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ vehicleId: ids.vehicleCancel, method: 'MOMO', deliveryMode: 'PICKUP' });
    expect(initiated.statusCode).toEqual(201);
    const purchase = initiated.body.purchase;

    // Claim, admin can't find the transfer -> reject clears the claim
    expect((await request(app)
      .post(`/api/purchases/${purchase.id}/claim-payment`)
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ paymentRef: 'WRONG-REF-1' })).statusCode).toEqual(200);
    expect((await request(app)
      .put(`/api/admin/purchases/${purchase.id}/reject-payment`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ reason: 'no matching credit' })).statusCode).toEqual(200);

    const prisma = require('./_db');
    try {
      const p = await prisma.purchase.findUnique({ where: { id: purchase.id } });
      expect(p.status).toEqual('AWAITING_PAYMENT'); // still waiting
      expect(p.paymentRef).toBeNull();
      expect(p.claimedAt).toBeNull();
    } finally {
    }

    // Buyer is told why
    let notified = false;
    for (let i = 0; i < 5 && !notified; i += 1) {
      const notes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokens.buyer}`);
      notified = notes.body.notifications.some((n) => n.type === 'PURCHASE_PAYMENT_REJECTED');
      if (!notified) await new Promise((r) => setTimeout(r, 400));
    }
    expect(notified).toBe(true);
  });

  it('cancelling frees the vehicle for other buyers', async () => {
    // Hook: stranger tries to steal mid-flow and still gets 409
    expect((await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${tokens.stranger}`)
      .send({ vehicleId: ids.vehicleCancel, method: 'CASH', deliveryMode: 'PICKUP' })).statusCode).toEqual(409);

    const list = await request(app)
      .get('/api/purchases')
      .set('Authorization', `Bearer ${tokens.buyer}`);
    const open = list.body.purchases.find((p) => p.vehicleId === ids.vehicleCancel && p.status === 'AWAITING_PAYMENT');
    expect(open).toBeDefined();

    const cancelled = await request(app)
      .post(`/api/purchases/${open.id}/cancel`)
      .set('Authorization', `Bearer ${tokens.buyer}`);
    expect(cancelled.statusCode).toEqual(200);
    expect(cancelled.body.purchase.status).toEqual('CANCELLED');

    // Vehicle is AVAILABLE again publicly
    const pub = await request(app).get(`/api/vehicles/${ids.vehicleCancel}`);
    expect(pub.statusCode).toEqual(200);

    // A fresh checkout now succeeds
    const retry = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${tokens.stranger}`)
      .send({ vehicleId: ids.vehicleCancel, method: 'CASH', deliveryMode: 'PICKUP' });
    expect(retry.statusCode).toEqual(201);
    expect(retry.body.purchase.status).toEqual('HANDOVER_PENDING');
  });

  it('admins list purchases and release the escrow payout', async () => {
    // Non-admin cannot touch the admin purchase queue
    expect((await request(app)
      .get('/api/admin/purchases')
      .set('Authorization', `Bearer ${tokens.buyer}`)).statusCode).toEqual(403);

    const list = await request(app)
      .get('/api/admin/purchases')
      .set('Authorization', `Bearer ${tokens.admin}`);
    expect(list.statusCode).toEqual(200);
    const escrowSale = list.body.find((p) => p.id === ids.payPurchase);
    expect(escrowSale).toBeDefined();
    expect(escrowSale.payoutStatus).toEqual('PENDING');
    expect(escrowSale.seller?.user?.name).toEqual('Pay Seller');
    // Commission + payout breakdown ships with each row
    expect(escrowSale.commissionBps).toEqual(100);
    expect(escrowSale.commission).toEqual(Math.round((escrowSale.amount * 100) / 10000));
    expect(escrowSale.payoutAmount).toEqual(escrowSale.amount - escrowSale.commission);

    // Cash orders carry no payout (PENDING-only releases)
    const cashOrder = list.body.find((p) => p.id === ids.cashPurchase);
    expect(cashOrder).toBeDefined();
    expect(cashOrder.payoutStatus).toEqual('NONE');
    expect((await request(app)
      .put(`/api/admin/purchases/${ids.cashPurchase}/release-payout`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({})).statusCode).toEqual(400);

    // Release the escrow payout with a transfer reference
    const released = await request(app)
      .put(`/api/admin/purchases/${ids.payPurchase}/release-payout`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ payoutRef: 'TRX-2026-0001' });
    expect(released.statusCode).toEqual(200);
    expect(released.body.purchase.payoutStatus).toEqual('SENT');
    expect(released.body.purchase.payoutRef).toEqual('TRX-2026-0001');

    // Re-release is blocked (idempotency guard)
    expect((await request(app)
      .put(`/api/admin/purchases/${ids.payPurchase}/release-payout`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({})).statusCode).toEqual(400);

    // Audit trail records the release
    const audit = await request(app)
      .get('/api/admin/audit-logs?action=PURCHASE.RELEASE_PAYOUT')
      .set('Authorization', `Bearer ${tokens.admin}`);
    expect(audit.statusCode).toEqual(200);
    expect(audit.body.logs.some((l) => l.entityId === ids.payPurchase)).toBe(true);
  });

  it('seller sees their sales and the purchase list is scoped', async () => {
    const sales = await request(app)
      .get('/api/purchases')
      .set('Authorization', `Bearer ${tokens.sellerCash}`);
    expect(sales.statusCode).toEqual(200);
    expect(sales.body.purchases.length).toEqual(0); // never bought anything
    expect(sales.body.sales.length).toEqual(1);
    expect(sales.body.sales[0].status).toEqual('COMPLETED');

    const buyerList = await request(app)
      .get('/api/purchases')
      .set('Authorization', `Bearer ${tokens.buyer}`);
    expect(buyerList.statusCode).toEqual(200);
    const statuses = buyerList.body.purchases.map((p) => p.status);
    expect(statuses).toContain('COMPLETED');
    expect(statuses).toContain('CANCELLED');
  });

  // ── Buyer protection: dispute freezes escrow; admin refunds or releases ──
  it('dispute lifecycle: open freezes, admin resolves with refund, car returns to sale', async () => {
    // Fresh listing (the pay vehicle is SOLD by now)
    const created = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${tokens.sellerPay}`)
      .send({
        make: 'Mazda', model: 'CX-5', year: 2022, price: 300000,
        location: 'Accra', images: [{ data: PNG_1PX, isPrimary: true }],
      });
    expect(created.statusCode).toEqual(201);
    const disputeVehicle = created.body.id;
    await request(app)
      .put(`/api/admin/vehicles/${disputeVehicle}/status`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ status: 'AVAILABLE' });

    const order = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ vehicleId: disputeVehicle, method: 'MOMO', deliveryMode: 'PICKUP' });
    expect(order.statusCode).toEqual(201);
    const disputePurchase = order.body.purchase.id;

    await request(app)
      .post(`/api/purchases/${disputePurchase}/claim-payment`)
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ paymentRef: 'TRF-DISPUTE-1' });
    expect((await request(app)
      .put(`/api/admin/purchases/${disputePurchase}/verify-payment`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({})).statusCode).toEqual(200);

    // Guards: strangers can't dispute; thin reasons rejected
    expect((await request(app)
      .post(`/api/purchases/${disputePurchase}/open-dispute`)
      .set('Authorization', `Bearer ${tokens.stranger}`)
      .send({ reason: 'not my order at all here' })).statusCode).toEqual(403);
    expect((await request(app)
      .post(`/api/purchases/${disputePurchase}/open-dispute`)
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ reason: 'bad' })).statusCode).toEqual(400);

    // Buyer opens a real dispute
    const disputed = await request(app)
      .post(`/api/purchases/${disputePurchase}/open-dispute`)
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ reason: 'Seller delivered a different car than the listing described.' });
    expect(disputed.statusCode).toEqual(200);
    expect(disputed.body.purchase.disputeStatus).toEqual('OPEN');

    // Frozen: confirm-received and cancel are both blocked while OPEN
    expect((await request(app)
      .post(`/api/purchases/${disputePurchase}/confirm-received`)
      .set('Authorization', `Bearer ${tokens.buyer}`)).statusCode).toEqual(400);
    expect((await request(app)
      .post(`/api/purchases/${disputePurchase}/cancel`)
      .set('Authorization', `Bearer ${tokens.buyer}`)).statusCode).toEqual(400);

    // Admin queue surfaces the dispute on top
    const queue = await request(app)
      .get('/api/admin/purchases')
      .set('Authorization', `Bearer ${tokens.admin}`);
    expect(queue.body[0].id).toEqual(disputePurchase);

    // Resolution must be a valid outcome
    expect((await request(app)
      .put(`/api/admin/purchases/${disputePurchase}/resolve-dispute`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ outcome: 'FLIP_A_COIN' })).statusCode).toEqual(400);

    // Refund the buyer: order REFUNDED, car back on sale
    const refunded = await request(app)
      .put(`/api/admin/purchases/${disputePurchase}/resolve-dispute`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ outcome: 'REFUND_BUYER', note: 'listing mismatch confirmed' });
    expect(refunded.statusCode).toEqual(200);
    expect(refunded.body.purchase.status).toEqual('REFUNDED');
    expect(refunded.body.purchase.disputeStatus).toEqual('RESOLVED_BUYER');

    const prisma = require('./_db');
    try {
      const v = await prisma.vehicle.findUnique({ where: { id: disputeVehicle } });
      expect(v.status).toEqual('AVAILABLE');
    } finally {
    }

    // Both parties hear the verdict
    let verdict = false;
    for (let i = 0; i < 5 && !verdict; i += 1) {
      const notes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokens.buyer}`);
      verdict = notes.body.notifications.some((n) => n.type === 'PURCHASE_DISPUTE_REFUNDED');
      if (!verdict) await new Promise((r) => setTimeout(r, 400));
    }
    expect(verdict).toBe(true);
  }, 90000);

  it('dispute resolution can release funds to the seller instead', async () => {
    // Reuse the refunded vehicle: it's AVAILABLE again
    const prisma = require('./_db');
    let vehicleId;
    try {
      const v = await prisma.vehicle.findFirst({ where: { make: 'Mazda', model: 'CX-5' }, orderBy: { id: 'desc' } });
      vehicleId = v.id;
    } finally {
    }

    const order = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${tokens.stranger}`)
      .send({ vehicleId, method: 'BANK_TRANSFER', deliveryMode: 'PICKUP' });
    expect(order.statusCode).toEqual(201);
    const pid = order.body.purchase.id;
    await request(app)
      .post(`/api/purchases/${pid}/claim-payment`)
      .set('Authorization', `Bearer ${tokens.stranger}`)
      .send({ paymentRef: 'TRF-RELEASE-9' });
    await request(app)
      .put(`/api/admin/purchases/${pid}/verify-payment`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({});

    // Seller opens this one
    expect((await request(app)
      .post(`/api/purchases/${pid}/open-dispute`)
      .set('Authorization', `Bearer ${tokens.sellerPay}`)
      .send({ reason: 'Buyer collected the car and now refuses to confirm receipt.' })).statusCode).toEqual(200);

    const released = await request(app)
      .put(`/api/admin/purchases/${pid}/resolve-dispute`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ outcome: 'RELEASE_SELLER' });
    expect(released.statusCode).toEqual(200);
    expect(released.body.purchase.status).toEqual('COMPLETED');
    expect(released.body.purchase.disputeStatus).toEqual('RESOLVED_SELLER');
    expect(released.body.purchase.payoutStatus).toEqual('PENDING');

    try {
      const v = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
      expect(v.status).toEqual('SOLD');
    } finally {
    }

    // Double-resolution is fenced
    expect((await request(app)
      .put(`/api/admin/purchases/${pid}/resolve-dispute`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ outcome: 'REFUND_BUYER' })).statusCode).toEqual(400);
  });
});
