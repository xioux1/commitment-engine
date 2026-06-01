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
// Optional body: { "referenceDate": "2026-06-02" } to simulate a specific day (useful for testing weekly/monthly commitments).
router.post('/run-evaluations', authMiddleware, async (req, res, next) => {
  try {
    let referenceDate;
    if (req.body?.referenceDate) {
      referenceDate = new Date(req.body.referenceDate);
      if (isNaN(referenceDate.getTime())) {
        return res.status(400).json({ error: 'Invalid referenceDate — use ISO format e.g. "2026-06-02"' });
      }
    }
    const results = await runAllActiveCommitments(referenceDate);
    const ok      = results.filter(r => r.ok && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;
    const errors  = results.filter(r => !r.ok).length;
    res.json({ ok, skipped, errors, results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
