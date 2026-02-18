import { createHmac, timingSafeEqual } from "node:crypto";

export function signPayload(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyHexSignature(secret: string, payload: string, signatureHeader: string | null) {
  if (!signatureHeader) return false;

  const sanitized = signatureHeader.replace(/^sha256=/, "").trim();
  const expected = signPayload(secret, payload);

  const a = Buffer.from(sanitized);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
