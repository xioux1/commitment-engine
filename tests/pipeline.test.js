'use strict';

/**
 * Integration + unit tests for the daily evaluation pipeline.
 *
 * Covers the full flow triggered when the cron fires at 08:00 UTC:
 *   computePeriod → fetchMetrics → evaluate rules → persist 3 DB rows
 *
 * The DB tests (condDescribe) are skipped unless DATABASE_URL is set.
 * fetchMetrics is always mocked — no real HTTP calls.
 */

const { v4: uuidv4 } = require('uuid');

const condDescribe = process.env.DATABASE_URL ? describe : describe.skip;

const { runEvaluation, runAllActiveCommitments, computePeriod } = require('../src/evaluator/pipeline');
const pool = require('../src/db');

jest.mock('../src/adapters/discriminador');
const { fetchMetrics } = require('../src/adapters/discriminador');

// Simulates the cron firing on Tuesday 2024-03-19 at 08:00 UTC
const CRON_FIRE_DATE = new Date('2024-03-19T08:00:00Z');
const YESTERDAY      = '2024-03-18';
const TEST_USER      = 'test_pipeline_user';

afterAll(async () => {
  await pool.end();
});

// ── computePeriod — pure unit tests, no DB ────────────────────────────────────

describe('computePeriod — daily at 08:00 UTC', () => {
  test('period start is yesterday 00:00:00.000 UTC', () => {
    const { periodStart } = computePeriod('daily', CRON_FIRE_DATE);
    expect(periodStart.toISOString()).toBe('2024-03-18T00:00:00.000Z');
  });

  test('period end is yesterday 23:59:59.999 UTC', () => {
    const { periodEnd } = computePeriod('daily', CRON_FIRE_DATE);
    expect(periodEnd.toISOString()).toBe('2024-03-18T23:59:59.999Z');
  });
});

// ── Full pipeline integration ─────────────────────────────────────────────────

