const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode);

  // Some code paths (e.g. multer filters) pass plain strings as errors, which
  // have no .message — handle them so users see the real reason, not a
  // generic "Server Error".
  const message = typeof err === 'string'
    ? err
    : (err && err.message) || 'Server Error';

  res.json({
    message,
    stack: process.env.NODE_ENV === 'production' || typeof err !== 'object'
      ? null
      : err.stack
  });
};

module.exports = { errorHandler };
