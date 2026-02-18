import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveRequestContext: vi.fn(),
  withSessionCookie: vi.fn((response: NextResponse) => response),
  canUpload: vi.fn(),
  store: {
    createAsset: vi.fn(),
  },
  generateClientTokenFromReadWriteToken: vi.fn(),
}));

vi.mock("@/lib/request-context", () => ({
  resolveRequestContext: mocks.resolveRequestContext,
  withSessionCookie: mocks.withSessionCookie,
}));

vi.mock("@/lib/quota/check", () => ({
  canUpload: mocks.canUpload,
}));

vi.mock("@/lib/store", () => ({
  store: mocks.store,
}));

vi.mock("@vercel/blob/client", () => ({
  generateClientTokenFromReadWriteToken: mocks.generateClientTokenFromReadWriteToken,
}));

async function loadPostRoute() {
  vi.resetModules();
  const module = await import("@/app/api/upload/init/route");
  return module.POST;
}

function buildRequest() {
  return new NextRequest("https://soundmaxx.example/api/upload/init", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      filename: "track.wav",
      mimeType: "audio/wav",
      sizeBytes: 29 * 1024 * 1024,
      durationSec: 180,
      rightsConfirmed: true,
      trainingConsent: false,
    }),
  });
}

describe("POST /api/upload/init", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.resolveRequestContext.mockResolvedValue({
      sessionId: "session_12345678",
      isNewSession: false,
    });
    mocks.canUpload.mockResolvedValue({
      allowed: true,
      reason: null,
      usage: {
        sessionId: "session_12345678",
        dayUtc: "2026-02-18",
        jobsCount: 0,
        secondsProcessed: 0,
        bytesUploaded: 0,
      },
    });
    mocks.store.createAsset.mockResolvedValue({
      id: "asset_12345678",
    });
    mocks.generateClientTokenFromReadWriteToken.mockResolvedValue("vercel_blob_client_token_test");
  });

  it("returns direct-upload token and upload metadata", async () => {
    const POST = await loadPostRoute();
    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.assetId).toBeTruthy();
    expect(body.blobKey).toMatch(/^uploads\/session_12345678\//);
    expect(body.clientUploadToken).toBe("vercel_blob_client_token_test");
    expect(body.uploadUrl).toMatch(/^\/api\/upload\/content\//);

    expect(mocks.generateClientTokenFromReadWriteToken).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: body.blobKey,
        allowOverwrite: true,
        addRandomSuffix: false,
      }),
    );
  });

  it("returns 500 when upload token generation fails", async () => {
    mocks.generateClientTokenFromReadWriteToken.mockRejectedValue(new Error("blob token missing"));

    const POST = await loadPostRoute();
    const response = await POST(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Unable to initialize direct upload token");
  });
});
