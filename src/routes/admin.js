'use strict';

const { Router } = require('express');
const { runAllActiveCommitments } = require('../evaluator/pipeline');

const router = Router();

function authMiddleware(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'CRON_SECRET not configured' });
  }
  const auth = req.headers['authorization'] || '';
  if (auth !== `Bearer ${secret.trim()}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// POST /api/run-evaluations
// Triggers the full evaluation pipeline for all active commitments.
// Secured via Authorization: Bearer <CRON_SECRET>.
router.post('/run-evaluations', authMiddleware, async (_req, res, next) => {
  try {
    const results = await runAllActiveCommitments();
    const ok      = results.filter(r => r.ok && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;
    const errors  = results.filter(r => !r.ok).length;
    res.json({ ok, skipped, errors, results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
