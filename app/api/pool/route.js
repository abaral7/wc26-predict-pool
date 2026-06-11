import { getPool, setPool } from "@/lib/db";

export const dynamic = "force-dynamic"; // never cache pool data

// GET /api/pool — public, read-only view of the whole pool.
// The admin PIN is stripped server-side and never sent to browsers.
export async function GET() {
  const data = await getPool();
  return Response.json({ data });
}

// PUT /api/pool — admin only. Requires the x-admin-pin header.
export async function PUT(req) {
  const pin = req.headers.get("x-admin-pin");
  if (!process.env.ADMIN_PIN || pin !== process.env.ADMIN_PIN) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body || !body.config || !Array.isArray(body.participants) || !Array.isArray(body.matches)) {
    return Response.json({ error: "Invalid pool payload" }, { status: 400 });
  }
  await setPool(body);
  return Response.json({ ok: true });
}
