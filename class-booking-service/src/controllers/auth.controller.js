const authService = require('../services/auth.service');
const { asyncHandler } = require('../utils/errors');
const register = asyncHandler(async (req, res) => { res.status(201).json({ success: true, data: await authService.register(req.body) }); });
const login = asyncHandler(async (req, res) => { res.status(200).json({ success: true, data: await authService.login(req.body) }); });
module.exports = { register, login };