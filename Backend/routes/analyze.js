// ============================================================================
// POST /api/analyze — Main Analysis Gateway
// ============================================================================
// Pipeline:
//   1. Accept { prompt: string }
//   2. Run Layer 1 — heuristic check (keyword/regex against known_attacks)
//   3. Run Layer 2 — guardrail check (Meta Prompt Guard via HF API)
//   4. Compute risk score via riskEngine
//   5. If score > threshold: block, log, return blocked response
//   6. If score <= threshold: call LLM, log, return allowed response
// ============================================================================

const express = require('express');
const router = express.Router();

const { checkHeuristics } = require('../lib/heuristics');
const { checkGuardrail } = require('../lib/guardrail');
const { computeRiskScore } = require('../lib/riskEngine');
const { callLLM } = require('../lib/llmProxy');

router.post('/', async (req, res) => {
  const startTime = Date.now();

  try {
    const { prompt } = req.body;

    // ── Validate input ────────────────────────────────────────────────────
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        error: 'Request body must contain a non-empty "prompt" string.',
      });
    }

    const trimmedPrompt = prompt.trim();
    const pool = req.app.locals.pool;
    const threshold = parseInt(process.env.RISK_THRESHOLD, 10) || 70;

    // ── Layer 1: Heuristic check ──────────────────────────────────────────
    console.log('🔍  Layer 1: Running heuristic checks...');
    const heuristicResult = await checkHeuristics(pool, trimmedPrompt);

    if (heuristicResult.matched) {
      console.log(`   ⚠  Matched ${heuristicResult.matches.length} pattern(s): ${heuristicResult.triggerWords.join(', ')}`);
    } else {
      console.log('   ✅  No heuristic matches');
    }

    // ── Layer 2: Guardrail check ──────────────────────────────────────────
    console.log('🛡  Layer 2: Running guardrail check...');
    const guardrailResult = await checkGuardrail(trimmedPrompt);
    console.log(`   Label: ${guardrailResult.label} | Confidence: ${guardrailResult.confidence} | Error: ${guardrailResult.error}`);

    // ── Risk score computation ────────────────────────────────────────────
    const { score: riskScore, reasons } = computeRiskScore({
      heuristicMatch: heuristicResult.matched,
      guardrailLabel: guardrailResult.label,
      guardrailError: guardrailResult.error,
    });

    console.log(`📊  Risk score: ${riskScore}/100 (threshold: ${threshold})`);

    // ── Decision: Block or Allow ──────────────────────────────────────────
    if (riskScore > threshold) {
      // ── BLOCKED ─────────────────────────────────────────────────────────
      const blockReason = reasons.join('; ');
      const processingMs = Date.now() - startTime;

      console.log(`🚫  BLOCKED (score ${riskScore} > ${threshold})`);

      // Insert security log
      await _insertLog(pool, {
        prompt: trimmedPrompt,
        riskScore,
        actionTaken: 'blocked',
        blockReason,
        triggerWords: heuristicResult.triggerWords,
        heuristicMatch: heuristicResult.matched,
        guardrailLabel: guardrailResult.label,
        guardrailConfidence: guardrailResult.confidence,
        guardrailError: guardrailResult.error,
        llmResponse: null,
        piiDetected: [],
        sourceIp: req.ip,
        userAgent: req.get('user-agent'),
        processingMs,
      });

      return res.status(200).json({
        blocked: true,
        riskScore,
        reason: blockReason,
        triggerWords: heuristicResult.triggerWords,
      });
    }

    // ── ALLOWED — call LLM ──────────────────────────────────────────────
    console.log('✅  ALLOWED — forwarding to LLM...');
    const llmResult = await callLLM(trimmedPrompt);
    const processingMs = Date.now() - startTime;

    // Insert security log
    await _insertLog(pool, {
      prompt: trimmedPrompt,
      riskScore,
      actionTaken: 'allowed',
      blockReason: null,
      triggerWords: heuristicResult.triggerWords,
      heuristicMatch: heuristicResult.matched,
      guardrailLabel: guardrailResult.label,
      guardrailConfidence: guardrailResult.confidence,
      guardrailError: guardrailResult.error,
      llmResponse: llmResult.response,
      piiDetected: llmResult.piiDetected,
      sourceIp: req.ip,
      userAgent: req.get('user-agent'),
      processingMs,
    });

    return res.status(200).json({
      blocked: false,
      riskScore,
      response: llmResult.response,
      piiDetected: llmResult.piiDetected.length > 0 ? llmResult.piiDetected : undefined,
    });
  } catch (err) {
    console.error('❌  /api/analyze error:', err);
    return res.status(500).json({ error: 'Internal server error during analysis.' });
  }
});

// ── Helper: insert a row into security_logs ─────────────────────────────────

async function _insertLog(pool, data) {
  try {
    await pool.query(
      `INSERT INTO security_logs (
        prompt, risk_score, action_taken, block_reason, trigger_words,
        heuristic_match, guardrail_label, guardrail_confidence, guardrail_error,
        llm_response, pii_detected, source_ip, user_agent, processing_ms
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        data.prompt,
        data.riskScore,
        data.actionTaken,
        data.blockReason,
        JSON.stringify(data.triggerWords),
        data.heuristicMatch,
        data.guardrailLabel,
        data.guardrailConfidence,
        data.guardrailError,
        data.llmResponse,
        JSON.stringify(data.piiDetected),
        data.sourceIp,
        data.userAgent,
        data.processingMs,
      ]
    );
  } catch (err) {
    // Log insertion failure should not crash the request
    console.error('❌  Failed to insert security log:', err.message);
  }
}

module.exports = router;
