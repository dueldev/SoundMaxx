import { describe, expect, it } from "vitest";
import { signPayload, verifyHexSignature } from "@/lib/signature";

describe("webhook signature contract", () => {
  it("accepts valid HMAC signature", () => {
    const secret = "test-secret-1234567890";
    const payload = JSON.stringify({ externalJobId: "job1", status: "succeeded" });
    const signature = signPayload(secret, payload);

    expect(verifyHexSignature(secret, payload, signature)).toBe(true);
  });

  it("rejects tampered payload", () => {
    const secret = "test-secret-1234567890";
    const payload = JSON.stringify({ externalJobId: "job1", status: "succeeded" });
    const signature = signPayload(secret, payload);

    expect(verifyHexSignature(secret, `${payload}x`, signature)).toBe(false);
  });
});
