import { NextRequest, NextResponse } from "next/server";
import { jsonError, noStoreHeaders } from "@/lib/http";
import { resolveRequestContext, withSessionCookie } from "@/lib/request-context";
import { store } from "@/lib/store";
import type { ArtifactResponse } from "@/types/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ artifactId: string }> }) {
  const reqContext = await resolveRequestContext(request);
  if (reqContext instanceof NextResponse) {
    return reqContext;
  }

  const { artifactId } = await context.params;
  const artifact = await store.getSessionArtifact(artifactId, reqContext.sessionId);

  if (!artifact) {
    return jsonError(404, "Artifact not found");
  }

  if (Date.now() > Date.parse(artifact.expiresAt)) {
    return jsonError(410, "Artifact expired");
  }

  const response = NextResponse.json<ArtifactResponse>(
    {
      downloadUrl: artifact.blobUrl,
      expiresAt: artifact.expiresAt,
      format: artifact.format,
    },
    {
      headers: noStoreHeaders(),
    },
  );

  return withSessionCookie(response, reqContext);
}
