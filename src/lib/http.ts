import { NextResponse } from "next/server";

export type ApiError = {
  error: string;
  details?: unknown;
};

export function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json<ApiError>(
    {
      error,
      ...(details ? { details } : {}),
    },
    { status },
  );
}

export function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
  };
}
