// Returns all PTF fixtures for the league, cached in Redis for 12 hours.
// GET /api/ptf/fixtures
// Returns { fixtures: [{ id, homeTeam, awayTeam, date }], cachedAt }
//
// Used by the client to auto-match a pool match to its PTF fixture ID by team name.

import { getPtfFixtureMap, setPtfFixtureMap } from "@/lib/db";
import { doLogin } from "@/app/api/ptf/login/route";
import { getPtfCredentials, setPtfCredentials } from "@/lib/db";

export const dynamic = "force-dynamic";

const BASE = "https://worldcup.predictthefootball.com";

async function getAuthCookie() {
  let creds = {};
  try { creds = await getPtfCredentials(); } catch {}
  const session = creds?.session || process.env.PTF_SESSION || "";
  const csrf = creds?.csrf || process.env.PTF_CSRF || "";
  if (!session) return null;
  return { cookie: `PHPSESSID=${session}; YII_CSRF_TOKEN=${csrf}`, creds };
}

async function refreshAndSave(creds) {
  if (!creds?.username || !creds?.password) return null;
  try {
    const result = await doLogin(creds.username, creds.password);
    if (!result.ok) return null;
    const updated = { ...creds, session: result.session, csrf: result.csrf, loginAt: new Date().toISOString() };
    await setPtfCredentials(updated);
    return `PHPSESSID=${updated.session}; YII_CSRF_TOKEN=${updated.csrf}`;
  } catch { return null; }
}

function parseFixtures(html, leagueId) {
  const fixtures = [];
  // Each fixture row: date td, home td, score td, away td, ..., link with fixtureid
  const rowRe = /<tr>([\s\S]*?)<\/tr>/g;
  let row;
  while ((row = rowRe.exec(html)) !== null) {
    const cells = row[1].match(/<td[^>]*>([\s\S]*?)<\/td>/g);
    if (!cells || cells.length < 4) continue;
    const idMatch = row[0].match(/fixtureid=(\d+)/);
    if (!idMatch) continue;
    const id = idMatch[1];
    // Strip tags from cells
    const text = (s) => s.replace(/<[^>]+>/g, "").trim();
    // Cell 0: date (hidden-xs), cell 1: home team, cell 2: score, cell 3: away team
    const home = text(cells[1]);
    const away = text(cells[3]);
    const date = text(cells[0]);
    if (home && away) fixtures.push({ id, homeTeam: home, awayTeam: away, date });
  }
  return fixtures;
}

export async function GET(req) {
  const leagueId = process.env.PTF_LEAGUE_ID;
  if (!leagueId) return Response.json({ error: "PTF_LEAGUE_ID not set" }, { status: 500 });

  // Return cache if fresh (Redis TTL handles expiry)
  const cached = await getPtfFixtureMap().catch(() => null);
  if (cached?.fixtures?.length) return Response.json(cached);

  // Need to fetch — get auth cookie
  let auth = await getAuthCookie();
  if (!auth) return Response.json({ error: "PTF credentials not configured" }, { status: 503 });

  const fetchPage = async (week) => {
    const url = `${BASE}/minileague/predictions/${leagueId}${week ? `?week=${week}` : ""}`;
    let r = await fetch(url, {
      headers: { cookie: auth.cookie, "user-agent": "Mozilla/5.0", accept: "text/html" },
      cache: "no-store",
    });
    // Auto-refresh session if expired
    if (r.status === 403 || r.redirected || r.url?.includes("site/login")) {
      const newCookie = await refreshAndSave(auth.creds);
      if (!newCookie) return null;
      auth = { ...auth, cookie: newCookie };
      r = await fetch(url, { headers: { cookie: newCookie, "user-agent": "Mozilla/5.0", accept: "text/html" }, cache: "no-store" });
    }
    if (!r.ok) return null;
    return r.text();
  };

  // Fetch default page to discover all available weeks
  const mainHtml = await fetchPage(null);
  if (!mainHtml) return Response.json({ error: "Could not fetch PTF fixtures page" }, { status: 502 });

  const weeks = [...mainHtml.matchAll(/<option value="(\d+)"[^>]*>/g)].map(m => m[1]);
  // Always include the default page (week already selected)
  const allFixtures = parseFixtures(mainHtml, leagueId);
  const seenIds = new Set(allFixtures.map(f => f.id));

  // Fetch remaining weeks in parallel
  const otherWeeks = weeks.filter(w => {
    // Skip the week that was already selected (shown on main page)
    const selectedMatch = mainHtml.match(/<option value="(\d+)" selected/);
    return !selectedMatch || w !== selectedMatch[1];
  });

  const otherHtmls = await Promise.all(otherWeeks.map(w => fetchPage(w)));
  for (const html of otherHtmls) {
    if (!html) continue;
    for (const f of parseFixtures(html, leagueId)) {
      if (!seenIds.has(f.id)) { allFixtures.push(f); seenIds.add(f.id); }
    }
  }

  if (!allFixtures.length) return Response.json({ error: "No fixtures found" }, { status: 502 });

  const result = { fixtures: allFixtures, cachedAt: new Date().toISOString() };
  await setPtfFixtureMap(result).catch(() => {});
  return Response.json(result);
}
