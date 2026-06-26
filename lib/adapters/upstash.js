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

const WC26_KEY = "wc26:wc26-token";

export async function getWc26Token() {
  return (await redis().get(WC26_KEY)) ?? null;
}

export async function setWc26Token(t) {
  await redis().set(WC26_KEY, t);
}

const PTF_FIXTURES_KEY = "wc26:ptf-fixture-map";

export async function getPtfFixtureMap() {
  return (await redis().get(PTF_FIXTURES_KEY)) ?? null;
}

export async function setPtfFixtureMap(data) {
  // Cache for 12 hours
  await redis().set(PTF_FIXTURES_KEY, data, { ex: 43200 });
}
