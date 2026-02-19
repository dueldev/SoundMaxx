import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadBlob: vi.fn(),
}));

vi.mock("@/lib/blob", () => ({
  uploadBlob: mocks.uploadBlob,
}));

import { materializeWebhookOutputAsArtifacts } from "@/lib/providers/output";

describe("materializeWebhookOutputAsArtifacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uploadBlob.mockImplementation(async (pathname: string, body: Buffer) => ({
      url: `https://blob.example/${pathname}`,
      downloadUrl: `https://download.example/${pathname}`,
      pathname,
      size: body.byteLength,
    }));
  });

  it("materializes nested URL outputs and dedupes artifact names", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      return new Response(Buffer.from(`payload:${url}`), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const output = {
      items: [
        "https://files.example.com/audio/mastered.wav",
        {
          nested: ["https://files.example.com/audio/mastered.wav?variant=b"],
        },
      ],
    };

    const artifacts = await materializeWebhookOutputAsArtifacts("job_123", output);

    expect(artifacts).toHaveLength(2);
    expect(artifacts[0]?.format).toBe("wav");
    expect(artifacts[1]?.format).toBe("wav");
    expect(artifacts[0]?.blobKey).toContain("artifacts/job_123/mastered.wav");
    expect(artifacts[1]?.blobKey).toContain("artifacts/job_123/mastered-2.wav");
    expect(mocks.uploadBlob).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to output.json when no output URLs exist", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const artifacts = await materializeWebhookOutputAsArtifacts("job_no_urls", {
      key: "value",
      metrics: { bpm: 120 },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]?.format).toBe("json");
    expect(artifacts[0]?.blobKey).toBe("artifacts/job_no_urls/output.json");
    expect(mocks.uploadBlob).toHaveBeenCalledTimes(1);

    const firstCall = mocks.uploadBlob.mock.calls[0];
    expect(firstCall?.[2]).toBe("application/json");
    const payloadBuffer = firstCall?.[1] as Buffer;
    const parsed = JSON.parse(payloadBuffer.toString("utf8")) as Record<string, unknown>;
    expect(parsed.metrics).toEqual({ bpm: 120 });
  });
});
