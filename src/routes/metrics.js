'use strict';

const { Router } = require('express');
const pool = require('../db');

const router = Router();

// GET /api/metrics/weekly-history?user_id=&commitment_id=&weeks=8
// Returns the last N metric snapshots (oldest-first for charts) and the
// study_minutes threshold from the relevant active commitment as a reference line.
router.get('/weekly-history', async (req, res, next) => {
  try {
    const { user_id, commitment_id, weeks = 8 } = req.query;

    const params = [Number(weeks)];
    let filter   = '';

    if (commitment_id) {
      params.push(commitment_id);
      filter += ` AND ms.commitment_id = $${params.length}`;
    } else if (user_id) {
      params.push(user_id);
      filter += ` AND c.user_id = $${params.length}`;
    }

    const { rows } = await pool.query(`
      SELECT
        ms.period_start,
        ms.period_end,
        ms.metrics_data,
        c.id    AS commitment_id,
        c.title AS commitment_title
      FROM metric_snapshots ms
      JOIN commitments c ON c.id = ms.commitment_id
      WHERE 1=1 ${filter}
      ORDER BY ms.period_start DESC
      LIMIT $1
    `, params);

    // Reverse so oldest week is leftmost on the chart
    const data = rows.reverse().map(row => ({
      week:                        row.period_start,
      study_minutes:               row.metrics_data?.metrics?.study_minutes               ?? 0,
      physical_activity_sessions:  row.metrics_data?.metrics?.physical_activity_sessions  ?? 0,
      cards_reviewed:              row.metrics_data?.metrics?.cards_reviewed              ?? 0,
      oral_evaluations:            row.metrics_data?.metrics?.oral_evaluations            ?? 0,
      commitment_title:            row.commitment_title,
      commitment_id:               row.commitment_id,
    }));

    // Find the study_minutes target from the active commitment for the reference line
    const tQuery  = commitment_id
      ? `SELECT rules FROM commitments WHERE id = $1 AND status = 'active'`
      : `SELECT rules FROM commitments WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`;
    const tParams = commitment_id ? [commitment_id] : [];
    const { rows: targetRows } = await pool.query(tQuery, tParams);

    const target = targetRows[0]?.rules
      ?.find?.(r => r.metric === 'study_minutes')?.threshold ?? null;

    res.json({ data, study_minutes_target: target });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
