const prisma = require('../config/db');

// @desc    Create a new vehicle listing
// @route   POST /api/vehicles
// @access  Private (Seller only)
const createVehicle = async (req, res) => {
  try {
    // Make sure user has a seller profile
    const seller = await prisma.sellerProfile.findUnique({
      where: { userId: req.user.id }
    });

    if (!seller) {
      return res.status(403).json({ message: 'Only sellers can create listings. Please upgrade your account.' });
    }

    const {
      make, model, year, price, location, condition,
      mileage, transmission, fuelType, engineSize, bodyType, color,
      description,
      features, // Array of strings e.g., ["Air Conditioning", "Bluetooth"]
      images    // Array of objects e.g., [{ url: "...", isPrimary: true }]
    } = req.body;

    // Create the vehicle with nested relationships for features and images
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
        // Nested write for features
        features: features && features.length > 0 ? {
          create: features.map(f => ({ featureName: f }))
        } : undefined,
        // Nested write for images
        images: images && images.length > 0 ? {
          create: images.map(img => ({ url: img.url, isPrimary: img.isPrimary || false }))
        } : undefined
      },
      include: {
        features: true,
        images: true
      }
    });

    res.status(201).json(vehicle);
  } catch (error) {
    console.error('Error creating vehicle:', error);
    res.status(500).json({ message: 'Server error creating vehicle' });
  }
};

// @desc    Get all vehicles with advanced filtering
// @route   GET /api/vehicles
// @access  Public
const getVehicles = async (req, res) => {
  try {
    const { 
      make, model, minPrice, maxPrice, year, 
      location, transmission, fuelType, condition 
    } = req.query;

    // Build the query dynamically based on provided filters
    let whereClause = { status: 'AVAILABLE' };

    if (make) whereClause.make = { equals: make };
    if (model) whereClause.model = { equals: model };
    if (location) whereClause.location = { equals: location };
    if (transmission) whereClause.transmission = transmission;
    if (fuelType) whereClause.fuelType = fuelType;
    if (condition) whereClause.condition = condition;
    if (year) whereClause.year = parseInt(year);
    
    // Price range filter
    if (minPrice || maxPrice) {
      whereClause.price = {};
      if (minPrice) whereClause.price.gte = parseFloat(minPrice);
      if (maxPrice) whereClause.price.lte = parseFloat(maxPrice);
    }

    const vehicles = await prisma.vehicle.findMany({
      where: whereClause,
      include: {
        images: {
          where: { isPrimary: true },
          take: 1
        },
        seller: {
          select: {
            verified: true,
            rating: true,
            sellerType: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(vehicles);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ message: 'Server error fetching vehicles' });
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
        images: true,
        features: true,
        seller: {
          include: {
            user: {
              select: {
                name: true,
                phone: true
              }
            }
          }
        }
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

    // Get the vehicle and ensure it belongs to the logged-in seller
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { seller: true }
    });

    if (!existingVehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    if (existingVehicle.seller.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this vehicle' });
    }

    // Extract fields that can be updated
    const { price, location, condition, mileage, description, status } = req.body;

    const updatedVehicle = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        price: price ? parseFloat(price) : undefined,
        location,
        condition,
        mileage: mileage ? parseInt(mileage) : undefined,
        description,
        status,
      }
    });

    res.json(updatedVehicle);
  } catch (error) {
    console.error('Error updating vehicle:', error);
    res.status(500).json({ message: 'Server error updating vehicle' });
  }
};

// @desc    Delete a vehicle
// @route   DELETE /api/vehicles/:id
// @access  Private (Seller only)
const deleteVehicle = async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.id);

    // Get the vehicle and ensure it belongs to the logged-in seller
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

    // Delete related features and images first (if not cascading in DB)
    await prisma.vehicleFeature.deleteMany({ where: { vehicleId } });
    await prisma.vehicleImage.deleteMany({ where: { vehicleId } });

    await prisma.vehicle.delete({
      where: { id: vehicleId }
    });

    res.json({ message: 'Vehicle removed successfully' });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({ message: 'Server error deleting vehicle' });
  }
};

module.exports = {
  createVehicle,
  getVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle
};
