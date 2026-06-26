// Test PTF automated login without touching the app.
// Usage: node scripts/test-ptf-login.mjs <username> <password>

const [username, password] = process.argv.slice(2);
if (!username || !password) {
  console.error("Usage: node scripts/test-ptf-login.mjs <username> <password>");
  process.exit(1);
}

const BASE = "https://worldcup.predictthefootball.com";

function extractCookie(setCookieHeaders, name) {
  for (const header of setCookieHeaders) {
    const match = header.match(new RegExp(`^${name}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

async function run() {
  console.log("Step 1: GET /site/login ...");
  const getRes = await fetch(`${BASE}/site/login`, {
    headers: { "user-agent": "Mozilla/5.0" },
    redirect: "follow",
  });
  console.log(`  Status: ${getRes.status}`);

  const setCookies1 = getRes.headers.getSetCookie?.() ?? [];
  console.log(`  Set-Cookie headers: ${setCookies1.length}`);
  setCookies1.forEach((c) => console.log(`    ${c.split(";")[0]}`));

  const csrfCookie = extractCookie(setCookies1, "YII_CSRF_TOKEN");
  console.log(`  YII_CSRF_TOKEN cookie: ${csrfCookie ? csrfCookie.slice(0, 20) + "…" : "NOT FOUND"}`);

  const html = await getRes.text();
  // Hidden field: <input type="hidden" value="..." name="YII_CSRF_TOKEN" />
  const csrfMatch1 = html.match(/<input[^>]+name="YII_CSRF_TOKEN"[^>]+value="([^"]+)"/);
  const csrfMatch2 = html.match(/<input[^>]+value="([^"]+)"[^>]+name="YII_CSRF_TOKEN"/);
  const csrfField = csrfMatch1?.[1] ?? csrfMatch2?.[1] ?? null;
  console.log(`  YII_CSRF_TOKEN hidden field: ${csrfField ? csrfField.slice(0, 20) + "…" : "NOT FOUND"}`);

  if (!csrfCookie || !csrfField) {
    console.error("Cannot proceed — CSRF token missing.");
    process.exit(1);
  }

  console.log("\nStep 2: POST /site/login ...");
  const body = new URLSearchParams({
    "YII_CSRF_TOKEN": csrfField,
    "LoginForm[email]": username,
    "LoginForm[password]": password,
    "LoginForm[rememberMe]": "0",
  });

  const postRes = await fetch(`${BASE}/site/login`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "cookie": `YII_CSRF_TOKEN=${csrfCookie}`,
      "user-agent": "Mozilla/5.0",
      "referer": `${BASE}/site/login`,
    },
    body: body.toString(),
    redirect: "manual",
  });
  console.log(`  Status: ${postRes.status}`);
  console.log(`  Location: ${postRes.headers.get("location") || "(none)"}`);

  const setCookies2 = postRes.headers.getSetCookie?.() ?? [];
  console.log(`  Set-Cookie headers: ${setCookies2.length}`);
  setCookies2.forEach((c) => console.log(`    ${c.split(";")[0]}`));

  const session = extractCookie(setCookies2, "PHPSESSID");
  const newCsrf = extractCookie(setCookies2, "YII_CSRF_TOKEN") || csrfCookie;

  if (!session) {
    console.error("\nLOGIN FAILED — no PHPSESSID in response. Check credentials.");
    process.exit(1);
  }

  console.log("\n✓ Login successful!");
  console.log(`  PHPSESSID:      ${session}`);
  console.log(`  YII_CSRF_TOKEN: ${newCsrf.slice(0, 30)}…`);

  // Quick smoke-test: fetch predictions for fixture 1
  const leagueId = process.env.PTF_LEAGUE_ID || "16363";
  console.log(`\nStep 3: Smoke-test predictions fetch (fixture 1, league ${leagueId}) ...`);
  const cookie = `PHPSESSID=${session}; YII_CSRF_TOKEN=${newCsrf}`;
  const predRes = await fetch(
    `${BASE}/minileague/predictions/${leagueId}?fixtureid=1`,
    {
      headers: {
        cookie,
        "x-requested-with": "XMLHttpRequest",
        accept: "text/html, */*; q=0.01",
        referer: `${BASE}/minileague/predictions/${leagueId}`,
        "user-agent": "Mozilla/5.0",
      },
    }
  );
  console.log(`  Status: ${predRes.status}`);
  if (predRes.redirected || predRes.url?.includes("site/login")) {
    console.error("  Redirected to login — session was not accepted.");
  } else {
    const text = await predRes.text();
    const hasTable = text.includes("<tbody>");
    console.log(`  Response contains <tbody>: ${hasTable}`);
    if (hasTable) console.log("  ✓ Predictions page accessible with new session cookies.");
    else console.log("  (No predictions table — fixture may not have started yet, but auth worked.)");
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
