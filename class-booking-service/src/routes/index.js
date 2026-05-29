const { Router } = require('express');
const authCtrl    = require('../controllers/auth.controller');
const teacherCtrl = require('../controllers/teacher.controller');
const bookingCtrl = require('../controllers/booking.controller');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/errorHandler');
const v = require('../validators');
const router = Router();

router.post('/auth/register', validate(v.registerRules), authCtrl.register);
router.post('/auth/login',    validate(v.loginRules),    authCtrl.login);

router.post('/teacher/offerings',                      authenticate, requireRole('teacher'), validate(v.createOfferingRules),      teacherCtrl.createOffering);
router.post('/teacher/offerings/:offeringId/sessions', authenticate, requireRole('teacher'), validate(v.addSessionsRules),         teacherCtrl.addSessions);
router.get( '/teacher/offerings',                      authenticate, requireRole('teacher'),                                       teacherCtrl.getOfferings);
router.get( '/teacher/offerings/:offeringId/sessions', authenticate, requireRole('teacher'),                                       teacherCtrl.getOfferingSessions);
router.patch('/teacher/offerings/:offeringId/status',  authenticate, requireRole('teacher'), validate(v.updateOfferingStatusRules), teacherCtrl.updateOfferingStatus);

router.get( '/parent/offerings',                       authenticate, requireRole('parent'),                                        bookingCtrl.getAvailableOfferings);
router.post('/parent/offerings/:offeringId/book',      authenticate, requireRole('parent'),  validate(v.bookOfferingRules),        bookingCtrl.bookOffering);
router.get( '/parent/bookings',                        authenticate, requireRole('parent'),                                        bookingCtrl.getBookings);
router.patch('/parent/bookings/:bookingId/cancel',     authenticate, requireRole('parent'),  validate(v.cancelBookingRules),       bookingCtrl.cancelBooking);

router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
module.exports = router;