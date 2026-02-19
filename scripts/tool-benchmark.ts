import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

type ToolType = "stem_isolation" | "mastering" | "key_bpm" | "loudness_report" | "midi_extract";

type ToolAuditResult = {
  toolType: ToolType;
  status: "queued" | "running" | "succeeded" | "failed" | "expired";
  elapsedMs: number;
  artifactCount: number;
};

type AuditReport = {
  startedAt: string;
  finishedAt?: string;
  baseUrl: string;
  success: boolean;
  failureReason?: string;
  toolResults: ToolAuditResult[];
};

type CliOptions = {
  baseUrl: string;
  iterations: number;
  toolTimeoutSec: number;
  opsSecret?: string;
  outputFile?: string;
  baselineFile?: string;
};

type Stats = {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
};

type ToolBenchmarkSummary = {
  runs: number;
  passed: number;
  failed: number;
  passRate: number;
  latencyMs: Stats | null;
};

type BaselineToolDelta = {
  p50DeltaMs: number | null;
  p95DeltaMs: number | null;
  passRateDelta: number;
};

type BaselineComparison = {
  baselineFile: string;
  tools: Record<ToolType, BaselineToolDelta>;
};

type BenchmarkReport = {
  startedAt: string;
  finishedAt?: string;
  baseUrl: string;
  iterations: number;
  toolTimeoutSec: number;
  runReports: Array<{
    iteration: number;
    reportFile: string;
    success: boolean;
    failureReason?: string;
    toolStatuses: Array<{
      toolType: ToolType;
      status: ToolAuditResult["status"];
      elapsedMs: number;
      artifactCount: number;
    }>;
  }>;
  summary: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    runPassRate: number;
    tools: Record<ToolType, ToolBenchmarkSummary>;
  };
  baselineComparison?: BaselineComparison;
};

const TOOL_TYPES: ToolType[] = ["stem_isolation", "mastering", "key_bpm", "loudness_report", "midi_extract"];

function usage() {
  return [
    "Usage:",
    "  tsx scripts/tool-benchmark.ts --base-url <url> [--iterations 3] [--tool-timeout-sec 900] [--ops-secret <secret>] [--output-file <path>] [--baseline-file <path>]",
    "",
    "Flags:",
    "  --base-url          Required. SoundMaxx base URL.",
    "  --iterations        Optional. Number of full live-audit runs (default 3).",
    "  --tool-timeout-sec  Optional. Per-tool timeout in seconds (default 900).",
    "  --ops-secret        Optional. Ops secret forwarded to live audit.",
    "  --output-file       Optional. Benchmark JSON output path.",
    "  --baseline-file     Optional. Previous benchmark JSON for regression deltas.",
  ].join("\n");
}

function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    baseUrl: "",
    iterations: 3,
    toolTimeoutSec: 900,
    opsSecret: process.env.OPS_SECRET,
    outputFile: undefined,
    baselineFile: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;

    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }

    const next = argv[index + 1];
    if ((arg === "--base-url" || arg === "--iterations" || arg === "--tool-timeout-sec" || arg === "--ops-secret" || arg === "--output-file" || arg === "--baseline-file") && !next) {
      throw new Error(`Missing value for ${arg}`);
    }

    if (arg === "--base-url") {
      options.baseUrl = String(next);
      index += 1;
      continue;
    }

    if (arg === "--iterations") {
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error("Invalid --iterations. Use a number >= 1.");
      }
      options.iterations = Math.floor(parsed);
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

    if (arg === "--ops-secret") {
      options.opsSecret = String(next);
      index += 1;
      continue;
    }

    if (arg === "--output-file") {
      options.outputFile = String(next);
      index += 1;
      continue;
    }

    if (arg === "--baseline-file") {
      options.baselineFile = String(next);
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

function defaultOutputFile() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.resolve(process.cwd(), "output", "benchmarks", `tool-benchmark-${stamp}.json`);
}

