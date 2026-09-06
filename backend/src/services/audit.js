const prisma = require('../config/db');

// Moderation trail writer. Fire-and-forget by design: call sites invoke
// logAction WITHOUT await — the promise never rejects, so a failed audit
// write can never break (or hang) the request it is recording.
//
// Actions are dot-namespaced so the admin audit screen can prefix-filter:
//   LISTING.CREATE | LISTING.UPDATE | LISTING.REMOVE | LISTING.APPROVE |
//   LISTING.REJECT | LISTING.DEACTIVATE | LISTING.MARK_SOLD | LISTING.FEATURE
//   USER.VERIFY | USER.DEACTIVATE | USER.REACTIVATE | USER.DELETE
//   USER.AVATAR_APPROVE | USER.AVATAR_REJECT
//   PAYMENT.VERIFY | PAYMENT.REJECT | REPORT.RESOLVE
async function logAction({
  actorId = null,
  actorRole = null,
  actorName = null,
  action,
  entityType,
  entityId = null,
  meta = null,
}) {
  try {
    await prisma.auditLog.create({
      data: { actorId, actorRole, actorName, action, entityType, entityId, meta },
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

module.exports = { logAction };
