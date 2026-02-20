import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderSubmitInput } from "@/lib/providers/types";

const ORIGINAL_ENV = { ...process.env };

function sampleInput(): ProviderSubmitInput {
  return {
    jobId: "job_123",
    toolType: "stem_isolation",
    params: { stems: 4 },
    sourceAsset: {
      id: "asset_1",
      sessionId: "session_1",
      blobKey: "uploads/session_1/asset_1/input.wav",
      blobUrl: "https://example.com/input.wav",
      trainingConsent: true,
      durationSec: 12,
      sampleRate: 44_100,
      channels: 2,
      ageConfirmed: true,
      rightsConfirmed: true,
      trainingCaptureMode: "implied_use",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      policyVersion: "2026-02-19",
    },
    callback: {
      webhookUrl: "https://app.example.com/api/provider/webhook/custom",
      webhookSecret: "secret",
    },
    dataset: {
      captureMode: "implied_use",
      policyVersion: "2026-02-19",
    },
  };
}

function setAdapterEnv() {
  Object.assign(process.env, {
    NODE_ENV: "test",
    WORKER_API_URL: "https://worker.example.com",
    WORKER_API_KEY: "worker-test-key",
    WORKER_SUBMIT_MAX_ATTEMPTS: "3",
    WORKER_SUBMIT_TIMEOUT_MS: "3000",
    WORKER_SUBMIT_BASE_DELAY_MS: "1",
    WORKER_SUBMIT_MAX_DELAY_MS: "1",
  });
}

describe("customWorkerAdapter", () => {
  beforeEach(() => {
    vi.resetModules();
    setAdapterEnv();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    for (const key of [
      "WORKER_API_URL",
      "WORKER_API_KEY",
      "WORKER_SUBMIT_MAX_ATTEMPTS",
      "WORKER_SUBMIT_TIMEOUT_MS",
      "WORKER_SUBMIT_BASE_DELAY_MS",
      "WORKER_SUBMIT_MAX_DELAY_MS",
    ]) {
      delete process.env[key];
    }
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it("retries transient worker errors and succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("bad gateway", { status: 502 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            externalJobId: "job_123",
            status: "queued",
            model: "mel_band_roformer",
            provider: "custom",
            progressPct: 5,
            etaSec: 180,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const { customWorkerAdapter } = await import("@/lib/providers/custom");
    const result = await customWorkerAdapter.submitJob(sampleInput());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.externalJobId).toBe("job_123");
    expect(result.status).toBe("queued");
  });

  it("does not retry non-transient 4xx worker errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad request", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const { customWorkerAdapter } = await import("@/lib/providers/custom");

    await expect(customWorkerAdapter.submitJob(sampleInput())).rejects.toThrow("Worker rejected job");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries network failures", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            externalJobId: "job_123",
            status: "running",
            model: "mel_band_roformer",
            provider: "custom",
            progressPct: 25,
            etaSec: 90,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const { customWorkerAdapter } = await import("@/lib/providers/custom");
    const result = await customWorkerAdapter.submitJob(sampleInput());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("running");
    expect(result.progressPct).toBe(25);
  });
});
