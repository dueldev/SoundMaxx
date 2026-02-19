ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recovery_state text NOT NULL DEFAULT 'none';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 1;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quality_flags jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_recovery_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_jobs_recovery_state ON jobs(recovery_state);
CREATE INDEX IF NOT EXISTS idx_jobs_last_recovery_at ON jobs(last_recovery_at);
