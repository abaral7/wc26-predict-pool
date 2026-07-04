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
  return fixtures.matches
    .filter((m) => m.stage === "group")
    .map((m) => ({ ...m, winners: [...m.winners] }));
}

export function makeR32Matches() {
  return fixtures.matches
    .filter((m) => m.stage === "knockout" && m.group === "R32")
    .map((m) => ({ ...m, winners: [...m.winners] }));
}

export function makeR16Matches() {
  return fixtures.matches
    .filter((m) => m.stage === "knockout" && m.group === "R16")
    .map((m) => ({ ...m, winners: [...m.winners] }));
}
