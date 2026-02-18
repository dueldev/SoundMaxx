import { boolean, date, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  ipHash: text("ip_hash").notNull(),
  userAgentHash: text("user_agent_hash").notNull(),
});

export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  blobKey: text("blob_key").notNull(),
  blobUrl: text("blob_url"),
  trainingConsent: boolean("training_consent").notNull().default(false),
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
