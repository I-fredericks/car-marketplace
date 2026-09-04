const prisma = require('../config/db');
const { createNotification } = require('./notificationController');

// @desc    Add vehicle to favorites
// @route   POST /api/favorites/:vehicleId
// @access  Private
const addFavorite = async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.vehicleId);

    const existing = await prisma.favorite.findUnique({
      where: {
        userId_vehicleId: {
          userId: req.user.id,
          vehicleId
        }
      }
    });

    if (existing) {
      return res.status(400).json({ message: 'Already in favorites' });
    }

    await prisma.favorite.create({
      data: {
        userId: req.user.id,
        vehicleId
      }
    });

    // Let the listing's owner know their car caught someone's eye.
    // Never blocks the response, and self-saves don't notify.
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        make: true, model: true, year: true,
        seller: { select: { userId: true } },
      },
    });
    const ownerId = vehicle?.seller?.userId;
    if (ownerId && ownerId !== req.user.id) {
      await createNotification({
        userId: ownerId,
        type: 'LISTING_SAVED',
        title: `${req.user.name} saved your listing`,
        body: `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim(),
        data: { vehicleId, actorId: req.user.id, actorName: req.user.name },
      }).catch(() => {});
    }

    res.status(201).json({ message: 'Added to favorites' });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Remove vehicle from favorites
// @route   DELETE /api/favorites/:vehicleId
// @access  Private
const removeFavorite = async (req, res) => {
  try {
    const vehicleId = parseInt(req.params.vehicleId);

    await prisma.favorite.delete({
      where: {
        userId_vehicleId: {
          userId: req.user.id,
          vehicleId
        }
      }
    });

    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user's favorite vehicles
// @route   GET /api/favorites
// @access  Private
const getFavorites = async (req, res) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      include: {
        vehicle: {
          include: {
            images: {
              where: { isPrimary: true },
              take: 1,
              select: { id: true, isPrimary: true }
            },
            seller: {
              select: {
                verified: true,
                rating: true,
                sellerType: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(favorites.map(f => f.vehicle));
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  addFavorite,
  removeFavorite,
  getFavorites
};
