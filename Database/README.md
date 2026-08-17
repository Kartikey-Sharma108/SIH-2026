# Database — AI Security Gateway (Supabase)

This folder contains the **Supabase local development** setup for the AI Security Gateway project.

## Structure

```
Database/
└── supabase/
    ├── config.toml                                 # Supabase local dev configuration
    ├── migrations/
    │   ├── 20260816000000_init_schema.sql          # Tables, indexes, RLS, views
    │   └── 20260816000001_stored_functions.sql     # RPC functions for the backend
    └── seed.sql                                    # 40+ known attack patterns
```

## Tables

### `known_attacks`
Curated catalogue of prompt-injection / jailbreak patterns used by **Layer 1** (heuristic checks).

| Column       | Type     | Description |
|-------------|----------|-------------|
| `id`        | UUID     | Primary key |
| `name`      | TEXT     | Human-readable label (e.g. "DAN Jailbreak") |
| `category`  | TEXT     | `injection` \| `jailbreak` \| `data_exfil` \| `other` |
| `pattern`   | TEXT     | Keyword/phrase for ILIKE matching, or POSIX regex if `is_regex = TRUE` |
| `severity`  | TEXT     | `low` \| `medium` \| `high` \| `critical` |
| `is_regex`  | BOOLEAN  | If true, `pattern` is matched via `~*` (POSIX case-insensitive regex) |
| `enabled`   | BOOLEAN  | Soft toggle — disabled rows are skipped by heuristics |

### `security_logs`
Audit log for every `POST /api/analyze` request.

| Column                | Type      | Description |
|----------------------|-----------|-------------|
| `id`                 | UUID      | Primary key |
| `prompt`             | TEXT      | Original user prompt |
| `risk_score`         | INTEGER   | 0–100 computed risk score |
| `action_taken`       | TEXT      | `allowed` \| `blocked` |
| `block_reason`       | TEXT      | Which layer(s) triggered the block |
| `trigger_words`      | JSONB     | Array of matched keywords/patterns |
| `heuristic_match`    | BOOLEAN   | Layer 1 hit? |
| `guardrail_label`    | TEXT      | Layer 2 result: `SAFE` / `INJECTION` / `JAILBREAK` |
| `guardrail_confidence` | NUMERIC | 0.0000–1.0000 |
| `guardrail_error`    | BOOLEAN   | True if HF API timed out / errored |
| `llm_response`       | TEXT      | LLM response (only when allowed) |
| `pii_detected`       | JSONB     | Array of `{type, value}` PII objects |
| `processing_ms`      | INTEGER   | Total request processing time |

## Views

| View                  | Description |
|----------------------|-------------|
| `v_security_summary` | Aggregate metrics (total requests, blocked, avg risk score, etc.) |
| `v_recent_blocked`   | Last 100 blocked prompts with full detail |

## Stored Functions (RPC)

| Function              | Description |
|----------------------|-------------|
| `check_heuristics(prompt_text)` | Layer 1: returns all matching `known_attacks` for a prompt |
| `insert_security_log(...)` | Inserts a log row and returns it |
| `get_recent_logs(limit)` | Returns N most recent logs, newest first |
| `get_security_stats()` | Aggregate dashboard metrics |

## Getting Started

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed

### Start local Supabase

```bash
cd Database
npx supabase start
```

This will:
1. Start Postgres, Auth, Storage, Studio, and other Supabase services in Docker
2. Run all migrations in `supabase/migrations/`
3. Run `supabase/seed.sql` to populate `known_attacks`

### Access

| Service        | URL |
|---------------|-----|
| API            | `http://127.0.0.1:54321` |
| Studio         | `http://127.0.0.1:54323` |
| Database (pg)  | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

### Reset database

```bash
npx supabase db reset
```

This drops and recreates all tables, reruns migrations, and reseeds.

## Connection from Backend

The Node.js backend connects via the `DATABASE_URL` env var. For local dev:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

The backend uses the `pg` library (not the Supabase JS client) for direct SQL queries, so it connects to the Postgres port (54322) directly.
