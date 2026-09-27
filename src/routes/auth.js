const express = require('express');
const rateLimit = require('express-rate-limit');
const { pool } = require('../db');
const { hashPassword, comparePassword, signToken, requireAuth } = require('../auth');

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

router.post('/register', authLimiter, async (req, res) => {
  const { username, password, branch } = req.body || {};
  if (!username || !password || !branch) return res.status(400).json({ error: 'username, password and branch are required.' });
  if (username.length < 3 || username.length > 24) return res.status(400).json({ error: 'Username must be 3-24 characters.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  const branchRow = await pool.query('SELECT code FROM branches WHERE code = $1', [branch]);
  if (branchRow.rows.length === 0) return res.status(400).json({ error: 'Unknown branch.' });
  const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
  if (existing.rows.length > 0) return res.status(409).json({ error: 'Username already taken.' });
  const hash = await hashPassword(password);
  const ip = req.ip;
  const { rows } = await pool.query(
    `INSERT INTO users (username, password_hash, branch, signup_ip) VALUES ($1,$2,$3,$4) RETURNING id, username, branch, role`,
    [username, hash, branch, ip]
  );
  const user = rows[0];
  res.json({ token: signToken(user), user });
});
router.post('/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password are required.' });
  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  if (rows.length === 0) return res.status(401).json({ error: 'Invalid username or password.' });
  const user = rows[0];
  if (user.status !== 'active') return res.status(403).json({ error: 'This account is suspended.' });
  const ok = await comparePassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid username or password.' });
  res.json({ token: signToken(user), user: { id: user.id, username: user.username, branch: user.branch, role: user.role } });
});
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT id, username, branch, role FROM users WHERE id = $1', [req.user.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: rows[0] });
});
router.patch('/me', requireAuth, async (req, res) => {
  const { username, branch } = req.body || {};
  const updates = [], values = []; let i = 1;
  if (username) {
    const existing = await pool.query('SELECT id FROM users WHERE username = $1 AND id <> $2', [username, req.user.id]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Username already taken.' });
    updates.push(`username = $${i++}`); values.push(username);
  }
  if (branch) {
    const roastCount = await pool.query('SELECT COUNT(*) FROM roasts WHERE user_id = $1', [req.user.id]);
    if (parseInt(roastCount.rows[0].count, 10) > 0) return res.status(400).json({ error: 'Branch can only be changed before you post your first roast.' });
    const branchRow = await pool.query('SELECT code FROM branches WHERE code = $1', [branch]);
    if (branchRow.rows.length === 0) return res.status(400).json({ error: 'Unknown branch.' });
    updates.push(`branch = $${i++}`); values.push(branch);
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update.' });
  values.push(req.user.id);
  const { rows } = await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, username, branch, role`, values);
  res.json({ token: signToken(rows[0]), user: rows[0] });
});
module.exports = router;