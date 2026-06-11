// ============================================================
// Database adapter — the ONLY file that knows about the DB.
// Default: Upstash Redis (Vercel Marketplace, serverless-friendly
// key-value store — the hosted equivalent of BoltDB's one-file KV).
//
// Note: BoltDB itself cannot run on Vercel: it is an embedded Go
// database writing to local disk, and Vercel functions have an
// ephemeral, read-only filesystem. To swap providers (Vercel KV,
// Neon Postgres, Turso, Mongo), reimplement these two functions.
// ============================================================
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const KEY = "wc26:pool";

export async function getPool() {
  // Upstash auto-deserializes JSON
  return (await redis.get(KEY)) ?? null;
}

export async function setPool(data) {
  await redis.set(KEY, data);
}
