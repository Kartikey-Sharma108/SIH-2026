-- ============================================================================
-- AI Security Gateway — Stored Functions (RPC)
-- ============================================================================
-- Optional Supabase RPC functions that the backend can call instead of raw SQL.
-- These provide a cleaner API and can be exposed via supabase.rpc() if needed.
-- ============================================================================

-- ============================================================================
-- 1. check_heuristics(prompt_text TEXT)
-- ============================================================================
-- Returns all matching known_attacks for a given prompt.
-- Supports both ILIKE (literal) and POSIX regex (~*) matching.
-- Called by lib/heuristics.js as an alternative to a raw query.
-- ============================================================================

CREATE OR REPLACE FUNCTION check_heuristics(prompt_text TEXT)
RETURNS TABLE (
    attack_id       UUID,
    attack_name     TEXT,
    category        TEXT,
    pattern         TEXT,
    severity        TEXT,
    matched_via     TEXT     -- 'ilike' or 'regex'
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ka.id,
        ka.name,
        ka.category,
        ka.pattern,
        ka.severity,
        CASE
            WHEN ka.is_regex THEN 'regex'::TEXT
            ELSE 'ilike'::TEXT
        END AS matched_via
    FROM known_attacks ka
    WHERE ka.enabled = TRUE
      AND (
          -- Literal ILIKE match
          (ka.is_regex = FALSE AND prompt_text ILIKE '%' || ka.pattern || '%')
          OR
          -- POSIX regex match (case-insensitive)
          (ka.is_regex = TRUE AND prompt_text ~* ka.pattern)
      );
END;
$$ LANGUAGE plpgsql STABLE
SET search_path = public;

COMMENT ON FUNCTION check_heuristics IS 'Layer 1: Returns all known_attacks that match the given prompt text via ILIKE or POSIX regex.';

-- ============================================================================
-- 2. insert_security_log(...)
-- ============================================================================
-- Inserts a new security_logs row and returns the created row.
-- Called by routes/analyze.js after risk assessment is complete.
-- ============================================================================

CREATE OR REPLACE FUNCTION insert_security_log(
    p_prompt            TEXT,
    p_risk_score        INTEGER,
    p_action_taken      TEXT,
    p_block_reason      TEXT        DEFAULT NULL,
    p_trigger_words     JSONB       DEFAULT '[]'::JSONB,
    p_heuristic_match   BOOLEAN     DEFAULT FALSE,
    p_guardrail_label   TEXT        DEFAULT NULL,
    p_guardrail_conf    NUMERIC     DEFAULT NULL,
    p_guardrail_error   BOOLEAN     DEFAULT FALSE,
    p_llm_response      TEXT        DEFAULT NULL,
    p_pii_detected      JSONB       DEFAULT '[]'::JSONB,
    p_source_ip         INET        DEFAULT NULL,
    p_user_agent        TEXT        DEFAULT NULL,
    p_processing_ms     INTEGER     DEFAULT NULL
)
RETURNS security_logs AS $$
DECLARE
    result security_logs;
BEGIN
    INSERT INTO security_logs (
        prompt, risk_score, action_taken, block_reason, trigger_words,
        heuristic_match, guardrail_label, guardrail_confidence, guardrail_error,
        llm_response, pii_detected, source_ip, user_agent, processing_ms
    ) VALUES (
        p_prompt, p_risk_score, p_action_taken, p_block_reason, p_trigger_words,
        p_heuristic_match, p_guardrail_label, p_guardrail_conf, p_guardrail_error,
        p_llm_response, p_pii_detected, p_source_ip, p_user_agent, p_processing_ms
    )
    RETURNING * INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

COMMENT ON FUNCTION insert_security_log IS 'Inserts a security_logs row and returns the created record. Used by the /api/analyze endpoint.';

-- ============================================================================
-- 3. get_recent_logs(limit_count INTEGER)
-- ============================================================================
-- Returns the N most recent security_logs rows, newest first.
-- Called by GET /api/logs.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_recent_logs(limit_count INTEGER DEFAULT 50)
RETURNS SETOF security_logs AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM security_logs
    ORDER BY created_at DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE
SET search_path = public;

COMMENT ON FUNCTION get_recent_logs IS 'Returns the N most recent security log entries, newest first.';

-- ============================================================================
-- 4. get_security_stats()
-- ============================================================================
-- Returns aggregate security metrics for the dashboard.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_security_stats()
RETURNS TABLE (
    total_requests       BIGINT,
    total_blocked        BIGINT,
    total_allowed        BIGINT,
    avg_risk_score       NUMERIC,
    max_risk_score       INTEGER,
    heuristic_hits       BIGINT,
    guardrail_injections BIGINT,
    guardrail_jailbreaks BIGINT,
    guardrail_errors     BIGINT,
    block_rate_pct       NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT                                               AS total_requests,
        COUNT(*) FILTER (WHERE sl.action_taken = 'blocked')::BIGINT    AS total_blocked,
        COUNT(*) FILTER (WHERE sl.action_taken = 'allowed')::BIGINT    AS total_allowed,
        ROUND(AVG(sl.risk_score), 2)                                   AS avg_risk_score,
        MAX(sl.risk_score)                                             AS max_risk_score,
        COUNT(*) FILTER (WHERE sl.heuristic_match = TRUE)::BIGINT      AS heuristic_hits,
        COUNT(*) FILTER (WHERE sl.guardrail_label = 'INJECTION')::BIGINT AS guardrail_injections,
        COUNT(*) FILTER (WHERE sl.guardrail_label = 'JAILBREAK')::BIGINT AS guardrail_jailbreaks,
        COUNT(*) FILTER (WHERE sl.guardrail_error = TRUE)::BIGINT      AS guardrail_errors,
        CASE
            WHEN COUNT(*) > 0 THEN
                ROUND(COUNT(*) FILTER (WHERE sl.action_taken = 'blocked')::NUMERIC / COUNT(*)::NUMERIC * 100, 2)
            ELSE 0
        END                                                            AS block_rate_pct
    FROM security_logs sl;
END;
$$ LANGUAGE plpgsql STABLE
SET search_path = public;

COMMENT ON FUNCTION get_security_stats IS 'Returns aggregate security metrics for the dashboard.';
