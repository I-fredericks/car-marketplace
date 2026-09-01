const prisma = require('../config/db');

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
const getVehicles = async (req, res) => {
  try {
    const {
      make, model, condition, transmission, fuelType,
      minPrice, maxPrice, location, verifiedOnly, search,
      sortBy = 'createdAt', order = 'desc', page = 1, limit = 12
    } = req.query;

    const where = {
      status: 'AVAILABLE'
    };

    if (make) where.make = { equals: make };
    if (model) where.model = { contains: model };
    if (condition) where.condition = condition;
    if (transmission) where.transmission = transmission;
    if (fuelType) where.fuelType = fuelType;
    if (location) where.location = location;

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }

    if (verifiedOnly === 'true') {
      where.seller = { verified: true };
    }

    if (search) {
      where.OR = [
        { make: { contains: search } },
        { model: { contains: search } },
        { description: { contains: search } },
        { location: { contains: search } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        include: {
          seller: {
            include: { user: { select: { name: true, phone: true } } }
          },
          images: true
        },
        orderBy: { [sortBy]: order },
        skip,
        take
      }),
      prisma.vehicle.count({ where })
    ]);

    res.json({
      vehicles,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ message: 'Server error fetching vehicles' });
  }
};

// @desc    Get featured vehicles
// @route   GET /api/vehicles/featured
// @access  Public
const getFeaturedCars = async (req, res) => {
  try {
    let vehicles = await prisma.vehicle.findMany({
      where: {
        status: 'AVAILABLE',
        featured: true,
      },
      include: {
        seller: {
          include: { user: { select: { name: true, phone: true } } }
        },
        images: true,
      },
      take: 6,
      orderBy: { createdAt: 'desc' }
    });

    if (vehicles.length === 0) {
      vehicles = await prisma.vehicle.findMany({
        where: { status: 'AVAILABLE' },
        include: {
          seller: {
            include: { user: { select: { name: true, phone: true } } }
          },
          images: true,
        },
        take: 6,
        orderBy: { createdAt: 'desc' }
      });
    }

    res.json(vehicles);
  } catch (error) {
    console.error('Error fetching featured cars:', error);
    res.status(500).json({ message: 'Server error fetching featured cars' });
  }
};

// @desc    Get single vehicle by ID
// @route   GET /api/vehicles/:id
// @access  Public
const getVehicleById = async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        seller: {
          include: {
            user: { select: { id: true, name: true, phone: true, email: true } },
            reviews: true
          }
        },
        features: true,
        images: true,
        documents: true
      }
    });

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    res.json(vehicle);
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
        status: 'PENDING',
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

    res.json(updatedVehicle);
  } catch (error) {
    console.error('Error updating vehicle:', error);
    const message = error?.message || 'Server error updating vehicle';
    res.status(500).json({ message });
  }
};

// @desc    Delete a vehicle
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

    await prisma.vehicleFeature.deleteMany({ where: { vehicleId } });
    await prisma.vehicleImage.deleteMany({ where: { vehicleId } });
    await prisma.vehicleDocument.deleteMany({ where: { vehicleId } });
    await prisma.favorite.deleteMany({ where: { vehicleId } });
    await prisma.report.deleteMany({ where: { vehicleId } });

    await prisma.vehicle.delete({
      where: { id: vehicleId }
    });

    res.json({ message: 'Vehicle removed successfully' });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({ message: 'Server error deleting vehicle' });
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
        images: true
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
  getSellerListings,
  markAsSold
};
