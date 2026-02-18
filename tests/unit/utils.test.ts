import { describe, expect, it } from "vitest";
import { normalizeDurationSec } from "@/lib/utils";

describe("normalizeDurationSec", () => {
  it("rounds fractional durations up to the next whole second", () => {
    expect(normalizeDurationSec(120.01)).toBe(121);
  });

  it("keeps integer durations unchanged", () => {
    expect(normalizeDurationSec(180)).toBe(180);
  });

  it("falls back to one second when duration is invalid", () => {
    expect(normalizeDurationSec(0)).toBe(1);
    expect(normalizeDurationSec(Number.NaN)).toBe(1);
  });
});
