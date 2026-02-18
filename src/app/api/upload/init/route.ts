import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";
import { buildShortLivedSessionToken } from "@/lib/session";
import { jsonError, noStoreHeaders } from "@/lib/http";
import { resolveRequestContext, withSessionCookie } from "@/lib/request-context";
import { canUpload } from "@/lib/quota/check";
import { limits } from "@/lib/config";
import { uploadInitSchema } from "@/lib/validators";
import { store } from "@/lib/store";
import { hoursFromNow, normalizeDurationSec } from "@/lib/utils";
import type { UploadInitResponse } from "@/types/api";

export const runtime = "nodejs";

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}

export async function POST(request: NextRequest) {
  try {
    const context = await resolveRequestContext(request);
    if (context instanceof NextResponse) {
      return context;
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return jsonError(400, "Invalid JSON body");
    }

    const parsed = uploadInitSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonError(400, "Validation failed", parsed.error.flatten());
    }

    const quota = await canUpload(context.sessionId, parsed.data.sizeBytes);
    if (!quota.allowed) {
      return jsonError(429, quota.reason ?? "Upload quota exceeded", quota.usage);
    }

    const assetId = nanoid(18);
    const blobKey = `uploads/${context.sessionId}/${assetId}/${safeFileName(parsed.data.filename)}`;
    const expiresAt = hoursFromNow(limits.retentionHours);

    await store.createAsset({
      id: assetId,
      sessionId: context.sessionId,
      blobKey,
      trainingConsent: parsed.data.trainingConsent,
      durationSec: normalizeDurationSec(parsed.data.durationSec),
      expiresAt,
    });

    const response = NextResponse.json<UploadInitResponse>(
      {
        uploadUrl: `/api/upload/content/${assetId}`,
        blobKey,
        assetId,
        sessionToken: buildShortLivedSessionToken(context.sessionId),
        expiresAt,
      },
      {
        headers: noStoreHeaders(),
      },
    );

    return withSessionCookie(response, context);
  } catch (error) {
    console.error("Failed to initialize upload", error);
    return jsonError(500, "Unable to initialize upload");
  }
}
