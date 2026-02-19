import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { jsonError, noStoreHeaders } from "@/lib/http";
import { resolveRequestContext, withSessionCookie } from "@/lib/request-context";
import { getDb } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import type { PrivacyPreferencesResponse } from "@/types/api";

export const runtime = "nodejs";

const updateSchema = z.object({
  adPersonalizationOptIn: z.boolean(),
  doNotSellOrShare: z.boolean().optional(),
});

async function currentPreferences(sessionId: string): Promise<PrivacyPreferencesResponse> {
  const db = getDb();
  const row = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });

  const adPersonalizationOptIn = row?.adPersonalizationOptIn ?? false;
  const doNotSellOrShare = row?.doNotSellOrShare ?? !adPersonalizationOptIn;

  return {
    adPersonalizationOptIn,
    doNotSellOrShare,
  };
}

export async function GET(request: NextRequest) {
  const context = await resolveRequestContext(request);
  if (context instanceof NextResponse) {
    return context;
  }

  const prefs = await currentPreferences(context.sessionId);
  const response = NextResponse.json<PrivacyPreferencesResponse>(prefs, {
    headers: noStoreHeaders(),
  });

  return withSessionCookie(response, context);
}

export async function PUT(request: NextRequest) {
  const context = await resolveRequestContext(request);
  if (context instanceof NextResponse) {
    return context;
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(400, "Validation failed", parsed.error.flatten());
  }

  const adPersonalizationOptIn = parsed.data.adPersonalizationOptIn;
  const doNotSellOrShare = parsed.data.doNotSellOrShare ?? !adPersonalizationOptIn;

  await getDb()
    .update(sessions)
    .set({
      adPersonalizationOptIn,
      doNotSellOrShare,
      policySeenAt: new Date(),
    })
    .where(eq(sessions.id, context.sessionId));

  const response = NextResponse.json<PrivacyPreferencesResponse>(
    {
      adPersonalizationOptIn,
      doNotSellOrShare,
    },
    {
      headers: noStoreHeaders(),
    },
  );

  return withSessionCookie(response, context);
}
