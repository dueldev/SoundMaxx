import { NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/http";
import { clearOpsAuthCookie } from "@/lib/ops-auth";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  clearOpsAuthCookie(response);
  return response;
}
