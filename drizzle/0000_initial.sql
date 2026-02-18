CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  ip_hash text NOT NULL,
  user_agent_hash text NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  blob_key text NOT NULL,
  blob_url text,
  training_consent boolean NOT NULL DEFAULT false,
  duration_sec integer NOT NULL,
  sample_rate integer,
  channels integer,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  asset_id text NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  tool_type text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  status text NOT NULL,
  progress_pct integer NOT NULL,
  eta_sec integer,
  params_json jsonb NOT NULL,
  error_code text,
  external_job_id text,
  created_at timestamptz NOT NULL,
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS artifacts (
  id text PRIMARY KEY,
  job_id text NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  blob_key text NOT NULL,
  blob_url text NOT NULL,
  format text NOT NULL,
  size_bytes integer NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS quota_usage (
  session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  day_utc date NOT NULL,
  jobs_count integer NOT NULL,
  seconds_processed integer NOT NULL,
  bytes_uploaded integer NOT NULL,
  PRIMARY KEY (session_id, day_utc)
);

CREATE INDEX IF NOT EXISTS idx_jobs_external_id ON jobs(external_job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_assets_expires_at ON assets(expires_at);
CREATE INDEX IF NOT EXISTS idx_artifacts_expires_at ON artifacts(expires_at);
