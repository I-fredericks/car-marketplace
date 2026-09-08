const request = require('supertest');
const app = require('../src/index');

// Exercises the listing/moderation lifecycle end to end against the real
// database (same policy as auth.test.js): edit -> re-approval, soft delete,
// admin takedown, user deactivation, audit trail, chat counters.
// Unique emails per run keep the suite re-runnable without cleanup.
// Free-tier sellers get ONE active listing, so flows are split across two
// sellers: sellerA owns the approve/edit/takedown listing, sellerB the
// soft-delete + deactivation listings.
const run = Date.now();
const sellerA = {
  email: `life-seller-a-${run}@example.com`,
  password: 'password123',
  name: 'Life Seller A',
};
const sellerB = {
  email: `life-seller-b-${run}@example.com`,
  password: 'password123',
  name: 'Life Seller B',
};
const buyer = {
  email: `life-buyer-${run}@example.com`,
  password: 'password123',
  name: 'Life Buyer',
};
const admin = {
  email: `life-admin-${run}@example.com`,
  password: 'password123',
  name: 'Life Admin',
};
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let sellerAToken;
let sellerBToken;
let sellerBId;
let buyerToken;
let adminToken;
let vehicle1; // sellerA: create -> approve -> edit -> PENDING -> takedown
let vehicle2; // sellerB: create -> chat -> soft delete
let vehicle3; // sellerB: stays PENDING, caught by the deactivation cascade

// Register + confirm the mailbox (login is blocked for unverified accounts):
// dev runs return the raw token inline because SMTP is not configured.
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
const createVehicle = (token, body) =>
  request(app).post('/api/vehicles').set('Authorization', `Bearer ${token}`).send(body);

