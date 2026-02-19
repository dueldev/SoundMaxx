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
      ageConfirmed: true,
      policyVersion: "2026-02-19",
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
      ageConfirmed: true,
      policyVersion: "2026-02-19",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects payload when age confirmation is missing", () => {
    const parsed = uploadInitSchema.safeParse({
      filename: "track.wav",
      mimeType: "audio/wav",
      sizeBytes: 1024,
      durationSec: 120,
      rightsConfirmed: true,
      ageConfirmed: false,
      policyVersion: "2026-02-19",
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
