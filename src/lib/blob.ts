import { del, put } from "@vercel/blob";
import { env } from "@/lib/config";

function ensureBlobReady() {
  if (!env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  }
  return env.BLOB_READ_WRITE_TOKEN;
}

export async function uploadBlob(pathname: string, body: File | Blob | Buffer, contentType: string) {
  const token = ensureBlobReady();

  const result = await put(pathname, body, {
    access: "public",
    token,
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  return {
    url: result.url,
    downloadUrl: result.downloadUrl,
    pathname: result.pathname,
    size: (body as Blob).size ?? (body as Buffer).byteLength,
  };
}

export async function deleteBlob(pathnameOrUrl: string) {
  const token = ensureBlobReady();

  try {
    await del(pathnameOrUrl, {
      token,
    });
  } catch {
    // Cleanup should be best-effort and idempotent.
  }
}
