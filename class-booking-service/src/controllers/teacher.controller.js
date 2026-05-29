const svc = require('../services/teacher.service');
const { asyncHandler } = require('../utils/errors');
const createOffering = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await svc.createOffering(req.user.id, req.body) }); });
const addSessions = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await svc.addSessions(req.user.id, req.params.offeringId, req.body.sessions, req.user.timezone) }); });
const getOfferings = asyncHandler(async (req, res) => { res.status(200).json({ success: true, data: await svc.getTeacherOfferings(req.user.id, { includeCompleted: req.query.includeCompleted === 'true' }) }); });
const getOfferingSessions = asyncHandler(async (req, res) => { res.status(200).json({ success: true, data: await svc.getOfferingSessions(req.user.id, req.params.offeringId, req.user.timezone) }); });
const updateOfferingStatus = asyncHandler(async (req, res) => { res.status(200).json({ success: true, data: await svc.updateOfferingStatus(req.user.id, req.params.offeringId, req.body.status) }); });
module.exports = { createOffering, addSessions, getOfferings, getOfferingSessions, updateOfferingStatus };