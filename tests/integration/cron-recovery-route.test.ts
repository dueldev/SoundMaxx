import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recoverStaleJobs: vi.fn(),
}));

vi.mock("@/lib/jobs/recovery", () => ({
  recoverStaleJobs: mocks.recoverStaleJobs,
}));

async function loadGetRoute(secret?: string) {
  vi.resetModules();
  if (secret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = secret;
  }
  const routeModule = await import("@/app/api/cron/recovery/route");
  return routeModule.GET;
}

function buildRequest(authorization?: string) {
  const headers = authorization ? { authorization } : undefined;
  return new NextRequest("https://soundmaxx.example/api/cron/recovery", {
    method: "GET",
    headers,
  });
}

describe("GET /api/cron/recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recoverStaleJobs.mockResolvedValue({
      scanned: 8,
      stale: 3,
      retried: 2,
      fallback: 1,
      failed: 0,
    });
  });

  it("returns recovery summary when cron secret is not configured", async () => {
    const GET = await loadGetRoute();
    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.stale).toBe(3);
    expect(mocks.recoverStaleJobs).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when cron secret is configured and bearer token is missing", async () => {
    const GET = await loadGetRoute("cron_test_secret");
    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(mocks.recoverStaleJobs).not.toHaveBeenCalled();
  });

  it("accepts matching bearer token when cron secret is configured", async () => {
    const GET = await loadGetRoute("cron_test_secret");
    const response = await GET(buildRequest("Bearer cron_test_secret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.retried).toBe(2);
    expect(mocks.recoverStaleJobs).toHaveBeenCalledTimes(1);
  });
});
