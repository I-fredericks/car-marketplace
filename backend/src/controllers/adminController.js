const prisma = require('../config/db');

// @desc    Get all pending vehicle listings
// @route   GET /api/admin/vehicles/pending
// @access  Private (Admin only)
const getPendingVehicles = async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { status: 'PENDING' },
      include: {
        images: true,
        seller: {
          include: {
            user: {
              select: { name: true, email: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(vehicles);
  } catch (error) {
    console.error('Error fetching pending vehicles:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all available vehicle listings (for admin management)
// @route   GET /api/admin/vehicles/all
// @access  Private (Admin only)
const getAllVehicles = async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { status: 'AVAILABLE' },
      include: {
        images: { take: 1 },
        seller: {
          include: {
            user: { select: { name: true } }
          }
        }
      },
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }]
    });
    res.json(vehicles);
  } catch (error) {
    console.error('Error fetching all vehicles:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Approve or reject a vehicle listing
// @route   PUT /api/admin/vehicles/:id/status
// @access  Private (Admin only)
const updateListingStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['AVAILABLE', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status update' });
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: parseInt(req.params.id) },
      data: { status }
    });

    res.json({ message: `Vehicle marked as ${status}`, vehicle });
  } catch (error) {
    console.error('Error updating vehicle status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Toggle featured status on a vehicle
// @route   PUT /api/admin/vehicles/:id/featured
// @access  Private (Admin only)
const toggleFeatured = async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.id);
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    const updated = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { featured: !vehicle.featured }
    });

    res.json({ message: `Vehicle ${updated.featured ? 'featured' : 'unfeatured'}`, vehicle: updated });
  } catch (error) {
    console.error('Error toggling featured:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all users (for management)
// @route   GET /api/admin/users
// @access  Private (Admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        verified: true,
        createdAt: true,
        sellerProfile: {
          select: { verified: true, sellerType: true, rating: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Verify a seller
// @route   PUT /api/admin/users/:id/verify
// @access  Private (Admin only)
const verifySeller = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { verified: true },
    });

    if (user.role === 'SELLER') {
      await prisma.sellerProfile.update({
        where: { userId: userId },
        data: { verified: true },
      });
    }

    res.json({ message: 'Seller verified successfully' });
  } catch (error) {
    console.error('Error verifying seller:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete a user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin only)
const deleteUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    await prisma.$transaction([
      prisma.sellerProfile.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } })
    ]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error deleting user' });
  }
};

// @desc    Get marketplace statistics
// @route   GET /api/admin/stats
// @access  Private (Admin only)
const getStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalSellers,
      totalBuyers,
      pendingListings,
      availableListings,
      soldListings,
      rejectedListings,
      featuredListings,
      totalFavorites,
      totalMessages,
      pendingReports,
      totalReports,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'SELLER' } }),
      prisma.user.count({ where: { role: 'BUYER' } }),
      prisma.vehicle.count({ where: { status: 'PENDING' } }),
      prisma.vehicle.count({ where: { status: 'AVAILABLE' } }),
      prisma.vehicle.count({ where: { status: 'SOLD' } }),
      prisma.vehicle.count({ where: { status: 'REJECTED' } }),
      prisma.vehicle.count({ where: { featured: true } }),
      prisma.favorite.count(),
      prisma.message.count(),
      prisma.report.count({ where: { status: 'PENDING' } }),
      prisma.report.count(),
    ]);

    res.json({
      users: { total: totalUsers, sellers: totalSellers, buyers: totalBuyers },
      listings: {
        pending: pendingListings,
        available: availableListings,
        sold: soldListings,
        rejected: rejectedListings,
        featured: featuredListings,
        total: pendingListings + availableListings + soldListings + rejectedListings,
      },
      engagement: {
        favorites: totalFavorites,
        messages: totalMessages,
      },
      reports: {
        pending: pendingReports,
        total: totalReports,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all reports
// @route   GET /api/admin/reports
// @access  Private (Admin only)
const getReports = async (req, res) => {
  try {
    const reports = await prisma.report.findMany({
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        vehicle: { select: { id: true, make: true, model: true, year: true } },
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Resolve a report
// @route   PUT /api/admin/reports/:id/resolve
// @access  Private (Admin only)
const resolveReport = async (req, res) => {
  try {
    const report = await prisma.report.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'RESOLVED' }
    });
    res.json({ message: 'Report resolved', report });
  } catch (error) {
    console.error('Error resolving report:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getPendingVehicles,
  getAllVehicles,
  updateListingStatus,
  toggleFeatured,
  getAllUsers,
  verifySeller,
  deleteUser,
  getStats,
  getReports,
  resolveReport,
};
