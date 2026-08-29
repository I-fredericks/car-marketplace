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

// @desc    Approve or reject a vehicle listing
// @route   PUT /api/admin/vehicles/:id/status
// @access  Private (Admin only)
const updateListingStatus = async (req, res) => {
  try {
    const { status } = req.body; // Expects 'AVAILABLE' (Approve) or 'REJECTED'

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

    // Verify both User and SellerProfile
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

    res.json({ message: 'Seller verified successfully (🟢 Verified Badge Applied)' });
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

    // Using transaction to clean up user data
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

module.exports = {
  getPendingVehicles,
  updateListingStatus,
  getAllUsers,
  verifySeller,
  deleteUser
};
