import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveRequestContext: vi.fn(),
  withSessionCookie: vi.fn((response: NextResponse) => response),
  findSession: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
}));

vi.mock("@/lib/request-context", () => ({
  resolveRequestContext: mocks.resolveRequestContext,
  withSessionCookie: mocks.withSessionCookie,
}));

vi.mock("@/lib/db/client", () => ({
  getDb: () => ({
    query: {
      sessions: {
        findFirst: mocks.findSession,
      },
    },
    update: mocks.update,
  }),
}));

async function loadRouteHandlers() {
  vi.resetModules();
  const routeModule = await import("@/app/api/privacy/preferences/route");
  return {
    GET: routeModule.GET,
    PUT: routeModule.PUT,
  };
}

describe("/api/privacy/preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestContext.mockResolvedValue({
      sessionId: "session_123",
      isNewSession: false,
    });

    mocks.findSession.mockResolvedValue({
      id: "session_123",
      adPersonalizationOptIn: false,
      doNotSellOrShare: true,
    });

    mocks.where.mockResolvedValue(undefined);
    mocks.set.mockReturnValue({ where: mocks.where });
    mocks.update.mockReturnValue({ set: mocks.set });
  });

  it("returns current preferences", async () => {
    const { GET } = await loadRouteHandlers();
    const response = await GET(new NextRequest("https://soundmaxx.example/api/privacy/preferences"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      adPersonalizationOptIn: false,
      doNotSellOrShare: true,
    });
  });

  it("updates preferences", async () => {
    const { PUT } = await loadRouteHandlers();
    const response = await PUT(
      new NextRequest("https://soundmaxx.example/api/privacy/preferences", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          adPersonalizationOptIn: true,
          doNotSellOrShare: false,
        }),
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      adPersonalizationOptIn: true,
      doNotSellOrShare: false,
    });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        adPersonalizationOptIn: true,
        doNotSellOrShare: false,
      }),
    );
  });
});
