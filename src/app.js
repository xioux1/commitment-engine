'use strict';

require('dotenv').config();
const path    = require('path');
const fs      = require('fs');
const express = require('express');

const commitmentsRouter   = require('./routes/commitments');
const evaluationsRouter   = require('./routes/evaluations');
const walletActionsRouter = require('./routes/walletActions');
const vaultRouter         = require('./routes/vault');
const metricsRouter       = require('./routes/metrics');

const app = express();

// ── Dashboard static files ────────────────────────────────────────────────────
// Served before API routes so assets (JS, CSS, etc.) resolve instantly.
const DIST = path.join(__dirname, '../dashboard-dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
}

app.use(express.json());

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    dry_run:   process.env.DRY_RUN?.toLowerCase() !== 'false',
    timestamp: new Date().toISOString(),
  });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/commitments',    commitmentsRouter);
app.use('/api/evaluations',    evaluationsRouter);
app.use('/api/wallet-actions', walletActionsRouter);
app.use('/api/vault',          vaultRouter);
app.use('/api/metrics',        metricsRouter);

// ── SPA fallback ──────────────────────────────────────────────────────────────
// All non-API GET requests fall through to index.html so React Router handles
// client-side navigation. Returns a JSON 404 if the dashboard hasn't been built.
app.get('*', (req, res) => {
  const index = path.join(DIST, 'index.html');
  if (fs.existsSync(index)) {
    res.sendFile(index);
  } else {
    res.status(404).json({ error: 'Dashboard not built — run: npm run build' });
  }
});

// ── Error handler ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