condDescribe('Daily evaluation pipeline — full flow', () => {
  let commitment;

  async function insertCommitment(overrides = {}) {
    const { rows } = await pool.query(
      `INSERT INTO commitments
         (id, user_id, title, rules, logic, period, start_date, dry_run,
          penalty_wallet, penalty_amount_usdc, reward_wallet, reward_amount_usdc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        uuidv4(),
        overrides.user_id             ?? TEST_USER,
        overrides.title               ?? 'Daily reading test',
        JSON.stringify(overrides.rules ?? [{ metric: 'reading_minutes', operator: '>=', threshold: 30 }]),
        overrides.logic               ?? 'all',
        overrides.period              ?? 'daily',
        overrides.start_date          ?? '2024-01-01',
        overrides.dry_run             ?? true,
        overrides.penalty_wallet      ?? null,
        overrides.penalty_amount_usdc ?? null,
        overrides.reward_wallet       ?? null,
        overrides.reward_amount_usdc  ?? null,
      ]
    );
    return rows[0];
  }

  beforeEach(async () => {
    commitment = await insertCommitment();
    fetchMetrics.mockResolvedValue({
      period:  { from: YESTERDAY, to: YESTERDAY },
      metrics: { reading_minutes: 45 },
    });
  });

  afterEach(async () => {
    // Delete all test rows in FK-safe order
    const { rows } = await pool.query(
      'SELECT id FROM commitments WHERE user_id = $1', [TEST_USER]
    );
    for (const { id } of rows) {
      await pool.query('DELETE FROM wallet_actions   WHERE commitment_id = $1', [id]);
      await pool.query('DELETE FROM evaluations      WHERE commitment_id = $1', [id]);
      await pool.query('DELETE FROM metric_snapshots WHERE commitment_id = $1', [id]);
    }
    await pool.query('DELETE FROM commitments WHERE user_id = $1', [TEST_USER]);
    jest.clearAllMocks();
  });

  // ── Discriminador call ──────────────────────────────────────────────────────

  test('calls fetchMetrics with the correct daily date range', async () => {
    await runEvaluation(commitment, CRON_FIRE_DATE);

    expect(fetchMetrics).toHaveBeenCalledTimes(1);
    expect(fetchMetrics).toHaveBeenCalledWith({
      userId: TEST_USER,
      from:   YESTERDAY,
      to:     YESTERDAY,
    });
  });

  // ── Rule evaluation ─────────────────────────────────────────────────────────

  test('returns pass when metric meets threshold (45 >= 30)', async () => {
    const { evaluation } = await runEvaluation(commitment, CRON_FIRE_DATE);

    expect(evaluation.result).toBe('pass');
    expect(evaluation.rule_results[0].passed).toBe(true);
    expect(evaluation.rule_results[0].actual_value).toBe(45);
  });

  test('returns fail when metric is below threshold (20 < 30)', async () => {
    fetchMetrics.mockResolvedValue({ metrics: { reading_minutes: 20 } });

    const { evaluation } = await runEvaluation(commitment, CRON_FIRE_DATE);

    expect(evaluation.result).toBe('fail');
    expect(evaluation.rule_results[0].passed).toBe(false);
    expect(evaluation.rule_results[0].actual_value).toBe(20);
  });

  // ── DB persistence ──────────────────────────────────────────────────────────

  test('persists metric_snapshot with correct period and raw metrics', async () => {
    const { snapshot } = await runEvaluation(commitment, CRON_FIRE_DATE);

    const { rows } = await pool.query(
      'SELECT * FROM metric_snapshots WHERE id = $1', [snapshot.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].commitment_id).toBe(commitment.id);
    expect(new Date(rows[0].period_start).toISOString()).toBe('2024-03-18T00:00:00.000Z');
    expect(new Date(rows[0].period_end).toISOString()).toBe('2024-03-18T23:59:59.999Z');
    expect(rows[0].metrics_data.metrics.reading_minutes).toBe(45);
  });

  test('persists evaluation with rules_snapshot, logic, and result', async () => {
    const { evaluation } = await runEvaluation(commitment, CRON_FIRE_DATE);

    const { rows } = await pool.query(
      'SELECT * FROM evaluations WHERE id = $1', [evaluation.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].result).toBe('pass');
    expect(rows[0].logic_snapshot).toBe('all');
    expect(rows[0].rules_snapshot).toEqual(commitment.rules); // JSONB roundtrip
    expect(rows[0].rule_results[0].actual_value).toBe(45);
  });

  // ── Wallet actions ──────────────────────────────────────────────────────────

  test('wallet_action is null when no wallet config is set', async () => {
    const { walletAction } = await runEvaluation(commitment, CRON_FIRE_DATE);
    expect(walletAction).toBeNull();
  });

  test('creates dry_run_logged reward action on pass', async () => {
    const c = await insertCommitment({ reward_wallet: '0xRewardWallet', reward_amount_usdc: 10 });

    const { walletAction } = await runEvaluation(c, CRON_FIRE_DATE);

    expect(walletAction).not.toBeNull();
    expect(walletAction.action_type).toBe('reward');
    expect(Number(walletAction.amount_usdc)).toBe(10);
    expect(walletAction.status).toBe('dry_run_logged');
    expect(walletAction.destination_wallet).toBe('0xRewardWallet');
  });

  test('creates dry_run_logged penalty action on fail', async () => {
    const c = await insertCommitment({ penalty_wallet: '0xPenaltyWallet', penalty_amount_usdc: 5 });
    fetchMetrics.mockResolvedValue({ metrics: { reading_minutes: 10 } });

    const { walletAction } = await runEvaluation(c, CRON_FIRE_DATE);

    expect(walletAction).not.toBeNull();
    expect(walletAction.action_type).toBe('penalty');
    expect(Number(walletAction.amount_usdc)).toBe(5);
    expect(walletAction.status).toBe('dry_run_logged');
    expect(walletAction.destination_wallet).toBe('0xPenaltyWallet');
  });

  // ── runAllActiveCommitments ─────────────────────────────────────────────────

  test('runAllActiveCommitments evaluates the active daily commitment at 08:00', async () => {
    const results = await runAllActiveCommitments(CRON_FIRE_DATE);

    const mine = results.find(r => r.commitment_id === commitment.id);
    expect(mine).toBeDefined();
    expect(mine.ok).toBe(true);
    expect(mine.skipped).toBeUndefined();
    expect(mine.evaluation.result).toBe('pass');
  });

  test('runAllActiveCommitments is idempotent — skips already-evaluated period', async () => {
    await runAllActiveCommitments(CRON_FIRE_DATE);
    fetchMetrics.mockClear();

    const secondRun = await runAllActiveCommitments(CRON_FIRE_DATE);

    const mine = secondRun.find(r => r.commitment_id === commitment.id);
    expect(mine.skipped).toBe(true);
    expect(fetchMetrics).not.toHaveBeenCalled();

    const { rows } = await pool.query(
      'SELECT id FROM evaluations WHERE commitment_id = $1', [commitment.id]
    );
    expect(rows).toHaveLength(1);
  });

  test('runAllActiveCommitments ignores paused commitments', async () => {
    await pool.query("UPDATE commitments SET status = 'paused' WHERE id = $1", [commitment.id]);

    const results = await runAllActiveCommitments(CRON_FIRE_DATE);

    const mine = results.find(r => r.commitment_id === commitment.id);
    expect(mine).toBeUndefined();
  });
});
