const PAYSTACK_BASE = 'https://api.paystack.co';

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not configured');
  return key;
}

/**
 * Initialize a Paystack transaction.
 * @returns {Promise<{authorization_url: string, access_code: string, reference: string}>}
 */
async function initializeTransaction({ email, amountGhs, reference, callbackUrl, metadata }) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amountGhs * 100), // pesewas
      reference,
      callback_url: callbackUrl || undefined,
      channels: ['card', 'mobile_money'],
      currency: 'GHS',
      metadata,
    }),
  });

  const body = await res.json();
  if (!body.status) {
    throw new Error(body.message || 'Paystack initialization failed');
  }
  return body.data;
}

/**
 * Verify a transaction server-side (fallback when the webhook is missed).
 * @returns {Promise<{status: string, amount: number, channel: string|null, paidAt: string|null}>}
 */
async function verifyTransaction(reference) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  });

  const body = await res.json();
  if (!body.status) {
    throw new Error(body.message || 'Paystack verification failed');
  }
  return {
    status: body.data.status, // success | failed | abandoned | pending
    amount: body.data.amount / 100,
    channel: body.data.channel || null,
    paidAt: body.data.paid_at || null,
  };
}

module.exports = { initializeTransaction, verifyTransaction };
