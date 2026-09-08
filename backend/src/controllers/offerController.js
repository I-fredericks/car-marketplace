const prisma = require('../config/db');
const { getActiveSubscription } = require('./billingController');

// Price negotiation lives inside the buyer↔seller chat. Model:
//   buyer opens with an offer -> seller accepts / declines / counters ->
//   counters can bounce either way. The newest PENDING row is always the
//   "live" number; when the seller accepts, THAT amount is locked as the
//   buyer's checkout price for this vehicle (used by purchaseController).
// Upgrade lever: counter-offers from the seller require an active
// subscription — free sellers can still accept or decline.

const VEHICLE_INCLUDE = { select: { id: true, make: true, model: true, year: true, price: true, status: true } };

/** The buyer/seller for a chat thread, whichever side the caller isn't on. */
async function loadOfferContext(userId, vehicleId, otherUserId) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: parseInt(vehicleId, 10) },
    include: { seller: { include: { user: { select: { id: true } } } } },
  });
  if (!vehicle) return { error: { status: 404, body: { message: 'Vehicle not found.' } } };

  const sellerUserId = vehicle.seller.user.id;
  const otherId = parseInt(otherUserId, 10);
  const callerIsSeller = userId === sellerUserId;

  // Negotiations only exist between the listing's seller and one buyer
  if (callerIsSeller && Number.isNaN(otherId)) {
    return { error: { status: 400, body: { message: 'Sellers must provide the buyer id (?withUserId=).' } } };
  }
  const buyerId = callerIsSeller ? otherId : userId;
  return { vehicle, sellerUserId, buyerId, callerIsSeller };
}

// @desc    Buyer makes a price offer on a vehicle
// @route   POST /api/offers
// @access  Private (Buyer)
const makeOffer = async (req, res) => {
  try {
    const { vehicleId, amount } = req.body;
    const amountPesewas = parseInt(amount, 10);

    if (!Number.isInteger(amountPesewas) || amountPesewas <= 0) {
      return res.status(400).json({ message: 'Enter a valid offer amount.' });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: parseInt(vehicleId, 10) },
      include: { seller: { include: { user: { select: { id: true, name: true } } } } },
    });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
    if (vehicle.status !== 'AVAILABLE') {
      return res.status(409).json({ message: 'This vehicle is not available right now.' });
    }
    if (vehicle.seller.user.id === req.user.id) {
      return res.status(400).json({ message: 'You can\'t negotiate with yourself.' });
    }

    const askingPesewas = Math.round(vehicle.price * 100);
    if (amountPesewas >= askingPesewas) {
      return res.status(400).json({ message: 'At that price just tap Buy Now — offers should be below asking.' });
    }

    const offer = await prisma.$transaction(async (tx) => {
      // One negotiation per buyer per vehicle: withdraw any stale pending
      // rows in that thread before opening a fresh one.
      await tx.priceOffer.updateMany({
        where: { vehicleId: vehicle.id, buyerId: req.user.id, status: 'PENDING' },
        data: { status: 'WITHDRAWN' },
      });
      return tx.priceOffer.create({
        data: {
          vehicleId: vehicle.id,
          buyerId: req.user.id,
          sellerId: vehicle.sellerId,
          amount: amountPesewas,
          proposedBy: 'BUYER',
        },
      });
    });

    prisma.notification.create({
      data: {
        userId: vehicle.seller.user.id,
        type: 'OFFER_RECEIVED',
        title: 'New price offer',
        body: `${vehicle.year} ${vehicle.make} ${vehicle.model} · buyer offers GH₵${(amountPesewas / 100).toLocaleString()} (asking GH₵${vehicle.price.toLocaleString()})`,
        data: { path: `/messages/${req.user.id}/${vehicle.id}`, offerId: offer.id },
      },
    }).catch((e) => console.error('Offer notify failed:', e.message));

    res.status(201).json({ offer });
  } catch (error) {
    console.error('Error making offer:', error);
    res.status(500).json({ message: 'Server error making offer' });
  }
};

