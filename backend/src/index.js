const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const { errorHandler } = require('./middlewares/errorHandler');

dotenv.config();

const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Password reset is email-only, so production without SMTP has a dead auth
// recovery path. Warn at boot; forgot-password returns 503 in this state.
if (process.env.NODE_ENV === 'production' && !(process.env.SMTP_HOST && process.env.SMTP_USER)) {
  console.warn('⚠️  SMTP is not configured — password reset emails cannot be delivered. Set SMTP_HOST/SMTP_USER/SMTP_PASS.');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Deployed behind proxies/tunnels: without this, rate limiting keys on the
// proxy IP (one shared bucket for everyone) and req.protocol is wrong.
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false, // Allow inline styles & base64 / static images in demo mode
}));

// HTTP request logging: concise in dev, standard combined format in prod.
// Health probes are skipped so uptime checks don't flood the log.
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  skip: (req) => req.path === '/api/health' || req.path === '/api',
}));

// SSE stream (live messages + notifications). Must be mounted BEFORE
// compression: gzip buffers event-stream responses and breaks realtime
// delivery. Auth via Authorization header or ?token= (EventSource can't
// set headers).
app.use('/api/events', require('./routes/eventRoutes'));

// Gzip/deflate all API + static responses (images already compressed formats stay cheap)
app.use(compression());

// CORS allowlist: production origins come from FRONTEND_URL (comma-separated).
// Dev origins are always allowed. Requests without an Origin header (mobile
// apps, curl, same-origin) are not subject to CORS and pass through.
const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];
const allowedOrigins = new Set([
  ...DEV_ORIGINS,
  ...(process.env.FRONTEND_URL || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean),
]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true
}));

const { getImage, getImageThumb } = require('./controllers/imageController');

// Immutable-cached binary images, exempt from the API rate limiter: browsers
// request these in bursts while scrolling lists and 304 responses are free.
// Must be mounted BEFORE the /api/ limiter or every image counts against it.
app.get('/api/images/:id', getImage);
app.get('/api/images/:id/thumb', getImageThumb);

// Public profile photos (own-profile preview + admin review load this UA-free):
// same rate-limit exemption as vehicle images.
// Public profile photos: APPROVED photos render anywhere a user identity is
// shown (navbar, chats, seller cards); PENDING/REJECTED load only for their
// owner and admins (own-profile preview + review). optionalAuth identifies
// the requester without blocking anonymous visitors.
app.get('/api/users/:id/avatar', require('./middlewares/authMiddleware').optionalAuth, require('./controllers/avatarController').getAvatar);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { message: 'Too many login attempts, please try again later' }
});
app.use('/api/auth/', authLimiter);

app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => { req.rawBody = buf; }, // needed for Paystack webhook signature check
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static uploads directory (backend/uploads) with long-lived caching
const uploadsFolder = path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsFolder, {
  maxAge: '1y',
  immutable: true,
}));

// API Routes
app.get('/api', (req, res) => {
  res.json({ message: 'Car Marketplace API is running', status: 'OK', timestamp: new Date() });
});

// Liveness + DB readiness for uptime checks and deploy health gates
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'OK', db: 'up', timestamp: new Date() });
  } catch (err) {
    console.error('Health check DB failure:', err.message);
    res.status(503).json({ status: 'ERROR', db: 'down', timestamp: new Date() });
  }
});

const authRoutes = require('./routes/authRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const adminRoutes = require('./routes/adminRoutes');
const prisma = require('./config/db');
const cache = require('./services/cache');
cache.initVehicleVersion();

app.use('/api/auth', authRoutes);
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/favorites', require('./routes/favoriteRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/billing', require('./routes/billingRoutes'));
app.use('/api/purchases', require('./routes/purchaseRoutes'));

// Serve static frontend build if dist folder exists (for single-tunnel ngrok presentation)
const distPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(distPath, {
  // Vite content-hashes /assets/* filenames: safe to cache forever.
  // index.html stays uncached so new deploys appear on refresh.
  setHeaders: (res, filePath) => {
    if (filePath.startsWith(path.join(distPath, 'assets'))) {
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.set('Cache-Control', 'no-cache');
    }
  },
}));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.send('Car Marketplace API is running...');
    }
  });
});

app.use(errorHandler);

module.exports = app;

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  // Daily maintenance: demote ended subscriptions, notify sellers of lapsed
  // free listings (see src/jobs/expiry.js for why statuses stay untouched).
  require('./jobs/expiry').startExpiryScheduler();

  // Graceful shutdown: stop accepting connections, let in-flight requests
  // finish, release the DB pool, then exit. Deploy platforms send SIGTERM.
  const shutdown = async (signal) => {
    console.log(`\n${signal} received: shutting down gracefully...`);
    server.close(async () => {
      try {
        await prisma.$disconnect();
        process.exit(0);
      } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
      }
    });
    // Drain deadline: force-exit if connections refuse to close
    setTimeout(() => {
      console.error('Forced exit: connections did not drain in time');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    shutdown('uncaughtException');
  });
}
