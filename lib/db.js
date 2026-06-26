// Router — set DB_ADAPTER in env to switch backends without touching app code.
// Available adapters: "upstash" (default), "api"
// Add new adapters in lib/adapters/ and register them in ADAPTERS below.

import * as upstash from "./adapters/upstash.js";
import * as api from "./adapters/api.js";

const ADAPTERS = { upstash, api };

const name = process.env.DB_ADAPTER ?? "upstash";
const adapter = ADAPTERS[name];
if (!adapter) throw new Error(`Unknown DB_ADAPTER: "${name}". Valid values: ${Object.keys(ADAPTERS).join(", ")}`);

export const { getPool, setPool, getPtfCredentials, setPtfCredentials, getWc26Token, setWc26Token, getPtfFixtureMap, setPtfFixtureMap } = adapter;
