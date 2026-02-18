import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveRequestContext: vi.fn(),
  withSessionCookie: vi.fn((response: NextResponse) => response),
  incrementUploadUsage: vi.fn(),
  store: {
    getSessionAsset: vi.fn(),
    updateAssetBlob: vi.fn(),
  },
}));

vi.mock("@/lib/request-context", () => ({
  resolveRequestContext: mocks.resolveRequestContext,
  withSessionCookie: mocks.withSessionCookie,
}));

vi.mock("@/lib/quota/check", () => ({
  incrementUploadUsage: mocks.incrementUploadUsage,
}));

vi.mock("@/lib/store", () => ({
  store: mocks.store,
}));

async function loadPutRoute() {
  vi.resetModules();
  const module = await import("@/app/api/upload/complete/[assetId]/route");
  return module.PUT;
}

describe("PUT /api/upload/complete/[assetId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestContext.mockResolvedValue({
      sessionId: "session_12345678",
      isNewSession: false,
    });
    mocks.store.getSessionAsset.mockResolvedValue({
      id: "asset_12345678",
      sessionId: "session_12345678",
      blobKey: "uploads/session_12345678/asset_12345678/track.wav",
    });
    mocks.store.updateAssetBlob.mockResolvedValue({
      id: "asset_12345678",
    });
    mocks.incrementUploadUsage.mockResolvedValue({
      ok: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("finalizes upload and stores blob URL for the session asset", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: {
          "content-length": "305419",
        },
      }),
    );

    const PUT = await loadPutRoute();
    const request = new NextRequest("https://soundmaxx.example/api/upload/complete/asset_12345678", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blobUrl: "https://bucket.public.blob.vercel-storage.com/uploads/session_12345678/asset_12345678/track.wav",
        uploadedBytes: 12345,
      }),
    });

    const response = await PUT(request, { params: Promise.resolve({ assetId: "asset_12345678" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.assetId).toBe("asset_12345678");
    expect(body.uploadedBytes).toBe(305419);
    expect(mocks.store.updateAssetBlob).toHaveBeenCalledWith({
      assetId: "asset_12345678",
      blobUrl: "https://bucket.public.blob.vercel-storage.com/uploads/session_12345678/asset_12345678/track.wav",
    });
    expect(mocks.incrementUploadUsage).toHaveBeenCalledWith("session_12345678", 305419);
  });

  it("rejects blob URLs that do not match the expected asset path", async () => {
    const PUT = await loadPutRoute();
    const request = new NextRequest("https://soundmaxx.example/api/upload/complete/asset_12345678", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blobUrl: "https://bucket.public.blob.vercel-storage.com/uploads/session_12345678/other-asset/track.wav",
        uploadedBytes: 12345,
      }),
    });

    const response = await PUT(request, { params: Promise.resolve({ assetId: "asset_12345678" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Uploaded blob does not match expected asset path");
    expect(mocks.store.updateAssetBlob).not.toHaveBeenCalled();
    expect(mocks.incrementUploadUsage).not.toHaveBeenCalled();
  });
});
