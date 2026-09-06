const request = require('supertest');
const app = require('../src/index');

describe('Auth API', () => {
  const testEmail = `test-${Date.now()}@example.com`;
  let devVerificationToken;

  const verifyEmail = async (token) =>
    request(app).get('/api/auth/verify-email').query({ token });

  it('should register a new user and issue a verification token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'password123',
        name: 'Test User',
        role: 'BUYER'
      });
    expect(res.statusCode).toEqual(201);
    expect(res.body.message).toEqual('User registered successfully');
    expect(res.body.requiresEmailVerification).toEqual(true);
    devVerificationToken = res.body.devVerificationToken;
    expect(devVerificationToken).toBeDefined();
  });

  it('should block login until the email is verified', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'password123' });
    expect(res.statusCode).toEqual(403);
    expect(res.body.emailNotVerified).toEqual(true);
  });

  it('should reject an invalid verification token', async () => {
    const res = await verifyEmail('totally-invalid-token');
    expect(res.statusCode).toEqual(400);
  });

  it('should confirm the email with the inbox link', async () => {
    const res = await verifyEmail(devVerificationToken);
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('Email confirmed');
  });

  it('should not register a user with existing email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'password123',
        name: 'Test User',
        role: 'BUYER'
      });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'password123',
        name: 'Test User',
        role: 'BUYER'
      });
    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toEqual('User already exists');
  });

  it('should verify the email with the token and allow login', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'password123' });
    expect(login.statusCode).toEqual(200);
    expect(login.body.token).toBeDefined();
    expect(login.body.user.email).toEqual(testEmail);
  });

  it('should reject invalid login credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'wrongpassword' });
    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toEqual('Invalid credentials');
  });

  it('should complete the forgot/reset password flow', async () => {
    const forgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: testEmail });
    expect(forgot.statusCode).toEqual(200);
    expect(forgot.body.devResetToken).toBeDefined();

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: forgot.body.devResetToken, password: 'newpassword456' });
    expect(reset.statusCode).toEqual(200);

    // Old password no longer works, the new one does
    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'password123' });
    expect(oldLogin.statusCode).toEqual(400);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'newpassword456' });
    expect(newLogin.statusCode).toEqual(200);

    // The reset token is single-use
    const reuse = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: forgot.body.devResetToken, password: 'anotherpass789' });
    expect(reuse.statusCode).toEqual(400);
  });

  it('should respond generically to forgot-password for unknown emails', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent-' + Date.now() + '@example.com' });
    expect(res.statusCode).toEqual(200);
    expect(res.body.devResetToken).toBeUndefined();
  });

  it('should reject registration with invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'invalid-email',
        password: 'password123',
        name: 'Test User'
      });
    expect(res.statusCode).toEqual(400);
  });

  it('should reject registration with short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `test-short-${Date.now()}@example.com`,
        password: '123',
        name: 'Test User'
      });
    expect(res.statusCode).toEqual(400);
  });
});
