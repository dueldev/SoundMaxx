import path from "node:path";
import { uploadBlob } from "@/lib/blob";
import type { ProviderArtifact } from "@/lib/providers/types";

const URL_PROTOCOL_PATTERN = /^https?:\/\//i;
const DEFAULT_ARTIFACT_IO_CONCURRENCY = 4;

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

function extensionFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const ext = path.extname(parsed.pathname).replace(".", "").toLowerCase();
    return ext || "bin";
  } catch {
    return "bin";
  }
}

function filenameFromUrl(url: string, fallbackIndex: number, ext: string) {
  const fallback = `output-${fallbackIndex}.${ext || "bin"}`;
  try {
    const parsed = new URL(url);
    const base = path.basename(parsed.pathname).replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!base) return fallback;
    if (path.extname(base)) return base;
    return `${base}.${ext || "bin"}`;
  } catch {
    return fallback;
  }
}

function mimeFromExtension(ext: string) {
  if (ext === "wav") return "audio/wav";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "flac") return "audio/flac";
  if (ext === "ogg") return "audio/ogg";
  if (ext === "zip") return "application/zip";
  if (ext === "json") return "application/json";
  if (ext === "mid" || ext === "midi") return "audio/midi";
  return "application/octet-stream";
}

function collectUrls(value: unknown, bucket: string[]) {
  if (typeof value === "string" && URL_PROTOCOL_PATTERN.test(value)) {
    bucket.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectUrls(item, bucket);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      collectUrls(entry, bucket);
    }
  }
}

export async function materializeWebhookOutputAsArtifacts(jobId: string, output: unknown) {
  const urls: string[] = [];
  collectUrls(output, urls);

  const artifacts: ProviderArtifact[] = [];
  const usedNames = new Set<string>();
  const candidates = urls.map((url, index) => {
    const ext = extensionFromUrl(url);
    const requestedName = filenameFromUrl(url, index + 1, ext);
    const parsedName = path.parse(requestedName);
    const baseName = parsedName.name || `output-${index + 1}`;
    const suffix = parsedName.ext.replace(/^\./, "") || ext || "bin";

    let uniqueName = `${baseName}.${suffix}`;
    let dedupe = 2;
    while (usedNames.has(uniqueName)) {
      uniqueName = `${baseName}-${dedupe}.${suffix}`;
      dedupe += 1;
    }
    usedNames.add(uniqueName);

    return {
      index,
      url,
      ext,
      format: ext,
      blobKey: `artifacts/${jobId}/${uniqueName}`,
    };
  });

  const concurrency = envInt("ARTIFACT_IO_CONCURRENCY", DEFAULT_ARTIFACT_IO_CONCURRENCY);
  const materialized = await mapWithConcurrency(candidates, concurrency, async (candidate) => {
    const response = await fetch(candidate.url);
    if (!response.ok) return null;

    const bytes = await response.arrayBuffer();
    const uploaded = await uploadBlob(candidate.blobKey, Buffer.from(bytes), mimeFromExtension(candidate.ext));
    return {
      blobKey: candidate.blobKey,
      blobUrl: uploaded.downloadUrl,
      format: candidate.format,
      sizeBytes: uploaded.size,
    } satisfies ProviderArtifact;
  });

  for (const artifact of materialized) {
    if (artifact) {
      artifacts.push(artifact);
    }
  }

  if (artifacts.length > 0) {
    return artifacts;
  }

  const blobKey = `artifacts/${jobId}/output.json`;
  const rawJson = Buffer.from(JSON.stringify(output ?? {}, null, 2), "utf8");
  const uploaded = await uploadBlob(blobKey, rawJson, "application/json");

  return [
    {
      blobKey,
      blobUrl: uploaded.downloadUrl,
      format: "json",
      sizeBytes: uploaded.size,
    },
  ];
}
