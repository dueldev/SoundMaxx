import path from "node:path";
import { uploadBlob } from "@/lib/blob";
import type { ProviderArtifact } from "@/lib/providers/types";

const URL_PROTOCOL_PATTERN = /^https?:\/\//i;

function extensionFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const ext = path.extname(parsed.pathname).replace(".", "").toLowerCase();
    return ext || "bin";
  } catch {
    return "bin";
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

  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index]!;
    const response = await fetch(url);
    if (!response.ok) continue;

    const bytes = await response.arrayBuffer();
    const ext = extensionFromUrl(url);
    const format = ext;
    const blobKey = `artifacts/${jobId}/output-${index + 1}.${ext}`;
    const uploaded = await uploadBlob(blobKey, Buffer.from(bytes), mimeFromExtension(ext));

    artifacts.push({
      blobKey,
      blobUrl: uploaded.downloadUrl,
      format,
      sizeBytes: uploaded.size,
    });
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
