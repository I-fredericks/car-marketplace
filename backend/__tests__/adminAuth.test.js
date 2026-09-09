// Staff-portal login: two-step admin authentication with an emailed 6-digit
// code. The public login must refuse admins; the portal must refuse everyone
// else; the code must be single-use and expiring.
const request = require('supertest');
const prisma = require('./_db');
const app = require('../src/index');

jest.setTimeout(30000);

const registerAndVerify = async (body) => {
  const res = await request(app).post('/api/auth/register').send(body);
  if (res.statusCode !== 201) return res.statusCode;
  const confirmed = await request(app)
    .get('/api/auth/verify-email')
    .query({ token: res.body.devVerificationToken });
  return confirmed.statusCode === 200 ? 201 : confirmed.statusCode;
};

describe('Staff portal (admin two-step login)', () => {
  const adminEmail = `staff-admin-${Date.now()}@example.com`;
  const adminPassword = 'StaffPass123!';
  let adminId;

  beforeAll(async () => {
    // Register a verified buyer, then promote to ADMIN directly in the DB —
    // mirrors how real admins come into existence (no self-registration).
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: adminEmail, password: adminPassword, name: 'Staff Admin', role: 'BUYER' });
    expect(res.statusCode).toEqual(201);
    adminId = res.body.userId;

    await prisma.user.update({
      where: { id: adminId },
      data: { role: 'ADMIN', emailVerified: true },
    });
  });

  afterAll(async () => {
    await prisma.authToken.deleteMany({ where: { userId: adminId } });
    await prisma.user.delete({ where: { id: adminId } }).catch(() => {});
  });

  it('public login rejects ADMIN accounts with the staff-portal message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: adminEmail, password: adminPassword });
    expect(res.statusCode).toEqual(403);
    expect(res.body.message).toMatch(/staff portal/i);
  });

  it('stage 1 rejects wrong passwords and non-admin accounts with the same error', async () => {
    const wrongPass = await request(app)
      .post('/api/auth/admin-login')
      .send({ email: adminEmail, password: 'WrongPass123!' });
    expect(wrongPass.statusCode).toEqual(401);

    const buyerEmail = `staff-buyer-${Date.now()}@example.com`;
    expect(await registerAndVerify({
      email: buyerEmail, password: 'BuyerPass123!', name: 'Not Staff', role: 'BUYER',
    })).toEqual(201);
    const notAdmin = await request(app)
      .post('/api/auth/admin-login')
      .send({ email: buyerEmail, password: 'BuyerPass123!' });
    expect(notAdmin.statusCode).toEqual(401);
  });

  it('stage 1 issues a 6-digit code and never a session token', async () => {
    const res = await request(app)
      .post('/api/auth/admin-login')
      .send({ email: adminEmail, password: adminPassword });
    expect(res.statusCode).toEqual(200);
    expect(res.body.requiresAdminCode).toEqual(true);
    expect(res.body.devAdminCode).toMatch(/^\d{6}$/); // dev mode returns the code
    expect(res.body.token).toBeUndefined();

    const record = await prisma.authToken.findFirst({
      where: { userId: adminId, type: 'ADMIN_OTP' },
    });
    expect(record).not.toBeNull();
  });

  it('stage 2 rejects a wrong code', async () => {
    const res = await request(app)
      .post('/api/auth/admin-verify')
      .send({ email: adminEmail, code: '000000' });
    expect(res.statusCode).toEqual(401);
  });

  it('stage 2 accepts the emailed code and returns a working admin session', async () => {
    const start = await request(app)
      .post('/api/auth/admin-login')
      .send({ email: adminEmail, password: adminPassword });
    const code = start.body.devAdminCode;

    const verify = await request(app)
      .post('/api/auth/admin-verify')
      .send({ email: adminEmail, code });
    expect(verify.statusCode).toEqual(200);
    expect(verify.body.token).toBeDefined();
    expect(verify.body.user.role).toEqual('ADMIN');

    // The returned session really is an admin session.
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${verify.body.token}`);
    expect(me.statusCode).toEqual(200);
    expect(me.body.role).toEqual('ADMIN');

    // Codes are single-use: replaying one must fail.
    const replay = await request(app)
      .post('/api/auth/admin-verify')
      .send({ email: adminEmail, code });
    expect(replay.statusCode).toEqual(401);
  });
});
