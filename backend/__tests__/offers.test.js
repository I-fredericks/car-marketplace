const request = require('supertest');
const app = require('../src/index');

// Paystack mocked so the final checkout step is deterministic.
jest.mock('../src/services/paystack', () => ({
  initializeTransaction: jest.fn(async (args) => ({
    authorization_url: 'https://paystack.test/checkout',
    access_code: 'ac_test',
    reference: args.reference,
  })),
  verifyTransaction: jest.fn(async () => ({ status: 'success', amount: 0, channel: 'mobile_money' })),
}));
const { verifyTransaction } = require('../src/services/paystack');
jest.mock('../src/services/mailer', () => ({
  ...jest.requireActual('../src/services/mailer'),
  sendMail: jest.fn().mockResolvedValue(true),
}));

// Negotiation coverage: offer -> counter chain -> accept -> agreed price
// flows into exactly the buyer's purchase amount (others pay asking).
const run = Date.now();
const seller = { email: `neg-seller-${run}@example.com`, password: 'password123', name: 'Neg Seller' };
const buyer = { email: `neg-buyer-${run}@example.com`, password: 'password123', name: 'Neg Buyer' };
const rival = { email: `neg-rival-${run}@example.com`, password: 'password123', name: 'Rival Buyer' };
const admin = { email: `neg-admin-${run}@example.com`, password: 'password123', name: 'Neg Admin' };
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAA748+iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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

