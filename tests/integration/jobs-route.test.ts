import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetRecord, ToolType } from "@/types/domain";

const mocks = vi.hoisted(() => ({
  resolveRequestContext: vi.fn(),
  withSessionCookie: vi.fn((response: NextResponse) => response),
  canCreateJob: vi.fn(),
  incrementJobUsage: vi.fn(),
  getProviderAdapter: vi.fn(),
  queueJob: vi.fn(),
  dequeueJob: vi.fn(),
  store: {
    getSessionAsset: vi.fn(),
    createJob: vi.fn(),
    updateJob: vi.fn(),
  },
}));

vi.mock("@/lib/request-context", () => ({
  resolveRequestContext: mocks.resolveRequestContext,
  withSessionCookie: mocks.withSessionCookie,
}));

vi.mock("@/lib/quota/check", () => ({
  canCreateJob: mocks.canCreateJob,
  incrementJobUsage: mocks.incrementJobUsage,
}));

vi.mock("@/lib/providers/registry", () => ({
  getProviderAdapter: mocks.getProviderAdapter,
}));

vi.mock("@/lib/redis", () => ({
  queueJob: mocks.queueJob,
  dequeueJob: mocks.dequeueJob,
}));

vi.mock("@/lib/store", () => ({
  store: mocks.store,
}));

const baseAsset: AssetRecord = {
  id: "asset_12345678",
  sessionId: "session_12345678",
  blobKey: "uploads/session_12345678/asset_12345678/input.wav",
  blobUrl: "https://example.com/input.wav",
  trainingConsent: false,
  policyVersion: "2026-02-19",
  ageConfirmed: true,
  rightsConfirmed: true,
  trainingCaptureMode: "implied_use",
  durationSec: 120,
  sampleRate: 44_100,
  channels: 2,
  expiresAt: "2026-02-19T00:00:00.000Z",
  createdAt: "2026-02-18T00:00:00.000Z",
};

async function loadPostRoute(secret = "whsec_test_1234567890") {
  vi.resetModules();
  process.env.APP_BASE_URL = "https://soundmaxx.example";
  process.env.INFERENCE_PROVIDER = "custom";
  process.env.INFERENCE_WEBHOOK_SECRET = secret;
  const routeModule = await import("@/app/api/jobs/route");
  return routeModule.POST;
}

function buildRequest(toolType: ToolType, params: Record<string, unknown>) {
  return new NextRequest("https://soundmaxx.example/api/jobs", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "soundmaxx.example",
      "x-forwarded-proto": "https",
    },
    body: JSON.stringify({
      assetId: baseAsset.id,
      toolType,
      params,
    }),
  });
}

describe("POST /api/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.resolveRequestContext.mockResolvedValue({
      sessionId: baseAsset.sessionId,
      isNewSession: false,
    });
    mocks.canCreateJob.mockResolvedValue({
      allowed: true,
      reason: null,
      usage: {
        sessionId: baseAsset.sessionId,
        dayUtc: "2026-02-18",
        jobsCount: 0,
        secondsProcessed: 0,
        bytesUploaded: 0,
      },
    });
    mocks.store.getSessionAsset.mockResolvedValue(baseAsset);
    mocks.store.createJob.mockResolvedValue({
      id: "job_12345678",
    });
    mocks.store.updateJob.mockResolvedValue({
      id: "job_12345678",
      status: "queued",
    });
    mocks.incrementJobUsage.mockResolvedValue({
      ok: true,
    });
    mocks.queueJob.mockResolvedValue(undefined);
    mocks.dequeueJob.mockResolvedValue(undefined);
  });

  it("submits every production tool type with valid params", async () => {
    const toolCases: Array<{ toolType: ToolType; params: Record<string, unknown> }> = [
      { toolType: "stem_isolation", params: { stems: 2 } },
      { toolType: "mastering", params: { preset: "streaming_clean", intensity: 60 } },
      { toolType: "key_bpm", params: { includeChordHints: true } },
      { toolType: "loudness_report", params: { targetLufs: -14 } },
      { toolType: "midi_extract", params: { sensitivity: 0.5 } },
    ];

    for (const testCase of toolCases) {
      const submitJob = vi.fn().mockResolvedValue({
        externalJobId: `external_${testCase.toolType}`,
        provider: "custom",
        model: "test-model",
        status: "queued",
        progressPct: 5,
        etaSec: 180,
      });
      mocks.getProviderAdapter.mockReturnValue({ submitJob });

      const POST = await loadPostRoute();
      const response = await POST(buildRequest(testCase.toolType, testCase.params));
      const body = (await response.json()) as { jobId: string; status: string };

      expect(response.status).toBe(200);
      expect(body.status).toBe("queued");
      expect(body.jobId).toMatch(/\w+/);
      expect(submitJob).toHaveBeenCalledWith(
        expect.objectContaining({
          toolType: testCase.toolType,
          params: testCase.params,
          sourceAsset: expect.objectContaining({
            id: baseAsset.id,
          }),
          callback: {
            webhookUrl: "https://soundmaxx.example/api/provider/webhook/custom",
            webhookSecret: "whsec_test_1234567890",
          },
          dataset: {
            captureMode: "implied_use",
            policyVersion: "2026-02-19",
          },
        }),
      );
      expect(mocks.incrementJobUsage).toHaveBeenCalledWith(baseAsset.sessionId, baseAsset.durationSec);
    }
  });

  it("returns 409 when upload content is missing", async () => {
    mocks.store.getSessionAsset.mockResolvedValue({
      ...baseAsset,
      blobUrl: null,
    });

    const POST = await loadPostRoute();
    const response = await POST(buildRequest("mastering", { preset: "streaming_clean", intensity: 50 }));

    expect(response.status).toBe(409);
    expect(mocks.getProviderAdapter).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid tool params", async () => {
    const POST = await loadPostRoute();
    const response = await POST(buildRequest("midi_extract", { sensitivity: 1.5 }));

    expect(response.status).toBe(400);
    expect(mocks.store.getSessionAsset).not.toHaveBeenCalled();
  });

  it("marks a job as failed if provider submission throws", async () => {
    const submitJob = vi.fn().mockRejectedValue(new Error("worker unreachable"));
    mocks.getProviderAdapter.mockReturnValue({ submitJob });

    const POST = await loadPostRoute();
    const response = await POST(buildRequest("key_bpm", { includeChordHints: true }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Unable to submit inference job");
    expect(mocks.store.updateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
      }),
    );
    expect(mocks.dequeueJob).toHaveBeenCalledTimes(1);
  });

  it("fails fast when webhook secret is missing", async () => {
    const POST = await loadPostRoute("");
    const response = await POST(buildRequest("loudness_report", { targetLufs: -14 }));

    expect(response.status).toBe(500);
    expect(mocks.store.createJob).not.toHaveBeenCalled();
  });
});
