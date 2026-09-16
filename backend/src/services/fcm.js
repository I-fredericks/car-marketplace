// Firebase Cloud Messaging delivery for users with no open SSE stream.
//
// Zero-dependency by design: the OAuth2 access token is a self-signed JWT
// (RS256) minted with node:crypto against the FCM v1 endpoint, so the only
// setup is three env vars on the host:
//   FCM_PROJECT_ID    — Firebase project id
//   FCM_CLIENT_EMAIL  — service-account email (firebase-adminsdk-...@...iam.gserviceaccount.com)
//   FCM_PRIVATE_KEY   — the service account's private key (\n escapes intact)
// Without all three the service no-ops (dev boxes, CI) — never throws.
const crypto = require('crypto');
const https = require('https');
const prisma = require('../config/db');
const { clientCount } = require('./eventBus');

const configured = () => Boolean(
  process.env.FCM_PROJECT_ID && process.env.FCM_CLIENT_EMAIL && process.env.FCM_PRIVATE_KEY
);

let cachedAccessToken = null; // { token, expiresAtMs }

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken() {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAtMs - 60_000) {
    return cachedAccessToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: process.env.FCM_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  // .env newlines arrive escaped; restore them before signing.
  const privateKey = process.env.FCM_PRIVATE_KEY.replace(/\\n/g, '\n');
  const signature = base64url(signer.sign(privateKey));
  const assertion = `${header}.${claims}.${signature}`;

  return new Promise((resolve, reject) => {
    const body = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${encodeURIComponent(assertion)}`;
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          if (res.statusCode !== 200 || !data.access_token) {
            return reject(new Error(`FCM token exchange failed: ${res.statusCode}`));
          }
          cachedAccessToken = { token: data.access_token, expiresAtMs: Date.now() + (data.expires_in || 3600) * 1000 };
          resolve(data.access_token);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sendToDevice(token, accessToken, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ message: { token, ...payload } });
    const req = https.request({
      hostname: 'fcm.googleapis.com',
      path: `/v1/projects/${process.env.FCM_PROJECT_ID}/messages:send`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: raw }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Fire-and-forget push to one user's registered device. Skipped silently when
 * FCM isn't configured, the user has an open SSE stream (they're in the app),
 * or they never registered a device. Dead tokens are cleared on 404/410.
 */
async function pushToDevices(userId, { title, body, data }) {
  if (!configured()) return false;
  try {
    if (clientCount(userId) > 0) return false; // online via SSE

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { deviceToken: true, isActive: true },
    });
    if (!user || !user.isActive || !user.deviceToken) return false;

    const accessToken = await getAccessToken();
    const result = await sendToDevice(user.deviceToken, accessToken, {
      notification: { title: String(title).slice(0, 100), body: String(body || '').slice(0, 200) },
      data: Object.fromEntries(
        Object.entries(data || {}).map(([k, v]) => [k, String(v ?? '')])
      ),
      android: { priority: 'high' },
    });

    if (result.status === 404 || result.status === 410) {
      // Token unregistered (app removed / device reset): drop it so future
      // sends don't waste a round-trip.
      await prisma.user.update({ where: { id: userId }, data: { deviceToken: null } }).catch(() => {});
      return false;
    }
    return result.status === 200;
  } catch (e) {
    console.warn('FCM push failed:', e.message);
    return false;
  }
}

module.exports = { pushToDevices, configured };
