const express = require('express');
const { pool } = require('../db');
const router = express.Router();
router.get('/', async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT b.code, b.name, b.total_points,
      (SELECT COUNT(*) FROM roasts WHERE branch = b.code AND status='active') AS roast_count,
      (SELECT COUNT(*) FROM votes v JOIN roasts r ON v.roast_id = r.id WHERE r.branch = b.code AND r.status='active') AS vote_count
    FROM branches b ORDER BY b.total_points DESC
  `);
  res.json({ branches: rows });
});
router.get('/:code', async (req, res) => {
  const { code } = req.params;
  const branch = await pool.query('SELECT * FROM branches WHERE code = $1', [code]);
  if (branch.rows.length === 0) return res.status(404).json({ error: 'Branch not found.' });
  const ranked = await pool.query('SELECT code FROM branches ORDER BY total_points DESC');
  const rank = ranked.rows.findIndex((r) => r.code === code) + 1;
  const above = rank > 1 ? ranked.rows[rank - 2].code : null;
  let aboveInfo = null;
  if (above) { const a = await pool.query('SELECT code, total_points FROM branches WHERE code = $1', [above]); aboveInfo = a.rows[0]; }
  const recent = await pool.query(`SELECT r.id, r.text, r.category, r.cached_points, r.created_at, u.username FROM roasts r JOIN users u ON r.user_id = u.id WHERE r.branch = $1 AND r.status = 'active' ORDER BY r.created_at DESC LIMIT 20`, [code]);
  const topContributors = await pool.query(`SELECT u.username, COALESCE(SUM(r.cached_points),0) AS points, COUNT(r.id) AS roasts FROM users u JOIN roasts r ON r.user_id = u.id AND r.status='active' WHERE u.branch = $1 GROUP BY u.username ORDER BY points DESC LIMIT 5`, [code]);
  res.json({ branch: branch.rows[0], rank, above: aboveInfo, recentRoasts: recent.rows, topContributors: topContributors.rows });
});
module.exports = router;