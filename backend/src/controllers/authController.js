const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const register = async (req, res) => {
  try {
    const { email, password, name, phone, role } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        role: role || 'BUYER',
      },
    });

    if (user.role === 'SELLER') {
      await prisma.sellerProfile.create({
        data: {
          userId: user.id,
        },
      });
    }

    res.status(201).json({ message: 'User registered successfully', userId: user.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get current logged in user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        sellerProfile: true, // Bring in seller details if they exist
      },
    });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Upgrade a Buyer account to a Seller account
// @route   PUT /api/auth/upgrade
// @access  Private
const upgradeToSeller = async (req, res) => {
  try {
    if (req.user.role === 'SELLER' || req.user.role === 'ADMIN') {
      return res.status(400).json({ message: 'User is already a seller or admin' });
    }

    const { whatsapp, location, sellerType } = req.body;

    // Update user role and create a seller profile in a transaction
    const [updatedUser, sellerProfile] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { role: 'SELLER' },
      }),
      prisma.sellerProfile.create({
        data: {
          userId: req.user.id,
          whatsapp,
          location,
          sellerType: sellerType || 'PRIVATE',
        },
      }),
    ]);

    // Generate a fresh token with the new role
    const token = jwt.sign(
      { id: updatedUser.id, role: updatedUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Account upgraded to seller successfully',
      token,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        role: updatedUser.role,
      },
      sellerProfile
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during upgrade' });
  }
};

const logout = (req, res) => {
  res.json({ message: 'Logged out successfully' });
};

module.exports = {
  register,
  login,
  getMe,
  upgradeToSeller,
  logout
};
