// ============================================================================
// Risk Engine (riskEngine.js)
// ============================================================================
// Aggregates a risk score from the outputs of Layer 1 (heuristics) and
// Layer 2 (guardrail). Scoring rules:
//
//   Base score:                  0
//   + 40  if regex/keyword match (Layer 1)
//   + 50  if similarity match   (reserved — not yet implemented)
//   + 70  if guardrail flags unsafe (Layer 2)
//   + 30  if guardrail API errored/timed out
//   Capped at 100.
// ============================================================================

/**
 * Compute the aggregate risk score.
 *
 * @param {object} params
 * @param {boolean} params.heuristicMatch   – Layer 1 hit?
 * @param {string}  params.guardrailLabel   – 'SAFE' | 'INJECTION' | 'JAILBREAK'
 * @param {boolean} params.guardrailError   – true if HF API timed out / errored
 * @returns {{ score: number, reasons: string[] }}
 */
function computeRiskScore({ heuristicMatch, guardrailLabel, guardrailError }) {
  let score = 0;
  const reasons = [];

  // Layer 1: heuristic keyword/regex match
  if (heuristicMatch) {
    score += 40;
    reasons.push('Layer 1: heuristic keyword/regex match (+40)');
  }

  // Layer 2: guardrail flags the prompt as unsafe
  if (guardrailLabel === 'INJECTION' || guardrailLabel === 'JAILBREAK') {
    score += 70;
    reasons.push(`Layer 2: guardrail classified as ${guardrailLabel} (+70)`);
  }

  // Layer 2: guardrail API failure — treat as moderate risk
  if (guardrailError) {
    score += 30;
    reasons.push('Layer 2: guardrail API error/timeout (+30)');
  }

  // Cap at 100
  score = Math.min(score, 100);

  return { score, reasons };
}

module.exports = { computeRiskScore };
