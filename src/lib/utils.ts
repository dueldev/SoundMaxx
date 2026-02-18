import { createHash } from "node:crypto";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
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
