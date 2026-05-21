'use strict';

require('dotenv').config();
const express = require('express');

const commitmentsRouter  = require('./routes/commitments');
const evaluationsRouter  = require('./routes/evaluations');
const walletActionsRouter = require('./routes/walletActions');

const app = express();

app.use(express.json());

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    dry_run: process.env.DRY_RUN !== 'false',
    timestamp: new Date().toISOString(),
  });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/commitments',   commitmentsRouter);
app.use('/api/evaluations',   evaluationsRouter);
app.use('/api/wallet-actions', walletActionsRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Error handler ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
