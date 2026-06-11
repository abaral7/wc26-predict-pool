import { Redis } from "@upstash/redis";

const KEY = "wc26:pool";
const PTF_KEY = "wc26:ptf-credentials";

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

export async function getPtfCredentials() {
  return (await redis().get(PTF_KEY)) ?? { session: "", csrf: "" };
}

export async function setPtfCredentials(creds) {
  await redis().set(PTF_KEY, creds);
}
