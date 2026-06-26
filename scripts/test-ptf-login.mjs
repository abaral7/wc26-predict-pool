// Test PTF automated login without touching the app.
// Usage: node scripts/test-ptf-login.mjs <email> <password>

const [username, password] = process.argv.slice(2);
if (!username || !password) {
  console.error("Usage: node scripts/test-ptf-login.mjs <email> <password>");
  process.exit(1);
}

const BASE = "https://worldcup.predictthefootball.com";
const LEAGUE_ID = process.env.PTF_LEAGUE_ID || "16363";

function mergeCookies(jar, headers) {
  for (const h of headers.getSetCookie?.() ?? []) {
    const [kv] = h.split(";");
    const eq = kv.indexOf("=");
    if (eq > 0) jar[kv.slice(0, eq).trim()] = kv.slice(eq + 1).trim();
  }
}
function jarStr(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function run() {
  const jar = {};

  // Step 1: GET login page
  console.log("Step 1: GET /site/login ...");
  const r1 = await fetch(`${BASE}/site/login`, { headers: { "user-agent": "Mozilla/5.0" }, redirect: "follow" });
  console.log(`  Status: ${r1.status}`);
  mergeCookies(jar, r1.headers);

  const html = await r1.text();
  const csrfField =
    html.match(/<input[^>]+name="YII_CSRF_TOKEN"[^>]+value="([^"]+)"/)?.[1] ??
    html.match(/<input[^>]+value="([^"]+)"[^>]+name="YII_CSRF_TOKEN"/)?.[1] ?? null;
  console.log(`  _csrf field: ${csrfField ? csrfField.slice(0, 20) + "…" : "NOT FOUND"}`);
  if (!csrfField) { console.error("Cannot proceed."); process.exit(1); }

  // Step 2: POST + follow full redirect chain
  console.log("\nStep 2: POST /site/login (following all redirects) ...");
  const body = new URLSearchParams({
    "YII_CSRF_TOKEN": csrfField,
    "LoginForm[email]": username,
    "LoginForm[password]": password,
    "LoginForm[rememberMe]": "0",
  });

  let nextUrl = `${BASE}/site/login`;
  let method = "POST";
  let postBody = body.toString();
  let loggedIn = false;

  for (let i = 0; i < 6; i++) {
    const opts = {
      method,
      headers: {
        "user-agent": "Mozilla/5.0",
        "referer": BASE,
        "cookie": jarStr(jar),
        ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}),
      },
      redirect: "manual",
      ...(method === "POST" ? { body: postBody } : {}),
    };
    const res = await fetch(nextUrl, opts);
    mergeCookies(jar, res.headers);
    const loc = res.headers.get("location");
    console.log(`  ${method} ${nextUrl.replace(BASE, "") || "/"} → ${res.status}${loc ? " → " + loc.replace(BASE, "") : ""}`);
    if (method === "POST" && loc && !loc.includes("site/login")) loggedIn = true;
    if (res.status >= 300 && res.status < 400 && loc) {
      nextUrl = loc.startsWith("http") ? loc : `${BASE}${loc}`;
      method = "GET"; postBody = null;
    } else break;
  }

  const session = jar["PHPSESSID"];
  const csrf = jar["YII_CSRF_TOKEN"];

  if (!session || !loggedIn) {
    console.error("\nLOGIN FAILED — check email and password.");
    process.exit(1);
  }

  console.log("\n✓ Login successful!");
  console.log(`  PHPSESSID:      ${session}`);
  console.log(`  YII_CSRF_TOKEN: ${csrf?.slice(0, 30)}…`);

  // Step 3: Smoke-test predictions
  console.log(`\nStep 3: Smoke-test predictions (fixture 59, league ${LEAGUE_ID}) ...`);
  const r3 = await fetch(`${BASE}/minileague/predictions/${LEAGUE_ID}?fixtureid=59`, {
    headers: {
      cookie: jarStr(jar),
      "x-requested-with": "XMLHttpRequest",
      accept: "text/html, */*; q=0.01",
      referer: `${BASE}/minileague/predictions/${LEAGUE_ID}`,
      "user-agent": "Mozilla/5.0",
    },
  });
  const text = await r3.text();
  console.log(`  Status: ${r3.status}`);
  if (text.includes("<tbody>")) {
    console.log("  ✓ Predictions page accessible — session is fully working.");
  } else {
    console.log("  Body snippet:", text.slice(0, 200));
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
