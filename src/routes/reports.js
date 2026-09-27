const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../auth');
const router = express.Router();
router.post('/', requireAuth, async (req, res) => {
  const { contentType, contentId, reason } = req.body || {};
  if (!['roast', 'comment'].includes(contentType) || !contentId) return res.status(400).json({ error: 'contentType (roast|comment) and contentId are required.' });
  const { rows } = await pool.query(`INSERT INTO reports (reporter_id, content_type, content_id, reason) VALUES ($1,$2,$3,$4) RETURNING *`, [req.user.id, contentType, contentId, reason || null]);
  res.status(201).json({ report: rows[0] });
});
module.exports = router;