import { NextRequest, NextResponse } from "next/server";
import { uploadBlob } from "@/lib/blob";
import { jsonError, noStoreHeaders } from "@/lib/http";
import { resolveRequestContext, withSessionCookie } from "@/lib/request-context";
import { incrementUploadUsage } from "@/lib/quota/check";
import { store } from "@/lib/store";

export const runtime = "nodejs";

async function readFileBody(request: NextRequest): Promise<{ body: Blob | Buffer; contentType: string; size: number } | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return null;

    return {
      body: file,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    };
  }

  const buffer = Buffer.from(await request.arrayBuffer());
  if (buffer.byteLength === 0) return null;

  return {
    body: buffer,
    contentType: request.headers.get("x-content-type") ?? contentType ?? "application/octet-stream",
    size: buffer.byteLength,
  };
}

export async function PUT(request: NextRequest, context: { params: Promise<{ assetId: string }> }) {
  const reqContext = await resolveRequestContext(request);
  if (reqContext instanceof NextResponse) {
    return reqContext;
  }

  const { assetId } = await context.params;
  const asset = await store.getSessionAsset(assetId, reqContext.sessionId);
  if (!asset) {
    return jsonError(404, "Asset not found");
  }

  const parsedBody = await readFileBody(request);
  if (!parsedBody) {
    return jsonError(400, "No audio payload found. Send multipart form field named 'file'.");
  }

  const uploaded = await uploadBlob(asset.blobKey, parsedBody.body, parsedBody.contentType);

  await store.updateAssetBlob({
    assetId: asset.id,
    blobUrl: uploaded.url,
  });

  await incrementUploadUsage(asset.sessionId, parsedBody.size);

  const response = NextResponse.json(
    {
      assetId: asset.id,
      blobKey: asset.blobKey,
      blobUrl: uploaded.downloadUrl,
      uploadedBytes: parsedBody.size,
    },
    {
      headers: noStoreHeaders(),
    },
  );

  return withSessionCookie(response, reqContext);
}
