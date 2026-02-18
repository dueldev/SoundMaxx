import { createHmac, timingSafeEqual } from "node:crypto";
import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";
import { env, limits } from "@/lib/config";
import { dayKeyUtc, sha256 } from "@/lib/utils";

const SESSION_COOKIE = "smx_session";

type SessionCookiePayload = {
  sid: string;
  exp: number;
};

function signPayload(payload: string) {
  return createHmac("sha256", env.SESSION_SECRET).update(payload).digest("base64url");
}

function encodeCookie(data: SessionCookiePayload) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

function decodeCookie(value: string | undefined): SessionCookiePayload | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = signPayload(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionCookiePayload;
    if (!decoded.sid || decoded.exp < Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export type SessionContext = {
  sessionId: string;
  isNew: boolean;
  ipHash: string;
  userAgentHash: string;
};

export function getSessionFromRequest(request: NextRequest): SessionContext {
  const existing = decodeCookie(request.cookies.get(SESSION_COOKIE)?.value);
  const sessionId = existing?.sid ?? nanoid(21);

  return {
    sessionId,
    isNew: !existing,
    ipHash: sha256(request.headers.get("x-forwarded-for") ?? "unknown-ip"),
    userAgentHash: sha256(request.headers.get("user-agent") ?? "unknown-ua"),
  };
}

export function applySessionCookie(response: NextResponse, sessionId: string) {
  const exp = Date.now() + limits.sessionTtlDays * 24 * 60 * 60 * 1000;
  response.cookies.set({
    name: SESSION_COOKIE,
    value: encodeCookie({ sid: sessionId, exp }),
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    expires: new Date(exp),
  });
}

export function buildShortLivedSessionToken(sessionId: string) {
  const payload = {
    sid: sessionId,
    day: dayKeyUtc(),
    exp: Date.now() + limits.sessionTokenTtlMinutes * 60 * 1000,
  };
  const base64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${base64}.${signPayload(base64)}`;
}
