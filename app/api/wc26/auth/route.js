// One-time setup: register or login with worldcup26.ir and store the JWT.
// JWT is valid for 84 days — re-connect from admin Settings when it expires.
// POST { email, password, name? }  +  x-admin-pin header

import { setWc26Token } from "@/lib/db";

export const dynamic = "force-dynamic";

const BASE = "https://worldcup26.ir";

export async function POST(req) {
  const pin = req.headers.get("x-admin-pin");
  if (!process.env.ADMIN_PIN || pin !== process.env.ADMIN_PIN)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const { email, password, name } = await req.json().catch(() => ({}));
  if (!email || !password) return Response.json({ error: "email and password required" }, { status: 400 });

  // Try login first; fall back to register if account doesn't exist yet.
  let token;
  const loginRes = await fetch(`${BASE}/auth/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (loginRes.ok) {
    token = (await loginRes.json()).token;
  } else {
    const regRes = await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || email.split("@")[0], email, password }),
    });
    if (!regRes.ok) {
      const err = await regRes.json().catch(() => ({}));
      return Response.json({ error: err.message || "Auth failed — check credentials" }, { status: 400 });
    }
    token = (await regRes.json()).token;
  }

  await setWc26Token(token);
  return Response.json({ ok: true });
}
