import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  APP_BASE_URL: z.string().url().optional(),
  GOOGLE_SITE_VERIFICATION: z.string().optional(),
  SEO_SAME_AS: z.string().optional(),
  SEO_CONTACT_EMAIL: z.string().email().optional(),
  DATABASE_URL: z.string().url().optional(),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  INFERENCE_PROVIDER: z.enum(["replicate", "custom"]).default("custom"),
  INFERENCE_WEBHOOK_SECRET: z.string().optional(),
  PROVIDER_CALLBACK_BASE_URL: z.string().url().optional(),
  REPLICATE_API_TOKEN: z.string().optional(),
  REPLICATE_WEBHOOK_SECRET: z.string().optional(),
  REPLICATE_MODEL_STEM_ISOLATION: z.string().optional(),
  REPLICATE_MODEL_MASTERING: z.string().optional(),
  REPLICATE_MODEL_KEY_BPM: z.string().optional(),
  REPLICATE_MODEL_LOUDNESS_REPORT: z.string().optional(),
  REPLICATE_MODEL_MIDI_EXTRACT: z.string().optional(),
  WORKER_API_URL: z.string().url().optional(),
  WORKER_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  OPS_SECRET: z.string().optional(),
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}

export const env = {
  ...parsed.data,
  SESSION_SECRET:
    parsed.data.SESSION_SECRET ??
    "soundmaxx-dev-secret-change-this-before-production-please-123456",
};

export const limits = {
  maxUploadBytes: 100 * 1024 * 1024,
  maxDurationSec: 15 * 60,
  dailyJobs: 10,
  dailySecondsProcessed: 45 * 60,
  dailyBytesUploaded: 600 * 1024 * 1024,
  retentionHours: 24,
  ipBurstPerMinute: 25,
  sessionTtlDays: 14,
  sessionTokenTtlMinutes: 15,
};

export const allowedMimeTypes = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/x-flac",
  "audio/aac",
  "audio/mp4",
  "audio/ogg",
  "audio/webm",
]);

export const modelCatalog = {
  stem_isolation: {
    primary: "mel_band_roformer",
    fallback: "demucs_v4",
  },
  mastering: {
    primary: "sonicmaster",
    fallback: "matchering_2_0",
  },
  key_bpm: {
    primary: "essentia",
    fallback: "essentia",
  },
  loudness_report: {
    primary: "pyloudnorm",
    fallback: "pyloudnorm",
  },
  midi_extract: {
    primary: "basic_pitch",
    fallback: "basic_pitch",
  },
} as const;

export const replicateModelEnvKeys = {
  stem_isolation: "REPLICATE_MODEL_STEM_ISOLATION",
  mastering: "REPLICATE_MODEL_MASTERING",
  key_bpm: "REPLICATE_MODEL_KEY_BPM",
  loudness_report: "REPLICATE_MODEL_LOUDNESS_REPORT",
  midi_extract: "REPLICATE_MODEL_MIDI_EXTRACT",
} as const;
