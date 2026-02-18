import path from "node:path";
import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env, limits } from "@/lib/config";
import { uploadBlob } from "@/lib/blob";
import { jsonError } from "@/lib/http";
import { materializeWebhookOutputAsArtifacts } from "@/lib/providers/output";
import { dequeueJob } from "@/lib/redis";
import { verifyHexSignature } from "@/lib/signature";
import { store } from "@/lib/store";
import { providerWebhookSchema } from "@/lib/validators";
import { hoursFromNow } from "@/lib/utils";

export const runtime = "nodejs";

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

async function materializeProvidedArtifacts(jobId: string, artifacts: Array<{ blobUrl: string; format: string }>) {
  const out = [] as Array<{ blobKey: string; blobUrl: string; format: string; sizeBytes: number }>;

  for (let index = 0; index < artifacts.length; index += 1) {
    const item = artifacts[index]!;
    const response = await fetch(item.blobUrl);
    if (!response.ok) continue;

    const buffer = Buffer.from(await response.arrayBuffer());
    const ext = item.format || extFromUrl(item.blobUrl);
    const blobKey = `artifacts/${jobId}/provided-${index + 1}.${ext}`;
    const uploaded = await uploadBlob(blobKey, buffer, mimeFromExt(ext));
    out.push({
      blobKey,
      blobUrl: uploaded.downloadUrl,
      format: ext,
      sizeBytes: uploaded.size,
    });
  }

  return out;
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
      await store.updateJob({
        jobId: job.id,
        status: "running",
        progressPct: 35,
        etaSec: job.etaSec ?? 120,
      });
      return NextResponse.json({ ok: true, status: "running" });
    }

    if (mappedStatus === "failed") {
      await store.updateJob({
        jobId: job.id,
        status: "failed",
        progressPct: 100,
        errorCode: parsed.data.error?.slice(0, 120) ?? "provider_failed",
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
      finishedAt: new Date().toISOString(),
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
    await store.updateJob({
      jobId: job.id,
      status: "running",
      progressPct: parsed.data.progressPct ?? 20,
      etaSec: job.etaSec ?? 120,
    });
    return NextResponse.json({ ok: true, status: "running" });
  }

  if (parsed.data.status === "failed") {
    await store.updateJob({
      jobId: job.id,
      status: "failed",
      progressPct: parsed.data.progressPct ?? 100,
      errorCode: parsed.data.errorCode?.slice(0, 120) ?? "provider_failed",
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

  await store.updateJob({
    jobId: job.id,
    status: "succeeded",
    progressPct: parsed.data.progressPct ?? 100,
    etaSec: 0,
    finishedAt: new Date().toISOString(),
  });

  await dequeueJob(job.id);

  return NextResponse.json({
    ok: true,
    status: "succeeded",
    artifacts: createdArtifacts.map((artifact) => artifact.id),
  });
}
