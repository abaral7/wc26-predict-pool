// POST /api/admin/verify  { pin } -> 200 if correct, 401 otherwise.
// The PIN lives only in the ADMIN_PIN env var on the server.
export async function POST(req) {
  const { pin } = await req.json().catch(() => ({}));
  if (!process.env.ADMIN_PIN) {
    return Response.json({ error: "ADMIN_PIN env var is not set" }, { status: 500 });
  }
  if (typeof pin === "string" && pin === process.env.ADMIN_PIN) {
    return Response.json({ ok: true });
  }
  return Response.json({ ok: false }, { status: 401 });
}
