'use strict';

const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { fetchMetrics } = require('../adapters/discriminador');
const { evaluate } = require('./rules');

const DRY_RUN = process.env.DRY_RUN !== 'false';

/**
 * Compute the [periodStart, periodEnd] for the most recently completed cycle
 * ending before `referenceDate`.
 *
 * @param {'weekly'|'daily'|'monthly'} period
 * @param {Date} referenceDate
 * @returns {{ periodStart: Date, periodEnd: Date }}
 */
function computePeriod(period, referenceDate = new Date()) {
  const ref = new Date(referenceDate);

  if (period === 'daily') {
    const end = new Date(ref);
    end.setUTCHours(0, 0, 0, 0);
    end.setUTCDate(end.getUTCDate() - 1);
    const start = new Date(end);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);
    return { periodStart: start, periodEnd: end };
  }

  if (period === 'weekly') {
    // Most recently completed Mon–Sun week
    const dayOfWeek = ref.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
    const daysToLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
    const end = new Date(ref);
    end.setUTCDate(end.getUTCDate() - daysToLastSunday);
    end.setUTCHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 6);
    start.setUTCHours(0, 0, 0, 0);
    return { periodStart: start, periodEnd: end };
  }

  if (period === 'monthly') {
    const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 0, 23, 59, 59, 999));
    const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - 1, 1, 0, 0, 0, 0));
    return { periodStart: start, periodEnd: end };
  }

  throw new Error(`Unknown period: "${period}"`);
}

/**
 * Run the full evaluation pipeline for a single commitment.
 * Steps:
 *  1. Fetch metrics from Discriminador → INSERT metric_snapshot (immutable)
 *  2. Evaluate rules → INSERT evaluation (immutable)
 *  3. Create wallet_action (pending or dry_run_logged)
 *
 * All three steps run inside a single transaction so a partial failure
 * leaves no orphaned rows.
 *
 * @param {object} commitment  Row from the commitments table
 * @param {Date}   [referenceDate]  Defaults to now; injectable for tests
 * @returns {Promise<{ snapshot, evaluation, walletAction }>}
 */
async function runEvaluation(commitment, referenceDate = new Date()) {
  const { periodStart, periodEnd } = computePeriod(commitment.period, referenceDate);

  const fromStr = periodStart.toISOString().split('T')[0];
  const toStr   = periodEnd.toISOString().split('T')[0];

  // ── 1. Fetch metrics (outside transaction — external HTTP call) ──────────
  let metricsData;
  try {
    metricsData = await fetchMetrics({
      userId: commitment.user_id,
      from: fromStr,
      to: toStr,
    });
  } catch (err) {
    throw new Error(`Discriminador fetch failed for commitment ${commitment.id}: ${err.message}`);
  }

  const flatMetrics = metricsData.metrics || {};

  // ── 2. Evaluate rules ────────────────────────────────────────────────────
  const { rule_results, result } = evaluate({
    rules:   commitment.rules,
    logic:   commitment.logic,
    metrics: flatMetrics,
  });

  // ── 3. Persist everything in one transaction ─────────────────────────────
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // metric_snapshot (immutable)
    const snapshotId = uuidv4();
    await client.query(
      `INSERT INTO metric_snapshots
         (id, commitment_id, period_start, period_end, metrics_data, fetched_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [snapshotId, commitment.id, periodStart, periodEnd, JSON.stringify(metricsData)]
    );

    // evaluation (immutable)
    const evalId = uuidv4();
    await client.query(
      `INSERT INTO evaluations
         (id, commitment_id, metric_snapshot_id, period_start, period_end,
          rules_snapshot, logic_snapshot, rule_results, result, evaluated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        evalId,
        commitment.id,
        snapshotId,
        periodStart,
        periodEnd,
        JSON.stringify(commitment.rules),
        commitment.logic,
        JSON.stringify(rule_results),
        result,
      ]
    );

    // wallet_action
    const actionId = uuidv4();
    const isDryRun = DRY_RUN || commitment.dry_run;
    let walletAction = null;

    const actionType        = result === 'fail' ? 'penalty' : 'reward';
    const destinationWallet = result === 'fail'
      ? commitment.penalty_wallet
      : commitment.reward_wallet;
    const amount = result === 'fail'
      ? commitment.penalty_amount_usdc
      : commitment.reward_amount_usdc;

    // For reward actions, compute the unix timestamp after which the lock expires
    let metadata = null;
    if (actionType === 'reward' && amount != null) {
      const lockDays = commitment.reward_lock_days || 30;
      const unlockDate = new Date(periodEnd);
      unlockDate.setUTCDate(unlockDate.getUTCDate() + lockDays);
      metadata = { unlock_timestamp: Math.floor(unlockDate.getTime() / 1000) };
    }

    if (destinationWallet && amount != null) {
      const status = isDryRun ? 'dry_run_logged' : 'pending';
      await client.query(
        `INSERT INTO wallet_actions
           (id, commitment_id, evaluation_id, action_type, amount_usdc,
            destination_wallet, status, dry_run, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [actionId, commitment.id, evalId, actionType, amount, destinationWallet, status, isDryRun,
         metadata ? JSON.stringify(metadata) : null]
      );
      walletAction = { id: actionId, action_type: actionType, amount_usdc: amount, destination_wallet: destinationWallet, status, metadata };
    }

    await client.query('COMMIT');

    const logPrefix = isDryRun ? '[DRY_RUN]' : '[LIVE]';
    console.log(
      `${logPrefix} commitment=${commitment.id} period=${fromStr}→${toStr} result=${result}`,
      walletAction ? `action=${walletAction.action_type} amount=${walletAction.amount_usdc} USDC` : '(no wallet action — missing wallet/amount config)'
    );

    return {
      snapshot:    { id: snapshotId, period_start: periodStart, period_end: periodEnd },
      evaluation:  { id: evalId, result, rule_results },
      walletAction,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Fetch all active commitments and run the evaluation pipeline for each.
 * Used by the cron job.
 *
 * @param {Date} [referenceDate]
 * @returns {Promise<Array>}
 */
async function runAllActiveCommitments(referenceDate = new Date()) {
  const { rows: commitments } = await pool.query(
    `SELECT * FROM commitments
     WHERE status = 'active'
       AND start_date <= CURRENT_DATE
       AND (end_date IS NULL OR end_date >= CURRENT_DATE)`
  );

  console.log(`[cron] found ${commitments.length} active commitment(s)`);

  const results = [];
  for (const commitment of commitments) {
    try {
      const result = await runEvaluation(commitment, referenceDate);
      results.push({ commitment_id: commitment.id, ok: true, ...result });
    } catch (err) {
      console.error(`[cron] ERROR commitment=${commitment.id}: ${err.message}`);
      results.push({ commitment_id: commitment.id, ok: false, error: err.message });
    }
  }

  return results;
}

module.exports = { runEvaluation, runAllActiveCommitments, computePeriod };
