const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { AppError } = require('../utils/errors');
const { isValidTimezone } = require('../utils/timezone');

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, timezone: user.timezone },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

const register = async ({ name, email, password, role, timezone }) => {
  if (!isValidTimezone(timezone))
    throw new AppError(`Invalid timezone: "${timezone}"`, 400, 'INVALID_TIMEZONE');
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role, timezone)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, role, timezone, created_at`,
    [name, email.toLowerCase(), hash, role, timezone]
  );
  return { user: rows[0], token: signToken(rows[0]) };
};

const login = async ({ email, password }) => {
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, timezone: user.timezone },
    token: signToken(user),
  };
};

module.exports = { register, login };