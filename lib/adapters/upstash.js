import { Redis } from "@upstash/redis";

const KEY = "wc26:pool";

let _redis = null;
function redis() {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

export async function getPool() {
  return (await redis().get(KEY)) ?? null;
}

export async function setPool(data) {
  await redis().set(KEY, data);
}
