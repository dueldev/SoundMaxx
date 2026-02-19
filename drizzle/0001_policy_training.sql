ALTER TABLE sessions ADD COLUMN IF NOT EXISTS policy_version text NOT NULL DEFAULT '2026-02-19';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS policy_seen_at timestamptz;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ad_personalization_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS do_not_sell_or_share boolean NOT NULL DEFAULT true;

ALTER TABLE assets ADD COLUMN IF NOT EXISTS policy_version text NOT NULL DEFAULT '2026-02-19';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS age_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS rights_confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS training_capture_mode text NOT NULL DEFAULT 'implied_use';

CREATE TABLE IF NOT EXISTS training_samples (
  id text PRIMARY KEY,
  sample_id text NOT NULL,
  tool_type text NOT NULL,
  capture_mode text NOT NULL DEFAULT 'implied_use',
  policy_version text NOT NULL,
  session_fingerprint text,
  input_hash text,
  output_hashes jsonb NOT NULL DEFAULT '[]'::jsonb,
  params_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  feature_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_duration_sec integer,
  status text NOT NULL DEFAULT 'captured',
  captured_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  derived_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS training_runs (
  id text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  backend text NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  notes text,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS model_versions (
  id text PRIMARY KEY,
  tool_type text NOT NULL,
  artifact_uri text NOT NULL,
  metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  lifecycle_state text NOT NULL,
  created_at timestamptz NOT NULL,
  promoted_at timestamptz,
  rolled_back_at timestamptz
);

CREATE TABLE IF NOT EXISTS model_rollouts (
  id text PRIMARY KEY,
  tool_type text NOT NULL,
  model_version_id text NOT NULL REFERENCES model_versions(id) ON DELETE CASCADE,
  stage text NOT NULL,
  traffic_pct integer NOT NULL,
  status text NOT NULL,
  baseline_metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  candidate_metrics_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  rollback_reason text,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_daily_aggregates (
  day_utc date NOT NULL,
  metric_key text NOT NULL,
  dimension text NOT NULL,
  dimension_value text NOT NULL,
  events_count integer NOT NULL,
  value_num integer,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (day_utc, metric_key, dimension, dimension_value)
);

CREATE INDEX IF NOT EXISTS idx_training_samples_captured_at ON training_samples(captured_at);
CREATE INDEX IF NOT EXISTS idx_training_samples_tool_type ON training_samples(tool_type);
CREATE INDEX IF NOT EXISTS idx_training_runs_started_at ON training_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_training_runs_status ON training_runs(status);
CREATE INDEX IF NOT EXISTS idx_model_versions_tool_type ON model_versions(tool_type);
CREATE INDEX IF NOT EXISTS idx_model_rollouts_tool_stage ON model_rollouts(tool_type, stage);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_metric ON analytics_daily_aggregates(day_utc, metric_key);
