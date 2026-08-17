-- ============================================================================
-- AI Security Gateway — Initial Schema
-- ============================================================================
-- This migration creates all tables needed by the Node.js/Express backend:
--   1. known_attacks   — curated attack patterns for Layer 1 (heuristic) checks
--   2. security_logs   — audit log of every /api/analyze request
-- ============================================================================

-- Enable pgcrypto for gen_random_uuid() if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. known_attacks
-- ============================================================================
-- Stores regex patterns, keywords, and descriptions of known prompt-injection
-- and jailbreak techniques. Layer 1 (heuristics.js) runs an ILIKE match
-- against these rows.
-- ============================================================================

CREATE TABLE IF NOT EXISTS known_attacks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,                         -- human-readable label, e.g. "DAN Jailbreak"
    category        TEXT NOT NULL DEFAULT 'injection',     -- 'injection' | 'jailbreak' | 'data_exfil' | 'other'
    pattern         TEXT NOT NULL,                         -- the keyword / phrase to ILIKE-match
    description     TEXT,                                  -- optional longer explanation
    severity        TEXT NOT NULL DEFAULT 'medium'         -- 'low' | 'medium' | 'high' | 'critical'
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    is_regex        BOOLEAN NOT NULL DEFAULT FALSE,        -- if true, treat `pattern` as a POSIX regex
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,         -- soft-delete / toggle without removing rows
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the ILIKE lookup that heuristics.js performs
CREATE INDEX IF NOT EXISTS idx_known_attacks_pattern
    ON known_attacks (pattern);

-- Partial index: only search enabled rows
CREATE INDEX IF NOT EXISTS idx_known_attacks_enabled
    ON known_attacks (enabled)
    WHERE enabled = TRUE;

COMMENT ON TABLE  known_attacks IS 'Curated catalogue of known prompt-injection / jailbreak patterns used by Layer 1 heuristic checks.';
COMMENT ON COLUMN known_attacks.pattern IS 'Keyword or phrase matched via ILIKE against incoming prompts. If is_regex = true, matched via ~ (POSIX regex).';

-- ============================================================================
-- 2. security_logs
-- ============================================================================
-- Every call to POST /api/analyze inserts exactly one row here, regardless of
-- whether the prompt was blocked or allowed through to the LLM.
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The original user prompt
    prompt          TEXT NOT NULL,

    -- Risk assessment
    risk_score      INTEGER NOT NULL DEFAULT 0
        CHECK (risk_score >= 0 AND risk_score <= 100),

    -- Which action did the gateway take?
    action_taken    TEXT NOT NULL DEFAULT 'allowed'
        CHECK (action_taken IN ('allowed', 'blocked')),

    -- Populated when action_taken = 'blocked'; describes which layer(s) triggered
    block_reason    TEXT,

    -- Keywords / patterns that matched (JSON array of strings for flexibility)
    trigger_words   JSONB DEFAULT '[]'::JSONB,

    -- Layer-level detail
    heuristic_match BOOLEAN NOT NULL DEFAULT FALSE,   -- Layer 1 hit?
    guardrail_label TEXT,                               -- Layer 2 result: 'SAFE' | 'INJECTION' | 'JAILBREAK'
    guardrail_confidence NUMERIC(5,4),                 -- 0.0000 – 1.0000
    guardrail_error BOOLEAN NOT NULL DEFAULT FALSE,    -- true if the HF API timed out or errored

    -- LLM response (only when action_taken = 'allowed')
    llm_response    TEXT,

    -- PII detected in the LLM response (JSON array of { type, value } objects)
    pii_detected    JSONB DEFAULT '[]'::JSONB,

    -- Metadata
    source_ip       INET,                              -- client IP, if captured
    user_agent      TEXT,                               -- client user-agent, if captured
    processing_ms   INTEGER,                            -- total request processing time in ms

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- For GET /api/logs — newest first, efficiently
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at
    ON security_logs (created_at DESC);

-- For filtering by action
CREATE INDEX IF NOT EXISTS idx_security_logs_action
    ON security_logs (action_taken);

-- For risk-score analytics / dashboards
CREATE INDEX IF NOT EXISTS idx_security_logs_risk_score
    ON security_logs (risk_score);

COMMENT ON TABLE  security_logs IS 'Audit log for every prompt analysed by the AI Security Gateway.';
COMMENT ON COLUMN security_logs.trigger_words IS 'JSON array of trigger keywords/patterns that matched during heuristic analysis.';
COMMENT ON COLUMN security_logs.pii_detected IS 'JSON array of {type, value} objects representing PII found in the LLM response.';

-- ============================================================================
-- 3. Utility: auto-update updated_at on known_attacks
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

CREATE TRIGGER trg_known_attacks_updated_at
    BEFORE UPDATE ON known_attacks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. Row-Level Security (RLS) policies
-- ============================================================================
-- In a production Supabase deployment these are tightened.
-- We grant full access only to the service_role (used by backend) and read/insert to authenticated.
-- ============================================================================

ALTER TABLE known_attacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

-- known_attacks: read-only for authenticated, full access for service_role
CREATE POLICY "Service role full access on known_attacks"
    ON known_attacks
    FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "Authenticated read access on known_attacks"
    ON known_attacks
    FOR SELECT
    TO authenticated
    USING (TRUE);

-- security_logs: select + insert for service_role/authenticated
CREATE POLICY "Service role full access on security_logs"
    ON security_logs
    FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "Authenticated insert access on security_logs"
    ON security_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "Authenticated select access on security_logs"
    ON security_logs
    FOR SELECT
    TO authenticated
    USING (TRUE);

-- Revoke public execution of rls_auto_enable to resolve anon/authenticated executable warning
ALTER FUNCTION rls_auto_enable() SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 5. Dashboard views (optional but useful for Studio / analytics)
-- ============================================================================

-- Quick stats for the dashboard
CREATE OR REPLACE VIEW v_security_summary WITH (security_invoker = true) AS
SELECT
    COUNT(*)                                              AS total_requests,
    COUNT(*) FILTER (WHERE action_taken = 'blocked')      AS total_blocked,
    COUNT(*) FILTER (WHERE action_taken = 'allowed')      AS total_allowed,
    ROUND(AVG(risk_score), 2)                             AS avg_risk_score,
    MAX(risk_score)                                       AS max_risk_score,
    COUNT(*) FILTER (WHERE heuristic_match = TRUE)        AS heuristic_hits,
    COUNT(*) FILTER (WHERE guardrail_label = 'INJECTION') AS guardrail_injections,
    COUNT(*) FILTER (WHERE guardrail_label = 'JAILBREAK') AS guardrail_jailbreaks,
    COUNT(*) FILTER (WHERE guardrail_error = TRUE)        AS guardrail_errors
FROM security_logs;

-- Recent blocked prompts — handy for the demo frontend
CREATE OR REPLACE VIEW v_recent_blocked WITH (security_invoker = true) AS
SELECT
    id,
    prompt,
    risk_score,
    block_reason,
    trigger_words,
    guardrail_label,
    guardrail_confidence,
    created_at
FROM security_logs
WHERE action_taken = 'blocked'
ORDER BY created_at DESC
LIMIT 100;

COMMENT ON VIEW v_security_summary IS 'Aggregate security metrics across all analysed prompts.';
COMMENT ON VIEW v_recent_blocked  IS 'Last 100 blocked prompts with detail — useful for demo dashboards.';
