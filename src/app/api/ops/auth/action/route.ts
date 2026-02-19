import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, noStoreHeaders } from "@/lib/http";
import { buildOpsActionToken, hasOpsCookieAccess, isOpsPasswordEnabled, verifyOpsPassword } from "@/lib/ops-auth";
import { enforceIpRateLimit } from "@/lib/redis";
import { getSessionFromRequest } from "@/lib/session";

export const runtime = "nodejs";

const actionSchema = z.object({
  password: z.string().min(1).max(256),
});

export async function POST(request: NextRequest) {
  if (!isOpsPasswordEnabled()) {
    return jsonError(409, "Ops dashboard password is not configured");
  }

  if (!hasOpsCookieAccess(request)) {
    return jsonError(401, "Unauthorized");
  }

  const sessionContext = getSessionFromRequest(request);
  const rateLimit = await enforceIpRateLimit(sessionContext.ipHash);
  if (!rateLimit.success) {
    return jsonError(429, "Too many attempts", {
      limit: rateLimit.limit,
      remaining: rateLimit.remaining,
      resetAt: new Date(rateLimit.reset).toISOString(),
    });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const parsed = actionSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.flatten());
  }

  if (!verifyOpsPassword(parsed.data.password)) {
    return jsonError(401, "Invalid password");
  }

  const response = NextResponse.json(
    {
      ok: true,
      actionToken: buildOpsActionToken(),
    },
    {
      headers: noStoreHeaders(),
    },
  );

  return response;
}
