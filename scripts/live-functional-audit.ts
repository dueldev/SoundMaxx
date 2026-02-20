import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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
  blobKey: string;
  format: string;
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
    blobKey: string;
    format: string;
    downloadUrl: string;
    expiresAt: string;
    downloadCheckStatus: number;
    sizeBytes: number;
    sha256: string;
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
  tools: ToolType[];
  stemCount: 2 | 4;
  masteringIntensity: number;
  midiSensitivity: number;
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
    "  tsx scripts/live-functional-audit.ts --base-url <url> [--ops-secret <secret>] [--tool-timeout-sec <seconds>] [--output-file <path>] [--tools <tool_a,tool_b>] [--stem-count 2|4] [--mastering-intensity 0-100] [--midi-sensitivity 0-1]",
    "",
    "Flags:",
    "  --base-url          Required. Base URL for SoundMaxx app (for example https://soundmaxx.vercel.app)",
    "  --ops-secret        Optional. Ops API bearer secret (falls back to OPS_SECRET env var)",
    "  --tool-timeout-sec  Optional. Per-tool timeout in seconds (default 900)",
    "  --output-file       Optional. JSON report output path (default output/live-validation/live-validation-<timestamp>.json)",
    "  --tools             Optional. Comma-separated tool filter.",
    "                      Allowed: stem_isolation, mastering, key_bpm, loudness_report, midi_extract",
    "  --stem-count        Optional. stem_isolation stems value (default 4). Allowed: 2, 4.",
    "  --mastering-intensity Optional. mastering intensity value (default 60). Allowed: 0-100.",
    "  --midi-sensitivity  Optional. midi_extract sensitivity value (default 0.5). Allowed: 0-1.",
  ].join("\n");
}

function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    baseUrl: "",
    opsSecret: process.env.OPS_SECRET,
    toolTimeoutSec: 900,
    outputFile: undefined,
    tools: ["stem_isolation", "mastering", "key_bpm", "loudness_report", "midi_extract"],
    stemCount: 4,
    masteringIntensity: 60,
    midiSensitivity: 0.5,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;

    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }

    const next = argv[index + 1];
    if (
      (arg === "--base-url" ||
        arg === "--ops-secret" ||
        arg === "--tool-timeout-sec" ||
        arg === "--output-file" ||
        arg === "--tools" ||
        arg === "--stem-count" ||
        arg === "--mastering-intensity" ||
        arg === "--midi-sensitivity") &&
      !next
    ) {
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
    if (arg === "--tools") {
      const selected = String(next)
        .split(",")
        .map((value) => value.trim())
        .filter((value): value is ToolType => TOOL_TYPES.includes(value as ToolType));

      if (selected.length === 0) {
        throw new Error("Invalid --tools list");
      }
      options.tools = selected;
      index += 1;
      continue;
    }

    if (arg === "--stem-count") {
      const parsed = Number(next);
      if (parsed !== 2 && parsed !== 4) {
        throw new Error("Invalid --stem-count. Allowed: 2 or 4.");
      }
      options.stemCount = parsed;
      index += 1;
      continue;
    }

    if (arg === "--mastering-intensity") {
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        throw new Error("Invalid --mastering-intensity. Use a number between 0 and 100.");
      }
      options.masteringIntensity = Math.round(parsed);
      index += 1;
      continue;
    }

    if (arg === "--midi-sensitivity") {
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
        throw new Error("Invalid --midi-sensitivity. Use a number between 0 and 1.");
      }
      options.midiSensitivity = parsed;
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

const TOOL_TYPES: ToolType[] = ["stem_isolation", "mastering", "key_bpm", "loudness_report", "midi_extract"];

