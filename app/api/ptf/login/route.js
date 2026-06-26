// Automated PTF login — extracts session cookies so admins never paste them manually.
// POST { username, password }  +  x-admin-pin header
// Flow:
//   1. GET /site/login  → grab YII_CSRF_TOKEN cookie + hidden field
//   2. POST /site/login → 302 → follow all redirects with cookie jar until non-redirect
//   3. Save PHPSESSID + YII_CSRF_TOKEN to Redis; also save credentials for auto-refresh

import { getPtfCredentials, setPtfCredentials } from "@/lib/db";

export const dynamic = "force-dynamic";

const BASE = "https://worldcup.predictthefootball.com";

export async function POST(req) {
  const pin = req.headers.get("x-admin-pin");
  if (!process.env.ADMIN_PIN || pin !== process.env.ADMIN_PIN)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password)
    return Response.json({ error: "username and password required" }, { status: 400 });

  const result = await doLogin(username, password);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });

  // Persist cookies + credentials (for auto-refresh when session expires)
  const existing = await getPtfCredentials().catch(() => ({}));
  await setPtfCredentials({
    ...existing,
    session: result.session,
    csrf: result.csrf,
    username,
    password,
    loginAt: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}

export async function doLogin(username, password) {
  // Step 1: GET login page to get initial CSRF cookie + hidden field
  const getRes = await fetch(`${BASE}/site/login`, {
    headers: { "user-agent": "Mozilla/5.0" },
    redirect: "follow",
  });
  if (!getRes.ok) return { ok: false, error: `GET /site/login failed: ${getRes.status}` };

  const html = await getRes.text();

  // Extract YII_CSRF_TOKEN hidden field — attribute order may vary
  const csrfMatch1 = html.match(/<input[^>]+name="YII_CSRF_TOKEN"[^>]+value="([^"]+)"/);
  const csrfMatch2 = html.match(/<input[^>]+value="([^"]+)"[^>]+name="YII_CSRF_TOKEN"/);
  const csrfField = csrfMatch1?.[1] ?? csrfMatch2?.[1] ?? null;
  if (!csrfField) return { ok: false, error: "Could not find CSRF field on login page" };

  // Seed cookie jar with cookies from the GET response
  const jar = parseCookieJar(getRes.headers.getSetCookie?.() ?? []);

  // Step 2: POST login form, then follow ALL redirects manually so the server
  // can fully activate the session (PTF does GET / → GET /profile/index before
  // the PHPSESSID becomes valid for minileague requests).
  const body = new URLSearchParams({
    "YII_CSRF_TOKEN": csrfField,
    "LoginForm[email]": username,
    "LoginForm[password]": password,
    "LoginForm[rememberMe]": "0",
  });

  let nextUrl = `${BASE}/site/login`;
  let method = "POST";
  let postBody = body.toString();
  let loggedIn = false;

  for (let i = 0; i < 6; i++) {
    const opts = {
      method,
      headers: {
        "user-agent": "Mozilla/5.0",
        "referer": BASE,
        "cookie": jarToString(jar),
        ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}),
      },
      redirect: "manual",
      ...(method === "POST" ? { body: postBody } : {}),
    };

    const res = await fetch(nextUrl, opts);
    mergeCookies(jar, res.headers.getSetCookie?.() ?? []);

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) break;
      // Detect successful login: POST redirects away from /site/login
      if (method === "POST" && !loc.includes("site/login")) loggedIn = true;
      nextUrl = loc.startsWith("http") ? loc : `${BASE}${loc}`;
      method = "GET";
      postBody = null;
    } else {
      break;
    }
  }

  const session = jar["PHPSESSID"];
  const csrf = jar["YII_CSRF_TOKEN"];

  if (!session || !loggedIn) {
    return { ok: false, error: "Login failed — check email and password" };
  }

  return { ok: true, session, csrf: csrf || "" };
}

function parseCookieJar(setCookieHeaders) {
  const jar = {};
  for (const header of setCookieHeaders) {
    const [kv] = header.split(";");
    const eq = kv.indexOf("=");
    if (eq > 0) jar[kv.slice(0, eq).trim()] = kv.slice(eq + 1).trim();
  }
  return jar;
}

function mergeCookies(jar, setCookieHeaders) {
  for (const header of setCookieHeaders) {
    const [kv] = header.split(";");
    const eq = kv.indexOf("=");
    if (eq > 0) jar[kv.slice(0, eq).trim()] = kv.slice(eq + 1).trim();
  }
}

function jarToString(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}

function extractCookie(setCookieHeaders, name) {
  for (const header of setCookieHeaders) {
    const match = header.match(new RegExp(`^${name}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}
