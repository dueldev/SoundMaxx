import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { eq } from "drizzle-orm";
import { buildShortLivedSessionToken } from "@/lib/session";
import { jsonError, noStoreHeaders } from "@/lib/http";
import { resolveRequestContext, withSessionCookie } from "@/lib/request-context";
import { canUpload } from "@/lib/quota/check";
import { allowedMimeTypes, env, featureFlags, limits, policyConfig } from "@/lib/config";
import { uploadInitSchema } from "@/lib/validators";
import { getDb } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { store } from "@/lib/store";
import { hoursFromNow, normalizeDurationSec } from "@/lib/utils";
import type { UploadInitResponse } from "@/types/api";

export const runtime = "nodejs";

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}

async function createDirectUploadToken(pathname: string) {
  return generateClientTokenFromReadWriteToken({
    pathname,
    addRandomSuffix: false,
    allowOverwrite: true,
    maximumSizeInBytes: limits.maxUploadBytes,
    allowedContentTypes: Array.from(allowedMimeTypes),
    validUntil: Date.now() + limits.sessionTokenTtlMinutes * 60 * 1000,
  });
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

    if (featureFlags.impliedDataUse && parsed.data.policyVersion !== policyConfig.version) {
      return jsonError(409, "Policy version mismatch. Please refresh and accept the latest policy.", {
        requiredPolicyVersion: policyConfig.version,
      });
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
      trainingConsent: true,
      policyVersion: parsed.data.policyVersion,
      ageConfirmed: parsed.data.ageConfirmed,
      rightsConfirmed: parsed.data.rightsConfirmed,
      trainingCaptureMode: "implied_use",
      durationSec: normalizeDurationSec(parsed.data.durationSec),
      expiresAt,
    });

    if (env.DATABASE_URL) {
      try {
        await getDb()
          .update(sessions)
          .set({
            policyVersion: parsed.data.policyVersion,
            policySeenAt: new Date(),
          })
          .where(eq(sessions.id, context.sessionId));
      } catch (error) {
        console.error("Failed to persist session policy acceptance", error);
      }
    }

    let clientUploadToken: string;
    try {
      clientUploadToken = await createDirectUploadToken(blobKey);
    } catch (error) {
      return jsonError(500, "Unable to initialize direct upload token", {
        message: error instanceof Error ? error.message : "unknown error",
      });
    }

    const response = NextResponse.json<UploadInitResponse>(
      {
        uploadUrl: `/api/upload/content/${assetId}`,
        blobKey,
        assetId,
        sessionToken: buildShortLivedSessionToken(context.sessionId),
        expiresAt,
        clientUploadToken,
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
