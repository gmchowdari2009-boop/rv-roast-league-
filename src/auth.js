const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET;

function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}
function comparePassword(pw, hash) {
  return bcrypt.compare(pw, hash);
}
function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role, branch: user.branch }, SECRET, { expiresIn: '30d' });
}

// Attaches req.user if a valid Bearer token is present; does not block the request.
function attachUser(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try { req.user = jwt.verify(token, SECRET); } catch (e) { /* invalid/expired token: treat as logged out */ }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Login required.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
}

// Simple keyword-level moderation pass. Not a substitute for a real classifier,
// but blocks the most obvious harassment/doxxing/threat content before it posts.
const BLOCK_PATTERNS = [
  /\bkill (yourself|urself|him|her|them)\b/i,
  /\brape\b/i,
  /\bsuicide\b/i,
  /\b(i'?ll|going to) (hurt|beat|stab|shoot)\b/i,
  /\bmy (phone|number|address) is\b/i,
  /\b\d{10}\b/,
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/
];
function moderationFlags(text) {
  return BLOCK_PATTERNS.some((re) => re.test(text));
}

module.exports = { hashPassword, comparePassword, signToken, attachUser, requireAuth, requireAdmin, moderationFlags };
