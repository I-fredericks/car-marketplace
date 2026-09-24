const request = require('supertest');
const app = require('../src/index');

// Admin-initiated support threads (Message.vehicleId NULL) + broadcast
// announcements. Policy under test:
//   - only admins may OPEN a listing-less thread; regular users may only
//     REPLY inside one that already exists
//   - support threads ride the same conversation list / read receipts /
//     deletion rails as listing chats, addressed as /messages/:id/general
//   - broadcasts create BROADCAST notifications for every active user except
//     the sender, and never create Message rows
const run = Date.now();
const buyer1 = {
  email: `supp-buyer-${run}@example.com`,
  password: 'Password123!',
  name: 'Support Buyer',
};
const buyer2 = {
  email: `supp-stranger-${run}@example.com`,
  password: 'Password123!',
  name: 'Never Contacted Buyer',
};
const seller = {
  email: `supp-seller-${run}@example.com`,
  password: 'Password123!',
  name: 'Support Seller',
};
const admin = {
  email: `supp-admin-${run}@example.com`,
  password: 'Password123!',
  name: 'Support Admin',
};
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let buyer1Token;
let buyer2Token;
let buyer1Id;
let buyer2Id;
let adminToken;
let adminId;
let sellerToken;
let vehicle;

const registerAndVerify = async (body) => {
  const res = await request(app).post('/api/auth/register').send(body);
  if (res.statusCode !== 201) return res.statusCode;
  const confirmed = await request(app)
    .get('/api/auth/verify-email')
    .query({ token: res.body.devVerificationToken });
  return confirmed.statusCode === 200 ? 201 : confirmed.statusCode;
};

