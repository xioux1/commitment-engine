'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./index');

async function migrate() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT 1 FROM schema_migrations WHERE filename = $1',
        [file]
      );
      if (rows.length > 0) {
        console.log(`[migrate] skipping ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`[migrate] applying ${file}…`);
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations(filename) VALUES($1)',
        [file]
      );
      await client.query('COMMIT');
      console.log(`[migrate] ${file} applied`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migrate] ERROR — rolling back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
