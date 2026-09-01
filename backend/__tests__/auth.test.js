const request = require('supertest');
const app = require('../src/index');

describe('Auth API', () => {
  const testEmail = `test-${Date.now()}@example.com`;

  it('should register a new user', async () => {
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

  it('should login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'password123'
      });
    expect(res.statusCode).toEqual(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toEqual(testEmail);
  });

  it('should reject invalid login credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'wrongpassword'
      });
    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toEqual('Invalid credentials');
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
