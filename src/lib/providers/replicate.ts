import { env, replicateModelEnvKeys } from "@/lib/config";
import type { ToolType } from "@/types/domain";
import type { InferenceProviderAdapter, ProviderSubmitInput, ProviderSubmitResult } from "@/lib/providers/types";

function modelForTool(toolType: ToolType) {
  const key = replicateModelEnvKeys[toolType];
  const model = env[key];

  if (!model) {
    throw new Error(`Missing ${key} for ${toolType}`);
  }

  return model;
}

function statusFromReplicate(status: string): ProviderSubmitResult["status"] {
  if (status === "succeeded") return "succeeded";
  if (status === "failed" || status === "canceled") return "failed";
  if (status === "processing") return "running";
  return "queued";
}

function buildInput(toolType: ToolType, sourceUrl: string, params: unknown) {
  const base = {
    audio: sourceUrl,
  } as Record<string, unknown>;

  if (toolType === "stem_isolation") {
    const stemParams = params as { stems?: 2 | 4; fallbackModel?: string };
    return {
      ...base,
      stems: stemParams.stems ?? 4,
      model_variant: stemParams.fallbackModel ?? "mel_band_roformer",
    };
  }

  if (toolType === "mastering") {
    const masteringParams = params as {
      preset?: string;
      intensity?: number;
      referenceAssetId?: string;
    };
    return {
      ...base,
      preset: masteringParams.preset ?? "streaming_clean",
      intensity: masteringParams.intensity ?? 50,
      reference_asset_id: masteringParams.referenceAssetId,
    };
  }

  if (toolType === "key_bpm") {
    const keyBpm = params as { includeChordHints?: boolean };
    return {
      ...base,
      include_chord_hints: keyBpm.includeChordHints ?? true,
    };
  }

  if (toolType === "loudness_report") {
    const loudness = params as { targetLufs?: number };
    return {
      ...base,
      target_lufs: loudness.targetLufs ?? -14,
    };
  }

  if (toolType === "midi_extract") {
    const midi = params as { sensitivity?: number };
    return {
      ...base,
      sensitivity: midi.sensitivity ?? 0.5,
    };
  }

  return base;
}

export const replicateAdapter: InferenceProviderAdapter = {
  async submitJob(input: ProviderSubmitInput): Promise<ProviderSubmitResult> {
    if (!env.REPLICATE_API_TOKEN) {
      throw new Error("REPLICATE_API_TOKEN is not configured");
    }

    if (!input.sourceAsset.blobUrl) {
      throw new Error("Source asset URL is missing");
    }

    const model = modelForTool(input.toolType);
    const predictionResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: buildInput(input.toolType, input.sourceAsset.blobUrl, input.params),
        webhook: input.callback.webhookUrl,
        webhook_events_filter: ["start", "output", "completed"],
      }),
    });

    if (!predictionResponse.ok) {
      const details = await predictionResponse.text();
      throw new Error(`Replicate prediction creation failed: ${predictionResponse.status} ${details}`);
    }

    const prediction = (await predictionResponse.json()) as {
      id: string;
      status: string;
      error?: string;
      output?: unknown;
      logs?: string;
    };

    return {
      externalJobId: prediction.id,
      provider: "replicate",
      model,
      status: statusFromReplicate(prediction.status),
      progressPct: prediction.status === "succeeded" ? 100 : prediction.status === "processing" ? 35 : 5,
      etaSec: prediction.status === "succeeded" ? 0 : 180,
      errorCode: prediction.error ? "replicate_prediction_failed" : undefined,
    };
  },
};
