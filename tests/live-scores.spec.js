// Tests for live score display and "currently winning" winners computation.
// Mocks live games and PTF fixture map; uses real PTF predictions from the API.
//
// Run:  pnpm exec playwright test --headed   (with browser visible)
//       pnpm exec playwright test            (headless)

import { test, expect } from "@playwright/test";

// Two mock live matches using real pool team names
const MOCK_LIVE_1_0 = [
  { id: "m1", homeTeam: "Turkey",                 awayTeam: "USA",   homeScore: 1, awayScore: 0 },
  { id: "m2", homeTeam: "Bosnia and Herzegovina", awayTeam: "Qatar", homeScore: 2, awayScore: 1 },
];

// PTF fixture map (same team names as PTF API returns them)
const MOCK_FIXTURES = [
  { id: "59", homeTeam: "Turkey", awayTeam: "United States", date: "26 Jun 2026 07:45" },
  { id: "48", homeTeam: "Bosnia", awayTeam: "Qatar",         date: "25 Jun 2026 00:45" },
];

// Known Rule 1 winners from real PTF predictions:
//   Turkey 1-0 USA  -> exact predictors of 1-0 -> Balaram, Shirshak Upadhayay, Ujjwal Karna
//   Turkey 2-0 USA  -> exact predictor of 2-0  -> Bishnu Ban
//   Bosnia 2-1 Qatar -> verified via earlier API call

// --- helpers ----------------------------------------------------------------

