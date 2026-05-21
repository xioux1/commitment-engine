'use strict';

require('dotenv').config();
const app  = require('./app');
const cron = require('./cron');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`[server] CommitmentVault listening on port ${PORT}`);
  console.log(`[server] DRY_RUN=${process.env.DRY_RUN !== 'false'}`);
  cron.start();
});
