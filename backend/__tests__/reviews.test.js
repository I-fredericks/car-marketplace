const request = require('supertest');
const app = require('../src/index');

// Reviews are transaction-verified: only buyers who COMPLETED an escrowed
// purchase can leave one, and only one per purchase. This test exercises
// the full create-gate, uniqueness, public-read, and rating-aggregation
// chain against the live test database.
jest.mock('../src/services/paystack', () => ({
  initializeTransaction: jest.fn(),
  verifyTransaction: jest.fn(),
}));
jest.mock('../src/services/mailer', () => ({
  ...jest.requireActual('../src/services/mailer'),
  sendMail: jest.fn().mockResolvedValue(true),
}));

const run = Date.now();
const seller = { email: `rev-seller-${run}@example.com`, password: 'password123', name: 'Rev Seller' };
const buyer = { email: `rev-buyer-${run}@example.com`, password: 'password123', name: 'Rev Buyer' };
const stranger = { email: `rev-stranger-${run}@example.com`, password: 'password123', name: 'Stranger' };
const admin = { email: `rev-admin-${run}@example.com`, password: 'password123', name: 'Rev Admin' };
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const tokens = {};
const ids = {};

const registerAndVerify = async (body) => {
  const res = await request(app).post('/api/auth/register').send(body);
  if (res.statusCode !== 201) return res.statusCode;
  const confirmed = await request(app).get('/api/auth/verify-email').query({ token: res.body.devVerificationToken });
  return confirmed.statusCode === 200 ? 201 : confirmed.statusCode;
};

describe('Seller reviews (transaction-verified)', () => {
  it('registers seller, buyer, stranger and admin', async () => {
    expect(await registerAndVerify({ ...seller, role: 'SELLER', sellerType: 'PRIVATE' })).toEqual(201);
    expect(await registerAndVerify({ ...buyer, role: 'BUYER' })).toEqual(201);
    expect(await registerAndVerify({ ...stranger, role: 'BUYER' })).toEqual(201);
    expect(await registerAndVerify({ ...admin, role: 'BUYER' })).toEqual(201);

    const prisma = require('./_db');
    try { await prisma.user.update({ where: { email: admin.email }, data: { role: 'ADMIN' } }); } finally {}

    tokens.buyer = (await request(app).post('/api/auth/login').send(buyer)).body.token;
    tokens.stranger = (await request(app).post('/api/auth/login').send(stranger)).body.token;
    const staff = await request(app).post('/api/auth/admin-login').send({ email: admin.email, password: admin.password });
    tokens.admin = (await request(app).post('/api/auth/admin-verify').send({ email: admin.email, code: staff.body.devAdminCode })).body.token;
    tokens.seller = (await request(app).post('/api/auth/login').send(seller)).body.token;
    ids.sellerUserId = (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokens.seller}`)).body.id;
  });

  it('creates and approves a listing', async () => {
    const created = await request(app).post('/api/vehicles').set('Authorization', `Bearer ${tokens.seller}`)
      .send({ make: 'VW', model: 'Golf', year: 2019, price: 95000, location: 'Accra', images: [{ data: PNG_1PX, isPrimary: true }] });
    expect(created.statusCode).toEqual(201);
    ids.vehicleId = created.body.id;
    expect((await request(app).put(`/api/admin/vehicles/${ids.vehicleId}/status`).set('Authorization', `Bearer ${tokens.admin}`).send({ status: 'AVAILABLE' })).statusCode).toEqual(200);
  });

  it('blocks reviews before a completed purchase exists', async () => {
    // No purchase at all
    expect((await request(app).post('/api/reviews').set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ purchaseId: 999999, rating: 5 })).statusCode).toEqual(404);

    // Start a purchase (AWAITING_PAYMENT, not COMPLETED)
    const order = await request(app).post('/api/purchases').set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ vehicleId: ids.vehicleId, method: 'BANK_TRANSFER', deliveryMode: 'PICKUP' });
    ids.purchaseId = order.body.purchase.id;

    expect((await request(app).post('/api/reviews').set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ purchaseId: ids.purchaseId, rating: 5 })).statusCode).toEqual(400); // not completed

    // Stranger can't review the buyer's purchase
    expect((await request(app).post('/api/reviews').set('Authorization', `Bearer ${tokens.stranger}`)
      .send({ purchaseId: ids.purchaseId, rating: 5 })).statusCode).toEqual(403);

    // Invalid rating
    expect((await request(app).post('/api/reviews').set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ purchaseId: ids.purchaseId, rating: 0 })).statusCode).toEqual(400);
  });

  it('completes the escrow flow, then lets the buyer review once', async () => {
    await request(app).post(`/api/purchases/${ids.purchaseId}/claim-payment`).set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ paymentRef: 'TRF-REV-1' });
    await request(app).put(`/api/admin/purchases/${ids.purchaseId}/verify-payment`).set('Authorization', `Bearer ${tokens.admin}`).send({});

    // Seller marks handover
    await request(app).post(`/api/purchases/${ids.purchaseId}/seller-handover`).set('Authorization', `Bearer ${tokens.seller}`);

    // Buyer confirms receipt -> COMPLETED
    expect((await request(app).post(`/api/purchases/${ids.purchaseId}/confirm-received`).set('Authorization', `Bearer ${tokens.buyer}`)).statusCode).toEqual(200);

    // Now the buyer CAN review
    const review = await request(app).post('/api/reviews').set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ purchaseId: ids.purchaseId, rating: 4, comment: 'Car was exactly as described. Honest seller.' });
    expect(review.statusCode).toEqual(201);
    expect(review.body.review.rating).toEqual(4);
    ids.reviewId = review.body.review.id;

    // Second review on the same purchase is blocked (one per transaction)
    expect((await request(app).post('/api/reviews').set('Authorization', `Bearer ${tokens.buyer}`)
      .send({ purchaseId: ids.purchaseId, rating: 5 })).statusCode).toEqual(409);
  });

  it('aggregates the seller rating and exposes reviews publicly', async () => {
    const prisma = require('./_db');
    let sellerProfile;
    try {
      sellerProfile = await prisma.sellerProfile.findFirst({ where: { user: { email: seller.email } } });
    } finally {}

    const data = await request(app).get(`/api/reviews/seller/${sellerProfile.id}`);
    expect(data.statusCode).toEqual(200);
    expect(data.body.rating).toBeGreaterThanOrEqual(4);
    expect(data.body.reviewCount).toEqual(1);
    expect(data.body.reviews[0].author.name).toEqual('Rev Buyer');
    expect(data.body.reviews[0].comment).toContain('Honest seller');

    // Public endpoint doesn't need auth
    expect((await request(app).get(`/api/reviews/seller/${sellerProfile.id}`)).statusCode).toEqual(200);
  });

  it('eligible endpoint shows the reviewed purchase as done', async () => {
    const eligible = await request(app).get('/api/reviews/eligible').set('Authorization', `Bearer ${tokens.buyer}`);
    expect(eligible.statusCode).toEqual(200);
    expect(eligible.body.eligible.find((p) => p.id === ids.purchaseId)).toBeUndefined();
    expect(eligible.body.reviewed.find((p) => p.id === ids.purchaseId)).toBeDefined();
  });
});