async function mockVerifyEndpoints(page) {
  await page.route("**/api/user/verify**", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/api/admin/verify**", (route) => route.fulfill({ json: { ok: true } }));
}

async function mockLiveGames(page, liveData = MOCK_LIVE_1_0) {
  await page.route("**/api/wc26/games**", (route) =>
    route.fulfill({ json: { live: liveData } })
  );
}

async function mockPtfFixtures(page) {
  await page.route("**/api/ptf/fixtures**", (route) =>
    route.fulfill({ json: { fixtures: MOCK_FIXTURES, cachedAt: new Date().toISOString() } })
  );
}

async function loginAsAdmin(page) {
  // /api/user/verify mock always returns ok so pool auto-loads on mount
  const adminBtn = page.getByRole("button", { name: "Admin" });
  await expect(adminBtn).toBeVisible({ timeout: 15_000 });
  await adminBtn.click();

  const unlockBtn = page.getByRole("button", { name: "Unlock" });
  await expect(unlockBtn).toBeVisible({ timeout: 5_000 });
  await page.locator('input[type="password"]').last().fill("test");
  await unlockBtn.click();
  await expect(unlockBtn).not.toBeVisible({ timeout: 5_000 });
}

async function goToMatches(page) {
  await page.getByRole("button", { name: "Matches" }).click();
  // Matches auto-collapses rounds where every match is already played.
  // Expand any collapsed sections so match cards (and live badges inside them) are visible.
  const sectionBtns = page.locator("section > button");
  await expect(sectionBtns.first()).toBeVisible({ timeout: 5_000 });
  for (const btn of await sectionBtns.all()) {
    if ((await btn.textContent())?.includes("▼")) await btn.click();
  }
}

// Settled match cards have a chip with title= (the rule description tooltip).
// Live "currently winning" chip has NO title attribute.
// Use this locator to find the live winners chip specifically.
function liveWinnersChip(card) {
  return card.locator(".chip.gold:not([title])");
}

// --- tests ------------------------------------------------------------------

test.describe("Live scores", () => {
  test("Live badge and score strip appear for live matches", async ({ page }) => {
    await mockVerifyEndpoints(page);
    await mockLiveGames(page);
    await mockPtfFixtures(page);

    await page.goto("/");
    await loginAsAdmin(page);
    await goToMatches(page);

    // Live badge appears once fetchLive resolves
    await expect(page.locator("text=Live").first()).toBeVisible({ timeout: 10_000 });

    // Turkey 1-0 USA: live badge + scores visible in strip
    const turkeyCard = page.locator(".match")
      .filter({ hasText: "Turkey" })
      .filter({ hasText: "USA" })
      .first();
    await expect(turkeyCard.locator("text=Live")).toBeVisible({ timeout: 5_000 });
    await expect(turkeyCard.locator(".mono")).toContainText("1");
    await expect(turkeyCard.locator(".mono")).toContainText("0");

    // Bosnia 2-1 Qatar: live badge + scores visible
    const bosniaCard = page.locator(".match")
      .filter({ hasText: "Bosnia" })
      .filter({ hasText: "Qatar" })
      .first();
    await expect(bosniaCard.locator("text=Live")).toBeVisible();
    await expect(bosniaCard.locator(".mono")).toContainText("2");
    await expect(bosniaCard.locator(".mono")).toContainText("1");
  });
});

test.describe("Live winners", () => {
  test("Rule 1 chip shows correct winners for current live score", async ({ page }) => {
    await mockVerifyEndpoints(page);
    await mockLiveGames(page); // Turkey 1-0 USA, Bosnia 2-1 Qatar
    await mockPtfFixtures(page);
    // PTF predictions come from real API / Redis cache

    await page.goto("/");
    await loginAsAdmin(page);
    await goToMatches(page);

    await expect(page.locator("text=Live").first()).toBeVisible({ timeout: 10_000 });

    // Turkey 1-0 USA:
    //   Real predictions: Balaram, Shirshak Upadhayay, Ujjwal Karna predicted 1-0 exactly -> Rule 1
    //   Settled chip (match.played) also has .chip.gold with title= -- use :not([title]) for live chip
    const turkeyCard = page.locator(".match")
      .filter({ hasText: "Turkey" })
      .filter({ hasText: "USA" })
      .first();
    const turkeyLiveChip = liveWinnersChip(turkeyCard);
    await expect(turkeyLiveChip).toContainText("Rule 1", { timeout: 10_000 });
    await expect(turkeyLiveChip).toContainText("Balaram");

    // Bosnia 2-1 Qatar: many participants predicted 2-1 exactly -> Rule 1
    const bosniaCard = page.locator(".match")
      .filter({ hasText: "Bosnia" })
      .filter({ hasText: "Qatar" })
      .first();
    const bosniaLiveChip = liveWinnersChip(bosniaCard);
    await expect(bosniaLiveChip).toContainText("Rule 1", { timeout: 10_000 });
  });

  // React Strict Mode (dev) fires useEffect twice, so callCount-based mocks are unreliable.
  // Instead: use a mutable object whose .score field ALL calls read. Flip it only after the
  // initial state is confirmed, then remount the Matches tab to trigger a fresh fetch.
  test("winners chip updates when live score changes", async ({ page }) => {
    const mock = { score: { homeScore: 1, awayScore: 0 } };

    await page.route("**/api/wc26/games**", (route) =>
      route.fulfill({ json: { live: [{ id: "m1", homeTeam: "Turkey", awayTeam: "USA", ...mock.score }] } })
    );

    await mockVerifyEndpoints(page);
    await mockPtfFixtures(page);

    await page.goto("/");
    await loginAsAdmin(page);
    await goToMatches(page);

    const turkeyCard = page.locator(".match")
      .filter({ hasText: "Turkey" })
      .filter({ hasText: "USA" })
      .first();
    const chip = liveWinnersChip(turkeyCard);

    // Phase 1: score 1-0 -> Balaram, Shirshak, Ujjwal are Rule 1 winners
    await expect(chip).toContainText("Rule 1", { timeout: 10_000 });
    await expect(chip).toContainText("Balaram");
    await expect(turkeyCard.locator(".mono")).toContainText("1");

    // Flip mock to 2-0, then remount Matches by navigating away + back.
    // Clear the cached live timestamp in sessionStorage so the cooldown resets,
    // allowing fetchLive to fire immediately on remount.
    mock.score = { homeScore: 2, awayScore: 0 };
    await page.getByRole("button", { name: "Standings" }).click();
    await page.evaluate(() => {
      sessionStorage.removeItem("wc26_live_map");
      sessionStorage.removeItem("wc26_live_ts");
    });
    await goToMatches(page);

    // Phase 2: Matches remounts, fetchLive fires with score 2-0
    // Only Bishnu Ban predicted exactly 2-0 -> Rule 1
    await expect(chip).toContainText("Rule 1", { timeout: 10_000 });
    await expect(chip).toContainText("Bishnu Ban");
    await expect(turkeyCard.locator(".mono")).toContainText("2");
  });
});

test.describe("Admin auto-fetch", () => {
  test("PTF predictions are fetched automatically for live matches", async ({ page }) => {
    await mockVerifyEndpoints(page);
    await mockLiveGames(page);
    await mockPtfFixtures(page);

    const fetchedIds = [];
    await page.route("**/api/ptf/predictions**", (route) => {
      const id = new URL(route.request().url()).searchParams.get("fixtureid");
      fetchedIds.push(id);
      route.continue(); // let real API respond
    });

    // Start with empty ptfPredictions so auto-fetch triggers
    await page.route("**/api/pool**", async (route) => {
      if (route.request().method() !== "GET") { await route.continue(); return; }
      try {
        const response = await route.fetch();
        const json = await response.json();
        json.ptfPredictions = {}; // clear so stale check triggers auto-fetch
        route.fulfill({ json });
      } catch { route.continue(); }
    });

    await page.goto("/");
    await loginAsAdmin(page);
    await goToMatches(page);

    await expect(page.locator("text=Live").first()).toBeVisible({ timeout: 10_000 });

    // Admin auto-fetch should have requested predictions for both live fixture IDs
    await expect.poll(() => fetchedIds, { timeout: 10_000 })
      .toEqual(expect.arrayContaining(["59", "48"]));
  });
});
