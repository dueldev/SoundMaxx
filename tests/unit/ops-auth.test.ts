import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildOpsActionToken,
  buildOpsAuthToken,
  buildOpsEntryToken,
  verifyOpsActionToken,
  verifyOpsAuthToken,
  verifyOpsEntryToken,
} from "@/lib/ops-auth";

describe("ops auth tokens", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("verifies session tokens for dashboard API auth only", () => {
    const token = buildOpsAuthToken();

    expect(verifyOpsAuthToken(token)).toBe(true);
    expect(verifyOpsEntryToken(token)).toBe(false);
  });

  it("verifies entry tokens for fresh dashboard entry only", () => {
    const token = buildOpsEntryToken();

    expect(verifyOpsEntryToken(token)).toBe(true);
    expect(verifyOpsAuthToken(token)).toBe(false);
    expect(verifyOpsActionToken(token)).toBe(false);
  });

  it("verifies action tokens for per-request API authorization only", () => {
    const token = buildOpsActionToken();

    expect(verifyOpsActionToken(token)).toBe(true);
    expect(verifyOpsEntryToken(token)).toBe(false);
    expect(verifyOpsAuthToken(token)).toBe(false);
  });

  it("expires entry tokens quickly to force re-auth", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-19T00:00:00.000Z"));

    const token = buildOpsEntryToken();
    expect(verifyOpsEntryToken(token)).toBe(true);

    vi.setSystemTime(new Date("2026-02-19T00:00:31.000Z"));
    expect(verifyOpsEntryToken(token)).toBe(false);
  });
});