describe('Price negotiation (offers in messages)', () => {
  it('registers seller, two buyers and admin', async () => {
    expect(await registerAndVerify({ ...seller, role: 'SELLER', sellerType: 'PRIVATE' })).toEqual(201);
    expect(await registerAndVerify({ ...buyer, role: 'BUYER' })).toEqual(201);
    expect(await registerAndVerify({ ...rival, role: 'BUYER' })).toEqual(201);
    expect(await registerAndVerify({ ...admin, role: 'BUYER' })).toEqual(201);

    const prisma = require('./_db');
    try {
      await prisma.user.update({ where: { email: admin.email }, data: { role: 'ADMIN' } });
    } finally {
      
    }
    tokens.buyer = (await login(buyer.email, buyer.password)).body.token;
    tokens.rival = (await login(rival.email, rival.password)).body.token;
    const staff = await request(app)
      .post('/api/auth/admin-login')
      .send({ email: admin.email, password: admin.password });
    tokens.admin = (await request(app)
      .post('/api/auth/admin-verify')
      .send({ email: admin.email, code: staff.body.devAdminCode })).body.token;
    expect(tokens.buyer).toBeDefined();
  });

  it('creates and approves a listing', async () => {
    tokens.seller = (await login(seller.email, seller.password)).body.token;
    const created = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${tokens.seller}`)
      .send({
        make: 'Hyundai', model: 'Elantra', year: 2021, price: 80000,
        location: 'Kumasi', images: [{ data: PNG_1PX, isPrimary: true }],
      });
    expect(created.statusCode).toEqual(201);
    ids.vehicleId = created.body.id;

    const approve = await request(app)
      .put(`/api/admin/vehicles/${ids.vehicleId}/status`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ status: 'AVAILABLE' });
    expect(approve.statusCode).toEqual(200);
  });

  it('buyer opens a negotiation; seller receives it + notification', async () => {
    const res = await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ vehicleId: ids.vehicleId, amount: 7000000 }); // GH₵70,000
    expect(res.statusCode).toEqual(201);
    expect(res.body.offer.status).toEqual('PENDING');
    expect(res.body.offer.proposedBy).toEqual('BUYER');
    ids.offerA = res.body.offer.id;

    // At/above asking is rejected outright
    expect((await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ vehicleId: ids.vehicleId, amount: 8000000 })).statusCode).toEqual(400);

    // Seller sees the thread
    const sellerUserRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokens.seller}`);
    ids.sellerUserId = sellerUserRes.body.id;
    const thread = await request(app)
      .get(`/api/offers?vehicleId=${ids.vehicleId}&withUserId=${(await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokens.buyer}`)).body.id}`)
      .set('Authorization', `Bearer ${tokens.seller}`);
    expect(thread.statusCode).toEqual(200);
    expect(thread.body.live.id).toEqual(ids.offerA);

    let notified = false;
    for (let i = 0; i < 5 && !notified; i += 1) {
      const notes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokens.seller}`);
      notified = notes.body.notifications.some((n) => n.type === 'OFFER_RECEIVED');
      if (!notified) await new Promise((r) => setTimeout(r, 400));
    }
    expect(notified).toBe(true);
  });

  it('free seller can\'t counter (needs subscription), subscriber can', async () => {
    // Free tier attempt gets the upgrade gate
    const gated = await request(app)
      .post(`/api/offers/${ids.offerA}/respond`)
      .set('Authorization', `Bearer ${tokens.seller}`)
      .send({ action: 'counter', amount: 7500000 });
    expect(gated.statusCode).toEqual(402);
    expect(gated.body.requiresPlan).toEqual(true);

    // Subscribe the seller directly in the DB (billing has its own suite)
    const prisma = require('./_db');
    try {
      const sellerUser = await prisma.user.findUnique({ where: { email: seller.email } });
      await prisma.subscription.create({
        data: {
          userId: sellerUser.id,
          plan: 'PLUS',
          status: 'ACTIVE',
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    } finally {
      
    }

    const counter = await request(app)
      .post(`/api/offers/${ids.offerA}/respond`)
      .set('Authorization', `Bearer ${tokens.seller}`)
      .send({ action: 'counter', amount: 7500000 }); // GH₵75,000
    expect(counter.statusCode).toEqual(200);
    expect(counter.body.offer.status).toEqual('PENDING');
    expect(counter.body.offer.proposedBy).toEqual('SELLER');
    ids.offerB = counter.body.offer.id;

    // Original offer is superseded
    const prisma2 = require('./_db');
    try {
      const old = await prisma2.priceOffer.findUnique({ where: { id: ids.offerA } });
      expect(old.status).toEqual('COUNTERED');
    } finally {
      
    }
  });

  it('buyer counter-counters, seller accepts; agree price binds', async () => {
    const counter2 = await request(app)
      .post(`/api/offers/${ids.offerB}/respond`)
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ action: 'counter', amount: 7200000 }); // GH₵72,000
    expect(counter2.statusCode).toEqual(200);
    ids.offerC = counter2.body.offer.id;

    // Buyer can't act again until seller responds (turn-taking enforced)
    const stale = await request(app)
      .post(`/api/offers/${ids.offerB}/respond`)
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ action: 'accept' });
    expect(stale.statusCode).toEqual(400); // offerB already superseded

    const accept = await request(app)
      .post(`/api/offers/${ids.offerC}/respond`)
      .set('Authorization', `Bearer ${tokens.seller}`)
      .send({ action: 'accept' });
    expect(accept.statusCode).toEqual(200);
    expect(accept.body.offer.status).toEqual('ACCEPTED');

    // Buyer gets the accept ping
    let notified = false;
    for (let i = 0; i < 5 && !notified; i += 1) {
      const notes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokens.buyer}`);
      notified = notes.body.notifications.some((n) => n.type === 'OFFER_RESPONSE' && n.body.includes('72,000'));
      if (!notified) await new Promise((r) => setTimeout(r, 400));
    }
    expect(notified).toBe(true);

    // Payable price reflects the agreement for THIS buyer only
    const priceBuyer = await request(app)
      .get(`/api/offers/price/${ids.vehicleId}`)
      .set('Authorization', `Bearer ${tokens.buyer}`);
    const priceRival = await request(app)
      .get(`/api/offers/price/${ids.vehicleId}`)
      .set('Authorization', `Bearer ${tokens.rival}`);
    expect(priceBuyer.body.agreedPesewas).toEqual(7200000);
    expect(priceRival.body.agreedPesewas).toBeNull();
    expect(priceRival.body.askingPesewas).toEqual(8000000);
  });

  it('checkout uses the agreed price and seals the offer', async () => {
    const initiated = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ vehicleId: ids.vehicleId, method: 'BANK_TRANSFER', deliveryMode: 'PICKUP' });
    expect(initiated.statusCode).toEqual(201);

    const purchase = initiated.body.purchase;
    expect(purchase.amount).toEqual(7200000); // the agreed price, not 80,000
    expect(initiated.body.paymentInstructions.amountPesewas).toEqual(7200000);
    ids.purchaseId = purchase.id;

    const prisma = require('./_db');
    try {
      const offer = await prisma.priceOffer.findUnique({ where: { id: ids.offerC } });
      expect(offer.status).toEqual('USED');
      const row = await prisma.purchase.findUnique({ where: { id: purchase.id } });
      expect(row.agreedOfferId).toEqual(ids.offerC);
      // 1% commission on the agreed amount
      expect(row.commissionBps).toEqual(100);
    } finally {
    }

    // Buyer claims the transfer, admin confirms -> funds in escrow
    expect((await request(app)
      .post(`/api/purchases/${purchase.id}/claim-payment`)
      .set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ paymentRef: 'TRF-445566' })).statusCode).toEqual(200);
    const verified = await request(app)
      .put(`/api/admin/purchases/${purchase.id}/verify-payment`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({});
    expect(verified.statusCode).toEqual(200);
    expect(verified.body.purchase.status).toEqual('PAID_HELD');
  });

  it('reserved vehicle blocks offers and checkouts from other buyers', async () => {
    // The buyer already has a checkout running — the link is RESERVED
    expect((await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${tokens.rival}`)
      .send({ vehicleId: ids.vehicleId, amount: 6500000 })).statusCode).toEqual(409);
    expect((await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${tokens.rival}`)
      .send({ vehicleId: ids.vehicleId, method: 'BANK_TRANSFER', deliveryMode: 'PICKUP' })).statusCode).toEqual(409);
  });

  it('withdraw takes a live offer back; declined ends the round', async () => {
    // Fresh listing for this flow (the first car is reserved by the winner)
    const created = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${tokens.seller}`)
      .send({
        make: 'Suzuki', model: 'Swift', year: 2020, price: 60000,
        location: 'Tamale', images: [{ data: PNG_1PX, isPrimary: true }],
      });
    expect(created.statusCode).toEqual(201);
    const fresh = created.body.id;
    expect((await request(app)
      .put(`/api/admin/vehicles/${fresh}/status`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ status: 'AVAILABLE' })).statusCode).toEqual(200);

    // Rival opens an offer and then withdraws it
    const opened = await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${tokens.rival}`)
      .send({ vehicleId: fresh, amount: 5500000 });
    expect(opened.statusCode).toEqual(201);
    const rivalOfferId = opened.body.offer.id;

    const withdrawn = await request(app)
      .post(`/api/offers/${rivalOfferId}/withdraw`)
      .set('Authorization', `Bearer ${tokens.rival}`);
    expect(withdrawn.statusCode).toEqual(200);
    expect(withdrawn.body.offer.status).toEqual('WITHDRAWN');

    // Buyer only withdraws their own; seller attempting to withdraw returns 403
    const next = await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${tokens.rival}`)
      .send({ vehicleId: fresh, amount: 5600000 });
    const buyerOffer = next.body.offer.id;
    expect((await request(app)
      .post(`/api/offers/${buyerOffer}/withdraw`)
      .set('Authorization', `Bearer ${tokens.seller}`)).statusCode).toEqual(403);

    // Seller declines — that round is over
    const declined = await request(app)
      .post(`/api/offers/${buyerOffer}/respond`)
      .set('Authorization', `Bearer ${tokens.seller}`)
      .send({ action: 'decline' });
    expect(declined.statusCode).toEqual(200);
    expect(declined.body.offer.status).toEqual('DECLINED');

    // A declined offer can't be acted on again
    expect((await request(app)
      .post(`/api/offers/${buyerOffer}/respond`)
      .set('Authorization', `Bearer ${tokens.seller}`)
      .send({ action: 'accept' })).statusCode).toEqual(400);
  });
});