function percentile(values: number[], q: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0] ?? 0;

  const index = Math.min(sorted.length - 1, Math.max(0, (sorted.length - 1) * q));
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? 0;

  const weight = index - lower;
  const low = sorted[lower] ?? 0;
  const high = sorted[upper] ?? 0;
  return low + (high - low) * weight;
}

function computeStats(values: number[]): Stats | null {
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const sum = values.reduce((acc, value) => acc + value, 0);

  return {
    count: values.length,
    min,
    max,
    avg: sum / values.length,
    p50: percentile(values, 0.5),
    p95: percentile(values, 0.95),
  };
}

async function runAuditIteration(options: CliOptions, iteration: number, reportFile: string) {
  const args = [
    "tsx",
    "scripts/live-functional-audit.ts",
    "--base-url",
    options.baseUrl,
    "--tool-timeout-sec",
    String(options.toolTimeoutSec),
    "--output-file",
    reportFile,
  ];

  if (options.opsSecret) {
    args.push("--ops-secret", options.opsSecret);
  }

  console.log(`[tool-benchmark] iteration ${iteration}: npx ${args.join(" ")}`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn("npx", args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`iteration ${iteration} failed with exit ${code ?? "unknown"}`));
    });
  });
}

async function readAuditReport(filePath: string) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as AuditReport;
}

async function tryReadBenchmark(pathOrFile: string) {
  try {
    const raw = await readFile(pathOrFile, "utf8");
    return JSON.parse(raw) as BenchmarkReport;
  } catch {
    return null;
  }
}

function emptyToolSummary(): Record<ToolType, ToolBenchmarkSummary> {
  return {
    stem_isolation: { runs: 0, passed: 0, failed: 0, passRate: 0, latencyMs: null },
    mastering: { runs: 0, passed: 0, failed: 0, passRate: 0, latencyMs: null },
    key_bpm: { runs: 0, passed: 0, failed: 0, passRate: 0, latencyMs: null },
    loudness_report: { runs: 0, passed: 0, failed: 0, passRate: 0, latencyMs: null },
    midi_extract: { runs: 0, passed: 0, failed: 0, passRate: 0, latencyMs: null },
  };
}

function baselineComparison(current: BenchmarkReport, baseline: BenchmarkReport | null, baselineFile: string | undefined) {
  if (!baseline || !baselineFile) return undefined;

  const tools = {} as Record<ToolType, BaselineToolDelta>;
  for (const toolType of TOOL_TYPES) {
    const currentTool = current.summary.tools[toolType];
    const baselineTool = baseline.summary.tools[toolType];

    tools[toolType] = {
      p50DeltaMs:
        currentTool.latencyMs && baselineTool.latencyMs
          ? currentTool.latencyMs.p50 - baselineTool.latencyMs.p50
          : null,
      p95DeltaMs:
        currentTool.latencyMs && baselineTool.latencyMs
          ? currentTool.latencyMs.p95 - baselineTool.latencyMs.p95
          : null,
      passRateDelta: currentTool.passRate - baselineTool.passRate,
    };
  }

  return {
    baselineFile,
    tools,
  };
}

