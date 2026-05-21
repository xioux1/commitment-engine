'use strict';

require('dotenv').config();
const axios = require('axios');

function getClient() {
  const BASE_URL = process.env.DISCRIMINADOR_BASE_URL;
  const API_KEY  = process.env.DISCRIMINADOR_API_KEY;

  if (!BASE_URL) throw new Error('DISCRIMINADOR_BASE_URL is not set');

  return axios.create({
    baseURL: BASE_URL,
    timeout: 10_000,
    headers: API_KEY ? { 'x-api-key': API_KEY } : {},
  });
}

/**
 * Fetch commitment metrics from Discriminador for a given user and period.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.from  ISO date string (inclusive), e.g. '2024-01-01'
 * @param {string} params.to    ISO date string (inclusive), e.g. '2024-01-07'
 * @returns {Promise<object>}  Raw metrics object from Discriminador
 *
 * Expected Discriminador response shape:
 * {
 *   "period": { "from": "...", "to": "..." },
 *   "metrics": {
 *     "study_minutes": 300,
 *     "study_sessions": 8,
 *     "cards_reviewed": 150,
 *     "oral_evaluations": 2,
 *     "physical_activity_sessions": 3,
 *     "physical_activity_minutes": 120
 *   }
 * }
 */
async function fetchMetrics({ userId, from, to }) {
  const response = await getClient().get('/api/commitment-metrics', {
    params: { user_id: userId, from, to },
  });
  return response.data;
}

module.exports = { fetchMetrics };
