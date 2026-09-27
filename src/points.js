const { pool } = require('./db');

// Upvote milestones -> bonus points, awarded once each per roast.
const MILESTONES = [
  { threshold: 25, bonus: 5 },
  { threshold: 50, bonus: 10 },
  { threshold: 100, bonus: 25 },
  { threshold: 250, bonus: 50 }
];

/**
 * Recomputes a single roast's point total after a vote or comment changes,
 * awards any newly-crossed upvote milestones, and keeps the branch's
 * total_points in sync - logging every change to point_transactions so the
 * leaderboard stays auditable.
 */
async function recalcRoast(client, roastId) {
  const { rows } = await client.query(
    `SELECT r.*, 
       (SELECT COUNT(*) FROM votes WHERE roast_id = r.id AND vote_type='up') AS up_count,
       (SELECT COUNT(*) FROM votes WHERE roast_id = r.id AND vote_type='down') AS down_count,
       (SELECT COUNT(*) FROM comments WHERE roast_id = r.id) AS comment_count
     FROM roasts r WHERE r.id = $1 FOR UPDATE`,
    [roastId]
  );
  if (rows.length === 0) return;
  const r = rows[0];
  const up = parseInt(r.up_count, 10);
  const down = parseInt(r.down_count, 10);
  const comments = parseInt(r.comment_count, 10);
  const awarded = new Set(r.milestones_awarded || []);

  let milestoneBonus = 0;
  for (const m of MILESTONES) {
    if (up >= m.threshold) {
      milestoneBonus += m.bonus;
      if (!awarded.has(m.threshold)) {
        awarded.add(m.threshold);
        await client.query(
          `INSERT INTO point_transactions (branch, roast_id, points, reason) VALUES ($1,$2,$3,$4)`,
          [r.branch, r.id, m.bonus, `milestone_${m.threshold}_upvotes`]
        );
      }
    }
  }

  const newTotal = up - down + comments * 2 + milestoneBonus;
  const diff = newTotal - r.cached_points;

  if (diff !== 0) {
    await client.query(
      `INSERT INTO point_transactions (branch, roast_id, points, reason) VALUES ($1,$2,$3,'engagement_update')`,
      [r.branch, r.id, diff]
    );
    await client.query(`UPDATE branches SET total_points = total_points + $1 WHERE code = $2`, [diff, r.branch]);
  }

  await client.query(
    `UPDATE roasts SET cached_points = $1, milestones_awarded = $2 WHERE id = $3`,
    [newTotal, JSON.stringify([...awarded]), roastId]
  );

  return { up, down, comments, points: newTotal };
}

// When a roast is removed or deleted, unwind its point contribution from the branch total.
async function reverseRoastPoints(client, roast) {
  if (roast.cached_points !== 0) {
    await client.query(
      `INSERT INTO point_transactions (branch, roast_id, points, reason) VALUES ($1,$2,$3,'roast_removed_or_deleted')`,
      [roast.branch, roast.id, -roast.cached_points]
    );
    await client.query(`UPDATE branches SET total_points = total_points - $1 WHERE code = $2`, [roast.cached_points, roast.branch]);
  }
}

module.exports = { recalcRoast, reverseRoastPoints, MILESTONES, pool };
