import { env } from "@/lib/config";
import type { InferenceProviderAdapter, ProviderSubmitInput, ProviderSubmitResult } from "@/lib/providers/types";

function resolveWorkerUrl(path: string) {
  if (!env.WORKER_API_URL) {
    throw new Error("WORKER_API_URL is not configured");
  }

  return `${env.WORKER_API_URL.replace(/\/$/, "")}${path}`;
}

export const customWorkerAdapter: InferenceProviderAdapter = {
  async submitJob(input: ProviderSubmitInput): Promise<ProviderSubmitResult> {
    if (!env.WORKER_API_KEY) {
      throw new Error("WORKER_API_KEY is not configured");
    }

    const response = await fetch(resolveWorkerUrl("/jobs"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.WORKER_API_KEY}`,
      },
      body: JSON.stringify({
        jobId: input.jobId,
        toolType: input.toolType,
        params: input.params,
        sourceAsset: {
          id: input.sourceAsset.id,
          blobUrl: input.sourceAsset.blobUrl,
          durationSec: input.sourceAsset.durationSec,
        },
        callback: {
          webhookUrl: input.callback.webhookUrl,
          webhookSecret: input.callback.webhookSecret,
        },
        dataset: {
          captureMode: input.dataset.captureMode,
          policyVersion: input.dataset.policyVersion,
          sourceSessionId: input.sourceAsset.sessionId,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Worker rejected job: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as {
      externalJobId: string;
      status: "queued" | "running" | "succeeded" | "failed";
      etaSec?: number;
      model: string;
      provider?: string;
      progressPct?: number;
    };

    return {
      externalJobId: payload.externalJobId,
      provider: payload.provider ?? "custom",
      model: payload.model,
      status: payload.status,
      progressPct: payload.progressPct ?? (payload.status === "queued" ? 5 : 15),
      etaSec: payload.etaSec ?? 180,
    };
  },
};
