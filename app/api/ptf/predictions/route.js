// Proxy for predictthefootball.com predictions.
// Credentials can be supplied via env vars OR saved in admin Settings → PTF:
//   PTF_SESSION   — PHPSESSID cookie value
//   PTF_CSRF      — YII_CSRF_TOKEN cookie value
//   PTF_LEAGUE_ID — numeric mini-league ID (e.g. 15333)
//
// Usage:  GET /api/ptf/predictions?fixtureid=5
// Returns {
//   fixtureid, matchTitle, actualScore, actualHome, actualAway,
//   predictions: [{ name, predHome, predAway }],
//   suggestedWinners: { rule, names }   — only when actual score is present
// }
// Add ?raw=1 to get the raw HTML for inspecting the structure.

import { getPtfCredentials } from "@/lib/db";

export const dynamic = "force-dynamic";

async function buildCookie() {
  // DB credentials (admin Settings) take priority over env vars.
  let session, csrf;
  try {
    const creds = await getPtfCredentials();
    session = creds?.session;
    csrf    = creds?.csrf;
  } catch {}
  // Fall back to env vars if DB has nothing.
  if (!session) session = process.env.PTF_SESSION;
  if (!csrf)    csrf    = process.env.PTF_CSRF;
  const parts = [];
  if (session) parts.push(`PHPSESSID=${session}`);
  if (csrf)    parts.push(`YII_CSRF_TOKEN=${csrf}`);
  return parts.join("; ");
}

function parseHtml(html) {
  // Match title: <h4 class="modal-title">Slovenia v Denmark</h4>
  const titleMatch = html.match(/<h4 class="modal-title">([^<]+)<\/h4>/);
  const matchTitle = titleMatch ? titleMatch[1].trim() : null;

  // Actual score: <b>Actual Score:</b>\n  Slovenia 1 - 1 Denmark
  const actualMatch = html.match(/<b>Actual Score:<\/b>\s*([^<\n]+)/);
  let actualScore = null, actualHome = null, actualAway = null;
  if (actualMatch) {
    actualScore = actualMatch[1].trim();
    const nums = actualScore.match(/(\d+)\s*-\s*(\d+)/);
    if (nums) {
      actualHome = parseInt(nums[1], 10);
      actualAway = parseInt(nums[2], 10);
    }
  }

  // Each player row in <tbody>:
  //   <td> <img alt="Full Name" .../> <a ...>possibly truncated&hellip;</a> </td>
  //   <td class="text-center">1 - 2</td>          ← prediction
  //   <td class="text-center hidden-xxs">...</td>  ← GD / CRB / ESB (skip)
  //   <td class="text-center points_N"><b>N</b></td>
  const predictions = [];

  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!tbodyMatch) return { matchTitle, actualScore, actualHome, actualAway, predictions };

  const rowPattern = /<tr[\s\S]*?<\/tr>/g;
  let rowMatch;
  while ((rowMatch = rowPattern.exec(tbodyMatch[1])) !== null) {
    const row = rowMatch[0];

    // Full name is always in the img alt — the <a> text may be truncated with &hellip;
    const nameMatch = row.match(/<img[^>]+alt="([^"]+)"/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();

    // First <td class="text-center"> (no hidden-xxs suffix) holds the prediction "H - A"
    const predMatch = row.match(/<td class="text-center">(\d+)\s*-\s*(\d+)<\/td>/);
    if (!predMatch) continue;
    const predHome = parseInt(predMatch[1], 10);
    const predAway = parseInt(predMatch[2], 10);

    predictions.push({ name, predHome, predAway });
  }

  // Apply pool rule cascade to suggest winners (only when actual score is known)
  let suggestedWinners = null;
  if (actualHome !== null && predictions.length) {
    const exactScore   = predictions.filter(p => p.predHome === actualHome && p.predAway === actualAway);
    const actualGD     = actualHome - actualAway;
    const correctGD    = predictions.filter(p => (p.predHome - p.predAway) === actualGD);
    const actualResult = Math.sign(actualHome - actualAway); // -1 | 0 | 1
    const correctTeam  = predictions.filter(p => Math.sign(p.predHome - p.predAway) === actualResult);
    const isDraw       = actualResult === 0;
    const anyPredDraw  = predictions.some(p => p.predHome === p.predAway);

    if (exactScore.length) {
      suggestedWinners = { rule: 1, names: exactScore.map(p => p.name) };
    } else if (correctGD.length) {
      suggestedWinners = { rule: 2, names: correctGD.map(p => p.name) };
    } else if (correctTeam.length) {
      suggestedWinners = { rule: 3, names: correctTeam.map(p => p.name) };
    } else if (isDraw && !anyPredDraw) {
      suggestedWinners = { rule: 4, names: [] }; // rollover
    }
  }

  return { matchTitle, actualScore, actualHome, actualAway, predictions, suggestedWinners };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const fixtureid = searchParams.get("fixtureid");
  const wantRaw   = searchParams.get("raw") === "1";

  if (!fixtureid) {
    return Response.json({ error: "fixtureid query param required" }, { status: 400 });
  }
  if (!process.env.PTF_LEAGUE_ID) {
    return Response.json({ error: "PTF_LEAGUE_ID env var is not set" }, { status: 500 });
  }

  const cookie = await buildCookie();
  if (!cookie) {
    return Response.json({
      error: "PTF credentials not configured — add PHPSESSID and YII_CSRF_TOKEN in admin Settings → PTF Integration",
    }, { status: 500 });
  }

  const leagueId = process.env.PTF_LEAGUE_ID;
  const url = `https://worldcup.predictthefootball.com/minileague/predictions/${leagueId}?fixtureid=${fixtureid}`;

  const r = await fetch(url, {
    headers: {
      cookie,
      "x-requested-with": "XMLHttpRequest",
      accept:              "text/html, */*; q=0.01",
      referer:             `https://worldcup.predictthefootball.com/minileague/predictions/${leagueId}`,
      "user-agent":        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    },
    cache: "no-store",
  });

  if (!r.ok) {
    return Response.json({ error: `PTF returned HTTP ${r.status}` }, { status: r.status });
  }

  const html = await r.text();

  if (wantRaw) {
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  return Response.json({ fixtureid, ...parseHtml(html) });
}