describe('Admin support threads & broadcast', () => {
  afterAll(async () => {
    const prisma = require('./_db');
    // Children first (FKs): notifications/messages cascade from users, but
    // the vehicle hangs off a sellerProfile that must go before its user.
    await prisma.notification.deleteMany({
      where: { user: { email: { in: [buyer1.email, buyer2.email, seller.email, admin.email] } } },
    });
    await prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: { in: [buyer1Id, buyer2Id, adminId].filter(Boolean) } },
          { receiverId: { in: [buyer1Id, buyer2Id, adminId].filter(Boolean) } },
        ],
      },
    }).catch(() => {});
    if (vehicle) {
      await prisma.vehicle.deleteMany({ where: { id: vehicle.id } }).catch(() => {});
    }
    for (const u of [buyer1, buyer2, seller, admin]) {
      await prisma.user.deleteMany({ where: { email: u.email } }).catch(() => {});
    }
  });

  it('registers the cast and promotes the admin in the DB', async () => {
    expect(await registerAndVerify({ ...buyer1, role: 'BUYER' })).toEqual(201);
    expect(await registerAndVerify({ ...buyer2, role: 'BUYER' })).toEqual(201);
    expect(await registerAndVerify({ ...seller, role: 'SELLER', sellerType: 'PRIVATE' })).toEqual(201);
    expect(await registerAndVerify({ ...admin, role: 'BUYER' })).toEqual(201);

    const prisma = require('./_db');
    await prisma.user.update({
      where: { email: admin.email },
      data: { role: 'ADMIN', emailVerified: true },
    });

    buyer1Token = (await request(app).post('/api/auth/login').send(buyer1)).body.token;
    buyer2Token = (await request(app).post('/api/auth/login').send(buyer2)).body.token;
    sellerToken = (await request(app).post('/api/auth/login').send(seller)).body.token;
    const staffLogin = await request(app)
      .post('/api/auth/admin-login')
      .send({ email: admin.email, password: admin.password });
    adminToken = (await request(app)
      .post('/api/auth/admin-verify')
      .send({ email: admin.email, code: staffLogin.body.devAdminCode })).body.token;
    expect(buyer1Token).toBeDefined();
    expect(buyer2Token).toBeDefined();
    expect(sellerToken).toBeDefined();
    expect(adminToken).toBeDefined();

    buyer1Id = (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${buyer1Token}`)).body.id;
    buyer2Id = (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${buyer2Token}`)).body.id;
    adminId = (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`)).body.id;
  });

  it('blocks a regular user from opening a listing-less thread', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${buyer1Token}`)
      .send({ receiverId: adminId, content: 'hello?' });
    expect(res.statusCode).toEqual(403);
  });

  it('lets the admin open a support thread with any user (no vehicle)', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ receiverId: buyer1Id, content: 'Hi! Following up on your report.' });
    expect(res.statusCode).toEqual(201);

    const prisma = require('./_db');
    const row = await prisma.message.findUnique({ where: { id: res.body.id } });
    expect(row.vehicleId).toBeNull();
  });

  it('shows the support thread in the inbox as a vehicle-less conversation', async () => {
    const res = await request(app)
      .get('/api/messages/conversations')
      .set('Authorization', `Bearer ${buyer1Token}`);
    expect(res.statusCode).toEqual(200);
    const row = res.body.find((c) => c.otherUser.id === adminId && c.isSupport);
    expect(row).toBeDefined();
    expect(row.vehicle).toBeNull();
    expect(row.unreadCount).toEqual(1);
  });

  it('lets the user REPLY inside the existing support thread', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${buyer1Token}`)
      .send({ receiverId: adminId, content: 'Thanks for reaching out!' });
    expect(res.statusCode).toEqual(201);
  });

  it('serves the whole thread under the general sentinel', async () => {
    const res = await request(app)
      .get(`/api/messages/${adminId}/general`)
      .set('Authorization', `Bearer ${buyer1Token}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toEqual(2);
    expect(res.body.every((m) => m.vehicleId === null)).toBe(true);
  });

  it('marks the support conversation read via the sentinel route', async () => {
    const res = await request(app)
      .put(`/api/messages/${adminId}/general/read`)
      .set('Authorization', `Bearer ${buyer1Token}`);
    expect(res.statusCode).toEqual(200);

    const prisma = require('./_db');
    const unread = await prisma.notification.count({
      where: { userId: buyer1Id, type: 'NEW_MESSAGE', senderId: adminId, vehicleId: null, readAt: null },
    });
    expect(unread).toEqual(0);
  });

  it('still refuses a listing-less send from a user with no existing thread', async () => {
    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${buyer2Token}`)
      .send({ receiverId: adminId, content: 'let me ping support directly' });
    expect(res.statusCode).toEqual(403);
  });

  it('deleting the support thread keeps vehicle-anchored chats intact', async () => {
    // Same pair also chats about a real listing…
    const created = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        make: 'Toyota', model: 'Corolla', year: 2021, price: 95000,
        location: 'Accra', images: [{ data: PNG_1PX, isPrimary: true }],
      });
    expect(created.statusCode).toEqual(201);
    vehicle = created.body;

    await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${buyer1Token}`)
      .send({ receiverId: adminId, vehicleId: vehicle.id, content: 'is this your car?' });

    // …then deleting the general thread removes ONLY the null-vehicle rows.
    const del = await request(app)
      .delete(`/api/messages/${adminId}/general`)
      .set('Authorization', `Bearer ${buyer1Token}`);
    expect(del.statusCode).toEqual(200);
    expect(del.body.deletedCount).toEqual(2);

    const prisma = require('./_db');
    const supportLeft = await prisma.message.count({
      where: { vehicleId: null, OR: [
        { senderId: buyer1Id, receiverId: adminId },
        { senderId: adminId, receiverId: buyer1Id },
      ] },
    });
    const listingLeft = await prisma.message.count({
      where: { vehicleId: vehicle.id, OR: [
        { senderId: buyer1Id, receiverId: adminId },
        { senderId: adminId, receiverId: buyer1Id },
      ] },
    });
    expect(supportLeft).toEqual(0);
    expect(listingLeft).toEqual(1);
  });

  it('single-message delete works (route previously shadowed by the pair route)', async () => {
    const sent = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${buyer1Token}`)
      .send({ receiverId: adminId, vehicleId: vehicle.id, content: 'second listing message' });
    expect(sent.statusCode).toEqual(201);

    const del = await request(app)
      .delete(`/api/messages/message/${sent.body.id}`)
      .set('Authorization', `Bearer ${buyer1Token}`);
    expect(del.statusCode).toEqual(200);
  });

  it('broadcasts a BROADCAST notification to every active user except the sender', async () => {
    const prisma = require('./_db');
    const beforeMessages = await prisma.message.count();
    const res = await request(app)
      .post('/api/admin/broadcast')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Scheduled maintenance', body: 'The site will be brief unavailable on Sunday.' });
    expect(res.statusCode).toEqual(200);
    expect(res.body.count).toBeGreaterThanOrEqual(3); // buyer1, buyer2, seller

    const buyerGot = await prisma.notification.findFirst({
      where: { userId: buyer1Id, type: 'BROADCAST', title: 'Scheduled maintenance' },
    });
    expect(buyerGot).not.toBeNull();

    const adminGot = await prisma.notification.findFirst({
      where: { userId: adminId, type: 'BROADCAST' },
    });
    expect(adminGot).toBeNull(); // sender excluded

    // A broadcast is not a chat: no NEW Message rows may appear. Measured as
    // a delta because this suite (and crashed earlier runs) legitimately
    // leaves support threads in the shared test database.
    const afterMessages = await prisma.message.count();
    expect(afterMessages - beforeMessages).toEqual(0);
  });

  it('validates broadcast input and enforces admin-only access', async () => {
    const missing = await request(app)
      .post('/api/admin/broadcast')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ body: 'no title here' });
    expect(missing.statusCode).toEqual(400);

    const notAdmin = await request(app)
      .post('/api/admin/broadcast')
      .set('Authorization', `Bearer ${buyer1Token}`)
      .send({ title: 'hi', body: 'should not go through' });
    expect(notAdmin.statusCode).toEqual(403);
  });

  it('bulk-messages selected users into replyable support threads', async () => {
    const prisma = require('./_db');
    const before = await prisma.message.count({ where: { senderId: adminId, vehicleId: null } });
    const res = await request(app)
      .post('/api/admin/messages/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userIds: [buyer1Id, buyer2Id], content: 'Hello from the AutoTrustGhana team!' });
    expect(res.statusCode).toEqual(200);
    expect(res.body.count).toEqual(2);

    const after = await prisma.message.count({ where: { senderId: adminId, vehicleId: null } });
    expect(after - before).toEqual(2);

    const forBuyer2 = await prisma.message.findFirst({
      where: { senderId: adminId, receiverId: buyer2Id, vehicleId: null },
    });
    expect(forBuyer2).not.toBeNull();

    // Each recipient gets a NEW_MESSAGE notification pointing at the thread
    const notified = await prisma.notification.findFirst({
      where: { userId: buyer2Id, type: 'NEW_MESSAGE', senderId: adminId, vehicleId: null },
    });
    expect(notified).not.toBeNull();
  });

  it('rejects bulk messaging from non-admins', async () => {
    const res = await request(app)
      .post('/api/admin/messages/bulk')
      .set('Authorization', `Bearer ${buyer1Token}`)
      .send({ userIds: [buyer2Id], content: 'spam' });
    expect(res.statusCode).toEqual(403);
  });

  it('validates bulk message input', async () => {
    const emptyList = await request(app)
      .post('/api/admin/messages/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userIds: [], content: 'hi' });
    expect(emptyList.statusCode).toEqual(400);

    const blankContent = await request(app)
      .post('/api/admin/messages/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userIds: [buyer1Id], content: '   ' });
    expect(blankContent.statusCode).toEqual(400);
  });

  it('skips inactive and admin accounts from the bulk send', async () => {
    const prisma = require('./_db');
    await prisma.user.update({ where: { id: buyer2Id }, data: { isActive: false } });
    try {
      const res = await request(app)
        .post('/api/admin/messages/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userIds: [buyer1Id, buyer2Id, adminId], content: 'Only active users get this' });
      expect(res.statusCode).toEqual(200);
      expect(res.body.count).toEqual(1); // buyer2 inactive, adminId is the sender/admin
    } finally {
      await prisma.user.update({ where: { id: buyer2Id }, data: { isActive: true } });
    }
  });

  it('inbox broadcast delivers a replyable chat message to every active user', async () => {
    const prisma = require('./_db');
    const beforeMessages = await prisma.message.count();
    const res = await request(app)
      .post('/api/admin/broadcast')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'New feature launch', body: 'Check out escrow checkout!', sendToInbox: true });
    expect(res.statusCode).toEqual(200);
    expect(res.body.count).toBeGreaterThanOrEqual(3); // buyer1, buyer2, seller (+ other DB users)

    const afterMessages = await prisma.message.count();
    expect(afterMessages - beforeMessages).toBeGreaterThanOrEqual(3);

    const inInbox = await prisma.message.findFirst({
      where: { senderId: adminId, receiverId: buyer1Id, vehicleId: null, content: 'Check out escrow checkout!' },
    });
    expect(inInbox).not.toBeNull();

    // Inbox delivery rides NEW_MESSAGE notifications, never BROADCAST rows
    const chatNotification = await prisma.notification.findFirst({
      where: { userId: buyer1Id, type: 'NEW_MESSAGE', senderId: adminId, vehicleId: null },
    });
    expect(chatNotification).not.toBeNull();
    const bellRow = await prisma.notification.findFirst({
      where: { userId: buyer1Id, type: 'BROADCAST', title: 'New feature launch' },
    });
    expect(bellRow).toBeNull();
  });
});
