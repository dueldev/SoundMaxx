import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { put as putBlob } from "@vercel/blob/client";

type ToolType = "stem_isolation" | "mastering" | "key_bpm" | "loudness_report" | "midi_extract";
type JobStatus = "queued" | "running" | "succeeded" | "failed" | "expired";

type UploadInitResponse = {
  uploadUrl: string;
  blobKey: string;
  assetId: string;
  sessionToken: string;
  expiresAt: string;
  clientUploadToken: string;
};

type CreateJobResponse = {
  jobId: string;
  status: JobStatus;
};

type JobStatusResponse = {
  jobId: string;
  status: JobStatus;
  progressPct: number;
  etaSec: number | null;
  error?: string;
  artifactIds: string[];
};

type ArtifactResponse = {
  downloadUrl: string;
  expiresAt: string;
};

type UploadCompleteResponse = {
  assetId: string;
  blobKey: string;
  blobUrl: string;
  uploadedBytes: number;
};

type ToolAuditResult = {
  toolType: ToolType;
  params: Record<string, unknown>;
  jobId: string;
  status: JobStatus;
  elapsedMs: number;
  progressPct: number;
  etaSec: number | null;
  artifactCount: number;
  artifacts: Array<{
    artifactId: string;
    downloadUrl: string;
    expiresAt: string;
    downloadCheckStatus: number;
  }>;
};

type AuditReport = {
  startedAt: string;
  finishedAt?: string;
  baseUrl: string;
  upload: {
    assetId: string;
    blobKey: string;
    expiresAt: string;
    uploadedBytes: number;
  };
  checks: {
    opsSummary?: {
      status: number;
      bodyPreview: string;
    };
    workerHealth?: {
      url: string;
      status: number | "error";
      bodyPreview?: string;
      error?: string;
    };
  };
  toolResults: ToolAuditResult[];
  success: boolean;
  failureReason?: string;
};

type CliOptions = {
  baseUrl: string;
  opsSecret?: string;
  toolTimeoutSec: number;
  outputFile?: string;
};

class HttpClient {
  private readonly baseUrl: string;

