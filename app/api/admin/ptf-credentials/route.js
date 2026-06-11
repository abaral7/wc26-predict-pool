import { getPtfCredentials, setPtfCredentials } from "@/lib/db";

export const dynamic = "force-dynamic";

function authorized(req) {
  const pin = req.headers.get("x-admin-pin");
  return process.env.ADMIN_PIN && pin === process.env.ADMIN_PIN;
}

export async function GET(req) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const creds = await getPtfCredentials();
  return Response.json({ session: creds?.session ?? "", csrf: creds?.csrf ?? "" });
}

export async function PUT(req) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { session, csrf } = await req.json().catch(() => ({}));
  await setPtfCredentials({ session: session ?? "", csrf: csrf ?? "" });
  return Response.json({ ok: true });
}
