import path from "node:path";
import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { env, featureFlags, limits, policyConfig } from "@/lib/config";
import { uploadBlob } from "@/lib/blob";
import { getDb } from "@/lib/db/client";
import { analyticsDailyAggregates, trainingSamples } from "@/lib/db/schema";
import { sha256 } from "@/lib/hash";
import { jsonError } from "@/lib/http";
import { materializeWebhookOutputAsArtifacts } from "@/lib/providers/output";
import { dequeueJob } from "@/lib/redis";
import { verifyHexSignature } from "@/lib/signature";
import { store } from "@/lib/store";
import { providerWebhookSchema } from "@/lib/validators";
import { hoursFromNow } from "@/lib/utils";

export const runtime = "nodejs";
const DEFAULT_ARTIFACT_IO_CONCURRENCY = 4;

const replicateWebhookSchema = z.object({
  id: z.string(),
  status: z.string(),
  output: z.unknown().optional(),
  error: z.string().optional(),
});

function webhookSecret(provider: string) {
  if (provider === "replicate") {
    return env.REPLICATE_WEBHOOK_SECRET ?? env.INFERENCE_WEBHOOK_SECRET;
  }

  return env.INFERENCE_WEBHOOK_SECRET;
}

function extractSignature(request: NextRequest) {
  return (
    request.headers.get("x-soundmaxx-signature") ??
    request.headers.get("x-webhook-signature") ??
    request.headers.get("webhook-signature") ??
    request.headers.get("x-replicate-signature")
  );
}

function statusFromReplicate(status: string): "succeeded" | "failed" | "running" | "ignored" {
  if (status === "succeeded") return "succeeded";
  if (status === "failed" || status === "canceled") return "failed";
  if (status === "processing" || status === "starting") return "running";
  return "ignored";
}

function extFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const ext = path.extname(parsed.pathname).replace(".", "").toLowerCase();
    return ext || "bin";
  } catch {
    return "bin";
  }
}

function mimeFromExt(ext: string) {
  if (ext === "wav") return "audio/wav";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "flac") return "audio/flac";
  if (ext === "ogg") return "audio/ogg";
  if (ext === "zip") return "application/zip";
  if (ext === "json") return "application/json";
  if (ext === "mid" || ext === "midi") return "audio/midi";
  return "application/octet-stream";
}

function sanitizeArtifactFilename(raw: string) {
  const base = path.basename(raw || "").replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!base) return "";
  return base.slice(0, 180);
}

function appendQualityFlags(existing: string[], ...incoming: string[]) {
  const next = new Set(existing);
  for (const flag of incoming) {
    if (!flag) continue;
    next.add(flag);
  }
  return [...next];
}

function envInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
) {
  if (items.length === 0) return [] as R[];
  const bounded = Math.max(1, Math.min(limit, items.length));
  const out = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    for (;;) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) return;
      out[current] = await task(items[current] as T, current);
    }
  }

  await Promise.all(Array.from({ length: bounded }, () => worker()));
  return out;
}

async function materializeProvidedArtifacts(jobId: string, artifacts: Array<{ blobUrl: string; blobKey: string; format: string }>) {
  const out = [] as Array<{ blobKey: string; blobUrl: string; format: string; sizeBytes: number }>;
  const usedNames = new Set<string>();

  const candidates = artifacts.map((item, index) => {
    const ext = (item.format || extFromUrl(item.blobUrl)).replace(/^\./, "").toLowerCase();
    const fallbackName = `output-${index + 1}.${ext || "bin"}`;
    const preferredName = sanitizeArtifactFilename(item.blobKey) || fallbackName;
    const parsed = path.parse(preferredName);
    const baseName = parsed.name || `output-${index + 1}`;
    const suffix = (parsed.ext || `.${ext || "bin"}`).replace(/^\./, "").toLowerCase();

    let filename = `${baseName}.${suffix}`;
    let dedupe = 2;
    while (usedNames.has(filename)) {
      filename = `${baseName}-${dedupe}.${suffix}`;
      dedupe += 1;
    }
    usedNames.add(filename);

    return {
      blobUrl: item.blobUrl,
      ext: ext || "bin",
      blobKey: `artifacts/${jobId}/${filename}`,
    };
  });

  const concurrency = envInt("ARTIFACT_IO_CONCURRENCY", DEFAULT_ARTIFACT_IO_CONCURRENCY);
  const uploaded = await mapWithConcurrency(candidates, concurrency, async (candidate) => {
    const response = await fetch(candidate.blobUrl);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    const uploadedBlob = await uploadBlob(candidate.blobKey, buffer, mimeFromExt(candidate.ext));
    return {
      blobKey: candidate.blobKey,
      blobUrl: uploadedBlob.downloadUrl,
      format: candidate.ext,
      sizeBytes: uploadedBlob.size,
    };
  });

  for (const item of uploaded) {
    if (item) {
      out.push(item);
    }
  }

  return out;
}

