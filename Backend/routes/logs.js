// ============================================================================
// GET /api/logs — Security Logs Endpoints
// ============================================================================
// GET /api/logs       — Returns the 50 most recent security_logs rows (newest first)
// GET /api/logs/:id   — Returns a single row with full detail
// ============================================================================

const express = require('express');
const router = express.Router();

// ── GET /api/logs — recent logs ─────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const { rows } = await pool.query(
      `SELECT
         id, prompt, risk_score, action_taken, block_reason, trigger_words,
         heuristic_match, guardrail_label, guardrail_confidence, guardrail_error,
         llm_response, pii_detected, processing_ms, created_at
       FROM security_logs
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return res.json({ count: rows.length, logs: rows });
  } catch (err) {
    console.error('❌  GET /api/logs error:', err);
    return res.status(500).json({ error: 'Failed to retrieve logs.' });
  }
});

// ── GET /api/logs/:id — single log detail ───────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const { id } = req.params;

    // Basic UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid log ID format. Expected UUID.' });
    }

    const { rows } = await pool.query(
      `SELECT * FROM security_logs WHERE id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Log entry not found.' });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error('❌  GET /api/logs/:id error:', err);
    return res.status(500).json({ error: 'Failed to retrieve log entry.' });
  }
});

module.exports = router;