describe('Listing lifecycle & moderation', () => {
  it('registers the sellers, buyer and a user promoted to admin', async () => {
    expect(await registerAndVerify({ ...sellerA, role: 'SELLER', sellerType: 'PRIVATE' })).toEqual(201);
    expect(await registerAndVerify({ ...sellerB, role: 'SELLER', sellerType: 'PRIVATE' })).toEqual(201);
    expect(await registerAndVerify({ ...buyer, role: 'BUYER' })).toEqual(201);
    expect(await registerAndVerify({ ...admin, role: 'BUYER' })).toEqual(201);

    // No self-service admin registration: promote via the DB directly.
    const prisma = require('./_db');
    try {
      await prisma.user.update({ where: { email: admin.email }, data: { role: 'ADMIN' } });
    } finally {
      
    }

    sellerAToken = (await login(sellerA.email, sellerA.password)).body.token;
    sellerBToken = (await login(sellerB.email, sellerB.password)).body.token;
    buyerToken = (await login(buyer.email, buyer.password)).body.token;
    // Admins can't use public login anymore — go through the staff portal
    // (stage 1 issues a devAdminCode; stage 2 trades it for the session).
    const staffLogin = await request(app)
      .post('/api/auth/admin-login')
      .send({ email: admin.email, password: admin.password });
    adminToken = (await request(app)
      .post('/api/auth/admin-verify')
      .send({ email: admin.email, code: staffLogin.body.devAdminCode })).body.token;
    expect(sellerAToken).toBeDefined();
    expect(sellerBToken).toBeDefined();
    expect(buyerToken).toBeDefined();
    expect(adminToken).toBeDefined();

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${sellerBToken}`);
    sellerBId = me.body.id;
  });

  it('creates a listing that starts PENDING', async () => {
    const res = await createVehicle(sellerAToken, {
      make: 'Toyota', model: 'Corolla', year: 2020, price: 90000,
      location: 'Accra', condition: 'LOCALLY_USED',
      images: [{ data: PNG_1PX, isPrimary: true }],
    });
    expect(res.statusCode).toEqual(201);
    expect(res.body.status).toEqual('PENDING');
    vehicle1 = res.body;
  });

  it('admin approves it, the seller is notified, and the audit log records it', async () => {
    const res = await request(app)
      .put(`/api/admin/vehicles/${vehicle1.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'AVAILABLE' });
    expect(res.statusCode).toEqual(200);
    expect(res.body.vehicle.status).toEqual('AVAILABLE');

    const notifications = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${sellerAToken}`);
    expect(notifications.body.unreadMessageCount).toBeDefined();
    expect(notifications.body.notifications.some((n) => n.type === 'LISTING_APPROVED')).toBe(true);

    const audit = await request(app)
      .get('/api/admin/audit-logs?action=LISTING.APPROVE')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(audit.body.logs.some((l) => l.entityId === vehicle1.id)).toBe(true);
  });

  it('rejects non-whitelisted status values', async () => {
    const res = await request(app)
      .put(`/api/admin/vehicles/${vehicle1.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PENDING' });
    expect(res.statusCode).toEqual(400);
  });

  it('seller edit sends the listing back to PENDING for re-approval', async () => {
    const res = await request(app)
      .put(`/api/vehicles/${vehicle1.id}`)
      .set('Authorization', `Bearer ${sellerAToken}`)
      .send({ price: 88000 });
    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toEqual('PENDING');

    // Non-owners cannot edit it, and the status field is not client-settable.
    const stranger = await request(app)
      .put(`/api/vehicles/${vehicle1.id}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ price: 1, status: 'AVAILABLE' });
    expect([403, 404]).toContain(stranger.statusCode);
  });

  it('admin can take a live listing down and buyers can no longer see it', async () => {
    const approve = await request(app)
      .put(`/api/admin/vehicles/${vehicle1.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'AVAILABLE' });
    expect(approve.statusCode).toEqual(200);

    const takedown = await request(app)
      .put(`/api/admin/vehicles/${vehicle1.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DEACTIVATED' });
    expect(takedown.statusCode).toEqual(200);

    const anon = await request(app).get(`/api/vehicles/${vehicle1.id}`);
    expect(anon.statusCode).toEqual(404);
  });

  it('seller soft delete keeps the row, closes the listing, keeps chats', async () => {
    const created = await createVehicle(sellerBToken, {
      make: 'Honda', model: 'Jazz', year: 2019, price: 70000,
      location: 'Tema', images: [{ data: PNG_1PX, isPrimary: true }],
    });
    expect(created.statusCode).toEqual(201);
    vehicle2 = created.body;

    // A buyer messages about it so the vehicle has chat history.
    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ receiverId: sellerBId, vehicleId: vehicle2.id, content: 'Still available?' });

    const del = await request(app)
      .delete(`/api/vehicles/${vehicle2.id}`)
      .set('Authorization', `Bearer ${sellerBToken}`);
    expect(del.statusCode).toEqual(200);
    expect(del.body.vehicle.status).toEqual('REMOVED');

    // Row survives (soft close) but is hidden from the public…
    expect((await request(app).get(`/api/vehicles/${vehicle2.id}`)).statusCode).toEqual(404);

    // …and the conversation still resolves, now marked closed.
    const convos = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${buyerToken}`);
    const row = convos.body.find((c) => c.vehicle && c.vehicle.id === vehicle2.id);
    expect(row).toBeDefined();
    expect(row.vehicle.status).toEqual('REMOVED');
  });

  it('deactivating a user blocks login, kills their token and takes listings down', async () => {
    // One still-active listing (PENDING) so the cascade has something to catch.
    const pending = await createVehicle(sellerBToken, {
      make: 'Kia', model: 'Rio', year: 2018, price: 55000,
      location: 'Kumasi', images: [{ data: PNG_1PX, isPrimary: true }],
    });
    expect(pending.statusCode).toEqual(201);
    vehicle3 = pending.body;

    const status = await request(app)
      .put(`/api/admin/users/${sellerBId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(status.statusCode).toEqual(200);
    expect(status.body.listingsAffected).toEqual(1);

    expect((await login(sellerB.email, sellerB.password)).statusCode).toEqual(403);
    expect(
      (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${sellerBToken}`)).statusCode
    ).toEqual(401);

        const prisma = require('./_db');
    try {
      const takenDown = await prisma.vehicle.findUnique({ where: { id: vehicle3.id } });
      expect(takenDown.status).toEqual('DEACTIVATED');
    } finally {
      
    }

    // Reactivation deliberately does not auto-restore listings.
    const reactivate = await request(app)
      .put(`/api/admin/users/${sellerBId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });
    expect(reactivate.statusCode).toEqual(200);
    expect((await login(sellerB.email, sellerB.password)).statusCode).toEqual(200);

        const prisma2 = require('./_db');
    try {
      const stillOff = await prisma2.vehicle.findUnique({ where: { id: vehicle3.id } });
      expect(stillOff.status).toEqual('DEACTIVATED');
    } finally {
      
    }
  });

  it('guards admin mutations: no self-deactivation, no admin deletion, admins-only audit access', async () => {
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);

    const selfDeactivate = await request(app)
      .put(`/api/admin/users/${me.body.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(selfDeactivate.statusCode).toEqual(400);

    const deleteAdmin = await request(app)
      .delete(`/api/admin/users/${me.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteAdmin.statusCode).toEqual(403);

    expect(
      (await request(app).get('/api/admin/audit-logs')).statusCode
    ).toEqual(401);
  });

  it('audit trail records the moderation story with actors', async () => {
    const res = await request(app)
      .get('/api/admin/audit-logs?limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toEqual(200);
    const actions = res.body.logs.map((l) => l.action);
    for (const expected of ['LISTING.CREATE', 'LISTING.UPDATE', 'LISTING.REMOVE', 'LISTING.DEACTIVATE', 'USER.DEACTIVATE', 'USER.REACTIVATE']) {
      expect(actions).toContain(expected);
    }
    const update = res.body.logs.find((l) => l.action === 'LISTING.UPDATE');
    expect(update.actorName).toBeDefined();
    expect(update.meta).toBeDefined();
  });
});
