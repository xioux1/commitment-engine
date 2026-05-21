'use strict';

// API integration tests — requires a running Postgres instance.
// These are skipped in CI unless DATABASE_URL is set.
const condDescribe = process.env.DATABASE_URL ? describe : describe.skip;

const request = require('supertest');
const app     = require('../src/app');
const pool    = require('../src/db');

beforeAll(async () => {
  // Verify tables exist (migration must run first)
  await pool.query('SELECT 1 FROM commitments LIMIT 1');
});

afterAll(async () => {
  await pool.end();
});

condDescribe('POST /api/commitments', () => {
  let createdId;

  const payload = {
    user_id:    'user_test_1',
    title:      'Weekly study goal',
    rules:      [{ metric: 'study_minutes', operator: '>=', threshold: 300 }],
    logic:      'all',
    period:     'weekly',
    start_date: '2024-01-01',
    dry_run:    true,
  };

  test('creates a commitment and returns 201', async () => {
    const res = await request(app).post('/api/commitments').send(payload);
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.dry_run).toBe(true);
    createdId = res.body.data.id;
  });

  test('rejects missing user_id', async () => {
    const res = await request(app).post('/api/commitments').send({ ...payload, user_id: undefined });
    expect(res.status).toBe(400);
  });

  test('rejects invalid logic value', async () => {
    const res = await request(app).post('/api/commitments').send({ ...payload, logic: 'xor' });
    expect(res.status).toBe(400);
  });

  test('GET /api/commitments returns the created commitment', async () => {
    const res = await request(app).get('/api/commitments').query({ user_id: 'user_test_1' });
    expect(res.status).toBe(200);
    expect(res.body.data.some(c => c.id === createdId)).toBe(true);
  });

  test('PATCH /api/commitments/:id updates status', async () => {
    const res = await request(app).patch(`/api/commitments/${createdId}`).send({ status: 'paused' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('paused');
  });
});

condDescribe('GET /health', () => {
  test('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.dry_run).toBe('boolean');
  });
});