function createSineWavBuffer(durationSec = 6, sampleRate = 44_100, frequencyHz = 440) {
  const channels = 2;
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

  const bpm = 120;
  const beatSec = 60 / bpm;
  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleRate;
    const beatPos = (t % beatSec) / beatSec;
    const measurePos = (t % (beatSec * 4)) / beatSec;

    const kickEnv = Math.exp(-7 * beatPos);
    const kick = Math.sin(2 * Math.PI * 60 * t) * kickEnv * 0.65;

    const snareBeat = Math.floor(measurePos + 1e-6);
    const snareGate = snareBeat === 1 || snareBeat === 3 ? Math.exp(-14 * (measurePos - snareBeat)) : 0;
    const noise = (Math.sin(2 * Math.PI * 3450 * t) + Math.sin(2 * Math.PI * 5120 * t)) * 0.5;
    const snare = noise * Math.max(0, snareGate) * 0.35;

    const bass = Math.sin(2 * Math.PI * 110 * t) * 0.32;
    const lead = Math.sin(2 * Math.PI * frequencyHz * t + 0.3 * Math.sin(2 * Math.PI * 5 * t)) * 0.28;
    const pad = Math.sin(2 * Math.PI * 660 * t) * 0.16;

    const mono = kick + snare + bass + lead + pad;
    const left = Math.max(-1, Math.min(1, mono + Math.sin(2 * Math.PI * 0.17 * t) * 0.03));
    const right = Math.max(-1, Math.min(1, mono - Math.sin(2 * Math.PI * 0.17 * t) * 0.03));

    buffer.writeInt16LE(Math.round(left * 32_767), offset);
    offset += 2;
    buffer.writeInt16LE(Math.round(right * 32_767), offset);
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

type MaterializedArtifact = {
  artifactId: string;
  blobKey: string;
  format: string;
  downloadUrl: string;
  expiresAt: string;
  downloadCheckStatus: number;
  sizeBytes: number;
  sha256: string;
  payload: Buffer;
  parsedJson: Record<string, unknown> | null;
};

function sha256Hex(payload: Buffer) {
  return createHash("sha256").update(payload).digest("hex");
}

function parseJsonPayload(payload: Buffer) {
  try {
    const parsed = JSON.parse(payload.toString("utf8")) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function blobKeyText(artifact: MaterializedArtifact) {
  return path.basename(artifact.blobKey).toLowerCase();
}

function validateStemIsolationArtifacts(artifacts: MaterializedArtifact[], stemCount: 2 | 4) {
  const audioArtifacts = artifacts.filter((artifact) => artifact.format.toLowerCase() === "wav");
  const zipArtifacts = artifacts.filter((artifact) => artifact.format.toLowerCase() === "zip");
  const expectedAudioCount = stemCount;

  if (audioArtifacts.length !== expectedAudioCount) {
    throw new Error(`stem_isolation expected ${expectedAudioCount} stem audio outputs, received ${audioArtifacts.length}`);
  }
  if (zipArtifacts.length !== 1) {
    throw new Error(`stem_isolation expected 1 zip bundle, received ${zipArtifacts.length}`);
  }

  const expectedStems = stemCount === 2 ? (["vocals", "accompaniment"] as const) : (["vocals", "drums", "bass", "other"] as const);
  for (const stem of expectedStems) {
    const found = audioArtifacts.some((artifact) => blobKeyText(artifact).includes(stem));
    if (!found) {
      throw new Error(`stem_isolation missing required '${stem}' stem output`);
    }
  }

  const uniqueHashes = new Set(audioArtifacts.map((artifact) => artifact.sha256));
  if (uniqueHashes.size < 2) {
    throw new Error("stem_isolation outputs appear identical; expected isolated stem-specific audio");
  }
}

function validateMasteringArtifacts(artifacts: MaterializedArtifact[], sourceHash: string) {
  const audioArtifacts = artifacts.filter((artifact) => artifact.format.toLowerCase() === "wav");
  const reportArtifact = artifacts.find((artifact) => artifact.format.toLowerCase() === "json");

  if (audioArtifacts.length === 0) {
    throw new Error("mastering expected at least one mastered audio artifact");
  }
  if (!reportArtifact || !reportArtifact.parsedJson) {
    throw new Error("mastering expected a JSON mastering report");
  }

  const mastered = audioArtifacts.find((artifact) => /master/i.test(blobKeyText(artifact))) ?? audioArtifacts[0];
  if (!mastered) {
    throw new Error("mastering could not identify mastered output artifact");
  }
  if (mastered.sha256 === sourceHash) {
    throw new Error("mastering output is byte-identical to the source audio");
  }

  const engine = reportArtifact.parsedJson.engine;
  if (typeof engine !== "string" || engine.trim().length === 0) {
    throw new Error("mastering report missing engine metadata");
  }
  if (engine === "fallback_passthrough") {
    throw new Error("mastering report indicates passthrough fallback instead of mastering");
  }
}

function validateKeyBpmArtifacts(artifacts: MaterializedArtifact[]) {
  if (artifacts.length !== 1) {
    throw new Error(`key_bpm expected exactly 1 artifact, received ${artifacts.length}`);
  }

  const artifact = artifacts[0]!;
  if (artifact.format.toLowerCase() !== "json" || !artifact.parsedJson) {
    throw new Error("key_bpm expected a JSON artifact");
  }

  const key = artifact.parsedJson.key;
  const bpm = artifact.parsedJson.bpm;
  if (typeof key !== "string" || key.trim().length === 0) {
    throw new Error("key_bpm JSON missing key value");
  }
  if (typeof bpm !== "number" || !Number.isFinite(bpm) || bpm <= 0) {
    throw new Error("key_bpm JSON missing valid BPM value");
  }
}

function validateLoudnessArtifacts(artifacts: MaterializedArtifact[]) {
  if (artifacts.length !== 1) {
    throw new Error(`loudness_report expected exactly 1 artifact, received ${artifacts.length}`);
  }

  const artifact = artifacts[0]!;
  if (artifact.format.toLowerCase() !== "json" || !artifact.parsedJson) {
    throw new Error("loudness_report expected a JSON artifact");
  }

  const required = ["integratedLufs", "truePeakDbtp", "dynamicRange"] as const;
  for (const key of required) {
    const value = artifact.parsedJson[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`loudness_report JSON missing numeric '${key}'`);
    }
  }
}

function validateMidiArtifacts(artifacts: MaterializedArtifact[]) {
  const midiArtifacts = artifacts.filter((artifact) => {
    const format = artifact.format.toLowerCase();
    return format === "mid" || format === "midi";
  });

  if (midiArtifacts.length === 0) {
    throw new Error("midi_extract expected at least one MIDI artifact");
  }

  for (const midiArtifact of midiArtifacts) {
    const header = midiArtifact.payload.subarray(0, 4).toString("ascii");
    if (header !== "MThd") {
      throw new Error(`midi_extract artifact '${midiArtifact.blobKey}' is not a valid MIDI file`);
    }
  }
}

function validateToolArtifacts(
  toolType: ToolType,
  artifacts: MaterializedArtifact[],
  sourceHash: string,
  options: { stemCount: 2 | 4 },
) {
  if (toolType === "stem_isolation") {
    validateStemIsolationArtifacts(artifacts, options.stemCount);
    return;
  }
  if (toolType === "mastering") {
    validateMasteringArtifacts(artifacts, sourceHash);
    return;
  }
  if (toolType === "key_bpm") {
    validateKeyBpmArtifacts(artifacts);
    return;
  }
  if (toolType === "loudness_report") {
    validateLoudnessArtifacts(artifacts);
    return;
  }
  validateMidiArtifacts(artifacts);
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
  const sourceHash = sha256Hex(tone.buffer);

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

  const toolDefaults = new Map<ToolType, Record<string, unknown>>([
    ["stem_isolation", { stems: options.stemCount }],
    ["mastering", { preset: "streaming_clean", intensity: options.masteringIntensity }],
    ["key_bpm", { includeChordHints: true }],
    ["loudness_report", { targetLufs: -14 }],
    ["midi_extract", { sensitivity: options.midiSensitivity }],
  ]);
  const tools: Array<{ toolType: ToolType; params: Record<string, unknown> }> = options.tools.map((toolType) => ({
    toolType,
    params: toolDefaults.get(toolType) ?? {},
  }));

  try {
    const initPayload = {
      filename: "synthetic-tone.wav",
      mimeType: "audio/wav",
      sizeBytes: tone.buffer.byteLength,
      durationSec: tone.durationSec,
      rightsConfirmed: true,
      ageConfirmed: true,
      policyVersion: process.env.POLICY_VERSION ?? "2026-02-19",
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
      const materializedArtifacts: MaterializedArtifact[] = [];
      for (const artifactId of current.artifactIds) {
        const artifactResponse = await client.requestJson<ArtifactResponse | { error?: string }>(`/api/artifacts/${artifactId}`, {
          method: "GET",
        });
        const artifact = assertJsonBody(artifactResponse.response, artifactResponse.json as ArtifactResponse | null, `artifact ${artifactId}`);
        if (!("downloadUrl" in artifact) || !artifact.downloadUrl) {
          throw new Error(`artifact ${artifactId} missing downloadUrl`);
        }
        if (!("blobKey" in artifact) || !artifact.blobKey) {
          throw new Error(`artifact ${artifactId} missing blobKey`);
        }
        if (!("format" in artifact) || !artifact.format) {
          throw new Error(`artifact ${artifactId} missing format`);
        }

        const downloadCheck = await fetch(artifact.downloadUrl, { method: "GET" });
        if (!downloadCheck.ok) {
          throw new Error(`artifact download failed (${artifactId}) status=${downloadCheck.status}`);
        }
        const payload = Buffer.from(await downloadCheck.arrayBuffer());
        const parsedJson = artifact.format.toLowerCase() === "json" ? parseJsonPayload(payload) : null;
        const checksum = sha256Hex(payload);

        materializedArtifacts.push({
          artifactId,
          blobKey: artifact.blobKey,
          format: artifact.format,
          downloadUrl: artifact.downloadUrl,
          expiresAt: artifact.expiresAt,
          downloadCheckStatus: downloadCheck.status,
          sizeBytes: payload.byteLength,
          sha256: checksum,
          payload,
          parsedJson,
        });

        artifacts.push({
          artifactId,
          blobKey: artifact.blobKey,
          format: artifact.format,
          downloadUrl: artifact.downloadUrl,
          expiresAt: artifact.expiresAt,
          downloadCheckStatus: downloadCheck.status,
          sizeBytes: payload.byteLength,
          sha256: checksum,
        });
      }

      validateToolArtifacts(tool.toolType, materializedArtifacts, sourceHash, {
        stemCount: options.stemCount,
      });

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
