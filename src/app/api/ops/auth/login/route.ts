import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, noStoreHeaders } from "@/lib/http";
import { buildOpsEntryToken, applyOpsAuthCookie, isOpsPasswordEnabled, verifyOpsPassword } from "@/lib/ops-auth";
import { enforceIpRateLimit } from "@/lib/redis";
import { getSessionFromRequest } from "@/lib/session";

export const runtime = "nodejs";

const loginSchema = z.object({
  password: z.string().min(1).max(256),
});

export async function POST(request: NextRequest) {
  if (!isOpsPasswordEnabled()) {
    return jsonError(409, "Ops dashboard password is not configured");
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

  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.flatten());
  }

  if (!verifyOpsPassword(parsed.data.password)) {
    return jsonError(401, "Invalid password");
  }

  const entryToken = buildOpsEntryToken();
  const response = NextResponse.json(
    {
      ok: true,
      entryToken,
    },
    {
      headers: noStoreHeaders(),
    },
  );

  applyOpsAuthCookie(response);
  return response;
}
