import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforceIpRateLimit: vi.fn(),
  getSessionFromRequest: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  enforceIpRateLimit: mocks.enforceIpRateLimit,
}));

vi.mock("@/lib/session", () => ({
  getSessionFromRequest: mocks.getSessionFromRequest,
}));

async function loadPostRoute(password = "test_ops_password_123") {
  vi.resetModules();
  process.env.OPS_DASHBOARD_PASSWORD = password;
  const routeModule = await import("@/app/api/ops/auth/login/route");
  return routeModule.POST;
}

function buildRequest(password: string) {
  return new NextRequest("https://soundmaxx.example/api/ops/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "vitest",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify({ password }),
  });
}

describe("POST /api/ops/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionFromRequest.mockReturnValue({
      sessionId: "session_test",
      isNew: false,
      ipHash: "ip_hash",
      userAgentHash: "ua_hash",
    });
    mocks.enforceIpRateLimit.mockResolvedValue({
      success: true,
      limit: 25,
      remaining: 24,
      reset: Date.now() + 60_000,
    });
  });

  it("returns entry token on successful login", async () => {
    const POST = await loadPostRoute();
    const response = await POST(buildRequest("test_ops_password_123"));
    const body = (await response.json()) as { ok?: boolean; entryToken?: string };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.entryToken).toBe("string");
    expect(body.entryToken?.length).toBeGreaterThan(10);
  });

  it("returns 401 for invalid password", async () => {
    const POST = await loadPostRoute();
    const response = await POST(buildRequest("wrong"));
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("Invalid password");
  });

  it("returns 429 when rate limited", async () => {
    mocks.enforceIpRateLimit.mockResolvedValue({
      success: false,
      limit: 25,
      remaining: 0,
      reset: Date.now() + 60_000,
    });

    const POST = await loadPostRoute();
    const response = await POST(buildRequest("test_ops_password_123"));
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(429);
    expect(body.error).toBe("Too many attempts");
  });
});

