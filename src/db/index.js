'use strict';

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Respect NODE_ENV: test environments may set this to a test DB
});

module.exports = pool;
