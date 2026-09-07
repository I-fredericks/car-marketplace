const nodemailer = require('nodemailer');

// SMTP is optional in development: when it is not configured, emails are
// logged to the server console and the link is returned to the caller so the
// flow can still be tested locally.
const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

let transporter = null;
if (smtpConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Gmail silently drops some datacenter IPs and revoked app passwords hang
    // during the handshake. Fail fast (~25s worst case) instead of pinning
    // the request thread for minutes — this already killed registration.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

const from = () => process.env.EMAIL_FROM || 'CarMarket Ghana <no-reply@carmarket.gh>';

// Preferred transport: Resend HTTP API (deliverable from any datacenter IP —
// Gmail SMTP has proven flaky from hosted networks: 587 handshakes hang and
// port 465 throttles sporadically). Set RESEND_API_KEY on Render + a verified
// sender in EMAIL_FROM and mail goes out over HTTPS instead of SMTP.
const resendConfigured = Boolean(process.env.RESEND_API_KEY);
const sendViaResend = async ({ to, subject, html, text }) => {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: from(), to, subject, html, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend email failed: HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
};

const sendMail = async ({ to, subject, html, text }) => {
  if (resendConfigured) {
    try {
      return await sendViaResend({ to, subject, html, text });
    } catch (error) {
      // Fall through to SMTP rather than losing the email outright
      console.error('Resend path failed, falling back to SMTP:', error.message);
    }
  }
  if (!smtpConfigured) {
    console.log(`[mailer:dev] To: ${to} | Subject: ${subject}\n${text}`);
    return { dev: true };
  }
  return transporter.sendMail({ from: from(), to, subject, html, text });
};

const appUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

// The public origin of the request currently being served. `trust proxy` is
// enabled in index.js, so req.protocol/host are the real public URL behind
// Vercel/Render/nginx. Email links are built from this so they keep working
// even when PUBLIC_API_URL is not set.
const originFromReq = (req) =>
  req ? `${req.protocol}://${req.get('host')}`.replace(/\/$/, '') : '';

// Verification/reset links point straight at the API (not the SPA): the inbox
// can be opened on any device, and the endpoints return self-contained HTML
// pages, so the flow works even without the web frontend running.
// Resolution order: explicit PUBLIC_API_URL -> origin of the request that
// triggered the email -> localhost dev default.
// NOTE: never fall back to FRONTEND_URL here — that is the SPA's origin and
// has no /api/* routes on static hosts like Vercel, which 404s these links.
const apiUrl = (origin) => {
  const base = process.env.PUBLIC_API_URL || origin || `http://localhost:${process.env.PORT || 5000}`;
  return base.replace(/\/$/, '');
};

if (process.env.NODE_ENV === 'production' && !process.env.PUBLIC_API_URL) {
  console.warn('[mailer] PUBLIC_API_URL is not set in production — email links will be built from incoming request origins. Set it to your canonical API URL (e.g. https://api.yourdomain.com).');
}

const emailTemplate = (heading, bodyHtml, ctaLabel, ctaUrl) => `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
    <h2 style="color:#1B2A4A;margin-bottom:16px;">CarMarket Ghana</h2>
    <h3 style="color:#1B2A4A;">${heading}</h3>
    <p style="color:#4B5563;line-height:1.6;">${bodyHtml}</p>
    <p style="margin:28px 0;">
      <a href="${ctaUrl}" style="background:#1B2A4A;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">${ctaLabel}</a>
    </p>
    <p style="color:#9CA3AF;font-size:12px;line-height:1.5;">
      Or paste this link into your browser: <br/>${ctaUrl}
      <br/><br/>If you didn't request this, you can safely ignore this email.
    </p>
  </div>
`;

const sendPasswordResetEmail = async (user, rawToken, origin) => {
  // API-hosted reset page (same pattern as verify-email): the link works from
  // any device's browser without the web frontend being reachable.
  const url = `${apiUrl(origin)}/api/auth/reset-password?token=${rawToken}`;
  const subject = 'Reset your CarMarket Ghana password';
  const body = `Hi ${user.name}, we received a request to reset your password. This link is valid for 1 hour.`;
  return sendMail({
    to: user.email,
    subject,
    text: `${body}\n\nReset here: ${url}`,
    html: emailTemplate('Reset your password', body, 'Reset Password', url),
  });
};

const sendVerificationEmail = async (user, rawToken, origin) => {
  const url = `${apiUrl(origin)}/api/auth/verify-email?token=${rawToken}`;
  const subject = 'Confirm your CarMarket Ghana email';
  const body = `Hi ${user.name}, welcome to CarMarket Ghana! Confirm this email address to activate your account. This link is valid for 24 hours.`;
  return sendMail({
    to: user.email,
    subject,
    text: `${body}\n\nConfirm here: ${url}`,
    html: emailTemplate('Confirm your email', body, 'Confirm Email', url),
  });
};

module.exports = {
  sendPasswordResetEmail,
  sendVerificationEmail,
  smtpConfigured,
  originFromReq,
  appUrl,
};
