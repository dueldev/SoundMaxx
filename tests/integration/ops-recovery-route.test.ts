import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasOpsApiAccess: vi.fn(),
  recoverStaleJobs: vi.fn(),
}));

vi.mock("@/lib/ops-access", () => ({
  hasOpsApiAccess: mocks.hasOpsApiAccess,
}));

vi.mock("@/lib/jobs/recovery", () => ({
  recoverStaleJobs: mocks.recoverStaleJobs,
}));

async function loadPostRoute() {
  vi.resetModules();
  const routeModule = await import("@/app/api/ops/recovery/route");
  return routeModule.POST;
}

function buildRequest() {
  return new NextRequest("https://soundmaxx.example/api/ops/recovery", {
    method: "POST",
  });
}

describe("POST /api/ops/recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasOpsApiAccess.mockReturnValue(true);
    mocks.recoverStaleJobs.mockResolvedValue({
      scanned: 11,
      stale: 4,
      retried: 2,
      fallback: 1,
      failed: 1,
    });
  });

  it("returns 401 when ops access is denied", async () => {
    mocks.hasOpsApiAccess.mockReturnValue(false);
    const POST = await loadPostRoute();
    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(mocks.recoverStaleJobs).not.toHaveBeenCalled();
  });

  it("runs stale recovery sweep and returns no-store response when authorized", async () => {
    const POST = await loadPostRoute();
    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.stale).toBe(4);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(mocks.recoverStaleJobs).toHaveBeenCalledTimes(1);
  });
});
