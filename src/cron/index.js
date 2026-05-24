'use strict';

const cron = require('node-cron');
const { runAllActiveCommitments } = require('../evaluator/pipeline');

const SCHEDULE = process.env.CRON_SCHEDULE || '0 8 * * *'; // default: daily 08:00
const DRY_RUN  = process.env.DRY_RUN !== 'false';

function start() {
  if (!cron.validate(SCHEDULE)) {
    throw new Error(`Invalid CRON_SCHEDULE: "${SCHEDULE}"`);
  }

  console.log(`[cron] scheduled "${SCHEDULE}" (DRY_RUN=${DRY_RUN})`);

  cron.schedule(SCHEDULE, async () => {
    console.log('[cron] evaluation run started', new Date().toISOString());
    try {
      const results = await runAllActiveCommitments();
      const evalOk  = results.filter(r => r.ok).length;
      const evalErr = results.filter(r => !r.ok).length;
      console.log(`[cron] evaluations done — ${evalOk} ok, ${evalErr} errors`);

      // Stage 2: execute pending wallet_actions generated above.
      // Skipped entirely in DRY_RUN mode — those actions are logged as
      // 'dry_run_logged' and never reach 'pending'.
      if (!DRY_RUN) {
        const { processPending } = require('../executor/walletExecutor');
        const execResults = await processPending();
        const execOk  = execResults.filter(r => r.ok).length;
        const execErr = execResults.filter(r => !r.ok).length;
        console.log(`[cron] executor done — ${execOk} confirmed, ${execErr} failed`);
      }
    } catch (err) {
      console.error('[cron] unhandled error:', err.message);
    }
  });
}

module.exports = { start };
