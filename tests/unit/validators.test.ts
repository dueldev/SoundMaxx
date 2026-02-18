import { describe, expect, it } from "vitest";
import { createJobSchema, uploadInitSchema } from "@/lib/validators";

describe("uploadInitSchema", () => {
  it("accepts a valid upload payload", () => {
    const parsed = uploadInitSchema.safeParse({
      filename: "track.wav",
      mimeType: "audio/wav",
      sizeBytes: 1024,
      durationSec: 180,
      rightsConfirmed: true,
      trainingConsent: true,
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects payload without rights confirmation", () => {
    const parsed = uploadInitSchema.safeParse({
      filename: "track.wav",
      mimeType: "audio/wav",
      sizeBytes: 1024,
      durationSec: 120,
      rightsConfirmed: false,
      trainingConsent: false,
    });

    expect(parsed.success).toBe(false);
  });
});

describe("createJobSchema", () => {
  it("validates mastering payload", () => {
    const parsed = createJobSchema.safeParse({
      assetId: "asset_12345678",
      toolType: "mastering",
      params: {
        preset: "streaming_clean",
        intensity: 60,
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid midi sensitivity", () => {
    const parsed = createJobSchema.safeParse({
      assetId: "asset_12345678",
      toolType: "midi_extract",
      params: {
        sensitivity: 1.5,
      },
    });

    expect(parsed.success).toBe(false);
  });
});
