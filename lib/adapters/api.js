function base() {
  const url = process.env.API_BASE_URL;
  if (!url) throw new Error("API_BASE_URL env var is not set");
  return url.replace(/\/$/, "");
}

function headers() {
  return {
    "Content-Type": "application/json",
    ...(process.env.API_SECRET ? { Authorization: `Bearer ${process.env.API_SECRET}` } : {}),
  };
}

export async function getPool() {
  const r = await fetch(`${base()}/pool`, { headers: headers(), cache: "no-store" });
  if (!r.ok) throw new Error(`GET /pool failed: ${r.status}`);
  return (await r.json()).data ?? null;
}

export async function setPool(data) {
  const r = await fetch(`${base()}/pool`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(`PUT /pool failed: ${r.status}`);
}