async function persistTrainingAndAggregates(args: {
  job: Awaited<ReturnType<typeof store.getJobByExternalId>>;
  artifacts: Array<{ blobUrl: string; format: string; sizeBytes: number }>;
  provider: string;
}) {
  if (!featureFlags.trainingDataPipeline || !args.job) {
    return;
  }

  const job = args.job;
  const asset = await store.getSessionAsset(job.assetId, job.sessionId);
  if (!asset) return;

  const now = new Date();
  const rawExpiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const derivedExpiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const paramsJson = (() => {
    try {
      return JSON.parse(job.paramsJson) as Record<string, unknown>;
    } catch {
      return {};
    }
  })();
  const totalSizeBytes = args.artifacts.reduce((sum, artifact) => sum + artifact.sizeBytes, 0);
  const avgSizeBytes = args.artifacts.length > 0 ? Math.floor(totalSizeBytes / args.artifacts.length) : 0;

  try {
    await getDb().insert(trainingSamples).values({
      id: nanoid(18),
      sampleId: nanoid(21),
      toolType: job.toolType,
      captureMode: "implied_use",
      policyVersion: asset.policyVersion || policyConfig.version,
      sessionFingerprint: sha256(`session:${job.sessionId}`),
      inputHash: asset.blobUrl ? sha256(asset.blobUrl) : null,
      outputHashes: args.artifacts.map((artifact) => sha256(`${artifact.blobUrl}:${artifact.sizeBytes}:${artifact.format}`)),
      paramsJson,
      outcomeJson: {
        provider: args.provider,
        status: "succeeded",
        artifactCount: args.artifacts.length,
      },
      featureJson: {
        outputCount: args.artifacts.length,
        totalArtifactBytes: totalSizeBytes,
        avgArtifactBytes: avgSizeBytes,
      },
      sourceDurationSec: asset.durationSec,
      status: "captured",
      capturedAt: now,
      expiresAt: rawExpiresAt,
      derivedExpiresAt,
      createdAt: now,
    });
  } catch (error) {
    console.error("Failed to persist training sample row", error);
  }

  try {
    const dayUtc = now.toISOString().slice(0, 10);
    await getDb()
      .insert(analyticsDailyAggregates)
      .values({
        dayUtc,
        metricKey: "jobs_succeeded",
        dimension: "tool_type",
        dimensionValue: job.toolType,
        eventsCount: 1,
        valueNum: totalSizeBytes,
        payloadJson: {
          provider: args.provider,
        },
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: [
          analyticsDailyAggregates.dayUtc,
          analyticsDailyAggregates.metricKey,
          analyticsDailyAggregates.dimension,
          analyticsDailyAggregates.dimensionValue,
        ],
        set: {
          eventsCount: sql`${analyticsDailyAggregates.eventsCount} + 1`,
          valueNum: sql`coalesce(${analyticsDailyAggregates.valueNum}, 0) + ${totalSizeBytes}`,
          createdAt: now,
        },
      });
  } catch (error) {
    console.error("Failed to persist analytics aggregate row", error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;

  const rawBody = await request.text();
  const secret = webhookSecret(provider);

  if (!secret) {
    return jsonError(500, "Webhook secret is not configured");
  }

  const signature = extractSignature(request);
  if (!verifyHexSignature(secret, rawBody, signature)) {
    return jsonError(401, "Invalid webhook signature");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonError(400, "Invalid webhook payload");
  }

  if (provider === "replicate") {
    const parsed = replicateWebhookSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonError(400, "Invalid replicate webhook payload", parsed.error.flatten());
    }

    const mappedStatus = statusFromReplicate(parsed.data.status);
    if (mappedStatus === "ignored") {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const job = await store.getJobByExternalId(parsed.data.id);
    if (!job) {
      return jsonError(404, "Unknown external job id");
    }

    if (mappedStatus === "running") {
      const progressPct = Math.max(5, Math.min(95, job.progressPct || 5));
      await store.updateJob({
        jobId: job.id,
        status: "running",
        progressPct,
        etaSec: job.etaSec ?? 120,
        recoveryState: job.attemptCount > 1 ? "retrying" : "none",
      });
      return NextResponse.json({ ok: true, status: "running" });
    }

    if (mappedStatus === "failed") {
      await store.updateJob({
        jobId: job.id,
        status: "failed",
        progressPct: 100,
        errorCode: parsed.data.error?.slice(0, 120) ?? "provider_failed",
        recoveryState: job.attemptCount > 1 ? "failed_after_retry" : "none",
        qualityFlags: appendQualityFlags(job.qualityFlags, "provider_failure"),
        finishedAt: new Date().toISOString(),
      });
      await dequeueJob(job.id);
      return NextResponse.json({ ok: true, status: "failed" });
    }

    const providerArtifacts = await materializeWebhookOutputAsArtifacts(job.id, parsed.data.output);
    const createdArtifacts = await store.createArtifacts(
      providerArtifacts.map((artifact) => ({
        id: nanoid(18),
        jobId: job.id,
        sessionId: job.sessionId,
        blobKey: artifact.blobKey,
        blobUrl: artifact.blobUrl,
        format: artifact.format,
        sizeBytes: artifact.sizeBytes,
        expiresAt: hoursFromNow(limits.retentionHours),
      })),
    );

    await store.updateJob({
      jobId: job.id,
      status: "succeeded",
      progressPct: 100,
      etaSec: 0,
      recoveryState: "none",
      finishedAt: new Date().toISOString(),
    });
    await persistTrainingAndAggregates({
      job,
      artifacts: createdArtifacts.map((artifact) => ({
        blobUrl: artifact.blobUrl,
        format: artifact.format,
        sizeBytes: artifact.sizeBytes,
      })),
      provider,
    });
    await dequeueJob(job.id);

    return NextResponse.json({
      ok: true,
      status: "succeeded",
      artifacts: createdArtifacts.map((artifact) => artifact.id),
    });
  }

  const parsed = providerWebhookSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(400, "Invalid provider webhook payload", parsed.error.flatten());
  }

  const job = await store.getJobByExternalId(parsed.data.externalJobId);
  if (!job) {
    return jsonError(404, "Unknown external job id");
  }

  if (parsed.data.status === "running") {
    const progressPct = typeof parsed.data.progressPct === "number" ? parsed.data.progressPct : Math.max(5, Math.min(95, job.progressPct || 5));
    await store.updateJob({
      jobId: job.id,
      status: "running",
      progressPct,
      etaSec: parsed.data.etaSec ?? job.etaSec ?? null,
      recoveryState: job.attemptCount > 1 ? "retrying" : "none",
    });
    return NextResponse.json({ ok: true, status: "running" });
  }

  if (parsed.data.status === "failed") {
    await store.updateJob({
      jobId: job.id,
      status: "failed",
      progressPct: parsed.data.progressPct ?? 100,
      errorCode: parsed.data.errorCode?.slice(0, 120) ?? "provider_failed",
      recoveryState: job.attemptCount > 1 ? "failed_after_retry" : "none",
      qualityFlags: appendQualityFlags(job.qualityFlags, "provider_failure"),
      finishedAt: new Date().toISOString(),
    });
    await dequeueJob(job.id);
    return NextResponse.json({ ok: true, status: "failed" });
  }

  const providedArtifacts = parsed.data.artifacts ?? [];
  const normalizedArtifacts = await materializeProvidedArtifacts(
    job.id,
    providedArtifacts.map((artifact) => ({
      blobUrl: artifact.blobUrl,
      blobKey: artifact.blobKey,
      format: artifact.format,
    })),
  );

  const createdArtifacts = await store.createArtifacts(
    normalizedArtifacts.map((artifact) => ({
      id: nanoid(18),
      jobId: job.id,
      sessionId: job.sessionId,
      blobKey: artifact.blobKey,
      blobUrl: artifact.blobUrl,
      format: artifact.format,
      sizeBytes: artifact.sizeBytes,
      expiresAt: hoursFromNow(limits.retentionHours),
    })),
  );

  const incomingQualityFlags = parsed.data.qualityFlags ?? [];
  if ((parsed.data.model ?? "").startsWith("fallback_")) {
    incomingQualityFlags.push("fallback_passthrough_output");
  }
  const qualityFlags = appendQualityFlags(job.qualityFlags, ...incomingQualityFlags);
  const degradedFallback = qualityFlags.includes("fallback_passthrough_output");

  await store.updateJob({
    jobId: job.id,
    status: "succeeded",
    progressPct: parsed.data.progressPct ?? 100,
    etaSec: 0,
    model: parsed.data.model,
    recoveryState: degradedFallback ? "degraded_fallback" : "none",
    qualityFlags,
    finishedAt: new Date().toISOString(),
  });
  await persistTrainingAndAggregates({
    job,
    artifacts: createdArtifacts.map((artifact) => ({
      blobUrl: artifact.blobUrl,
      format: artifact.format,
      sizeBytes: artifact.sizeBytes,
    })),
    provider,
  });

  await dequeueJob(job.id);

  return NextResponse.json({
    ok: true,
    status: "succeeded",
    artifacts: createdArtifacts.map((artifact) => artifact.id),
  });
}
