# World Cup 2026 Prediction Pool

Next.js app that replaces the EuroCup2024.xlsx workbook. Public visitors get a
view-only dashboard (standings, matches, money, rules). Editing — adding match
results, participants, payment confirmations, settings — requires the admin PIN,
which is verified **server-side** on every write.

## Why not BoltDB?

BoltDB is an embedded Go database that stores data in a single file on local
disk. Vercel runs serverless functions with an **ephemeral, read-only
filesystem**, so a BoltDB file cannot persist there. This project uses
**Upstash Redis** instead — a serverless key-value store from the Vercel
Marketplace that works the same way conceptually (one key, one JSON document)
and has a free tier far beyond this app's needs.

All database access lives in one file: `lib/db.js` (two functions, `getPool`
and `setPool`). Swap that file to use Vercel KV, Neon Postgres, Turso, or
MongoDB without touching anything else.

## Deploy to Vercel (10 minutes)

1. **Push to GitHub**
   ```bash
   cd wc26-pool
   git init && git add -A && git commit -m "World Cup 2026 pool"
   # create an empty repo on github.com, then:
   git remote add origin https://github.com/<you>/wc26-pool.git
   git push -u origin main
   ```

2. **Import in Vercel** — vercel.com → Add New → Project → import the repo.
   Framework is auto-detected as Next.js. Don't deploy yet.

3. **Add the database** — in the Vercel project: Storage tab → Create Database
   → **Upstash (Redis)** → create with defaults → Connect to project. This
   automatically injects `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN` as environment variables.

4. **Set the admin PIN** — Project → Settings → Environment Variables → add
   `ADMIN_PIN` with a value only you know (this is what the Admin button asks
   for). Apply to Production, Preview, and Development.

5. **Deploy.** Open the URL, tap "I'm the admin — set up", enter your PIN,
   fill in fees + participants, done. Share the same URL with everyone —
   they see live data and cannot edit.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in ADMIN_PIN and Upstash credentials
npm run dev                  # http://localhost:3000
```

You can copy the Upstash REST URL/token from the Vercel Storage tab, or create
a free database directly at upstash.com.

## Fixtures data (JSON)

All 72 group-stage fixtures ship in **`data/fixtures.json`** — match number,
group, date, and teams, ready to load. The app reads it via `lib/fixtures.js`:

- **New pool**: the setup wizard's "Preload all 72 group-stage fixtures"
  checkbox seeds them automatically.
- **Existing pool**: Settings → "Import 72 group fixtures" merges them in,
  skipping match numbers that already exist.

To fix a date/team or add knockout fixtures later, edit the JSON directly and
redeploy — no code changes required. Each match entry looks like:

```json
{
  "id": "wc26-g1", "num": 1, "stage": "group", "group": "A",
  "date": "Jun 11, 2026", "home": "Mexico", "away": "South Africa",
  "played": false, "scoreHome": "", "scoreAway": "",
  "rule": "Rule 1", "winners": []
}
```

## How the pool math works

- Enrollment types: **Full** (group + knockout + league), **Group only**,
  **Knockout only**.
- Match pot = players enrolled in that stage × stage fee.
- Winners (from your external prediction app) split the pot equally.
- Rule 4 (unclaimed draw): the pot rolls over into the league fund.
- League fund = Full members × league fee + rollovers, split 50/30/20 between
  the top three Full members when the admin flips "Finalize league".
- Money tab tracks entry-paid and payout-done per person.

## API

| Route                    | Method | Auth                  | Purpose                |
|--------------------------|--------|-----------------------|------------------------|
| `/api/pool`              | GET    | none (public)         | Read the whole pool    |
| `/api/pool`              | PUT    | `x-admin-pin` header  | Replace the pool state |
| `/api/admin/verify`      | POST   | body `{pin}`          | Check a PIN            |

The PIN is held in browser memory only while admin mode is on; it is never
stored in the database or in client code.
