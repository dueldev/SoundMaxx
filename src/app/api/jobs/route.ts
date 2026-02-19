import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";
import { env, modelCatalog } from "@/lib/config";
import { jsonError, noStoreHeaders } from "@/lib/http";
import { resolveRequestContext, withSessionCookie } from "@/lib/request-context";
import { canCreateJob, incrementJobUsage } from "@/lib/quota/check";
import { getProviderAdapter } from "@/lib/providers/registry";
import { dequeueJob, queueJob } from "@/lib/redis";
import { store } from "@/lib/store";
import { createJobSchema } from "@/lib/validators";
import type { CreateJobResponse } from "@/types/api";
import type { JobStatus } from "@/types/domain";

export const runtime = "nodejs";

function callbackBase(request: NextRequest) {
  if (env.APP_BASE_URL) return env.APP_BASE_URL.replace(/\/$/, "");

  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) {
    throw new Error("Unable to compute callback URL. Set APP_BASE_URL.");
  }

  return `${proto}://${host}`;
}

function webhookSecret() {
  if (env.INFERENCE_PROVIDER === "replicate") {
    return env.REPLICATE_WEBHOOK_SECRET ?? env.INFERENCE_WEBHOOK_SECRET ?? "";
  }

  return env.INFERENCE_WEBHOOK_SECRET ?? "";
}

export async function POST(request: NextRequest) {
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

  const parsed = createJobSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.flatten());
  }

  const asset = await store.getSessionAsset(parsed.data.assetId, context.sessionId);
  if (!asset) {
    return jsonError(404, "Asset not found");
  }

  if (!asset.blobUrl) {
    return jsonError(409, "Upload content first before starting processing");
  }

  const quota = await canCreateJob(context.sessionId, asset.durationSec);
  if (!quota.allowed) {
    return jsonError(429, quota.reason ?? "Job quota exceeded", quota.usage);
  }

  const jobId = nanoid(18);
  const defaultModel = modelCatalog[parsed.data.toolType].primary;
  const hookSecret = webhookSecret();
  if (!hookSecret) {
    return jsonError(500, "Inference webhook secret is not configured");
  }

  let callbackUrl: string;
  try {
    callbackUrl = `${callbackBase(request)}/api/provider/webhook/${env.INFERENCE_PROVIDER}`;
  } catch (error) {
    return jsonError(500, "Unable to compute callback URL", {
      message: error instanceof Error ? error.message : "unknown error",
    });
  }

  await store.createJob({
    id: jobId,
    sessionId: context.sessionId,
    assetId: asset.id,
    toolType: parsed.data.toolType,
    provider: env.INFERENCE_PROVIDER,
    model: defaultModel,
    status: "queued",
    progressPct: 5,
    etaSec: 180,
    paramsJson: JSON.stringify(parsed.data.params),
    recoveryState: "none",
    attemptCount: 1,
    qualityFlags: [],
    lastRecoveryAt: null,
  });

  await queueJob(jobId);

  try {
    const adapter = getProviderAdapter();

    const submitResult = await adapter.submitJob({
      jobId,
      toolType: parsed.data.toolType,
      params: parsed.data.params,
      sourceAsset: asset,
      callback: {
        webhookUrl: callbackUrl,
        webhookSecret: hookSecret,
      },
      dataset: {
        captureMode: "implied_use",
        policyVersion: asset.policyVersion,
      },
    });

    const normalizedStatus: JobStatus =
      submitResult.status === "queued"
        ? "queued"
        : submitResult.status === "running"
          ? "running"
          : submitResult.status === "succeeded"
            ? "succeeded"
            : "failed";

    await store.updateJob({
      jobId,
      externalJobId: submitResult.externalJobId,
      status: normalizedStatus,
      progressPct: submitResult.progressPct,
      etaSec: submitResult.etaSec,
      errorCode: submitResult.errorCode ?? null,
      recoveryState: "none",
      qualityFlags: [],
      finishedAt: normalizedStatus === "succeeded" || normalizedStatus === "failed" ? new Date().toISOString() : null,
    });

    await incrementJobUsage(context.sessionId, asset.durationSec);

    const response = NextResponse.json<CreateJobResponse>(
      {
        jobId,
        status: normalizedStatus,
        recoveryState: "none",
        attemptCount: 1,
        qualityFlags: [],
      },
      {
        headers: noStoreHeaders(),
      },
    );

    return withSessionCookie(response, context);
  } catch (error) {
    await store.updateJob({
      jobId,
      status: "failed",
      progressPct: 100,
      errorCode: error instanceof Error ? error.message.slice(0, 120) : "job_submission_failed",
      recoveryState: "none",
      finishedAt: new Date().toISOString(),
    });
    await dequeueJob(jobId);

    return jsonError(500, "Unable to submit inference job", {
      message: error instanceof Error ? error.message : "unknown error",
    });
  }
}
