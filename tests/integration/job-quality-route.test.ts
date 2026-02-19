import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveRequestContext: vi.fn(),
  withSessionCookie: vi.fn((response: NextResponse) => response),
  findFirst: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  onConflictDoUpdate: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("@/lib/request-context", () => ({
  resolveRequestContext: mocks.resolveRequestContext,
  withSessionCookie: mocks.withSessionCookie,
}));

vi.mock("@/lib/db/client", () => ({
  getDb: mocks.getDb,
}));

async function loadPostRoute() {
  vi.resetModules();
  const routeModule = await import("@/app/api/jobs/[jobId]/quality/route");
  return routeModule.POST;
}

function buildRequest(payload: unknown) {
  return new NextRequest("https://soundmaxx.example/api/jobs/job_123/quality", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/jobs/[jobId]/quality", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.resolveRequestContext.mockResolvedValue({
      sessionId: "session_123",
      isNewSession: false,
    });
    mocks.findFirst.mockResolvedValue({
      id: "job_123",
      sessionId: "session_123",
    });
    mocks.onConflictDoUpdate.mockResolvedValue(undefined);
    mocks.values.mockReturnValue({
      onConflictDoUpdate: mocks.onConflictDoUpdate,
    });
    mocks.insert.mockReturnValue({
      values: mocks.values,
    });
    mocks.getDb.mockReturnValue({
      query: {
        jobs: {
          findFirst: mocks.findFirst,
        },
      },
      insert: mocks.insert,
    });
  });

  it("records quality feedback for a session-owned job", async () => {
    const POST = await loadPostRoute();
    const response = await POST(buildRequest({ usable: false, reason: "quality_gap", toolType: "stem_isolation" }), {
      params: Promise.resolve({ jobId: "job_123" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({
        metricKey: "job_quality_feedback",
        dimensionValue: "stem_isolation:needs_rerun",
      }),
    );
    expect(mocks.onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when job is not found for the current session", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const POST = await loadPostRoute();
    const response = await POST(buildRequest({ usable: true, reason: "looks_good", toolType: "mastering" }), {
      params: Promise.resolve({ jobId: "job_missing" }),
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Job not found");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns 400 when payload validation fails", async () => {
    const POST = await loadPostRoute();
    const response = await POST(buildRequest({ usable: true, reason: "", toolType: "mastering" }), {
      params: Promise.resolve({ jobId: "job_123" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Validation failed");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
