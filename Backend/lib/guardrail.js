// ============================================================================
// Layer 2 — Guardrail (guardrail.js)
// ============================================================================
// Calls the Hugging Face Inference API running Meta's Prompt Guard model.
// Returns { label: "SAFE"|"INJECTION"|"JAILBREAK", confidence: number }.
//
// If the API times out (>3s) or errors, the failure is logged and a fallback
// result is returned so the pipeline continues instead of crashing.
// ============================================================================

const fetch = require('node-fetch');

const HF_API_URL = 'https://api-inference.huggingface.co/models/meta-llama/Prompt-Guard-86M';
const TIMEOUT_MS = 3000;

/**
 * Call Meta Prompt Guard via Hugging Face Inference API.
 *
 * @param {string} prompt – The user's raw prompt text
 * @returns {Promise<{ label: string, confidence: number, error: boolean }>}
 */
async function checkGuardrail(prompt) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;

  if (!apiKey || apiKey === 'hf_your_key_here') {
    console.warn('⚠  HUGGINGFACE_API_KEY not set — skipping guardrail check');
    return { label: 'SAFE', confidence: 0, error: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const body = await response.text();
      console.error(`❌  Guardrail API returned ${response.status}: ${body}`);
      return { label: 'SAFE', confidence: 0, error: true };
    }

    const data = await response.json();

    // HF text-classification returns [[{label, score}, ...]]
    // We pick the top prediction from the first (and only) input.
    const predictions = Array.isArray(data[0]) ? data[0] : data;
    const top = predictions.reduce((a, b) => (a.score > b.score ? a : b));

    // Normalize label to our enum
    const label = _normalizeLabel(top.label);

    return {
      label,
      confidence: parseFloat(top.score.toFixed(4)),
      error: false,
    };
  } catch (err) {
    clearTimeout(timeout);

    if (err.name === 'AbortError') {
      console.error('⏱  Guardrail API timed out after 3 seconds');
    } else {
      console.error('❌  Guardrail API error:', err.message);
    }

    return { label: 'SAFE', confidence: 0, error: true };
  }
}

/**
 * Map HF model labels to our standardized enum.
 */
function _normalizeLabel(raw) {
  const upper = String(raw).toUpperCase();
  if (upper.includes('INJECTION') || upper === 'LABEL_1') return 'INJECTION';
  if (upper.includes('JAILBREAK') || upper === 'LABEL_2') return 'JAILBREAK';
  return 'SAFE';
}

module.exports = { checkGuardrail };
