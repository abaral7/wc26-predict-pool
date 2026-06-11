export async function POST(req) {
  const { pin } = await req.json().catch(() => ({}));
  if (!process.env.USER_PIN) {
    return Response.json({ ok: true });
  }
  if (typeof pin === "string" && pin === process.env.USER_PIN) {
    return Response.json({ ok: true });
  }
  return Response.json({ ok: false }, { status: 401 });
}
