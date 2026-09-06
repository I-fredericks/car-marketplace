const prisma = require('../config/db');

// Daily maintenance sweep. Kept status-preserving on purpose:
//  - Ended subscriptions are demoted to EXPIRED for truthful data. Visibility
//    already keys off periodEnd (getActiveSubscription), so this is cosmetic
//    plus cheap.
//  - Lapsed free listings keep status AVAILABLE: public queries filter on
//    expiresAt, and applyVerifiedPayment clears expiresAt on upgrade, which
//    is what brings a listing back after a seller pays. Flipping status here
//    would make that upgrade promise a lie.
//  - Sellers get one LISTING_EXPIRED notification per lapsed listing; the
//    24h window + daily cadence means each listing is announced exactly once.
async function runExpirySweep() {
  const now = new Date();
  try {
    const subs = await prisma.subscription.updateMany({
      where: { status: 'ACTIVE', periodEnd: { lte: now } },
      data: { status: 'EXPIRED' },
    });
    if (subs.count > 0) {
      console.log(`[expiry] demoted ${subs.count} ended subscription(s)`);
    }

    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lapsed = await prisma.vehicle.findMany({
      where: { status: 'AVAILABLE', expiresAt: { lte: now, gt: dayAgo } },
      include: { seller: { select: { userId: true } } },
    });
    if (lapsed.length > 0) {
      const { createNotification } = require('../controllers/notificationController');
      for (const vehicle of lapsed) {
        const ownerId = vehicle.seller?.userId;
        if (!ownerId) continue;
        await createNotification({
          userId: ownerId,
          type: 'LISTING_EXPIRED',
          title: 'Your listing expired',
          body: `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim() +
            ' is no longer visible to buyers. Upgrade your plan to put it back up.',
          data: { vehicleId: vehicle.id },
        }).catch(() => {});
      }
      console.log(`[expiry] notified ${lapsed.length} seller(s) about lapsed listings`);
    }

    return { subscriptionsDemoted: subs.count, listingsLapsed: lapsed.length };
  } catch (err) {
    console.error('[expiry] sweep failed:', err.message);
  }
}

// First sweep shortly after boot, then every 24h. Started only for the real
// server process (not under jest, which imports the app).
function startExpiryScheduler() {
  const DAY = 24 * 60 * 60 * 1000;
  setTimeout(async () => {
    await runExpirySweep();
    setInterval(runExpirySweep, DAY);
  }, 30 * 1000).unref();
}

module.exports = { runExpirySweep, startExpiryScheduler };
