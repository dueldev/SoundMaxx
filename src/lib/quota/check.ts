import { limits } from "@/lib/config";
import { store } from "@/lib/store";
import { dayKeyUtc } from "@/lib/utils";

export async function canUpload(sessionId: string, sizeBytes: number) {
  const usage = await store.getQuotaUsage(sessionId, dayKeyUtc());
  const wouldExceed = usage.bytesUploaded + sizeBytes > limits.dailyBytesUploaded;

  return {
    allowed: !wouldExceed,
    usage,
    reason: wouldExceed ? "daily upload quota exceeded" : null,
  };
}

export async function canCreateJob(sessionId: string, durationSec: number) {
  const usage = await store.getQuotaUsage(sessionId, dayKeyUtc());

  if (usage.jobsCount + 1 > limits.dailyJobs) {
    return {
      allowed: false,
      usage,
      reason: "daily job quota exceeded",
    };
  }

  if (usage.secondsProcessed + durationSec > limits.dailySecondsProcessed) {
    return {
      allowed: false,
      usage,
      reason: "daily processing-time quota exceeded",
    };
  }

  return {
    allowed: true,
    usage,
    reason: null,
  };
}

export async function incrementUploadUsage(sessionId: string, sizeBytes: number) {
  return store.bumpQuotaUsage({
    sessionId,
    dayUtc: dayKeyUtc(),
    bytesUploaded: sizeBytes,
  });
}

export async function incrementJobUsage(sessionId: string, durationSec: number) {
  return store.bumpQuotaUsage({
    sessionId,
    dayUtc: dayKeyUtc(),
    jobsCount: 1,
    secondsProcessed: durationSec,
  });
}
