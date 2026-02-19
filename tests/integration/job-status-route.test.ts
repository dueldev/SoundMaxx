import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtifactRecord, JobRecord } from "@/types/domain";

const mocks = vi.hoisted(() => ({
  resolveRequestContext: vi.fn(),
  withSessionCookie: vi.fn((response: NextResponse) => response),
  dequeueJob: vi.fn(),
  store: {
    getSessionJob: vi.fn(),
    listArtifactsForJob: vi.fn(),
    getSessionAsset: vi.fn(),
    createArtifacts: vi.fn(),
    updateJob: vi.fn(),
  },
}));

vi.mock("@/lib/request-context", () => ({
  resolveRequestContext: mocks.resolveRequestContext,
  withSessionCookie: mocks.withSessionCookie,
}));

vi.mock("@/lib/redis", () => ({
  dequeueJob: mocks.dequeueJob,
}));

vi.mock("@/lib/store", () => ({
  store: mocks.store,
}));

const now = new Date();

const baseJob: JobRecord = {
  id: "job_12345678",
  sessionId: "session_12345678",
  assetId: "asset_12345678",
  toolType: "stem_isolation",
  provider: "custom",
  model: "mel_band_roformer",
  status: "queued",
  progressPct: 5,
  etaSec: 180,
  paramsJson: JSON.stringify({ stems: 2 }),
  errorCode: null,
  externalJobId: "external_12345678",
  recoveryState: "none",
  attemptCount: 1,
  qualityFlags: [],
  lastRecoveryAt: null,
  createdAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
  finishedAt: null,
};

const fallbackArtifacts: ArtifactRecord[] = [
  {
    id: "artifact_1",
    jobId: baseJob.id,
    sessionId: baseJob.sessionId,
    blobKey: `artifacts/${baseJob.id}/fallback-stem-1.wav`,
    blobUrl: "https://example.com/fallback-1.wav",
    format: "wav",
    sizeBytes: 0,
    expiresAt: "2026-02-19T00:00:00.000Z",
    createdAt: "2026-02-18T00:00:00.000Z",
  },
  {
    id: "artifact_2",
    jobId: baseJob.id,
    sessionId: baseJob.sessionId,
    blobKey: `artifacts/${baseJob.id}/fallback-stem-2.wav`,
    blobUrl: "https://example.com/fallback-2.wav",
    format: "wav",
    sizeBytes: 0,
    expiresAt: "2026-02-19T00:00:00.000Z",
    createdAt: "2026-02-18T00:00:00.000Z",
  },
];

async function loadGetRoute() {
  vi.resetModules();
  process.env.CUSTOM_STEM_STALE_TIMEOUT_SEC = "60";
  const routeModule = await import("@/app/api/jobs/[jobId]/route");
  return routeModule.GET;
}

describe("GET /api/jobs/[jobId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestContext.mockResolvedValue({
      sessionId: baseJob.sessionId,
      isNewSession: false,
    });
    mocks.dequeueJob.mockResolvedValue(undefined);
  });

  it("auto-completes stale custom stem jobs with fallback artifacts", async () => {
    mocks.store.getSessionJob.mockResolvedValue({
      ...baseJob,
      attemptCount: 2,
    });
    mocks.store.listArtifactsForJob.mockResolvedValueOnce([]).mockResolvedValueOnce(fallbackArtifacts);
    mocks.store.getSessionAsset.mockResolvedValue({
      id: baseJob.assetId,
      sessionId: baseJob.sessionId,
      blobUrl: "https://example.com/source.wav",
    });
    mocks.store.createArtifacts.mockResolvedValue(fallbackArtifacts);
    mocks.store.updateJob.mockResolvedValue({
      ...baseJob,
      status: "succeeded",
      progressPct: 100,
      etaSec: 0,
      recoveryState: "degraded_fallback",
      qualityFlags: ["fallback_passthrough_output"],
      finishedAt: now.toISOString(),
    });

    const GET = await loadGetRoute();
    const request = new NextRequest("https://soundmaxx.example/api/jobs/job_12345678");
    const response = await GET(request, { params: Promise.resolve({ jobId: baseJob.id }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("succeeded");
    expect(body.artifactIds).toEqual(["artifact_1", "artifact_2"]);
    expect(mocks.store.createArtifacts).toHaveBeenCalledTimes(1);
    expect(mocks.dequeueJob).toHaveBeenCalledWith(baseJob.id);
  });

  it("returns existing status/artifacts for non-stale jobs", async () => {
    const freshJob: JobRecord = {
      ...baseJob,
      createdAt: new Date(now.getTime() - 20_000).toISOString(),
      status: "running",
    };

    const existingArtifacts: ArtifactRecord[] = [fallbackArtifacts[0]!];

    mocks.store.getSessionJob.mockResolvedValue(freshJob);
    mocks.store.listArtifactsForJob.mockResolvedValue(existingArtifacts);

    const GET = await loadGetRoute();
    const request = new NextRequest("https://soundmaxx.example/api/jobs/job_12345678");
    const response = await GET(request, { params: Promise.resolve({ jobId: freshJob.id }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("running");
    expect(body.artifactIds).toEqual(["artifact_1"]);
    expect(mocks.store.createArtifacts).not.toHaveBeenCalled();
    expect(mocks.dequeueJob).not.toHaveBeenCalled();
  });
});
