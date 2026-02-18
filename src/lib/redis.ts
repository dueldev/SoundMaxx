import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env, limits } from "@/lib/config";

type SimpleRateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

const globalRedisState = globalThis as unknown as {
  redisClient?: Redis;
  ratelimit?: Ratelimit;
  localBucket?: Map<string, { count: number; resetAt: number }>;
  localQueue?: string[];
};

function getRedisClient() {
  if (!env.KV_REST_API_URL || !env.KV_REST_API_TOKEN) {
    return null;
  }

  if (!globalRedisState.redisClient) {
    globalRedisState.redisClient = new Redis({
      url: env.KV_REST_API_URL,
      token: env.KV_REST_API_TOKEN,
    });
  }

  return globalRedisState.redisClient;
}

function getRatelimit() {
  const redis = getRedisClient();
  if (!redis) return null;

  if (!globalRedisState.ratelimit) {
    globalRedisState.ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(limits.ipBurstPerMinute, "60 s"),
      prefix: "soundmaxx-ip",
      analytics: false,
    });
  }

  return globalRedisState.ratelimit;
}

export async function enforceIpRateLimit(ipHash: string): Promise<SimpleRateLimitResult> {
  const ratelimit = getRatelimit();

  if (!ratelimit) {
    if (!globalRedisState.localBucket) {
      globalRedisState.localBucket = new Map();
    }

    const key = `ip:${ipHash}`;
    const now = Date.now();
    const item = globalRedisState.localBucket.get(key);

    if (!item || now > item.resetAt) {
      globalRedisState.localBucket.set(key, {
        count: 1,
        resetAt: now + 60_000,
      });

      return {
        success: true,
        limit: limits.ipBurstPerMinute,
        remaining: limits.ipBurstPerMinute - 1,
        reset: now + 60_000,
      };
    }

    const count = item.count + 1;
    globalRedisState.localBucket.set(key, {
      count,
      resetAt: item.resetAt,
    });

    return {
      success: count <= limits.ipBurstPerMinute,
      limit: limits.ipBurstPerMinute,
      remaining: Math.max(limits.ipBurstPerMinute - count, 0),
      reset: item.resetAt,
    };
  }

  const result = await ratelimit.limit(ipHash);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

const QUEUE_KEY = "soundmaxx:queue";

export async function queueJob(jobId: string) {
  const redis = getRedisClient();
  if (!redis) {
    if (!globalRedisState.localQueue) globalRedisState.localQueue = [];
    globalRedisState.localQueue.push(jobId);
    return;
  }

  await redis.lpush(QUEUE_KEY, jobId);
}

export async function dequeueJob(jobId: string) {
  const redis = getRedisClient();
  if (!redis) {
    if (!globalRedisState.localQueue) return;
    globalRedisState.localQueue = globalRedisState.localQueue.filter((id) => id !== jobId);
    return;
  }

  await redis.lrem(QUEUE_KEY, 0, jobId);
}

export async function queueDepth() {
  const redis = getRedisClient();
  if (!redis) {
    return globalRedisState.localQueue?.length ?? 0;
  }

  const count = await redis.llen(QUEUE_KEY);
  return Number(count ?? 0);
}
