'use strict';

require('dotenv').config();
const pool = require('./index.js');

// Simulates 5 historical weeks before the most recent real evaluation.
// Pattern: fail, fail, pass, pass, pass  →  streak of 3 + the real eval = streak 4.
// Run once: node src/db/seed-test.js
// Then set MOCK_VAULT_BALANCE=60.00,20.00 in your env vars.

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch active commitment
    const { rows: [c] } = await client.query(
      `SELECT * FROM commitments WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`
    );
    if (!c) { console.log('No active commitment found.'); process.exit(1); }
    console.log(`Seeding: "${c.title}" (${c.id})`);

    // 2. Guard against re-seeding
    const { rows: [{ count }] } = await client.query(
      `SELECT COUNT(*)::int AS count FROM wallet_actions WHERE commitment_id = $1`,
      [c.id]
    );
    if (count >= 4) {
      console.log(`Already has ${count} wallet_actions — skipping seed.`);
      await client.query('ROLLBACK');
      return;
    }

    // 3. Set penalty / reward amounts if not configured
    await client.query(
      `UPDATE commitments
       SET penalty_amount_usdc = COALESCE(penalty_amount_usdc, 10),
           reward_amount_usdc  = COALESCE(reward_amount_usdc,  10)
       WHERE id = $1`,
      [c.id]
    );
    console.log('penalty_amount_usdc = 10, reward_amount_usdc = 10');

    // 4. Insert 5 fake weeks (oldest first, ending before the real evaluation)
    //    Pattern: fail, fail, pass, pass, pass  →  combined streak of 4 with the real eval
    const WEEKS = [
      { weeksAgo: 7, studyMinutes: 180, result: 'fail' },
      { weeksAgo: 6, studyMinutes: 120, result: 'fail' },
      { weeksAgo: 5, studyMinutes: 420, result: 'pass' },
      { weeksAgo: 4, studyMinutes: 380, result: 'pass' },
      { weeksAgo: 3, studyMinutes: 510, result: 'pass' },
    ];

    const rules = Array.isArray(c.rules) ? c.rules : [];

    for (const w of WEEKS) {
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - w.weeksAgo * 7);
      periodStart.setHours(0, 0, 0, 0);
      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 7);
      const evaluatedAt = new Date(periodEnd.getTime() + 8 * 60 * 60 * 1000);

      const metricsData = { metrics: { study_minutes: w.studyMinutes }, source: 'test_seed' };

      const { rows: [snap] } = await client.query(
        `INSERT INTO metric_snapshots (commitment_id, period_start, period_end, metrics_data)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [c.id, periodStart, periodEnd, JSON.stringify(metricsData)]
      );

      const ruleResults = rules.map(rule => {
        const actual = metricsData.metrics[rule.metric] ?? 0;
        const ops = { '>=': (a, b) => a >= b, '<=': (a, b) => a <= b,
                      '>':  (a, b) => a >  b, '<':  (a, b) => a <  b,
                      '==': (a, b) => a == b };
        return { rule, actual_value: actual, passed: (ops[rule.operator] ?? (() => false))(actual, rule.threshold) };
      });

      const { rows: [ev] } = await client.query(
        `INSERT INTO evaluations
           (commitment_id, metric_snapshot_id, result, period_start, period_end,
            rule_results, rules_snapshot, evaluated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [c.id, snap.id, w.result, periodStart, periodEnd,
         JSON.stringify(ruleResults), JSON.stringify(rules), evaluatedAt]
      );

      const actionType = w.result === 'pass' ? 'reward' : 'penalty';
      const unlockTs   = Math.floor((periodEnd.getTime() + 30 * 24 * 60 * 60 * 1000) / 1000);
      const metadata   = actionType === 'reward' ? { unlock_timestamp: unlockTs } : {};

      await client.query(
        `INSERT INTO wallet_actions
           (commitment_id, evaluation_id, action_type, amount_usdc,
            status, dry_run, metadata, created_at)
         VALUES ($1,$2,$3,10,'dry_run_logged',true,$4,$5)`,
        [c.id, ev.id, actionType, JSON.stringify(metadata), evaluatedAt]
      );

      console.log(`  ${periodStart.toISOString().slice(0,10)} → ${w.result.toUpperCase()} (${w.studyMinutes} min)`);
    }

    await client.query('COMMIT');

    console.log(`
Done! 5 weeks of test data inserted.

Next steps:
  1. In Render → Environment → add:
       MOCK_VAULT_BALANCE=60.00,20.00
  2. Redeploy (or restart) the service.

Simulated state:
  - 100 USDC deposited
  - 2 failures × 10 USDC penalty = 20 USDC burned
  - 4 passes  × 10 USDC reward  = 40 USDC locked, 2 oldest released back to available
  - Available: 60.00  Locked: 20.00  Total: 80.00
`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
