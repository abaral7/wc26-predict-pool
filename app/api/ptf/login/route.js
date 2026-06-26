// Automated PTF login — extracts session cookies so admins never paste them manually.
// POST { username, password }  +  x-admin-pin header
// Flow:
//   1. GET /site/login  → grab YII_CSRF_TOKEN cookie + hidden _csrf field
//   2. POST /site/login → on success, Set-Cookie contains PHPSESSID + new YII_CSRF_TOKEN
//   3. Save both to Redis via setPtfCredentials; also save credentials for auto-refresh

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

  // Extract YII_CSRF_TOKEN from Set-Cookie
  const setCookies = getRes.headers.getSetCookie?.() ?? [];
  const csrfCookie = extractCookie(setCookies, "YII_CSRF_TOKEN");
  if (!csrfCookie) return { ok: false, error: "Could not get CSRF cookie from login page" };

  // Step 2: POST login form
  const body = new URLSearchParams({
    "YII_CSRF_TOKEN": csrfField,
    "LoginForm[email]": username,
    "LoginForm[password]": password,
    "LoginForm[rememberMe]": "0",
  });

  const postRes = await fetch(`${BASE}/site/login`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "cookie": `YII_CSRF_TOKEN=${csrfCookie}`,
      "user-agent": "Mozilla/5.0",
      "referer": `${BASE}/site/login`,
    },
    body: body.toString(),
    redirect: "manual", // don't follow redirect — we need to read Set-Cookie first
  });

  const loginCookies = postRes.headers.getSetCookie?.() ?? [];

  // Successful login redirects away from /site/login
  if (postRes.status !== 302 && postRes.status !== 301 && postRes.status !== 200) {
    return { ok: false, error: `Login POST returned ${postRes.status}` };
  }

  const session = extractCookie(loginCookies, "PHPSESSID");
  const newCsrf = extractCookie(loginCookies, "YII_CSRF_TOKEN") || csrfCookie;

  if (!session) {
    // If no new PHPSESSID, login likely failed (bad credentials)
    return { ok: false, error: "Login failed — check username and password" };
  }

  return { ok: true, session, csrf: newCsrf };
}

function extractCookie(setCookieHeaders, name) {
  for (const header of setCookieHeaders) {
    const match = header.match(new RegExp(`^${name}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}