// @desc    Respond to the live offer: accept | decline | counter
// @route   POST /api/offers/:id/respond
// @access  Private (the party the offer is sitting with)
const respondToOffer = async (req, res) => {
  try {
    const { action, amount, reason } = req.body || {};
    const offer = await prisma.priceOffer.findUnique({
      where: { id: parseInt(req.params.id, 10) },
      include: {
        vehicle: VEHICLE_INCLUDE,
        seller: { include: { user: { select: { id: true } } } },
      },
    });
    if (!offer) return res.status(404).json({ message: 'Offer not found.' });
    if (offer.status !== 'PENDING') {
      return res.status(400).json({ message: `This offer is already ${offer.status.toLowerCase()}.` });
    }

    // The offer sits with the party that did NOT propose it
    const callerIsBuyerSide = req.user.id === offer.buyerId;
    const callerIsSellerSide = req.user.id === offer.seller.user.id;
    if (!callerIsBuyerSide && !callerIsSellerSide) {
      return res.status(403).json({ message: 'Not your negotiation.' });
    }
    const sittingWithBuyer = offer.proposedBy === 'SELLER';
    if (sittingWithBuyer !== callerIsBuyerSide) {
      return res.status(403).json({
        message: callerIsBuyerSide ? 'The seller hasn\'t responded yet.' : 'You made this offer — wait for the buyer.',
      });
    }

    let result;
    if (action === 'accept') {
      result = await prisma.priceOffer.update({
        where: { id: offer.id },
        data: { status: 'ACCEPTED' },
      });
    } else if (action === 'decline') {
      result = await prisma.priceOffer.update({
        where: { id: offer.id },
        data: { status: 'DECLINED' },
      });
    } else if (action === 'counter') {
      const counterPesewas = parseInt(amount, 10);
      if (!Number.isInteger(counterPesewas) || counterPesewas <= 0) {
        return res.status(400).json({ message: 'Counter amount must be a valid number of cedis.' });
      }
      // Counters must stay under the live asking price (never haggle UP)
      const freshVehicle = await prisma.vehicle.findUnique({
        where: { id: offer.vehicleId },
        select: { price: true },
      });
      const askingPesewas = Math.round((freshVehicle?.price ?? Number.MAX_SAFE_INTEGER) * 100);
      if (counterPesewas >= askingPesewas) {
        return res.status(400).json({ message: 'Counter must stay below the asking price.' });
      }
      // Upgrade lever: sellers need an active subscription to haggle back —
      // accepting/declining stays free.
      if (callerIsSellerSide) {
        const subscription = await getActiveSubscription(req.user.id);
        if (!subscription) {
          return res.status(402).json({
            message: 'Counter-offers need a subscription. Upgrade on the Pricing page to haggle — accepting or declining stays free.',
            requiresPlan: true,
          });
        }
      }
      result = await prisma.$transaction(async (tx) => {
        await tx.priceOffer.update({
          where: { id: offer.id },
          data: { status: 'COUNTERED' },
        });
        return tx.priceOffer.create({
          data: {
            vehicleId: offer.vehicleId,
            buyerId: offer.buyerId,
            sellerId: offer.sellerId,
            amount: counterPesewas,
            proposedBy: callerIsBuyerSide ? 'BUYER' : 'SELLER',
            parentId: offer.id,
          },
        });
      });
    } else {
      return res.status(400).json({ message: 'action must be accept | decline | counter.' });
    }

    // Ping the other party (fire-and-forget)
    const targetUserId = callerIsBuyerSide ? offer.seller.user.id : offer.buyerId;
    const verbs = { accept: 'accepted your offer', decline: 'declined your offer', counter: 'countered with a new price' };
    const title = { accept: 'Offer accepted', decline: 'Offer declined', counter: 'Counter-offer received' };
    prisma.notification.create({
      data: {
        userId: targetUserId,
        type: 'OFFER_RESPONSE',
        title: title[action],
        body: `${offer.vehicle.year} ${offer.vehicle.make} ${offer.vehicle.model} · ${verbs[action]}${action === 'counter' ? ` of GH₵${(result.amount / 100).toLocaleString()}` : ` at GH₵${(offer.amount / 100).toLocaleString()}`}${action === 'accept' && callerIsSellerSide ? ' — tap Buy Now to checkout at this price.' : ''}`,
        data: { path: `/messages/${callerIsBuyerSide ? offer.seller.user.id : offer.buyerId}/${offer.vehicleId}`, offerId: result.id },
      },
    }).catch((e) => console.error('Offer response notify failed:', e.message));

    res.json({ offer: result });
  } catch (error) {
    console.error('Error responding to offer:', error);
    res.status(500).json({ message: 'Server error responding to offer' });
  }
};

