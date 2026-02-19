import { boolean, date, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  ipHash: text("ip_hash").notNull(),
  userAgentHash: text("user_agent_hash").notNull(),
  policyVersion: text("policy_version").notNull().default("2026-02-19"),
  policySeenAt: timestamp("policy_seen_at", { withTimezone: true }),
  adPersonalizationOptIn: boolean("ad_personalization_opt_in").notNull().default(false),
  doNotSellOrShare: boolean("do_not_sell_or_share").notNull().default(true),
});

export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  blobKey: text("blob_key").notNull(),
  blobUrl: text("blob_url"),
  trainingConsent: boolean("training_consent").notNull().default(false),
  policyVersion: text("policy_version").notNull().default("2026-02-19"),
  ageConfirmed: boolean("age_confirmed").notNull().default(false),
  rightsConfirmed: boolean("rights_confirmed").notNull().default(false),
  trainingCaptureMode: text("training_capture_mode").notNull().default("implied_use"),
  durationSec: integer("duration_sec").notNull(),
  sampleRate: integer("sample_rate"),
  channels: integer("channels"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  assetId: text("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  toolType: text("tool_type").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  status: text("status").notNull(),
  progressPct: integer("progress_pct").notNull(),
  etaSec: integer("eta_sec"),
  paramsJson: jsonb("params_json").notNull(),
  errorCode: text("error_code"),
  externalJobId: text("external_job_id"),
  recoveryState: text("recovery_state").notNull().default("none"),
  attemptCount: integer("attempt_count").notNull().default(1),
  qualityFlags: jsonb("quality_flags").notNull().default([]),
  lastRecoveryAt: timestamp("last_recovery_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const artifacts = pgTable("artifacts", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  blobKey: text("blob_key").notNull(),
  blobUrl: text("blob_url").notNull(),
  format: text("format").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const quotaUsage = pgTable(
  "quota_usage",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    dayUtc: date("day_utc").notNull(),
    jobsCount: integer("jobs_count").notNull(),
    secondsProcessed: integer("seconds_processed").notNull(),
    bytesUploaded: integer("bytes_uploaded").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.sessionId, table.dayUtc] }),
  }),
);

export const trainingSamples = pgTable("training_samples", {
  id: text("id").primaryKey(),
  sampleId: text("sample_id").notNull(),
  toolType: text("tool_type").notNull(),
  captureMode: text("capture_mode").notNull().default("implied_use"),
  policyVersion: text("policy_version").notNull(),
  sessionFingerprint: text("session_fingerprint"),
  inputHash: text("input_hash"),
  outputHashes: jsonb("output_hashes").notNull().default([]),
  paramsJson: jsonb("params_json").notNull().default({}),
  outcomeJson: jsonb("outcome_json").notNull().default({}),
  featureJson: jsonb("feature_json").notNull().default({}),
  sourceDurationSec: integer("source_duration_sec"),
  status: text("status").notNull().default("captured"),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  derivedExpiresAt: timestamp("derived_expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const trainingRuns = pgTable("training_runs", {
  id: text("id").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
  backend: text("backend").notNull(),
  status: text("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  metricsJson: jsonb("metrics_json").notNull().default({}),
  errorCode: text("error_code"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const modelVersions = pgTable("model_versions", {
  id: text("id").primaryKey(),
  toolType: text("tool_type").notNull(),
  artifactUri: text("artifact_uri").notNull(),
  metricsJson: jsonb("metrics_json").notNull().default({}),
  lifecycleState: text("lifecycle_state").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  promotedAt: timestamp("promoted_at", { withTimezone: true }),
  rolledBackAt: timestamp("rolled_back_at", { withTimezone: true }),
});

export const modelRollouts = pgTable("model_rollouts", {
  id: text("id").primaryKey(),
  toolType: text("tool_type").notNull(),
  modelVersionId: text("model_version_id")
    .notNull()
    .references(() => modelVersions.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  trafficPct: integer("traffic_pct").notNull(),
  status: text("status").notNull(),
  baselineMetricsJson: jsonb("baseline_metrics_json").notNull().default({}),
  candidateMetricsJson: jsonb("candidate_metrics_json").notNull().default({}),
  rollbackReason: text("rollback_reason"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const analyticsDailyAggregates = pgTable(
  "analytics_daily_aggregates",
  {
    dayUtc: date("day_utc").notNull(),
    metricKey: text("metric_key").notNull(),
    dimension: text("dimension").notNull(),
    dimensionValue: text("dimension_value").notNull(),
    eventsCount: integer("events_count").notNull(),
    valueNum: integer("value_num"),
    payloadJson: jsonb("payload_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.dayUtc, table.metricKey, table.dimension, table.dimensionValue] }),
  }),
);
