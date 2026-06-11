// ============================================================
// Fixture loader — the schedule itself lives in data/fixtures.json
// (FIFA World Cup 2026, all 72 group-stage matches, fully
// materialized: match number, group, date, home/away teams).
//
// To correct or extend the schedule (e.g., add knockout matches
// once the bracket is known), edit data/fixtures.json directly —
// no code changes needed. Next.js imports JSON natively.
// ============================================================
import fixtures from "@/data/fixtures.json";

export const GROUPS = fixtures.groups;

export function makeGroupStageMatches() {
  // Deep copy so seeded pools never share references with the JSON module
  return fixtures.matches.map((m) => ({ ...m, winners: [...m.winners] }));
}
