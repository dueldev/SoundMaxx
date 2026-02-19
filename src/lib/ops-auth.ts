import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config";

export const OPS_AUTH_COOKIE = "smx_ops_auth";
const OPS_AUTH_TTL_HOURS = 12;
const OPS_ENTRY_TOKEN_TTL_SECONDS = 30;
const OPS_ACTION_TOKEN_TTL_SECONDS = 20;

type OpsAuthPayload = {
  typ: "session" | "entry" | "action";
  exp: number;
};

function signPayload(payload: string) {
  return createHmac("sha256", env.SESSION_SECRET).update(payload).digest("base64url");
}

function encodePayload(data: OpsAuthPayload) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

function decodePayload(token: string | undefined): OpsAuthPayload | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = signPayload(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OpsAuthPayload;
    if (!decoded.exp || decoded.exp < Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function constantTimeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function isOpsPasswordEnabled() {
  return Boolean(env.OPS_DASHBOARD_PASSWORD);
}

export function verifyOpsPassword(password: string) {
  if (!env.OPS_DASHBOARD_PASSWORD) return false;
  return constantTimeEqual(password, env.OPS_DASHBOARD_PASSWORD);
}

export function buildOpsAuthToken() {
  const exp = Date.now() + OPS_AUTH_TTL_HOURS * 60 * 60 * 1000;
  return encodePayload({ typ: "session", exp });
}

export function verifyOpsAuthToken(token: string | undefined) {
  const payload = decodePayload(token);
  return payload?.typ === "session";
}

export function buildOpsEntryToken() {
  const exp = Date.now() + OPS_ENTRY_TOKEN_TTL_SECONDS * 1000;
  return encodePayload({ typ: "entry", exp });
}

export function verifyOpsEntryToken(token: string | undefined) {
  const payload = decodePayload(token);
  return payload?.typ === "entry";
}

export function buildOpsActionToken() {
  const exp = Date.now() + OPS_ACTION_TOKEN_TTL_SECONDS * 1000;
  return encodePayload({ typ: "action", exp });
}

export function verifyOpsActionToken(token: string | undefined) {
  const payload = decodePayload(token);
  return payload?.typ === "action";
}

export function hasOpsCookieAccess(request: NextRequest) {
  const token = request.cookies.get(OPS_AUTH_COOKIE)?.value;
  return verifyOpsAuthToken(token);
}

export function applyOpsAuthCookie(response: NextResponse) {
  const token = buildOpsAuthToken();
  const exp = Date.now() + OPS_AUTH_TTL_HOURS * 60 * 60 * 1000;

  response.cookies.set({
    name: OPS_AUTH_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    expires: new Date(exp),
  });
}

export function clearOpsAuthCookie(response: NextResponse) {
  response.cookies.set({
    name: OPS_AUTH_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}
