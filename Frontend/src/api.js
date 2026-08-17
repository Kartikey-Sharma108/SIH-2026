// ============================================================================
// API Client — Axios instance for AI Security Gateway backend
// ============================================================================

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000, // 30s — guardrail calls can take ~12s
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── API Methods ─────────────────────────────────────────────────────────────

/**
 * POST /api/analyze — Submit a prompt for analysis
 * @param {string} prompt
 * @returns {Promise<{blocked, riskScore, reason?, triggerWords?, response?, piiDetected?}>}
 */
export async function analyzePrompt(prompt) {
  const { data } = await api.post('/api/analyze', { prompt });
  return data;
}

/**
 * GET /api/logs — Fetch recent security logs
 * @param {number} limit
 * @returns {Promise<{count, logs}>}
 */
export async function fetchLogs(limit = 50) {
  const { data } = await api.get('/api/logs', { params: { limit } });
  return data;
}

/**
 * GET /api/logs/:id — Fetch a single log entry with full detail
 * @param {string} id — UUID
 * @returns {Promise<object>}
 */
export async function fetchLogById(id) {
  const { data } = await api.get(`/api/logs/${id}`);
  return data;
}

export default api;
