import { env } from "@/lib/config";
import { customWorkerAdapter } from "@/lib/providers/custom";
import { replicateAdapter } from "@/lib/providers/replicate";
import type { InferenceProviderAdapter } from "@/lib/providers/types";

export function getProviderAdapterByName(provider: string): InferenceProviderAdapter {
  if (provider === "replicate") {
    return replicateAdapter;
  }

  return customWorkerAdapter;
}

export function getProviderAdapter(): InferenceProviderAdapter {
  return getProviderAdapterByName(env.INFERENCE_PROVIDER);
}