// @desc    Withdraw your own pending offer (takes the price back)
// @route   POST /api/offers/:id/withdraw
// @access  Private (proposer)
const withdrawOffer = async (req, res) => {
  try {
    const offer = await prisma.priceOffer.findUnique({
      where: { id: parseInt(req.params.id, 10) },
      include: { seller: { include: { user: { select: { id: true } } } } },
    });
    if (!offer) return res.status(404).json({ message: 'Offer not found.' });
    if (offer.status !== 'PENDING') {
      return res.status(400).json({ message: `This offer is already ${offer.status.toLowerCase()}.` });
    }
    const proposerUserId = offer.proposedBy === 'BUYER' ? offer.buyerId : offer.seller.user.id;
    if (proposerUserId !== req.user.id) {
      return res.status(403).json({ message: 'You can only withdraw your own offer.' });
    }
    const updated = await prisma.priceOffer.update({
      where: { id: offer.id },
      data: { status: 'WITHDRAWN' },
    });
    res.json({ offer: updated });
  } catch (error) {
    console.error('Error withdrawing offer:', error);
    res.status(500).json({ message: 'Server error withdrawing offer' });
  }
};

// @desc    Negotiation thread for this chat (vehicle + the two parties)
// @route   GET /api/offers?vehicleId=..&withUserId=..
// @access  Private (either party)
const getOfferThread = async (req, res) => {
  try {
    const { vehicleId, withUserId } = req.query;
    const ctx = await loadOfferContext(req.user.id, vehicleId, withUserId);
    if (ctx.error) return res.status(ctx.error.status).json(ctx.error.body);

    // Only the two principals of the thread may read it
    const otherId = parseInt(withUserId, 10);
    if (ctx.callerIsSeller && otherId !== ctx.buyerId) {
      return res.status(403).json({ message: 'Not your negotiation.' });
    }
    if (!ctx.callerIsSeller && otherId !== ctx.sellerUserId) {
      return res.status(403).json({ message: 'Not your negotiation.' });
    }

    const offers = await prisma.priceOffer.findMany({
      where: { vehicleId: ctx.vehicle.id, buyerId: ctx.buyerId },
      orderBy: { createdAt: 'asc' },
    });

    const live = offers.find((o) => o.status === 'PENDING') || null;
    const accepted = offers.find((o) => ['ACCEPTED', 'USED'].includes(o.status)) || null;

    res.json({
      vehicle: ctx.vehicle,
      offers,
      live,
      acceptedPrice: accepted ? accepted.amount : null,
    });
  } catch (error) {
    console.error('Error loading offers:', error);
    res.status(500).json({ message: 'Server error loading offers' });
  }
};

// @desc    Best payable price for the signed-in buyer on a vehicle
//          (accepted offer, else asking price). Checkout calls this.
// @route   GET /api/offers/price/:vehicleId
// @access  Private
const getPayablePrice = async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.vehicleId, 10);
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, price: true, status: true },
    });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });

    const accepted = await prisma.priceOffer.findFirst({
      where: { vehicleId, buyerId: req.user.id, status: 'ACCEPTED' },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      askingPesewas: Math.round(vehicle.price * 100),
      agreedPesewas: accepted ? accepted.amount : null,
      agreedOfferId: accepted ? accepted.id : null,
    });
  } catch (error) {
    console.error('Error resolving payable price:', error);
    res.status(500).json({ message: 'Server error resolving price' });
  }
};

module.exports = { makeOffer, respondToOffer, withdrawOffer, getOfferThread, getPayablePrice };
