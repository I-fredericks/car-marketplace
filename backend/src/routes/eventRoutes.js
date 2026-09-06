const express = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { addClient, removeClient } = require('../services/eventBus');

const router = express.Router();

// @desc    Server-Sent Events stream (new messages, notifications)
// @route   GET /api/events?token=<jwt>
// @access  Private
//
// EventSource cannot set Authorization headers, so the JWT is accepted from
// the query string as well. Mounted BEFORE compression (gzip buffers
// event streams) and before the API rate limiter.
router.get('/', async (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '').trim()
    || req.query.token;

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  let user;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, role: true, isActive: true },
    });
  } catch (_) {
    return res.status(401).json({ message: 'Not authorized, invalid token' });
  }
  if (!user) {
    return res.status(401).json({ message: 'Not authorized, invalid token' });
  }
  // Deactivated accounts may not open (or keep refreshing) a live stream.
  if (!user.isActive) {
    return res.status(401).json({ message: 'This account has been deactivated.' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable proxy buffering (ngrok/nginx)
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ userId: user.id })}\n\n`);

  addClient(user.id, res);

  // Keepalive comment every 25s so tunnels/load balancers don't close the
  // connection during quiet periods.
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (_) {
      /* cleanup happens on close */
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(user.id, res);
  });
});

module.exports = router;
