import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { limits } from "@/lib/config";
import { jsonError, noStoreHeaders } from "@/lib/http";
import { resolveRequestContext, withSessionCookie } from "@/lib/request-context";
import { incrementUploadUsage } from "@/lib/quota/check";
import { store } from "@/lib/store";

export const runtime = "nodejs";

const uploadCompleteSchema = z.object({
  blobUrl: z.string().url(),
  uploadedBytes: z.number().int().positive().max(limits.maxUploadBytes),
});

function blobPathname(blobUrl: string) {
  try {
    return decodeURIComponent(new URL(blobUrl).pathname).replace(/^\/+/, "");
  } catch {
    return null;
  }
}

async function resolveUploadedBytes(blobUrl: string, fallbackBytes: number) {
  try {
    const response = await fetch(blobUrl, {
      method: "HEAD",
    });
    if (!response.ok) {
      return fallbackBytes;
    }

    const value = Number(response.headers.get("content-length"));
    if (!Number.isFinite(value) || value <= 0) {
      return fallbackBytes;
    }

    return Math.min(Math.floor(value), limits.maxUploadBytes);
  } catch {
    return fallbackBytes;
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ assetId: string }> }) {
  try {
    const reqContext = await resolveRequestContext(request);
    if (reqContext instanceof NextResponse) {
      return reqContext;
    }

    const { assetId } = await context.params;
    const asset = await store.getSessionAsset(assetId, reqContext.sessionId);
    if (!asset) {
      return jsonError(404, "Asset not found");
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return jsonError(400, "Invalid JSON body");
    }

    const parsed = uploadCompleteSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonError(400, "Validation failed", parsed.error.flatten());
    }

    const uploadedPath = blobPathname(parsed.data.blobUrl);
    if (!uploadedPath || uploadedPath !== asset.blobKey) {
      return jsonError(400, "Uploaded blob does not match expected asset path");
    }

    const uploadedBytes = await resolveUploadedBytes(parsed.data.blobUrl, parsed.data.uploadedBytes);

    await store.updateAssetBlob({
      assetId: asset.id,
      blobUrl: parsed.data.blobUrl,
    });

    await incrementUploadUsage(asset.sessionId, uploadedBytes);

    const response = NextResponse.json(
      {
        assetId: asset.id,
        blobKey: asset.blobKey,
        blobUrl: parsed.data.blobUrl,
        uploadedBytes,
      },
      {
        headers: noStoreHeaders(),
      },
    );

    return withSessionCookie(response, reqContext);
  } catch (error) {
    console.error("Failed to complete direct upload", error);
    return jsonError(500, "Audio upload finalization failed");
  }
}
