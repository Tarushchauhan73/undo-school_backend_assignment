const { validationResult } = require('express-validator');

const validate = (validations) => async (req, res, next) => {
  await Promise.all(validations.map((v) => v.run(req)));
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(422).json({
    success: false, code: 'VALIDATION_ERROR',
    errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
  });
};

const errorHandler = (err, req, res, next) => {
  if (err.code === '23505')
    return res.status(409).json({ success: false, code: 'DUPLICATE_ENTRY', message: 'Record already exists.' });
  if (err.code === '23503')
    return res.status(400).json({ success: false, code: 'INVALID_REFERENCE', message: 'Referenced resource not found.' });
  if (err.isOperational) {
    const body = { success: false, code: err.code || 'ERROR', message: err.message };
    if (err.meta) body.details = err.meta;
    return res.status(err.statusCode).json(body);
  }
  console.error('Unhandled error:', err);
  return res.status(500).json({
    success: false, code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
  });
};

module.exports = { validate, errorHandler };