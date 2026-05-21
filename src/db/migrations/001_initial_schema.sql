-- CommitmentVault — initial schema
-- All timestamps are TIMESTAMPTZ (UTC).
-- evaluations and metric_snapshots are append-only (immutable once inserted).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- commitments
-- Defines a commitment: what metrics to track, thresholds, and penalty/reward
-- wallets. dry_run mirrors the env flag at creation time so historical records
-- are self-describing.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commitments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               TEXT        NOT NULL,
  title                 TEXT        NOT NULL,
  description           TEXT,

  -- Array of rule objects: { metric, operator, threshold, description }
  -- logic: 'all' (every rule must pass) | 'any' (at least one must pass)
  rules                 JSONB       NOT NULL,
  logic                 TEXT        NOT NULL DEFAULT 'all' CHECK (logic IN ('all', 'any')),

  -- Financial parameters (populated before going live; NULL is fine in dry_run)
  penalty_wallet        TEXT,
  penalty_amount_usdc   NUMERIC(18, 6),
  reward_wallet         TEXT,

  -- Evaluation schedule
  -- period: 'weekly' | 'daily' | 'monthly'
  period                TEXT        NOT NULL DEFAULT 'weekly' CHECK (period IN ('weekly', 'daily', 'monthly')),
  -- day_of_week 0=Sun … 6=Sat, only meaningful for period='weekly'
  evaluation_day_of_week INT CHECK (evaluation_day_of_week BETWEEN 0 AND 6),
  evaluation_time       TIME        NOT NULL DEFAULT '08:00:00',

  start_date            DATE        NOT NULL,
  end_date              DATE,

  status                TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),

  dry_run               BOOLEAN     NOT NULL DEFAULT TRUE,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- metric_snapshots  (immutable)
-- Raw data returned by Discriminador for the evaluation period.
-- Never updated after INSERT.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metric_snapshots (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commitment_id         UUID        NOT NULL REFERENCES commitments(id),

  period_start          TIMESTAMPTZ NOT NULL,
  period_end            TIMESTAMPTZ NOT NULL,

  -- Full JSON body returned by Discriminador GET /api/commitment-metrics
  metrics_data          JSONB       NOT NULL,

  fetched_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- evaluations  (immutable)
-- One row per commitment per evaluation cycle.  Captures the rules as they
-- existed at evaluation time (copy-on-write) so future rule edits don't
-- rewrite history.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evaluations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commitment_id         UUID        NOT NULL REFERENCES commitments(id),
  metric_snapshot_id    UUID        NOT NULL REFERENCES metric_snapshots(id),

  period_start          TIMESTAMPTZ NOT NULL,
  period_end            TIMESTAMPTZ NOT NULL,

  -- Snapshot of rules + logic at evaluation time
  rules_snapshot        JSONB       NOT NULL,
  logic_snapshot        TEXT        NOT NULL,

  -- Per-rule detail: [{ rule, actual_value, passed }]
  rule_results          JSONB       NOT NULL,

  result                TEXT        NOT NULL CHECK (result IN ('pass', 'fail')),

  evaluated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- wallet_actions
-- Pending or executed financial instructions derived from an evaluation.
-- In dry_run mode these are created with status='dry_run_logged' and never
-- advanced further.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_actions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commitment_id         UUID        NOT NULL REFERENCES commitments(id),
  evaluation_id         UUID        NOT NULL REFERENCES evaluations(id),

  -- 'penalty': funds moved to burn/donation wallet on failure
  -- 'reward':  funds released/accumulated on success
  action_type           TEXT        NOT NULL CHECK (action_type IN ('penalty', 'reward')),

  amount_usdc           NUMERIC(18, 6) NOT NULL,
  destination_wallet    TEXT        NOT NULL,

  -- pending → submitted → confirmed | failed
  -- dry_run_logged: never advanced, purely informational
  status                TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'dry_run_logged', 'submitted', 'confirmed', 'failed')),

  dry_run               BOOLEAN     NOT NULL DEFAULT TRUE,
  tx_hash               TEXT,
  error_message         TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at           TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_commitments_user_id   ON commitments(user_id);
CREATE INDEX IF NOT EXISTS idx_commitments_status    ON commitments(status);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_cid  ON metric_snapshots(commitment_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_cid       ON evaluations(commitment_id);
CREATE INDEX IF NOT EXISTS idx_wallet_actions_cid    ON wallet_actions(commitment_id);
CREATE INDEX IF NOT EXISTS idx_wallet_actions_status ON wallet_actions(status);
