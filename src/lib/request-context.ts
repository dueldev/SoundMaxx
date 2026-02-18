import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { enforceIpRateLimit } from "@/lib/redis";
import { applySessionCookie, getSessionFromRequest } from "@/lib/session";
import { store } from "@/lib/store";

export type RequestContext = {
  sessionId: string;
  isNewSession: boolean;
};

type ResolveRequestContextOptions = {
  enforceRateLimit?: boolean;
};

export async function resolveRequestContext(
  request: NextRequest,
  options?: ResolveRequestContextOptions,
): Promise<RequestContext | NextResponse> {
  const session = getSessionFromRequest(request);
  const shouldEnforceRateLimit = options?.enforceRateLimit ?? request.method !== "GET";

  if (shouldEnforceRateLimit) {
    const ipLimit = await enforceIpRateLimit(session.ipHash);

    if (!ipLimit.success) {
      return jsonError(429, "Too many requests", {
        limit: ipLimit.limit,
        remaining: ipLimit.remaining,
        resetAt: new Date(ipLimit.reset).toISOString(),
      });
    }
  }

  await store.createOrTouchSession({
    id: session.sessionId,
    ipHash: session.ipHash,
    userAgentHash: session.userAgentHash,
  });

  return {
    sessionId: session.sessionId,
    isNewSession: session.isNew,
  };
}

export function withSessionCookie<T>(response: NextResponse<T>, context: RequestContext) {
  if (context.isNewSession) {
    applySessionCookie(response, context.sessionId);
  }

  return response;
}
