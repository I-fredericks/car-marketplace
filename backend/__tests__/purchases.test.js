const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
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

    const prisma = new PrismaClient();
    try {
      await prisma.user.update({ where: { email: admin.email }, data: { role: 'ADMIN' } });
    } finally {
      await prisma.$disconnect();
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
    ids.cashPurchase = res.body.purchase.id;

    const prisma = new PrismaClient();
    try {
      const v = await prisma.vehicle.findUnique({ where: { id: ids.vehicleCash } });
      expect(v.status).toEqual('RESERVED');
    } finally {
      await prisma.$disconnect();
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

    const prisma = new PrismaClient();
    try {
      const v = await prisma.vehicle.findUnique({ where: { id: ids.vehicleCash } });
      expect(v.status).toEqual('SOLD');
      const p = await prisma.purchase.findUnique({ where: { id: ids.cashPurchase } });
      expect(p.completedAt).not.toBeNull();
    } finally {
      await prisma.$disconnect();
    }
  });

  // ── Paystack escrow flow: AWAITING_PAYMENT -> PAID_HELD -> COMPLETED ──
  it('paystack purchase escrows on verify and completes on receipt', async () => {
    const initiated = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ vehicleId: ids.vehiclePay, method: 'PAYSTACK', deliveryMode: 'PICKUP' });
    expect(initiated.statusCode).toEqual(201);
    expect(initiated.body.purchase.status).toEqual('AWAITING_PAYMENT');
    expect(initiated.body.escrow).toEqual(true);
    const purchase = initiated.body.purchase;
    ids.payPurchase = purchase.id;

    // A cash order must not hit the Paystack init endpoint; this one can.
    const init = await request(app)
      .post(`/api/purchases/${purchase.id}/initialize`)
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({});
    expect(init.statusCode).toEqual(200);
    expect(init.body.authorizationUrl).toEqual('https://paystack.test/checkout');
    expect(init.body.reference).toEqual(purchase.reference);

    // Sellers/strangers cannot verify for the buyer
    expect((await request(app)
      .get(`/api/purchases/${purchase.id}/verify`)
      .set('Authorization', `Bearer ${tokens.stranger}`)).statusCode).toEqual(403);

    // Settle: Paystack reports the exact pesewas amount
    verifyTransaction.mockResolvedValueOnce({
      status: 'success',
      amount: purchase.amount,
      channel: 'mobile_money',
    });
    const verified = await request(app)
      .get(`/api/purchases/${purchase.id}/verify`)
      .set('Authorization', `Bearer ${tokens.buyer}`);
    expect(verified.statusCode).toEqual(200);
    expect(verified.body.status).toEqual('success');
    expect(verified.body.purchase.status).toEqual('PAID_HELD');
    expect(verified.body.purchase.channel).toEqual('mobile_money');

    // Double-verify is a safe no-op (idempotent)
    const again = await request(app)
      .get(`/api/purchases/${purchase.id}/verify`)
      .set('Authorization', `Bearer ${tokens.buyer}`);
    expect(again.statusCode).toEqual(200);
    expect(again.body.purchase.status).toEqual('PAID_HELD');

    // Buyer confirms receipt -> COMPLETED + payout queued for admin payout
    const received = await request(app)
      .post(`/api/purchases/${purchase.id}/confirm-received`)
      .set('Authorization', `Bearer ${tokens.buyer}`);
    expect(received.statusCode).toEqual(200);
    expect(received.body.purchase.status).toEqual('COMPLETED');
    expect(received.body.purchase.payoutStatus).toEqual('PENDING');

    const prisma = new PrismaClient();
    try {
      const v = await prisma.vehicle.findUnique({ where: { id: ids.vehiclePay } });
      expect(v.status).toEqual('SOLD');
    } finally {
      await prisma.$disconnect();
    }
  });

  it('rejects verify when Paystack reports too little money', async () => {
    const initiated = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ vehicleId: ids.vehicleCancel, method: 'PAYSTACK', deliveryMode: 'PICKUP' });
    expect(initiated.statusCode).toEqual(201);
    const purchase = initiated.body.purchase;

    verifyTransaction.mockResolvedValueOnce({
      status: 'success',
      amount: purchase.amount - 1, // 1 pesewa short
      channel: 'card',
    });
    const underpaid = await request(app)
      .get(`/api/purchases/${purchase.id}/verify`)
      .set('Authorization', `Bearer ${tokens.buyer}`);
    expect(underpaid.statusCode).toEqual(400);
    expect(underpaid.body.status).toEqual('amount_mismatch');

    const prisma = new PrismaClient();
    try {
      const p = await prisma.purchase.findUnique({ where: { id: purchase.id } });
      expect(p.status).toEqual('AWAITING_PAYMENT'); // still waiting
    } finally {
      await prisma.$disconnect();
    }
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
});
