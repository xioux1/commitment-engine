'use strict';

const { Router } = require('express');
const pool = require('../db');

const router = Router();

// ── GET /evaluations?commitment_id=&result=&limit=&offset= ───────────────────
router.get('/', async (req, res, next) => {
  try {
    const { commitment_id, result, limit = 20, offset = 0 } = req.query;
    let query = `
      SELECT e.*, ms.metrics_data
      FROM evaluations e
      JOIN metric_snapshots ms ON ms.id = e.metric_snapshot_id
      WHERE 1=1
    `;
    const params = [];

    if (commitment_id) { params.push(commitment_id); query += ` AND e.commitment_id = $${params.length}`; }
    if (result)        { params.push(result);         query += ` AND e.result = $${params.length}`; }

    params.push(Number(limit));
    params.push(Number(offset));
    query += ` ORDER BY e.evaluated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// ── GET /evaluations/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*, ms.metrics_data
       FROM evaluations e
       JOIN metric_snapshots ms ON ms.id = e.metric_snapshot_id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Evaluation not found' });
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
