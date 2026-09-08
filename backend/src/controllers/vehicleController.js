const prisma = require('../config/db');
const { getActiveSubscription } = require('./billingController');
const { getListingLimit, getPlanRank } = require('../config/plans');
const cache = require('../services/cache');
const audit = require('../services/audit');
const { notifyAdmins } = require('./notificationController');

// How long a free-plan listing stays public before it must be renewed by upgrading
const FREE_LISTING_DAYS = 90;

// Public queries must hide listings whose free period has lapsed
const notExpiredFilter = () => ({
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
});

// Seller info included with listings: identity + active subscription for ranking/badges
const sellerInclude = {
  seller: {
    include: {
      user: {
        select: {
          id: true, // lets clients render the seller's approved avatar (/api/users/:id/avatar)
          name: true,
          phone: true,
          subscription: { select: { plan: true, status: true, periodEnd: true } },
        },
      },
    },
  },
};

// Plan weight of a listing's seller; only counts if the subscription is currently active
const sellerPlanRank = (seller) => {
  const sub = seller?.user?.subscription;
  if (!sub || sub.status !== 'ACTIVE' || !sub.periodEnd || new Date(sub.periodEnd) <= new Date()) {
    return 0;
  }
  return getPlanRank(sub.plan);
};

// List endpoints ship only image ids; browsers load pixels via /api/images/:id
// which caches immutably. Full base64 data is only pulled for editing.
const imageIdSelect = {
  select: { id: true, isPrimary: true },
};

// Card fields only: list views (Home/Search/Favorites) never render the
// free-text description, and it's the heaviest column — leaving it out of
// hydration keeps list payloads small and the detail page authoritative.
const listingCardSelect = {
  id: true, make: true, model: true, year: true, price: true, location: true,
  condition: true, mileage: true, transmission: true, fuelType: true, bodyType: true,
  status: true, featured: true, featuredUntil: true, createdAt: true, updatedAt: true,
  seller: sellerInclude.seller,
  images: imageIdSelect,
};

