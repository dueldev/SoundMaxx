import { describe, expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { applySessionCookie, getSessionFromRequest } from "@/lib/session";

describe("session helpers", () => {
  it("creates a new session context when cookie is missing", () => {
    const request = new NextRequest("http://localhost:3000");
    const context = getSessionFromRequest(request);

    expect(context.sessionId).toBeTruthy();
    expect(context.isNew).toBe(true);
  });

  it("sets httpOnly cookie on response", () => {
    const response = NextResponse.json({ ok: true });
    applySessionCookie(response, "session-test");

    const cookie = response.cookies.get("smx_session");
    expect(cookie).toBeDefined();
    expect(cookie?.value).toContain(".");
  });
});
