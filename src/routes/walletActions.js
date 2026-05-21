'use strict';

const { Router } = require('express');
const pool = require('../db');

const router = Router();

// ── GET /wallet-actions?commitment_id=&status=&limit=&offset= ────────────────
router.get('/', async (req, res, next) => {
  try {
    const { commitment_id, status, limit = 20, offset = 0 } = req.query;
    let query = 'SELECT * FROM wallet_actions WHERE 1=1';
    const params = [];

    if (commitment_id) { params.push(commitment_id); query += ` AND commitment_id = $${params.length}`; }
    if (status)        { params.push(status);         query += ` AND status = $${params.length}`; }

    params.push(Number(limit));
    params.push(Number(offset));
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// ── GET /wallet-actions/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM wallet_actions WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Wallet action not found' });
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
