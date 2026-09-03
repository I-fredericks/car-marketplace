/* Paystack billing integration test (run on port 5001) */
process.env.PORT = '5001';
const crypto = require('crypto');
const app = require('./src/index.js');
const http = require('http');
const prisma = require('./src/config/db');

const BASE = 'http://localhost:5001/api';
const ok = (name, cond, extra = '') => console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);

(async () => {
  const server = http.createServer(app);
  await new Promise(r => server.listen(5001, r));

  const email = `pstack${Date.now()}@test.com`;
  const pass = 'password123';

  // 1. Register + upgrade to seller
  await fetch(`${BASE}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Pay Tester', email, password: pass }) });
  const login1 = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pass }) }).then(r => r.json());
  const tok = { Authorization: `Bearer ${login1.token}`, 'Content-Type': 'application/json' };
  await fetch(`${BASE}/auth/upgrade`, { method: 'PUT', headers: tok, body: '{}' });
  ok('Seller registered', Boolean(login1.token));

  // 2. Plans endpoint exposes Paystack public key
  const plans = await fetch(`${BASE}/billing/plans`).then(r => r.json());
  ok('Public key exposed', plans.paystackPublicKey?.startsWith('pk_test_'));

  // 3. Create payment + initialize with Paystack (real test API call)
  const created = await fetch(`${BASE}/billing/payments`, { method: 'POST', headers: tok, body: JSON.stringify({ planKey: 'BASIC' }) }).then(r => r.json());
  ok('Payment record created', created.payment?.status === 'PENDING', `ref ${created.payment?.reference}`);

  const init = await fetch(`${BASE}/billing/payments/${created.payment.id}/initialize`, {
    method: 'POST', headers: tok,
    body: JSON.stringify({ callbackUrl: 'http://localhost:5173/billing/callback' }),
  }).then(r => r.json());
  ok('Paystack checkout URL generated', Boolean(init.authorizationUrl && init.authorizationUrl.includes('checkout.paystack.com')), init.authorizationUrl?.slice(0, 60));

  // 4. Verify endpoint handles an unpaid (abandoned/ongoing) transaction gracefully
  const verify = await fetch(`${BASE}/billing/verify/${created.payment.reference}`, { headers: { Authorization: `Bearer ${login1.token}` } }).then(r => r.json());
  ok('Verify returns transaction status (unpaid)', ['abandoned', 'ongoing', 'pending'].includes(verify.status), `status=${verify.status}`);

  // 5. Webhook rejects invalid signatures
  const badHook = await fetch(`${BASE}/billing/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': 'deadbeef' },
    body: JSON.stringify({ event: 'charge.success', data: { reference: created.payment.reference, amount: 5000 } }),
  });
  ok('Webhook rejects bad signature (401)', badHook.status === 401);

  // 6. Webhook accepts valid signature and applies the plan (simulated charge.success)
  const payload = JSON.stringify({ event: 'charge.success', data: { reference: created.payment.reference, amount: 5000, channel: 'mobile_money', status: 'success' } });
  const sig = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(Buffer.from(payload)).digest('hex');
  const goodHook = await fetch(`${BASE}/billing/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sig },
    body: payload,
  });
  ok('Webhook accepts valid signature (200)', goodHook.status === 200);

  const status = await fetch(`${BASE}/billing/status`, { headers: { Authorization: `Bearer ${login1.token}` } }).then(r => r.json());
  ok('Plan auto-activated by webhook: BASIC, 5 listings', status.plan.key === 'BASIC' && status.listingLimit === 5, `used ${status.listingsUsed}/5`);

  const payAfter = await fetch(`${BASE}/billing/payments`, { headers: { Authorization: `Bearer ${login1.token}` } }).then(r => r.json());
  ok('Payment marked VERIFIED with channel', payAfter[0]?.status === 'VERIFIED' && payAfter[0]?.channel === 'mobile_money');

  // 7. Replay the same webhook (idempotency) — should stay consistent
  const replay = await fetch(`${BASE}/billing/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sig },
    body: payload,
  });
  ok('Webhook replay is safe (200)', replay.status === 200);

  // Cleanup
  const me = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${login1.token}` } }).then(r => r.json());
  await prisma.payment.deleteMany({ where: { userId: me.id } });
  await prisma.subscription.deleteMany({ where: { userId: me.id } });
  await prisma.sellerProfile.deleteMany({ where: { userId: me.id } });
  await prisma.user.delete({ where: { id: me.id } }).catch(() => {});
  console.log('\n🧹 Test data cleaned up');

  server.close();
  await prisma.$disconnect();
  process.exit(0);
})().catch(e => { console.error('TEST ERROR:', e); process.exit(1); });