  private readonly cookieJar = new Map<string, string>();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private resolveUrl(pathOrUrl: string) {
    if (/^https?:\/\//i.test(pathOrUrl)) {
      return pathOrUrl;
    }

    return `${this.baseUrl}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
  }

  private updateCookieJar(response: Response) {
    const headers = response.headers as Headers & {
      getSetCookie?: () => string[];
    };
    const setCookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];

    for (const setCookie of setCookies) {
      const firstPair = setCookie.split(";")[0];
      if (!firstPair) continue;
      const eq = firstPair.indexOf("=");
      if (eq <= 0) continue;

      const name = firstPair.slice(0, eq).trim();
      const value = firstPair.slice(eq + 1).trim();
      if (name) {
        this.cookieJar.set(name, value);
      }
    }
  }

  private cookieHeader() {
    if (this.cookieJar.size === 0) {
      return undefined;
    }
    return Array.from(this.cookieJar.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }

  async request(pathOrUrl: string, init: RequestInit = {}) {
    const url = this.resolveUrl(pathOrUrl);
    const headers = new Headers(init.headers);
    const cookie = this.cookieHeader();
    if (cookie) {
      headers.set("Cookie", cookie);
    }

    const response = await fetch(url, {
      ...init,
      headers,
    });

    this.updateCookieJar(response);
    return response;
  }

  async requestJson<T>(pathOrUrl: string, init: RequestInit = {}) {
    const response = await this.request(pathOrUrl, init);
    let json: T | null = null;

    try {
      json = (await response.json()) as T;
    } catch {
      json = null;
    }

    return { response, json };
  }
}

function usage() {
  return [
    "Usage:",
    "  tsx scripts/live-functional-audit.ts --base-url <url> [--ops-secret <secret>] [--tool-timeout-sec <seconds>] [--output-file <path>]",
    "",
    "Flags:",
    "  --base-url          Required. Base URL for SoundMaxx app (for example https://soundmaxx.vercel.app)",
    "  --ops-secret        Optional. Ops API bearer secret (falls back to OPS_SECRET env var)",
    "  --tool-timeout-sec  Optional. Per-tool timeout in seconds (default 900)",
    "  --output-file       Optional. JSON report output path (default output/live-validation/live-validation-<timestamp>.json)",
  ].join("\n");
}

function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    baseUrl: "",
    opsSecret: process.env.OPS_SECRET,
    toolTimeoutSec: 900,
    outputFile: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;

    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }

    const next = argv[index + 1];
    if ((arg === "--base-url" || arg === "--ops-secret" || arg === "--tool-timeout-sec" || arg === "--output-file") && !next) {
      throw new Error(`Missing value for ${arg}`);
    }

    if (arg === "--base-url") {
      options.baseUrl = String(next);
      index += 1;
      continue;
    }
    if (arg === "--ops-secret") {
      options.opsSecret = String(next);
      index += 1;
      continue;
    }
    if (arg === "--tool-timeout-sec") {
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed < 30) {
        throw new Error("Invalid --tool-timeout-sec. Use a number >= 30.");
      }
      options.toolTimeoutSec = Math.floor(parsed);
      index += 1;
      continue;
    }
    if (arg === "--output-file") {
      options.outputFile = String(next);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.baseUrl) {
    throw new Error("Missing --base-url");
  }

  return options;
}

function createSineWavBuffer(durationSec = 2, sampleRate = 44_100, frequencyHz = 440) {
  const channels = 1;
  const bitsPerSample = 16;
  const sampleCount = Math.floor(durationSec * sampleRate);
  const dataSize = sampleCount * channels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  let offset = 0;
  buffer.write("RIFF", offset);
  offset += 4;
  buffer.writeUInt32LE(36 + dataSize, offset);
  offset += 4;
  buffer.write("WAVE", offset);
  offset += 4;

  buffer.write("fmt ", offset);
  offset += 4;
  buffer.writeUInt32LE(16, offset);
  offset += 4;
  buffer.writeUInt16LE(1, offset);
  offset += 2;
  buffer.writeUInt16LE(channels, offset);
  offset += 2;
  buffer.writeUInt32LE(sampleRate, offset);
  offset += 4;
  buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), offset);
  offset += 4;
  buffer.writeUInt16LE(channels * (bitsPerSample / 8), offset);
  offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset);
  offset += 2;

  buffer.write("data", offset);
  offset += 4;
  buffer.writeUInt32LE(dataSize, offset);
  offset += 4;

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequencyHz * t);
    const amplitude = Math.max(-1, Math.min(1, sample * 0.4));
    buffer.writeInt16LE(Math.round(amplitude * 32_767), offset);
    offset += 2;
  }

  return {
    buffer,
    durationSec,
    sampleRate,
  };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultOutputFile() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.resolve(process.cwd(), "output", "live-validation", `live-validation-${stamp}.json`);
}

function previewBody(value: unknown) {
  if (typeof value === "string") {
    return value.slice(0, 160);
  }
  try {
    return JSON.stringify(value).slice(0, 160);
  } catch {
    return String(value).slice(0, 160);
  }
}

function assertJsonBody<T>(response: Response, json: T | null, context: string): T {
  if (!response.ok || !json) {
    throw new Error(`${context} failed (${response.status})`);
  }
  return json;
}

async function checkWorkerHealth(baseUrl: string, report: AuditReport) {
  let workerUrl: string;
  try {
    workerUrl = new URL("/health", baseUrl).toString();
  } catch {
    return;
  }

  if (!/onrender\.com/i.test(workerUrl)) {
    return;
  }

  try {
    const response = await fetch(workerUrl, { method: "GET" });
    const body = await response.text();
    report.checks.workerHealth = {
      url: workerUrl,
      status: response.status,
      bodyPreview: body.slice(0, 160),
    };
    if (!response.ok) {
      throw new Error(`Worker health failed (${response.status})`);
    }
  } catch (error) {
    report.checks.workerHealth = {
      url: workerUrl,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
    throw new Error(`Worker health check failed: ${report.checks.workerHealth.error}`);
  }
}

async function run() {
  const options = parseCliArgs(process.argv.slice(2));
  const outputFile = options.outputFile ? path.resolve(process.cwd(), options.outputFile) : defaultOutputFile();
  const client = new HttpClient(options.baseUrl);
  const tone = createSineWavBuffer(2, 44_100, 440);

  const report: AuditReport = {
    startedAt: new Date().toISOString(),
    baseUrl: options.baseUrl,
    upload: {
      assetId: "",
      blobKey: "",
      expiresAt: "",
      uploadedBytes: tone.buffer.byteLength,
    },
    checks: {},
    toolResults: [],
    success: false,
  };

  const tools: Array<{ toolType: ToolType; params: Record<string, unknown> }> = [
    {
      toolType: "stem_isolation",
      params: { stems: 2 },
    },
    {
      toolType: "mastering",
      params: { preset: "streaming_clean", intensity: 60 },
    },
    {
      toolType: "key_bpm",
      params: { includeChordHints: true },
    },
    {
      toolType: "loudness_report",
      params: { targetLufs: -14 },
    },
    {
      toolType: "midi_extract",
      params: { sensitivity: 0.5 },
    },
  ];

  try {
    const initPayload = {
      filename: "synthetic-tone.wav",
      mimeType: "audio/wav",
      sizeBytes: tone.buffer.byteLength,
      durationSec: tone.durationSec,
      rightsConfirmed: true,
      trainingConsent: false,
    };

    const initResult = await client.requestJson<UploadInitResponse | { error?: string }>("/api/upload/init", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(initPayload),
    });

    const uploadInit = assertJsonBody(initResult.response, initResult.json as UploadInitResponse | null, "upload init");
    if (!("assetId" in uploadInit) || !uploadInit.assetId || !uploadInit.uploadUrl) {
      throw new Error(`upload init invalid response (${initResult.response.status})`);
    }

    report.upload = {
      assetId: uploadInit.assetId,
      blobKey: uploadInit.blobKey,
      expiresAt: uploadInit.expiresAt,
      uploadedBytes: tone.buffer.byteLength,
    };

    if (!uploadInit.clientUploadToken) {
      throw new Error("Upload init response missing clientUploadToken");
    }

    const uploaded = await putBlob(uploadInit.blobKey, tone.buffer, {
      access: "public",
      token: uploadInit.clientUploadToken,
      contentType: "audio/wav",
      multipart: true,
    });

    const finalize = await client.requestJson<UploadCompleteResponse | { error?: string }>(
      `/api/upload/complete/${uploadInit.assetId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          blobUrl: uploaded.url,
          uploadedBytes: tone.buffer.byteLength,
        }),
      },
    );

    if (!finalize.response.ok) {
      throw new Error(`upload finalize failed (${finalize.response.status})`);
    }

    if (options.opsSecret) {
      const ops = await client.requestJson<Record<string, unknown>>("/api/ops/summary", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${options.opsSecret}`,
        },
      });

      report.checks.opsSummary = {
        status: ops.response.status,
        bodyPreview: previewBody(ops.json),
      };

      if (!ops.response.ok) {
        throw new Error(`ops summary check failed (${ops.response.status})`);
      }
    }

    await checkWorkerHealth(options.baseUrl, report).catch(() => undefined);

    for (const tool of tools) {
      const started = Date.now();
      const createJob = await client.requestJson<CreateJobResponse | { error?: string }>("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId: uploadInit.assetId,
          toolType: tool.toolType,
          params: tool.params,
        }),
      });

      const job = assertJsonBody(createJob.response, createJob.json as CreateJobResponse | null, `create job (${tool.toolType})`);
      if (!("jobId" in job) || !job.jobId) {
        throw new Error(`create job returned invalid payload (${tool.toolType})`);
      }

      let current: JobStatusResponse | null = null;
      while (Date.now() - started < options.toolTimeoutSec * 1000) {
        const poll = await client.requestJson<JobStatusResponse | { error?: string }>(`/api/jobs/${job.jobId}`, {
          method: "GET",
        });
        current = assertJsonBody(poll.response, poll.json as JobStatusResponse | null, `poll job (${tool.toolType})`);

        if (current.status === "succeeded") {
          break;
        }
        if (current.status === "failed" || current.status === "expired") {
          throw new Error(`job ${current.jobId} ${current.status}: ${current.error ?? "no error code"}`);
        }

        await sleep(3000);
      }

      if (!current || current.status !== "succeeded") {
        throw new Error(`job ${job.jobId} timed out for ${tool.toolType}`);
      }
      if (!Array.isArray(current.artifactIds) || current.artifactIds.length === 0) {
        throw new Error(`job ${job.jobId} succeeded without artifacts (${tool.toolType})`);
      }

      const artifacts: ToolAuditResult["artifacts"] = [];
      for (const artifactId of current.artifactIds) {
        const artifactResponse = await client.requestJson<ArtifactResponse | { error?: string }>(`/api/artifacts/${artifactId}`, {
          method: "GET",
        });
        const artifact = assertJsonBody(artifactResponse.response, artifactResponse.json as ArtifactResponse | null, `artifact ${artifactId}`);
        if (!("downloadUrl" in artifact) || !artifact.downloadUrl) {
          throw new Error(`artifact ${artifactId} missing downloadUrl`);
        }

        const downloadCheck = await fetch(artifact.downloadUrl, { method: "GET" });
        if (!downloadCheck.ok) {
          throw new Error(`artifact download failed (${artifactId}) status=${downloadCheck.status}`);
        }
        await downloadCheck.body?.cancel();

        artifacts.push({
          artifactId,
          downloadUrl: artifact.downloadUrl,
          expiresAt: artifact.expiresAt,
          downloadCheckStatus: downloadCheck.status,
        });
      }

      report.toolResults.push({
        toolType: tool.toolType,
        params: tool.params,
        jobId: job.jobId,
        status: current.status,
        elapsedMs: Date.now() - started,
        progressPct: current.progressPct,
        etaSec: current.etaSec,
        artifactCount: artifacts.length,
        artifacts,
      });
    }

    report.success = true;
  } catch (error) {
    report.success = false;
    report.failureReason = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    await mkdir(path.dirname(outputFile), { recursive: true });
    await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const statusLabel = report.success ? "PASS" : "FAIL";
    console.log(`[live-functional-audit] ${statusLabel} ${report.baseUrl}`);
    console.log(`[live-functional-audit] report: ${outputFile}`);
    for (const item of report.toolResults) {
      console.log(
        `[live-functional-audit] ${item.toolType} status=${item.status} job=${item.jobId} artifacts=${item.artifactCount} elapsedMs=${item.elapsedMs}`,
      );
    }
    if (!report.success && report.failureReason) {
      console.error(`[live-functional-audit] failure: ${report.failureReason}`);
    }
  }
}

run().catch(() => {
  process.exit(1);
});
