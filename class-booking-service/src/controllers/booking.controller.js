const svc = require('../services/booking.service');
const { asyncHandler } = require('../utils/errors');
const getAvailableOfferings = asyncHandler(async (req, res) => { res.status(200).json({ success: true, data: await svc.getAvailableOfferings(req.user.id, req.user.timezone) }); });
const bookOffering = asyncHandler(async (req, res) => {
  try { res.status(201).json({ success: true, data: await svc.bookOffering(req.user.id, req.params.offeringId, req.user.timezone) }); }
  catch (err) {
    if (err.code === 'TIME_CONFLICT' && err.meta) return res.status(409).json({ success: false, code: err.code, message: err.message, conflicts: err.meta });
    throw err;
  }
});
const getBookings = asyncHandler(async (req, res) => { res.status(200).json({ success: true, data: await svc.getParentBookings(req.user.id, req.user.timezone) }); });
const cancelBooking = asyncHandler(async (req, res) => { res.status(200).json({ success: true, data: await svc.cancelBooking(req.user.id, req.params.bookingId) }); });
module.exports = { getAvailableOfferings, bookOffering, getBookings, cancelBooking };