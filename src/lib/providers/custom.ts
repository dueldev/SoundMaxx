import { env } from "@/lib/config";
import type { InferenceProviderAdapter, ProviderSubmitInput, ProviderSubmitResult } from "@/lib/providers/types";

const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function envInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

const SUBMIT_MAX_ATTEMPTS = Math.max(1, envInt("WORKER_SUBMIT_MAX_ATTEMPTS", 5));
const SUBMIT_TIMEOUT_MS = Math.max(3_000, envInt("WORKER_SUBMIT_TIMEOUT_MS", 25_000));
const SUBMIT_BASE_DELAY_MS = Math.max(0, envInt("WORKER_SUBMIT_BASE_DELAY_MS", 1_500));
const SUBMIT_MAX_DELAY_MS = Math.max(SUBMIT_BASE_DELAY_MS, envInt("WORKER_SUBMIT_MAX_DELAY_MS", 12_000));

function resolveWorkerUrl(path: string) {
  if (!env.WORKER_API_URL) {
    throw new Error("WORKER_API_URL is not configured");
  }

  return `${env.WORKER_API_URL.replace(/\/$/, "")}${path}`;
}

function backoffDelayMs(retryIndex: number) {
  const exponential = SUBMIT_BASE_DELAY_MS * 2 ** Math.max(0, retryIndex - 1);
  return Math.min(SUBMIT_MAX_DELAY_MS, exponential);
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableFetchError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === "AbortError") {
    return true;
  }

  const message = error.message.toLowerCase();
  return (
    error.name === "TypeError" ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timed out") ||
    message.includes("econnreset") ||
    message.includes("econnrefused")
  );
}

function normalizeWorkerResponse(payload: {
  externalJobId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  etaSec?: number;
  model: string;
  provider?: string;
  progressPct?: number;
}) {
  return {
    externalJobId: payload.externalJobId,
    provider: payload.provider ?? "custom",
    model: payload.model,
    status: payload.status,
    progressPct: payload.progressPct ?? (payload.status === "queued" ? 5 : 15),
    etaSec: payload.etaSec ?? 180,
  } satisfies ProviderSubmitResult;
}

export const customWorkerAdapter: InferenceProviderAdapter = {
  async submitJob(input: ProviderSubmitInput): Promise<ProviderSubmitResult> {
    if (!env.WORKER_API_KEY) {
      throw new Error("WORKER_API_KEY is not configured");
    }

    const requestBody = JSON.stringify({
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
    });

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= SUBMIT_MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 1) {
        await sleep(backoffDelayMs(attempt - 1));
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);

      try {
        const response = await fetch(resolveWorkerUrl("/jobs"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.WORKER_API_KEY}`,
          },
          body: requestBody,
          signal: controller.signal,
        });

        if (response.ok) {
          const payload = (await response.json()) as {
            externalJobId: string;
            status: "queued" | "running" | "succeeded" | "failed";
            etaSec?: number;
            model: string;
            provider?: string;
            progressPct?: number;
          };

          return normalizeWorkerResponse(payload);
        }

        const errorText = (await response.text()).slice(0, 400);
        const responseError = new Error(
          `Worker rejected job (attempt ${attempt}/${SUBMIT_MAX_ATTEMPTS}): ${response.status} ${errorText}`,
        );
        lastError = responseError;

        if (attempt < SUBMIT_MAX_ATTEMPTS && TRANSIENT_HTTP_STATUSES.has(response.status)) {
          continue;
        }

        throw responseError;
      } catch (error) {
        const submitError = error instanceof Error ? error : new Error("Worker submission failed");
        lastError = submitError;

        if (attempt < SUBMIT_MAX_ATTEMPTS && isRetryableFetchError(error)) {
          continue;
        }

        throw submitError;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error("Worker submission failed after retries");
  },
};
