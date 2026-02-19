import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runAutonomousTrainingCycle: vi.fn(),
}));

vi.mock("@/lib/training/orchestrator", () => ({
  runAutonomousTrainingCycle: mocks.runAutonomousTrainingCycle,
}));

async function loadPostRoute() {
  vi.resetModules();
  const routeModule = await import("@/app/api/cron/training/run/route");
  return routeModule.POST;
}

describe("POST /api/cron/training/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TRAINING_CRON_SECRET;
    delete process.env.OPS_DASHBOARD_PASSWORD;
    delete process.env.OPS_SECRET;
    process.env.FEATURE_AUTONOMOUS_TRAINING = "false";
    mocks.runAutonomousTrainingCycle.mockResolvedValue({
      runId: "run_123",
      status: "succeeded",
      backend: "best_effort_free",
      notes: "ok",
    });
  });

  it("returns unauthorized when secret is configured and missing", async () => {
    process.env.TRAINING_CRON_SECRET = "secret_123";

    const POST = await loadPostRoute();
    const response = await POST(new NextRequest("https://soundmaxx.example/api/cron/training/run", { method: "POST" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("skips when autonomous training feature flag is disabled", async () => {
    const POST = await loadPostRoute();
    const response = await POST(new NextRequest("https://soundmaxx.example/api/cron/training/run", { method: "POST" }));
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.status).toBe("skipped");
    expect(mocks.runAutonomousTrainingCycle).not.toHaveBeenCalled();
  });

  it("runs training cycle when enabled", async () => {
    process.env.FEATURE_AUTONOMOUS_TRAINING = "true";

    const POST = await loadPostRoute();
    const response = await POST(new NextRequest("https://soundmaxx.example/api/cron/training/run", { method: "POST" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.runId).toBe("run_123");
    expect(mocks.runAutonomousTrainingCycle).toHaveBeenCalledWith(48);
  });
});
