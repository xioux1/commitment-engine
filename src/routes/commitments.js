'use strict';

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { runEvaluation } = require('../evaluator/pipeline');

const router = Router();

// ── Validation helpers ────────────────────────────────────────────────────────

const VALID_OPERATORS = ['>=', '<=', '>', '<', '=='];
const VALID_LOGIC     = ['all', 'any'];
const VALID_PERIODS   = ['weekly', 'daily', 'monthly'];
const VALID_STATUSES  = ['active', 'paused', 'completed', 'cancelled'];

function validateRules(rules) {
  if (!Array.isArray(rules) || rules.length === 0) {
    return 'rules must be a non-empty array';
  }
  for (const r of rules) {
    if (!r.metric || typeof r.metric !== 'string') return 'each rule must have a string metric';
    if (!VALID_OPERATORS.includes(r.operator))      return `unsupported operator "${r.operator}"`;
    if (typeof r.threshold !== 'number')             return 'each rule must have a numeric threshold';
  }
  return null;
}

// ── GET /commitments ──────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { user_id, status } = req.query;
    let query = 'SELECT * FROM commitments WHERE 1=1';
    const params = [];

    if (user_id) { params.push(user_id);  query += ` AND user_id = $${params.length}`; }
    if (status)  { params.push(status);   query += ` AND status = $${params.length}`; }

    query += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(query, params);
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// ── GET /commitments/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM commitments WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Commitment not found' });
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
});

// ── POST /commitments ─────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const {
      user_id, title, description,
      rules, logic = 'all',
      penalty_wallet, penalty_amount_usdc,
      reward_wallet, reward_amount_usdc, reward_lock_days = 30,
      period = 'weekly', evaluation_day_of_week, evaluation_time = '08:00:00',
      start_date, end_date,
      dry_run = true,
    } = req.body;

    if (!user_id)    return res.status(400).json({ error: 'user_id is required' });
    if (!title)      return res.status(400).json({ error: 'title is required' });
    if (!start_date) return res.status(400).json({ error: 'start_date is required' });
    if (!VALID_LOGIC.includes(logic))     return res.status(400).json({ error: `logic must be one of: ${VALID_LOGIC.join(', ')}` });
    if (!VALID_PERIODS.includes(period))  return res.status(400).json({ error: `period must be one of: ${VALID_PERIODS.join(', ')}` });

    const rulesError = validateRules(rules);
    if (rulesError) return res.status(400).json({ error: rulesError });

    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO commitments
         (id, user_id, title, description, rules, logic,
          penalty_wallet, penalty_amount_usdc,
          reward_wallet, reward_amount_usdc, reward_lock_days,
          period, evaluation_day_of_week, evaluation_time,
          start_date, end_date, dry_run)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        id, user_id, title, description || null,
        JSON.stringify(rules), logic,
        penalty_wallet || null, penalty_amount_usdc || null,
        reward_wallet || null, reward_amount_usdc || null, reward_lock_days,
        period, evaluation_day_of_week ?? null, evaluation_time,
        start_date, end_date || null, dry_run,
      ]
    );

    res.status(201).json({ data: rows[0] });
  } catch (err) { next(err); }
});

// ── PATCH /commitments/:id ────────────────────────────────────────────────────
// Only allows safe mutations (no retroactive rule changes if already evaluated).
router.patch('/:id', async (req, res, next) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM commitments WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Commitment not found' });

    const allowed = ['title', 'description', 'status', 'end_date', 'penalty_wallet',
                     'penalty_amount_usdc', 'reward_wallet', 'reward_amount_usdc',
                     'reward_lock_days', 'dry_run'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (updates.status && !VALID_STATUSES.includes(updates.status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
    setClauses.push(`updated_at = NOW()`);
    const values = [req.params.id, ...Object.values(updates)];

    const { rows } = await pool.query(
      `UPDATE commitments SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
    res.json({ data: rows[0] });
  } catch (err) { next(err); }
});

// ── POST /commitments/:id/evaluate  (manual trigger for testing) ──────────────
router.post('/:id/evaluate', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM commitments WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Commitment not found' });

    const result = await runEvaluation(rows[0]);
    res.json({ data: result });
  } catch (err) { next(err); }
});

module.exports = router;
