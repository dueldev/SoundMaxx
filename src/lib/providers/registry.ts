import { env } from "@/lib/config";
import { customWorkerAdapter } from "@/lib/providers/custom";
import { replicateAdapter } from "@/lib/providers/replicate";
import type { InferenceProviderAdapter } from "@/lib/providers/types";

export function getProviderAdapter(): InferenceProviderAdapter {
  if (env.INFERENCE_PROVIDER === "replicate") {
    return replicateAdapter;
  }

  return customWorkerAdapter;
}
