const { body, param } = require('express-validator');
const { isValidTimezone } = require('../utils/timezone');
const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required.'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required.'),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars.'),
  body('role').isIn(['teacher', 'parent']).withMessage('Role must be teacher or parent.'),
  body('timezone').notEmpty().custom(tz => { if (!isValidTimezone(tz)) throw new Error(`Invalid timezone: "${tz}"`); return true; }),
];
const loginRules = [body('email').isEmail().normalizeEmail(), body('password').notEmpty()];
const createOfferingRules = [
  body('title').trim().notEmpty().withMessage('Offering title required.'),
  body('courseId').optional().isUUID(),
  body('courseTitle').if(body('courseId').not().exists()).trim().notEmpty().withMessage('courseTitle required when courseId not provided.'),
  body('maxStudents').optional().isInt({ min: 1 }),
];
const addSessionsRules = [
  param('offeringId').isUUID(),
  body('sessions').isArray({ min: 1 }).withMessage('Provide at least one session.'),
  body('sessions.*.startTime').notEmpty().withMessage('startTime required per session.'),
  body('sessions.*.endTime').notEmpty().withMessage('endTime required per session.'),
];
const updateOfferingStatusRules = [param('offeringId').isUUID(), body('status').isIn(['cancelled', 'completed'])];
const bookOfferingRules = [param('offeringId').isUUID()];
const cancelBookingRules = [param('bookingId').isUUID()];
module.exports = { registerRules, loginRules, createOfferingRules, addSessionsRules, updateOfferingStatusRules, bookOfferingRules, cancelBookingRules };