// Fetch listing card rows for an ordered list of ids, preserving the given order
const hydrateVehiclesByIds = async (ids) => {
  if (ids.length === 0) return [];
  const rows = await prisma.vehicle.findMany({
    where: { id: { in: ids } },
    select: listingCardSelect,
  });
  const byId = new Map(rows.map((v) => [v.id, v]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
};

// Helper to format images array safely
const formatImages = (images) => {
  if (!images || !Array.isArray(images)) return [];
  return images.map((img, i) => {
    const dataStr = typeof img === 'string' ? img : img?.data;
    const isPrim = (typeof img === 'object' && img?.isPrimary !== undefined) ? img.isPrimary : (i === 0);
    return { data: dataStr, isPrimary: isPrim };
  }).filter(img => Boolean(img.data));
};

// Helper to format documents array safely
const formatDocuments = (documents) => {
  if (!documents || !Array.isArray(documents)) return [];
  return documents.map((doc, i) => {
    const dataStr = typeof doc === 'string' ? doc : doc?.data;
    const docType = (typeof doc === 'object' && doc?.documentType) ? doc.documentType : (i === 0 ? 'REGISTRATION' : 'OTHER');
    return { data: dataStr, documentType: docType };
  }).filter(doc => Boolean(doc.data));
};

// @desc    Create a new vehicle listing
// @route   POST /api/vehicles
// @access  Private (Seller only)
const createVehicle = async (req, res) => {
  try {
    let seller = await prisma.sellerProfile.findUnique({
      where: { userId: req.user.id }
    });

    if (!seller) {
      if (req.user.role === 'SELLER' || req.user.role === 'ADMIN') {
        seller = await prisma.sellerProfile.create({
          data: { userId: req.user.id }
        });
      } else {
        return res.status(403).json({ message: 'Only sellers can create listings. Please upgrade your account.' });
      }
    }

    // Enforce plan-based listing limits (starter billing strategy)
    const subscription = await getActiveSubscription(req.user.id);
    const listingLimit = getListingLimit(subscription ? subscription.plan : null);
    if (listingLimit !== null) {
      const activeListings = await prisma.vehicle.count({
        where: { sellerId: seller.id, status: { in: ['PENDING', 'AVAILABLE'] } },
      });
      if (activeListings >= listingLimit) {
        return res.status(403).json({
          message: `You've reached the ${listingLimit}-listing limit of your current plan. Upgrade your plan to add more listings.`,
          upgradeRequired: true,
        });
      }
    }

    const {
      make, model, year, price, location, condition,
      mileage, transmission, fuelType, engineSize, bodyType, color,
      description,
      features,
      images,
      documents
    } = req.body;

    const formattedImgList = formatImages(images);
    const formattedDocList = formatDocuments(documents);

    // Free-plan listings auto-expire after 90 days; paid plans don't expire
    const subscription2 = await getActiveSubscription(req.user.id);
    const expiresAt = subscription2
      ? null
      : new Date(Date.now() + FREE_LISTING_DAYS * 24 * 60 * 60 * 1000);

    const vehicle = await prisma.vehicle.create({
      data: {
        sellerId: seller.id,
        make,
        model,
        year: parseInt(year),
        price: parseFloat(price),
        location,
        condition,
        mileage: mileage ? parseInt(mileage) : null,
        transmission,
        fuelType,
        engineSize,
        bodyType,
        color,
        description,
        expiresAt,
        features: features && features.length > 0 ? {
          create: features.map(f => ({ featureName: f }))
        } : undefined,
        images: formattedImgList.length > 0 ? {
          create: formattedImgList
        } : undefined,
        documents: formattedDocList.length > 0 ? {
          create: formattedDocList
        } : undefined
      },
      include: {
        features: true,
        images: true,
        documents: true
      }
    });

    cache.bumpVehicleVersion();
    audit.logAction({
      actorId: req.user.id,
      actorRole: req.user.role,
      actorName: req.user.name,
      action: 'LISTING.CREATE',
      entityType: 'VEHICLE',
      entityId: vehicle.id,
      meta: { title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim() },
    });

    // Every new listing needs moderation — alert admins (fire-and-forget).
    notifyAdmins({
      type: 'ADMIN_PENDING_LISTING',
      title: 'New listing awaiting approval',
      body: `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim(),
      vehicleId: vehicle.id,
      senderId: req.user.id,
      data: { path: '/admin?tab=pending', vehicleId: vehicle.id },
    }).catch((e) => console.error('Admin listing notify failed:', e.message));

    res.status(201).json(vehicle);
  } catch (error) {
    console.error('Error creating vehicle:', error);
    const message = error?.message || 'Server error creating vehicle';
    res.status(500).json({ message });
  }
};

// @desc    Get all vehicles (with filtering, sorting, pagination)
// @route   GET /api/vehicles
// @access  Public
const SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'price', 'year', 'mileage'];

const getVehicles = async (req, res) => {
  try {
    const {
      make, model, condition, transmission, fuelType, bodyType,
      minPrice, maxPrice, location, verifiedOnly, search,
      order = 'desc', page = 1, limit = 12
    } = req.query;
    const sortBy = SORTABLE_FIELDS.includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';

    const where = {
      status: 'AVAILABLE'
    };

    if (make) where.make = { equals: make };
    if (model) where.model = { contains: model };
    if (condition) where.condition = condition;
    if (transmission) where.transmission = transmission;
    if (fuelType) where.fuelType = fuelType;
    if (bodyType) where.bodyType = bodyType;
    if (location) where.location = location;

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }

    if (verifiedOnly === 'true') {
      where.seller = { verified: true };
    }

    // Keyword and expiry clauses are AND-ed so expired free listings stay hidden during searches
    where.AND = [notExpiredFilter()];
    if (search) {
      where.AND.push({
        OR: [
          { make: { contains: search } },
          { model: { contains: search } },
          { description: { contains: search } },
          { location: { contains: search } }
        ],
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const dir = order === 'asc' ? 1 : -1;

    // Cache the full listing response per query for a short window. The key
    // embeds a vehicle version counter that any listing write bumps, so
    // stale entries are orphaned instantly instead of expiring late.
    const queryParams = {
      make, model, condition, transmission, fuelType, bodyType,
      minPrice, maxPrice, location, verifiedOnly, search, sortBy, order, page, limit,
    };
    const cacheKey = cache.stableKey('vehicles:list', queryParams);
    const cached = await cache.getJSON(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Keyword relevance: exact make/model matches outrank incidental
    // mentions in description/location (case-insensitive)
    const q = (search || '').toLowerCase().trim();

    // Fast path — plain browsing with an explicit sort (price/year/mileage)
    // needs no in-memory ranking at all: push sort+pagination to SQL and
    // skip the candidates scan entirely. This is the common catalog browse.
    const explicitSort = Boolean(req.query.sortBy);
    if (!q && explicitSort) {
      const [vehicles, total] = await Promise.all([
        prisma.vehicle.findMany({
          where,
          orderBy: { [sortBy]: order },
          skip,
          take,
          select: listingCardSelect,
        }),
        prisma.vehicle.count({ where }),
      ]);
      const fastResponse = {
        vehicles,
        pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) },
      };
      await cache.setJSON(cacheKey, fastResponse, 30);
      return res.json(fastResponse);
    }

    const relevance = (v) => {
      if (!q) return 0;
      const makeLc = (v.make || '').toLowerCase();
      const modelLc = (v.model || '').toLowerCase();
      let score = 0;
      if (makeLc === q) score += 4;
      else if (makeLc.includes(q)) score += 2;
      if (modelLc === q) score += 3;
      else if (modelLc.includes(q)) score += 2;
      if ((v.location || '').toLowerCase().includes(q)) score += 1;
      if ((v.description || '').toLowerCase().includes(q)) score += 0.5;
      return score;
    };

    // Lightweight pass over all matches to rank by relevance and seller
    // plan tier before pagination. `description` only travels when a
    // keyword needs to score against it.
    const candidates = await prisma.vehicle.findMany({
      where,
      select: {
        id: true,
        featured: true,
        createdAt: true,
        updatedAt: true,
        price: true,
        year: true,
        mileage: true,
        make: true,
        model: true,
        location: true,
        description: q ? true : undefined,
        seller: { select: { user: { select: { subscription: { select: { plan: true, status: true, periodEnd: true } } } } } },
      },
    });

    // Explicit sorts (price/year/mileage) must be honored literally: plan
    // and featured boosts only apply to the default newest-first browsing.

    candidates.sort((a, b) => {
      const rel = relevance(b) - relevance(a);
      if (rel !== 0) return rel;
      if (explicitSort) return ((a[sortBy] ?? 0) - (b[sortBy] ?? 0)) * dir;
      return (sellerPlanRank(b.seller) - sellerPlanRank(a.seller)) ||
        (b.featured - a.featured) ||
        ((a[sortBy] ?? 0) - (b[sortBy] ?? 0)) * dir;
    });

    const pageIds = candidates.slice(skip, skip + take).map((v) => v.id);

    const [vehicles, total] = await Promise.all([
      hydrateVehiclesByIds(pageIds),
      prisma.vehicle.count({ where })
    ]);

    const response = {
      vehicles,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    };

    await cache.setJSON(cacheKey, response, 30);
    res.json(response);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ message: 'Server error fetching vehicles' });
  }
};

// @desc    Get featured vehicles (home feed), prioritising sellers on higher plans
// @route   GET /api/vehicles/featured
// @access  Public
const getFeaturedCars = async (req, res) => {
  try {
    // The home feed is the hottest public read — cache it like the search
    // list (the vehicle version key orphans it on any listing write).
    const cacheKey = cache.stableKey('vehicles:featured', {});
    const cached = await cache.getJSON(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const candidateSelect = {
      id: true,
      createdAt: true,
      seller: { select: { user: { select: { subscription: { select: { plan: true, status: true, periodEnd: true } } } } } },
    };

    let candidates = await prisma.vehicle.findMany({
      where: {
        status: 'AVAILABLE',
        featured: true,
        AND: [
          { OR: [{ featuredUntil: null }, { featuredUntil: { gt: new Date() } }] },
          notExpiredFilter(),
        ],
      },
      select: candidateSelect,
      take: 24,
      orderBy: { createdAt: 'desc' }
    });

    if (candidates.length === 0) {
      candidates = await prisma.vehicle.findMany({
        where: {
          status: 'AVAILABLE',
          AND: [notExpiredFilter()],
        },
        select: candidateSelect,
        take: 24,
        orderBy: { createdAt: 'desc' }
      });
    }

    // Highest plan tier first, then newest
    candidates.sort((a, b) =>
      (sellerPlanRank(b.seller) - sellerPlanRank(a.seller)) ||
      (new Date(b.createdAt) - new Date(a.createdAt))
    );

    const vehicles = await hydrateVehiclesByIds(candidates.slice(0, 6).map((v) => v.id));

    await cache.setJSON(cacheKey, vehicles, 60);
    res.json(vehicles);
  } catch (error) {
    console.error('Error fetching featured cars:', error);
    res.status(500).json({ message: 'Server error fetching featured cars' });
  }
};

// @desc    Get single vehicle by ID
// @route   GET /api/vehicles/:id
// @access  Public (AVAILABLE listings only; owner/admin see any status; chat
//          participants also see listings that have since been closed)
const getVehicleById = async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        seller: {
          include: {
            // email is deliberately excluded: public viewers get phone only
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
                subscription: { select: { plan: true, status: true, periodEnd: true } },
              },
            },
            reviews: true,
          },
        },
        features: true,
        images: req.query.withImageData === 'true' ? true : imageIdSelect,
      },
    });

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    const isOwner = req.user && vehicle.seller.userId === req.user.id;
    const isAdmin = req.user && req.user.role === 'ADMIN';
    const isExpired = vehicle.expiresAt && vehicle.expiresAt <= new Date();
    const isPrivileged = isOwner || isAdmin;

    // Full-resolution image payloads are only for the owner's edit screen;
    // everyone else gets lightweight /api/images/:id references.
    const withoutImageData = (list) =>
      (list || []).map(({ data, ...rest }) => rest);

    // Anonymous/public viewers only see live, available, unexpired listings.
    if (!isPrivileged) {
      if (vehicle.status !== 'AVAILABLE' || isExpired) {
        // Chat participants keep their vehicle context card after a listing
        // is closed or taken down — the conversation stays coherent. Like the
        // public view, registration documents are never included.
        if (req.user) {
          const participant = await prisma.message.findFirst({
            where: {
              vehicleId: vehicle.id,
              OR: [{ senderId: req.user.id }, { receiverId: req.user.id }],
            },
            select: { id: true },
          });
          if (participant) {
            return res.json({ ...vehicle, images: withoutImageData(vehicle.images), documents: [] });
          }
        }
        return res.status(404).json({ message: 'Vehicle not found' });
      }
      // Never ship registration documents or raw image blobs to the public
      return res.json({ ...vehicle, images: withoutImageData(vehicle.images) });
    }

    // Owner/admin view: include document metadata (never the raw blobs)
    const withDocs = await prisma.vehicleDocument.findMany({
      where: { vehicleId: vehicle.id },
      select: { id: true, documentType: true },
    });
    res.json({ ...vehicle, documents: withDocs });
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    res.status(500).json({ message: 'Server error fetching vehicle' });
  }
};

// @desc    Update a vehicle
// @route   PUT /api/vehicles/:id
// @access  Private (Seller only)
const updateVehicle = async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.id);

    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { seller: true }
    });

    if (!existingVehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    if (existingVehicle.seller.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized to update this vehicle' });
    }

    // A seller editing their listing must go back through admin approval.
    // Admin edits use the dedicated status endpoint instead and keep the
    // current status; a SOLD sale is finished and is never resurrected.
    const isOwner = existingVehicle.seller.userId === req.user.id;
    const nextStatus = isOwner && existingVehicle.status !== 'SOLD'
      ? 'PENDING'
      : existingVehicle.status;

    const {
      make, model, year, price, location, condition,
      mileage, transmission, fuelType, engineSize, bodyType, color,
      description, features, images, documents
    } = req.body;

    const formattedImgList = images ? formatImages(images) : null;
    const formattedDocList = documents ? formatDocuments(documents) : null;

    const updatedVehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        make,
        model,
        year: year ? parseInt(year) : undefined,
        price: price ? parseFloat(price) : undefined,
        location,
        condition,
        mileage: mileage ? parseInt(mileage) : undefined,
        transmission,
        fuelType,
        engineSize,
        bodyType,
        color,
        description,
        status: nextStatus,
        features: features ? {
          deleteMany: {},
          create: features.map(f => ({ featureName: f }))
        } : undefined,
        images: formattedImgList ? {
          deleteMany: {},
          create: formattedImgList
        } : undefined,
        documents: formattedDocList ? {
          deleteMany: {},
          create: formattedDocList
        } : undefined
      },
      include: {
        features: true,
        images: true,
        documents: true
      }
    });

    cache.bumpVehicleVersion();
    audit.logAction({
      actorId: req.user.id,
      actorRole: req.user.role,
      actorName: req.user.name,
      action: 'LISTING.UPDATE',
      entityType: 'VEHICLE',
      entityId: vehicleId,
      meta: {
        title: `${updatedVehicle.year} ${updatedVehicle.make} ${updatedVehicle.model}`.trim(),
        from: existingVehicle.status,
        to: updatedVehicle.status,
      },
    });
    res.json(updatedVehicle);
  } catch (error) {
    console.error('Error updating vehicle:', error);
    const message = error?.message || 'Server error updating vehicle';
    res.status(500).json({ message });
  }
};

// @desc    Delete a vehicle. Live listings are soft-closed (chats kept);
//          an already-closed listing (REMOVED/DEACTIVATED) is wiped for good.
// @route   DELETE /api/vehicles/:id
// @access  Private (Seller only)
const deleteVehicle = async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.id);

    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { seller: true }
    });

    if (!existingVehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    if (existingVehicle.seller.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized to delete this vehicle' });
    }

    const title = `${existingVehicle.year} ${existingVehicle.make} ${existingVehicle.model}`.trim();

    // Second stage: the listing is already off-market, so the owner may wipe
    // it entirely — messages, favourites and reports on it go with it
    // (RESTRICT FKs demand it). Payments only reference vehicles SET NULL, so
    // financial records survive.
    if (['REMOVED', 'DEACTIVATED'].includes(existingVehicle.status)) {
      await prisma.$transaction([
        prisma.message.deleteMany({ where: { vehicleId } }),
        prisma.favorite.deleteMany({ where: { vehicleId } }),
        prisma.report.deleteMany({ where: { vehicleId } }),
        prisma.vehicleImage.deleteMany({ where: { vehicleId } }),
        prisma.vehicleFeature.deleteMany({ where: { vehicleId } }),
        prisma.vehicleDocument.deleteMany({ where: { vehicleId } }),
        prisma.vehicle.delete({ where: { id: vehicleId } }),
      ]);
      cache.bumpVehicleVersion();
      audit.logAction({
        actorId: req.user.id,
        actorRole: req.user.role,
        actorName: req.user.name,
        action: 'LISTING.DELETE',
        entityType: 'VEHICLE',
        entityId: vehicleId,
        meta: { title },
      });
      return res.json({ message: 'Listing permanently deleted.' });
    }

    // First stage: soft close rather than a hard delete — chat history must
    // survive the listing, so the row is kept and hidden instead. Public
    // queries only ever surface AVAILABLE.
    const closed = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status: 'REMOVED', featured: false }
    });

    cache.bumpVehicleVersion();
    audit.logAction({
      actorId: req.user.id,
      actorRole: req.user.role,
      actorName: req.user.name,
      action: 'LISTING.REMOVE',
      entityType: 'VEHICLE',
      entityId: vehicleId,
      meta: { title },
    });
    res.json({ message: 'Listing closed. Your chats about this car are kept.', vehicle: closed });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({ message: 'Server error deleting vehicle' });
  }
};

// @desc    Seller reactivates a closed or taken-down listing
// @route   PUT /api/vehicles/:id/reactivate
// @access  Private (Seller only)
//
// Reactivating never goes live by itself: the listing returns to PENDING and
// must be approved by an admin again.
const reactivateVehicle = async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.id);

    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { seller: true }
    });

    if (!existingVehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    if (existingVehicle.seller.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized to update this vehicle' });
    }

    if (!['REMOVED', 'DEACTIVATED'].includes(existingVehicle.status)) {
      return res.status(400).json({ message: 'Only closed or taken-down listings can be reactivated.' });
    }

    const reactivated = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status: 'PENDING' },
      include: {
        features: true,
        images: imageIdSelect,
        documents: true
      }
    });

    cache.bumpVehicleVersion();
    audit.logAction({
      actorId: req.user.id,
      actorRole: req.user.role,
      actorName: req.user.name,
      action: 'LISTING.REACTIVATE',
      entityType: 'VEHICLE',
      entityId: vehicleId,
      meta: { title: `${reactivated.year} ${reactivated.make} ${reactivated.model}`.trim(), from: existingVehicle.status, to: 'PENDING' },
    });
    res.json({ message: 'Listing reactivated — waiting for admin approval.', vehicle: reactivated });
  } catch (error) {
    console.error('Error reactivating vehicle:', error);
    res.status(500).json({ message: 'Server error reactivating vehicle' });
  }
};

// @desc    Get seller's own listings
// @route   GET /api/vehicles/seller/my-listings
// @access  Private (Seller only)
const getSellerListings = async (req, res) => {
  try {
    let seller = await prisma.sellerProfile.findUnique({
      where: { userId: req.user.id }
    });

    if (!seller) {
      if (req.user.role === 'SELLER' || req.user.role === 'ADMIN') {
        seller = await prisma.sellerProfile.create({
          data: { userId: req.user.id }
        });
      } else {
        return res.status(403).json({ message: 'Only sellers can view listings.' });
      }
    }

    const vehicles = await prisma.vehicle.findMany({
      where: { sellerId: seller.id },
      include: {
        images: imageIdSelect
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(vehicles);
  } catch (error) {
    console.error('Error fetching seller listings:', error);
    res.status(500).json({ message: 'Server error fetching listings' });
  }
};

// @desc    Mark vehicle as sold
// @route   PUT /api/vehicles/:id/sold
// @access  Private (Seller only)
const markAsSold = async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.id);

    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { seller: true }
    });

    if (!existingVehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    if (existingVehicle.seller.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized to update this vehicle' });
    }

    const updatedVehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status: 'SOLD' }
    });

    cache.bumpVehicleVersion();
    audit.logAction({
      actorId: req.user.id,
      actorRole: req.user.role,
      actorName: req.user.name,
      action: 'LISTING.MARK_SOLD',
      entityType: 'VEHICLE',
      entityId: vehicleId,
      meta: { title: `${updatedVehicle.year} ${updatedVehicle.make} ${updatedVehicle.model}`.trim() },
    });
    res.json(updatedVehicle);
  } catch (error) {
    console.error('Error marking vehicle as sold:', error);
    res.status(500).json({ message: 'Server error updating vehicle status' });
  }
};

module.exports = {
  createVehicle,
  getVehicles,
  getFeaturedCars,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  reactivateVehicle,
  getSellerListings,
  markAsSold
};
