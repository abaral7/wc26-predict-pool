// Live score proxy for worldcup26.ir.
// GET /api/wc26/live?matchId=1
// matchId corresponds to pool match number (1–104).
// Returns { matchId, homeTeam, awayTeam, homeScore, awayScore, timeElapsed, finished, status }

import { getWc26Token } from "@/lib/db";

export const dynamic = "force-dynamic";

async function token() {
  return process.env.WC26_TOKEN || (await getWc26Token()) || null;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("matchId");
  if (!matchId) return Response.json({ error: "matchId required" }, { status: 400 });

  const jwt = await token();
  if (!jwt) return Response.json({
    error: "WC26 Live Scores not connected — set up in admin Settings → Live Scores",
  }, { status: 503 });

  const r = await fetch(`https://worldcup26.ir/get/game/${matchId}`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });

  if (r.status === 401) return Response.json({ error: "Token expired — reconnect in admin Settings → Live Scores" }, { status: 401 });
  if (!r.ok) return Response.json({ error: `WC26 API returned ${r.status}` }, { status: r.status });

  const { game: g } = await r.json();
  const notStarted = g.time_elapsed === "notstarted";

  return Response.json({
    matchId,
    homeTeam: g.home_team_name_en,
    awayTeam: g.away_team_name_en,
    homeScore: notStarted ? null : parseInt(g.home_score, 10),
    awayScore: notStarted ? null : parseInt(g.away_score, 10),
    timeElapsed: g.time_elapsed,
    finished: g.finished === "TRUE",
    status: notStarted ? "upcoming" : g.finished === "TRUE" ? "finished" : "live",
  });
}