async function run() {
  const options = parseCliArgs(process.argv.slice(2));
  const outputFile = options.outputFile
    ? path.resolve(process.cwd(), options.outputFile)
    : defaultOutputFile();
  const runStamp = new Date().toISOString().replace(/[:.]/g, "-");

  const benchmark: BenchmarkReport = {
    startedAt: new Date().toISOString(),
    baseUrl: options.baseUrl,
    iterations: options.iterations,
    toolTimeoutSec: options.toolTimeoutSec,
    runReports: [],
    summary: {
      totalRuns: options.iterations,
      successfulRuns: 0,
      failedRuns: 0,
      runPassRate: 0,
      tools: emptyToolSummary(),
    },
  };

  for (let iteration = 1; iteration <= options.iterations; iteration += 1) {
    const runReportFile = path.resolve(
      process.cwd(),
      "output",
      "live-validation",
      `live-benchmark-${runStamp}-iter-${iteration}.json`,
    );

    try {
      await runAuditIteration(options, iteration, runReportFile);
      const audit = await readAuditReport(runReportFile);

      benchmark.runReports.push({
        iteration,
        reportFile: runReportFile,
        success: audit.success,
        failureReason: audit.failureReason,
        toolStatuses: audit.toolResults.map((toolResult) => ({
          toolType: toolResult.toolType,
          status: toolResult.status,
          elapsedMs: toolResult.elapsedMs,
          artifactCount: toolResult.artifactCount,
        })),
      });
    } catch (error) {
      let fallbackReport: AuditReport | null = null;
      try {
        fallbackReport = await readAuditReport(runReportFile);
      } catch {
        fallbackReport = null;
      }

      benchmark.runReports.push({
        iteration,
        reportFile: runReportFile,
        success: false,
        failureReason:
          error instanceof Error
            ? error.message
            : fallbackReport?.failureReason ?? "benchmark iteration failed",
        toolStatuses: fallbackReport?.toolResults.map((toolResult) => ({
          toolType: toolResult.toolType,
          status: toolResult.status,
          elapsedMs: toolResult.elapsedMs,
          artifactCount: toolResult.artifactCount,
        })) ?? [],
      });
    }
  }

  benchmark.summary.successfulRuns = benchmark.runReports.filter((runReport) => runReport.success).length;
  benchmark.summary.failedRuns = benchmark.runReports.length - benchmark.summary.successfulRuns;
  benchmark.summary.runPassRate = benchmark.runReports.length > 0
    ? benchmark.summary.successfulRuns / benchmark.runReports.length
    : 0;

  for (const toolType of TOOL_TYPES) {
    const toolStatuses = benchmark.runReports
      .flatMap((runReport) => runReport.toolStatuses)
      .filter((status) => status.toolType === toolType);

    const passed = toolStatuses.filter((status) => status.status === "succeeded").length;
    const failed = toolStatuses.length - passed;
    const latencies = toolStatuses
      .filter((status) => status.status === "succeeded")
      .map((status) => status.elapsedMs)
      .filter((value) => Number.isFinite(value) && value > 0);

    benchmark.summary.tools[toolType] = {
      runs: toolStatuses.length,
      passed,
      failed,
      passRate: toolStatuses.length > 0 ? passed / toolStatuses.length : 0,
      latencyMs: computeStats(latencies),
    };
  }

  const baseline = options.baselineFile
    ? await tryReadBenchmark(path.resolve(process.cwd(), options.baselineFile))
    : null;
  benchmark.baselineComparison = baselineComparison(benchmark, baseline, options.baselineFile);

  benchmark.finishedAt = new Date().toISOString();

  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(benchmark, null, 2)}\n`, "utf8");

  console.log(`[tool-benchmark] report: ${outputFile}`);
  console.log(
    `[tool-benchmark] runs: ${benchmark.summary.successfulRuns}/${benchmark.summary.totalRuns} passed (${(benchmark.summary.runPassRate * 100).toFixed(1)}%)`,
  );

  for (const toolType of TOOL_TYPES) {
    const tool = benchmark.summary.tools[toolType];
    const latency = tool.latencyMs;
    const latencyText = latency
      ? `p50=${Math.round(latency.p50)}ms p95=${Math.round(latency.p95)}ms avg=${Math.round(latency.avg)}ms`
      : "no successful latency samples";

    console.log(
      `[tool-benchmark] ${toolType} pass=${tool.passed}/${tool.runs} (${(tool.passRate * 100).toFixed(1)}%) ${latencyText}`,
    );
  }

  if (benchmark.summary.failedRuns > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(`[tool-benchmark] fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
