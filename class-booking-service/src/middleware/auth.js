const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/errors');

const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return next(new AppError('Authentication required.', 401, 'MISSING_TOKEN'));
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    next(new AppError(err.name === 'TokenExpiredError' ? 'Token expired.' : 'Invalid token.', 401, 'INVALID_TOKEN'));
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role))
    return next(new AppError(`Access denied. Required: ${roles.join(' or ')}.`, 403, 'FORBIDDEN'));
  next();
};

module.exports = { authenticate, requireRole };