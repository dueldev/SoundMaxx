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

type PrivateSWRHeaderOptions = {
  maxAgeSec?: number;
  staleWhileRevalidateSec?: number;
};

export function privateSWRHeaders(options: PrivateSWRHeaderOptions = {}) {
  const maxAgeSec = options.maxAgeSec ?? 5;
  const staleWhileRevalidateSec = options.staleWhileRevalidateSec ?? 30;

  return {
    "Cache-Control": `private, max-age=${maxAgeSec}, stale-while-revalidate=${staleWhileRevalidateSec}`,
  };
}
