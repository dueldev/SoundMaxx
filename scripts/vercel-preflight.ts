import { execSync } from "node:child_process";

const requiredVars = [
  "APP_BASE_URL",
  "SESSION_SECRET",
  "INFERENCE_PROVIDER",
  "INFERENCE_WEBHOOK_SECRET",
  "BLOB_READ_WRITE_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "WORKER_API_URL",
  "WORKER_API_KEY",
  "CRON_SECRET",
  "OPS_SECRET",
];

function run(command: string) {
  return execSync(`${command} 2>&1`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function extractEnvNames(raw: string) {
  const normalized = raw.replace(/\u001b\[[0-9;]*m/g, "");
  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[A-Z0-9_]+\s+Encrypted/.test(line))
    .map((line) => line.split(/\s+/)[0] ?? "")
    .filter(Boolean);
}

function hasReadyDeployment(raw: string) {
  const normalized = raw.replace(/\u001b\[[0-9;]*m/g, "");
  return /status\s+.*Ready/i.test(normalized) || /\bReady\b/.test(normalized);
}

function main() {
  const deploymentTarget = process.argv[2] ?? "soundmaxx.vercel.app";

  const inspectRaw = run(`vercel inspect ${deploymentTarget}`);
  const envRaw = run("vercel env ls");

  const envNames = new Set(extractEnvNames(envRaw));
  const missing = requiredVars.filter((name) => !envNames.has(name));

  const report = {
    deploymentTarget,
    deploymentReady: hasReadyDeployment(inspectRaw),
    missingRequiredEnv: missing,
    checksPassed: hasReadyDeployment(inspectRaw) && missing.length === 0,
  };

  console.log(JSON.stringify(report, null, 2));

  if (!report.checksPassed) {
    process.exit(1);
  }
}

main();
