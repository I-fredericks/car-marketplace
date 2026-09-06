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
  });
}

const from = () => process.env.EMAIL_FROM || 'CarMarket Ghana <no-reply@carmarket.gh>';

const sendMail = async ({ to, subject, html, text }) => {
  if (!smtpConfigured) {
    console.log(`[mailer:dev] To: ${to} | Subject: ${subject}\n${text}`);
    return { dev: true };
  }
  return transporter.sendMail({ from: from(), to, subject, html, text });
};

const appUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

// Verification links point straight at the API (not the SPA): the inbox can be
// opened on any device, and the endpoint returns a self-contained HTML page,
// so the flow works even without the web frontend running. PUBLIC_API_URL
// overrides everything for deployments where the API lives on its own origin.
const apiUrl = () => (
  process.env.PUBLIC_API_URL ||
  (process.env.FRONTEND_URL ? appUrl() : 'http://localhost:5000')
).replace(/\/$/, '');

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

const sendPasswordResetEmail = async (user, rawToken) => {
  const url = `${appUrl()}/reset-password?token=${rawToken}`;
  const subject = 'Reset your CarMarket Ghana password';
  const body = `Hi ${user.name}, we received a request to reset your password. This link is valid for 1 hour.`;
  return sendMail({
    to: user.email,
    subject,
    text: `${body}\n\nReset here: ${url}`,
    html: emailTemplate('Reset your password', body, 'Reset Password', url),
  });
};

const sendVerificationEmail = async (user, rawToken) => {
  const url = `${apiUrl()}/api/auth/verify-email?token=${rawToken}`;
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
};
