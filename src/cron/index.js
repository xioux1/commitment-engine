'use strict';

const cron = require('node-cron');
const { runAllActiveCommitments } = require('../evaluator/pipeline');

const SCHEDULE = process.env.CRON_SCHEDULE || '0 8 * * 1'; // default: Mon 08:00
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
      const passed  = results.filter(r => r.ok).length;
      const failed  = results.filter(r => !r.ok).length;
      console.log(`[cron] done — ${passed} ok, ${failed} errors`);
    } catch (err) {
      console.error('[cron] unhandled error:', err.message);
    }
  });
}

module.exports = { start };
