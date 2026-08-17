// ============================================================================
// Layer 1 — Heuristic Checks (heuristics.js)
// ============================================================================
// Queries the known_attacks table for regex/keyword matches against the prompt.
// Uses the check_heuristics() stored function when available, with a raw-SQL
// fallback for maximum compatibility.
// ============================================================================

/**
 * Run Layer 1 heuristic analysis on a prompt.
 *
 * @param {import('pg').Pool} pool   – Postgres connection pool
 * @param {string}            prompt – The user's raw prompt text
 * @returns {Promise<{ matched: boolean, matches: Array<{ name: string, category: string, pattern: string, severity: string }>, triggerWords: string[] }>}
 */
async function checkHeuristics(pool, prompt) {
  try {
    // Try the stored function first (cleaner, already handles regex vs ILIKE)
    const { rows } = await pool.query(
      'SELECT * FROM check_heuristics($1)',
      [prompt]
    );

    if (rows.length > 0) {
      return {
        matched: true,
        matches: rows.map((r) => ({
          name: r.attack_name,
          category: r.category,
          pattern: r.pattern,
          severity: r.severity,
          matchedVia: r.matched_via,
        })),
        triggerWords: [...new Set(rows.map((r) => r.pattern))],
      };
    }

    return { matched: false, matches: [], triggerWords: [] };
  } catch (err) {
    // If the stored function doesn't exist, fall back to raw SQL
    console.warn('⚠  check_heuristics() RPC failed, using raw SQL fallback:', err.message);
    return _fallbackHeuristics(pool, prompt);
  }
}

/**
 * Raw-SQL fallback: runs ILIKE + POSIX regex checks directly.
 */
async function _fallbackHeuristics(pool, prompt) {
  const { rows } = await pool.query(
    `SELECT id, name, category, pattern, severity, is_regex
     FROM known_attacks
     WHERE enabled = TRUE
       AND (
         (is_regex = FALSE AND $1 ILIKE '%' || pattern || '%')
         OR
         (is_regex = TRUE  AND $1 ~* pattern)
       )`,
    [prompt]
  );

  if (rows.length > 0) {
    return {
      matched: true,
      matches: rows.map((r) => ({
        name: r.name,
        category: r.category,
        pattern: r.pattern,
        severity: r.severity,
        matchedVia: r.is_regex ? 'regex' : 'ilike',
      })),
      triggerWords: [...new Set(rows.map((r) => r.pattern))],
    };
  }

  return { matched: false, matches: [], triggerWords: [] };
}

module.exports = { checkHeuristics };
