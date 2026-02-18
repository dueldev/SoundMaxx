import { z } from "zod";
import { allowedMimeTypes, limits } from "@/lib/config";
import { MASTERING_PRESETS, TOOL_TYPES } from "@/types/domain";

const baseUploadSchema = z.object({
  filename: z.string().min(1).max(256),
  mimeType: z.string().min(3).max(100),
  sizeBytes: z.number().int().positive(),
  durationSec: z.number().positive(),
  rightsConfirmed: z.boolean(),
  trainingConsent: z.boolean().default(false),
});

export const uploadInitSchema = baseUploadSchema.superRefine((input, ctx) => {
  if (!allowedMimeTypes.has(input.mimeType)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Unsupported file format",
      path: ["mimeType"],
    });
  }

  if (input.sizeBytes > limits.maxUploadBytes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `File exceeds ${Math.floor(limits.maxUploadBytes / (1024 * 1024))}MB limit`,
      path: ["sizeBytes"],
    });
  }

  if (input.durationSec > limits.maxDurationSec) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Audio exceeds ${Math.floor(limits.maxDurationSec / 60)} minute limit`,
      path: ["durationSec"],
    });
  }

  if (!input.rightsConfirmed) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "You must confirm rights ownership or permission",
      path: ["rightsConfirmed"],
    });
  }
});

const stemIsolationParams = z.object({
  stems: z.union([z.literal(2), z.literal(4)]),
  fallbackModel: z.enum(["demucs_v4", "mel_band_roformer"]).optional(),
});

const masteringParams = z.object({
  preset: z.enum(MASTERING_PRESETS),
  intensity: z.number().min(0).max(100),
  referenceAssetId: z.string().min(8).max(64).optional(),
});

const keyBpmParams = z.object({
  includeChordHints: z.boolean().default(true),
});

const loudnessParams = z.object({
  targetLufs: z.number().min(-24).max(-6).optional(),
});

const midiParams = z.object({
  sensitivity: z.number().min(0).max(1),
});

export const createJobSchema = z.discriminatedUnion("toolType", [
  z.object({
    assetId: z.string().min(8).max(64),
    toolType: z.literal(TOOL_TYPES[0]),
    params: stemIsolationParams,
  }),
  z.object({
    assetId: z.string().min(8).max(64),
    toolType: z.literal(TOOL_TYPES[1]),
    params: masteringParams,
  }),
  z.object({
    assetId: z.string().min(8).max(64),
    toolType: z.literal(TOOL_TYPES[2]),
    params: keyBpmParams,
  }),
  z.object({
    assetId: z.string().min(8).max(64),
    toolType: z.literal(TOOL_TYPES[3]),
    params: loudnessParams,
  }),
  z.object({
    assetId: z.string().min(8).max(64),
    toolType: z.literal(TOOL_TYPES[4]),
    params: midiParams,
  }),
]);

export const providerWebhookSchema = z.object({
  externalJobId: z.string().min(8),
  status: z.union([z.literal("succeeded"), z.literal("failed"), z.literal("running")]),
  progressPct: z.number().min(0).max(100).optional(),
  errorCode: z.string().max(120).optional(),
  artifacts: z
    .array(
      z.object({
        blobUrl: z.string().url(),
        blobKey: z.string().min(1),
        format: z.string().min(1).max(32),
        sizeBytes: z.number().int().nonnegative(),
      }),
    )
    .optional(),
  metrics: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
});
