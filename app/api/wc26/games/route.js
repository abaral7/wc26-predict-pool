// Returns currently live matches from worldcup26.ir.
// GET /api/wc26/games
// Uses /get/games — scores and status are already included in that response.
// Returns { live: [{ id, homeTeam, awayTeam, homeScore, awayScore }] }

import { getWc26Token } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.WC26_TOKEN || (await getWc26Token()) || null;
  if (!token) return Response.json({ error: "WC26 not connected" }, { status: 503 });

  const r = await fetch("https://worldcup26.ir/get/games", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (r.status === 401) return Response.json({ error: "Token expired — reconnect in Settings" }, { status: 401 });
  if (!r.ok) return Response.json({ error: `WC26 API returned ${r.status}` }, { status: r.status });

  const { games } = await r.json();

  // time_elapsed is "notstarted" for upcoming, "live" for in-progress
  const live = (games || [])
    .filter((g) => g.time_elapsed !== "notstarted" && g.finished !== "TRUE")
    .map((g) => ({
      id: g.id,
      homeTeam: g.home_team_name_en,
      awayTeam: g.away_team_name_en,
      homeScore: parseInt(g.home_score, 10),
      awayScore: parseInt(g.away_score, 10),
    }));

  return Response.json({ live });
}
