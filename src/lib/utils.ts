import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function nowIso() {
  return new Date().toISOString();
}

export function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function dayKeyUtc(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export function normalizeDurationSec(durationSec: number) {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(durationSec));
}
