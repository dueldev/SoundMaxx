import type { NextRequest } from "next/server";
import { env } from "@/lib/config";
import { hasOpsCookieAccess, isOpsPasswordEnabled, verifyOpsActionToken } from "@/lib/ops-auth";

export function hasOpsApiAccess(request: NextRequest) {
  if (isOpsPasswordEnabled()) {
    if (!hasOpsCookieAccess(request)) {
      return false;
    }

    const actionToken = request.headers.get("x-ops-action-token") ?? undefined;
    return verifyOpsActionToken(actionToken);
  }

  if (env.OPS_SECRET) {
    const auth = request.headers.get("authorization") ?? "";
    return auth === `Bearer ${env.OPS_SECRET}`;
  }

  return true;
}

export function hasTrainingCronAccess(request: NextRequest) {
  if (hasOpsCookieAccess(request)) {
    const actionToken = request.headers.get("x-ops-action-token") ?? undefined;
    if (verifyOpsActionToken(actionToken)) {
      return true;
    }
  }

  const auth = request.headers.get("authorization") ?? "";
  const secret = env.TRAINING_CRON_SECRET ?? env.CRON_SECRET;
  if (secret && auth === `Bearer ${secret}`) {
    return true;
  }

  if (env.OPS_SECRET && auth === `Bearer ${env.OPS_SECRET}`) {
    return true;
  }

  if (secret || isOpsPasswordEnabled() || env.OPS_SECRET) {
    return false;
  }

  return true;
}
