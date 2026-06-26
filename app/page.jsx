"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { makeGroupStageMatches } from "@/lib/fixtures";

/* ============================================================
   WORLD CUP 2026 PREDICTION POOL — Next.js client UI
   - Reads pool data from  GET /api/pool   (public, view-only)
   - Writes go through     PUT /api/pool   (x-admin-pin header,
     verified server-side against the ADMIN_PIN env var)
   - Enrollment types: full | group | knockout
   ============================================================ */

const DEFAULT_CONFIG = {
  poolName: "FIFA World Cup 2026 Pool",
  groupFee: 50,
  knockoutFee: 100,
  leagueFee: 200,
  groupMatchCount: 72,
  knockoutMatchCount: 32,
  leagueFinalized: false,
};

const TYPES = {
  full: { label: "Full", short: "Full" },
  group: { label: "Group stage only", short: "Group" },
  knockout: { label: "Knockout only", short: "KO" },
};
const inGroup = (p) => p.type === "full" || p.type === "group";
const inKO = (p) => p.type === "full" || p.type === "knockout";
const inLeague = (p) => p.type === "full";

const RULES = ["Rule 1", "Rule 2", "Rule 3", "Rule 4"];
const RULE_HELP = {
  "Rule 1": "Exact score matched",
  "Rule 2": "Goal difference matched",
  "Rule 3": "Winning team matched",
  "Rule 4": "Draw, nobody predicted it — pot rolls to league fund",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..100,400..900&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

  .wcp * { box-sizing: border-box; margin: 0; }
  .wcp {
    --pitch: #0c241a;
    --pitch-2: #10301f;
    --line: rgba(244, 247, 240, 0.14);
    --chalk: #f4f7f0;
    --chalk-dim: #9db3a4;
    --gold: #e9c63f;
    --grass: #54d98c;
    --loss: #ef7a6d;
    --card: #122b1e;
    font-family: 'Archivo', system-ui, sans-serif;
    background:
      repeating-linear-gradient(90deg, transparent 0 120px, rgba(255,255,255,0.015) 120px 240px),
      var(--pitch);
    color: var(--chalk);
    min-height: 100vh;
  }
  .wcp .mono { font-family: 'IBM Plex Mono', monospace; }
  .wcp .disp { font-family: 'Archivo', sans-serif; font-stretch: 80%; font-weight: 800; letter-spacing: 0.01em; }

  .wcp header.top {
    border-bottom: 2px solid var(--line);
    padding: 20px 18px 0;
    position: sticky; top: 0; z-index: 30;
    background: linear-gradient(var(--pitch) 70%, rgba(12,36,26,0.96));
    backdrop-filter: blur(6px);
  }
  .wcp .eyebrow { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--gold); font-weight: 600; }
  .wcp h1 { font-stretch: 75%; font-weight: 900; font-size: clamp(22px, 5vw, 34px); text-transform: uppercase; line-height: 1.05; }
  .wcp .tabs { display: flex; gap: 2px; margin-top: 14px; overflow-x: auto; }
  .wcp .tabs button {
    appearance: none; border: none; background: transparent; color: var(--chalk-dim);
    font: 600 13px 'Archivo'; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 10px 14px; cursor: pointer; border-bottom: 3px solid transparent; white-space: nowrap;
  }
  .wcp .tabs button:focus-visible { outline: 2px solid var(--gold); outline-offset: -2px; }
  .wcp .tabs button.on { color: var(--chalk); border-bottom-color: var(--gold); }

  .wcp main { max-width: 920px; margin: 0 auto; padding: 18px 14px 90px; }
  .wcp .card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px; }
  .wcp .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .wcp .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  @media (max-width: 560px) { .wcp .grid3 { grid-template-columns: 1fr 1fr; } }

  .wcp .stat .k { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--chalk-dim); }
  .wcp .stat .v { font-size: 20px; font-weight: 800; font-stretch: 80%; margin-top: 2px; }

  .wcp table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  .wcp th { text-align: left; font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--chalk-dim); padding: 8px 8px; border-bottom: 1px solid var(--line); }
  .wcp td { padding: 9px 8px; border-bottom: 1px solid rgba(244,247,240,0.06); }
  .wcp .num { text-align: right; font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; }
  .wcp .pos { color: var(--grass); }
  .wcp .neg { color: var(--loss); }

  .wcp .chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; border: 1px solid var(--line); color: var(--chalk-dim); }
  .wcp .chip.gold { color: var(--gold); border-color: rgba(233,198,63,0.5); }
  .wcp .chip.green { color: var(--grass); border-color: rgba(84,217,140,0.45); }

  .wcp .match { border: 1px solid var(--line); border-radius: 10px; background: var(--card); margin-bottom: 10px; overflow: hidden; }
  .wcp .match .head { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-bottom: 1px dashed var(--line); flex-wrap: wrap; }
  .wcp .match .score {
    font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 16px;
    background: #0a1d14; border: 1px solid var(--line); border-radius: 6px; padding: 4px 10px; color: var(--gold);
  }
  .wcp .match .teams { font-weight: 700; font-stretch: 85%; font-size: 15px; flex: 1; min-width: 160px; }
  .wcp .match .body { padding: 10px 12px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .wcp .winner-tag { background: rgba(84,217,140,0.1); border: 1px solid rgba(84,217,140,0.3); color: var(--grass); border-radius: 5px; padding: 2px 7px; font-size: 12px; }

  .wcp button.btn {
    appearance: none; cursor: pointer; border-radius: 8px; font: 700 13px 'Archivo'; letter-spacing: 0.04em;
    padding: 10px 16px; border: 1px solid var(--line); background: var(--pitch-2); color: var(--chalk);
  }
  .wcp button.btn.primary { background: var(--gold); border-color: var(--gold); color: #1c1a0a; }
  .wcp button.btn.danger { border-color: rgba(239,122,109,0.5); color: var(--loss); background: transparent; }
  .wcp button.btn.sm { padding: 6px 10px; font-size: 12px; }
  .wcp button.btn:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }

  .wcp input, .wcp select, .wcp textarea {
    width: 100%; background: #0a1d14; border: 1px solid var(--line); color: var(--chalk);
    border-radius: 8px; padding: 10px 12px; font: 500 14px 'Archivo';
  }
  .wcp input:focus, .wcp select:focus, .wcp textarea:focus { outline: 2px solid var(--gold); outline-offset: -1px; }
  .wcp label.f { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--chalk-dim); margin: 12px 0 5px; }

  .wcp .overlay { position: fixed; inset: 0; background: rgba(4,12,8,0.78); z-index: 50; display: flex; align-items: flex-end; justify-content: center; }
  @media (min-width: 600px) { .wcp .overlay { align-items: center; } }
  .wcp .sheet { background: var(--pitch-2); border: 1px solid var(--line); border-radius: 14px 14px 0 0; width: 100%; max-width: 620px; max-height: 88vh; overflow-y: auto; padding: 18px; }
  @media (min-width: 600px) { .wcp .sheet { border-radius: 14px; } }

  .wcp .adminbar {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 40;
    background: rgba(10,29,20,0.97); border-top: 1px solid var(--gold);
    display: flex; gap: 8px; padding: 10px 14px; justify-content: center; flex-wrap: wrap;
  }
  .wcp .winnergrid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; max-height: 240px; overflow-y: auto; border: 1px solid var(--line); border-radius: 8px; padding: 8px; }
  .wcp .winnergrid label { display: flex; gap: 7px; align-items: center; font-size: 13px; padding: 4px 2px; cursor: pointer; }
  .wcp .winnergrid input { width: auto; }
  .wcp .toast { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 99; background: var(--gold); color: #1c1a0a; font-weight: 700; font-size: 13px; padding: 9px 16px; border-radius: 999px; }
  .wcp .medal { font-size: 15px; }
  .wcp .rulecard { border-left: 3px solid var(--gold); padding: 10px 12px; background: var(--card); border-radius: 0 8px 8px 0; margin-bottom: 10px; font-size: 13.5px; line-height: 1.5; }
  .wcp .rulecard b { color: var(--gold); }
  .wcp .prow { display: flex; gap: 8px; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(244,247,240,0.07); flex-wrap: wrap; }
  .wcp .prow .pname { flex: 1; min-width: 130px; font-weight: 600; font-size: 14px; }
  .wcp .prow select { width: auto; padding: 6px 8px; font-size: 12.5px; }
  @media (prefers-reduced-motion: no-preference) {
    .wcp .match, .wcp .card { transition: border-color .15s; }
    .wcp .match:hover { border-color: rgba(233,198,63,0.4); }
  }
`;

/* ---------- money helpers ---------- */
const rs = (n) =>
  "Rs " + (Math.round(n * 100) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const rs0 = (n) => "Rs " + Math.round(n).toLocaleString("en-IN");

/* ---------- entry fee for one participant ---------- */
function entryFor(p, config) {
  let t = 0;
  if (inGroup(p)) t += config.groupFee * config.groupMatchCount;
  if (inKO(p)) t += config.knockoutFee * config.knockoutMatchCount;
  if (inLeague(p)) t += config.leagueFee;
  return t;
}

/* ---------- core computation (the whole spreadsheet) ---------- */
function compute(data) {
  const { config, participants, matches, payments } = data;
  const groupPlayers = participants.filter(inGroup);
  const koPlayers = participants.filter(inKO);
  const leaguePlayers = participants.filter(inLeague);

  const potFor = (stage) =>
    stage === "group"
      ? groupPlayers.length * config.groupFee
      : koPlayers.length * config.knockoutFee;

  const stats = {};
  participants.forEach((p) => {
    stats[p.name] = {
      name: p.name, type: p.type,
      groupEarned: 0, koEarned: 0, wins: 0, maxWin: 0,
      playedFees: 0, leagueReturn: 0,
    };
  });

  let rollover = 0;
  let playedCount = 0;

  matches.forEach((m) => {
    if (!m.played) return;
    playedCount++;
    const pot = potFor(m.stage);
    const eligible = m.stage === "group" ? groupPlayers : koPlayers;
    const winners = (m.winners || []).filter((w) => stats[w]);
    const isRollover = m.rule === "Rule 4" || winners.length === 0;
    const share = isRollover ? 0 : pot / winners.length;
    m._pot = pot; m._share = share; m._rollover = isRollover;

    if (isRollover) rollover += pot;
    eligible.forEach((p) => {
      const s = stats[p.name];
      s.playedFees += m.stage === "group" ? config.groupFee : config.knockoutFee;
      if (!isRollover && winners.includes(p.name)) {
        if (m.stage === "group") s.groupEarned += share;
        else s.koEarned += share;
        s.wins += 1;
        s.maxWin = Math.max(s.maxWin, share);
      }
    });
  });

  const leagueFund = leaguePlayers.length * config.leagueFee + rollover;
  const leaguePrizes = [leagueFund * 0.5, leagueFund * 0.3, leagueFund * 0.2];

  const rows = participants
    .map((p) => {
      const s = stats[p.name];
      const earned = s.groupEarned + s.koEarned;
      return { ...s, earned, netSoFar: earned - s.playedFees, entry: entryFor(p, config) };
    })
    .sort((a, b) => b.earned - a.earned || a.name.localeCompare(b.name));

  const leagueRanked = rows.filter((r) => r.type === "full");
  leagueRanked.forEach((r, i) => {
    r.leagueRank = i + 1;
    if (config.leagueFinalized && i < 3) r.leagueReturn = leaguePrizes[i];
  });
  rows.forEach((r, i) => {
    r.rank = i + 1;
    r.finalReturn = r.earned + r.leagueReturn;
  });

  const totalCollection = participants
    .filter((p) => payments?.[p.name]?.entryPaid)
    .reduce((a, p) => a + entryFor(p, config), 0);
  const distributed = rows.reduce((a, r) => a + r.earned, 0);

  return {
    rows, rollover, leagueFund, leaguePrizes,
    counts: { all: participants.length, group: groupPlayers.length, ko: koPlayers.length, league: leaguePlayers.length },
    groupPot: groupPlayers.length * config.groupFee,
    koPot: koPlayers.length * config.knockoutFee,
    totalCollection, distributed, playedCount,
    paidIn: participants.filter((p) => payments?.[p.name]?.entryPaid).length,
    paidOut: participants.filter((p) => payments?.[p.name]?.payoutDone).length,
  };
}

/* ---------- API helpers ---------- */
async function apiGet() {
  const r = await fetch("/api/pool", { cache: "no-store" });
  if (!r.ok) throw new Error("load failed");
  return (await r.json()).data;
}
async function apiPut(data, pin) {
  const r = await fetch("/api/pool", {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-admin-pin": pin },
    body: JSON.stringify(data),
  });
  if (r.status === 401) throw new Error("unauthorized");
  if (!r.ok) throw new Error("save failed");
}
async function apiVerify(pin) {
  const r = await fetch("/api/admin/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  return r.ok;
}
async function apiUserVerify(pin) {
  const r = await fetch("/api/user/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  return r.ok;
}

/* ============================================================ */
export default function WorldCupPool() {
  const [data, setData] = useState(null);
  const [phase, setPhase] = useState("locked"); // locked | loading | empty | main | error
  const [tab, setTab] = useState("standings");
  const [adminPin, setAdminPin] = useState(null); // held in memory only
  const isAdmin = adminPin !== null;
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");

  const loadPool = async () => {
    setPhase("loading");
    try {
      const d = await apiGet();
      if (d) { setData(d); setPhase("main"); } else setPhase("empty");
    } catch { setPhase("error"); }
  };

  useEffect(() => {
    const stored = sessionStorage.getItem("wc26_pin") ?? "";
    apiUserVerify(stored)
      .then((ok) => {
        if (!ok) { if (stored) sessionStorage.removeItem("wc26_pin"); return; }
        loadPool();
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const save = async (next) => {
    const prev = data;
    setData(next);
    try { await apiPut(next, adminPin); }
    catch (e) {
      setData(prev);
      flash(e.message === "unauthorized" ? "Session invalid — unlock admin again" : "Couldn't save — try again");
      if (e.message === "unauthorized") setAdminPin(null);
    }
  };

  const refresh = async () => {
    try {
      const d = await apiGet();
      if (d) { setData(d); setPhase("main"); flash("Up to date"); }
    } catch { flash("Couldn't refresh"); }
  };

  const calc = useMemo(() => (data ? compute(data) : null), [data]);

  if (phase === "locked")
    return (
      <Shell>
        <UserPinGate onUnlock={(pin) => {
          sessionStorage.setItem("wc26_pin", pin);
          loadPool();
        }} />
      </Shell>
    );

  if (phase === "loading")
    return <Shell><main><p style={{ color: "var(--chalk-dim)" }}>Loading the pool…</p></main></Shell>;

  if (phase === "error")
    return <Shell><main>
      <p style={{ color: "var(--loss)" }}>Couldn't reach the database. Check the Upstash env vars on Vercel, then reload.</p>
    </main></Shell>;

  if (phase === "empty")
    return <Shell>
      {toast && <div className="toast" role="status">{toast}</div>}
      {!isAdmin ? (
        <main>
          <div className="eyebrow" style={{ marginTop: 8 }}>USA · Canada · Mexico</div>
          <h1 className="disp">World Cup 2026 Pool</h1>
          <p style={{ color: "var(--chalk-dim)", margin: "12px 0 16px" }}>
            The pool hasn't been set up yet. If you're the admin, unlock to create it.
          </p>
          <button className="btn primary" onClick={() => setModal({ type: "pin" })}>I'm the admin — set up</button>
          {modal?.type === "pin" && (
            <PinModal onClose={() => setModal(null)}
              onOk={(pin) => { setAdminPin(pin); setModal(null); }} />
          )}
        </main>
      ) : (
        <SetupWizard onDone={async (d) => {
          try { await apiPut(d, adminPin); setData(d); setPhase("main"); flash("Pool created"); }
          catch { flash("Couldn't save — check env vars"); }
        }} />
      )}
    </Shell>;

  const { config } = data;

  return (
    <Shell>
      {toast && <div className="toast" role="status">{toast}</div>}

      <header className="top">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div>
            <div className="eyebrow">USA · Canada · Mexico — 104 matches</div>
            <h1 className="disp">{config.poolName}</h1>
          </div>
          <div style={{ display: "flex", gap: 6, paddingTop: 4 }}>
            <button className="btn sm" onClick={refresh} title="Pull latest results">↻</button>
            {isAdmin ? (
              <button className="btn sm" onClick={() => { setAdminPin(null); flash("Back to view-only"); }}>Exit admin</button>
            ) : (
              <button className="btn sm" onClick={() => setModal({ type: "pin" })}>Admin</button>
            )}
          </div>
        </div>
        <nav className="tabs" aria-label="Sections">
          {[["standings", "Standings"], ["matches", "Matches"], ["money", "Money"], ["rules", "Rules"], ...(isAdmin ? [["fixtures", "Fixtures"]] : [])].map(([k, label]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label}</button>
          ))}
        </nav>
      </header>

      <main>
        {tab === "standings" && <Standings calc={calc} config={config} />}
        {tab === "matches" && (
          <Matches data={data} calc={calc} isAdmin={isAdmin}
            onEdit={(m) => setModal({ type: "match", payload: m })}
            onSavePredictions={(ptfId, preds) => save({ ...data, ptfPredictions: { ...(data.ptfPredictions || {}), [ptfId]: preds } })}
            onBatchSavePredictions={(predsMap) => save({ ...data, ptfPredictions: { ...(data.ptfPredictions || {}), ...predsMap } })} />
        )}
        {tab === "money" && (
          <Money data={data} calc={calc} isAdmin={isAdmin}
            onTogglePay={(name, field) => {
              const payments = { ...(data.payments || {}) };
              payments[name] = { ...(payments[name] || {}), [field]: !payments[name]?.[field] };
              save({ ...data, payments });
            }} />
        )}
        {tab === "rules" && <RulesView config={config} calc={calc} />}
        {tab === "fixtures" && isAdmin && (
          <FixturesTab data={data}
            onAdd={() => setModal({ type: "fixture", payload: null })}
            onEdit={(f) => setModal({ type: "fixture", payload: f })}
            onImport={() => {
              const existing = new Set(data.matches.map((m) => m.stage + ":" + m.num));
              const fresh = makeGroupStageMatches().filter((m) => !existing.has(m.stage + ":" + m.num));
              if (!fresh.length) { flash("All 72 group fixtures already imported"); return; }
              save({ ...data, matches: [...data.matches, ...fresh] });
              flash(`${fresh.length} fixtures imported`);
            }}
          />
        )}
      </main>

      {isAdmin && (
        <div className="adminbar">
          <button className="btn primary" onClick={() => setModal({ type: "match", payload: null })}>+ Match result</button>
          <button className="btn" onClick={() => setModal({ type: "participants" })}>Participants</button>
          <button className="btn" onClick={() => setModal({ type: "settings" })}>Settings</button>
        </div>
      )}

      {modal?.type === "pin" && (
        <PinModal onClose={() => setModal(null)}
          onOk={(pin) => { setAdminPin(pin); setModal(null); flash("Admin mode on"); }} />
      )}
      {modal?.type === "match" && (
        <MatchEditor data={data} match={modal.payload}
          onClose={() => setModal(null)}
          onSave={(m, del) => {
            let matches = [...data.matches];
            if (del) matches = matches.filter((x) => x.id !== m.id);
            else {
              const i = matches.findIndex((x) => x.id === m.id);
              if (i >= 0) matches[i] = m; else matches.push(m);
            }
            save({ ...data, matches });
            setModal(null);
            flash(del ? "Match removed" : "Match saved — balances updated");
          }}
          onSavePredictions={(ptfId, preds) => {
            save({ ...data, ptfPredictions: { ...(data.ptfPredictions || {}), [String(ptfId)]: preds } });
          }} />
      )}
      {modal?.type === "fixture" && (
        <FixtureEditor data={data} fixture={modal.payload}
          onClose={() => setModal(null)}
          onSave={(f, del) => {
            let matches = [...data.matches];
            if (del) matches = matches.filter((x) => x.id !== f.id);
            else {
              const i = matches.findIndex((x) => x.id === f.id);
              if (i >= 0) matches[i] = f; else matches.push(f);
            }
            save({ ...data, matches });
            setModal(null);
            flash(del ? "Fixture removed" : "Fixture saved");
          }} />
      )}
      {modal?.type === "settings" && (
        <SettingsModal data={data} adminPin={adminPin}
          onClose={() => setModal(null)}
          onSave={(next) => { save(next); setModal(null); flash("Settings saved"); }} />
      )}
      {modal?.type === "participants" && (
        <ParticipantsModal data={data} config={config}
          onClose={() => setModal(null)}
          onSave={(participants, payments) => {
            save({ ...data, participants, payments });
            flash("Participants updated");
          }} />
      )}
    </Shell>
  );
}

const Shell = ({ children }) => (
  <div className="wcp">
    <style dangerouslySetInnerHTML={{ __html: css }} />
    {children}
  </div>
);

/* ---------- Standings ---------- */
function Standings({ calc, config }) {
  const [sortKey, setSortKey] = useState("rank");
  const [sortDir, setSortDir] = useState("asc");

  const handleSort = (key, defaultDir = "desc") => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(defaultDir); }
  };

  const SortTh = ({ label, k, defaultDir = "desc", className }) => {
    const active = sortKey === k;
    return (
      <th className={className} onClick={() => handleSort(k, defaultDir)}
        style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
        {label}
        <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3, fontSize: 10 }}>
          {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </th>
    );
  };

  if (!calc.rows.length)
    return <p style={{ color: "var(--chalk-dim)" }}>No participants yet. The admin adds them from the admin bar.</p>;

  const sorted = [...calc.rows].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortKey === "name") return mul * a.name.localeCompare(b.name);
    const va = a[sortKey] ?? 0, vb = b[sortKey] ?? 0;
    return mul * (va - vb);
  });

  const medals = ["🥇", "🥈", "🥉"];
  return (
    <>
      <div className="grid3" style={{ marginBottom: 14 }}>
        <div className="card stat"><div className="k">Matches settled</div><div className="v mono">{calc.playedCount}</div></div>
        <div className="card stat"><div className="k">League fund {calc.rollover > 0 ? "(incl. rollovers)" : ""}</div><div className="v mono" style={{ color: "var(--gold)" }}>{rs0(calc.leagueFund)}</div></div>
        <div className="card stat"><div className="k">Prize money paid out</div><div className="v mono">{rs0(calc.distributed)}</div></div>
      </div>
      <p style={{ fontSize: 12, color: "var(--chalk-dim)", marginBottom: 10 }}>
        {calc.counts.group} in group stage (pot {rs0(calc.groupPot)}/match) · {calc.counts.ko} in knockouts (pot {rs0(calc.koPot)}/match) · {calc.counts.league} full members in the league race.
        {!config.leagueFinalized && <> League prizes ({rs0(calc.leaguePrizes[0])} / {rs0(calc.leaguePrizes[1])} / {rs0(calc.leaguePrizes[2])}) lock in after the final.</>}
      </p>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table>
          <thead><tr>
            <SortTh label="#" k="rank" defaultDir="asc" />
            <SortTh label="Participant" k="name" defaultDir="asc" />
            <th>Type</th>
            <SortTh label="Wins" k="wins" className="num" />
            <SortTh label="Group" k="groupEarned" className="num" />
            <SortTh label="Knockout" k="koEarned" className="num" />
            <SortTh label="League" k="leagueReturn" className="num" />
            <SortTh label="Total return" k="finalReturn" className="num" />
            <SortTh label="Net so far" k="netSoFar" className="num" />
          </tr></thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.name}>
                <td className="mono">{r.leagueRank && r.leagueRank <= 3 ? <span className="medal">{medals[r.leagueRank - 1]}</span> : r.rank}</td>
                <td style={{ fontWeight: 600 }}>{r.name}</td>
                <td><span className="chip">{TYPES[r.type].short}</span></td>
                <td className="num">{r.wins}</td>
                <td className="num">{inGroup(r) ? rs(r.groupEarned) : "—"}</td>
                <td className="num">{inKO(r) ? rs(r.koEarned) : "—"}</td>
                <td className="num">{r.type !== "full" ? "n/a" : config.leagueFinalized && r.leagueReturn ? rs(r.leagueReturn) : "—"}</td>
                <td className="num" style={{ fontWeight: 700 }}>{rs(r.finalReturn)}</td>
                <td className={"num " + (r.netSoFar >= 0 ? "pos" : "neg")}>{r.netSoFar >= 0 ? "+" : ""}{rs(r.netSoFar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Live score indicator — just the score badge, no predictions logic.
function LiveScoreStrip({ liveData }) {
  if (!liveData) return null;
  return (
    <div style={{ padding: "6px 12px", borderTop: "1px dashed var(--line)", display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--grass)" }}>
        ⚡ Live
      </span>
      {liveData.homeScore !== null && !isNaN(liveData.homeScore) && (
        <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
          {liveData.homeScore} – {liveData.awayScore}
        </span>
      )}
    </div>
  );
}

function MatchCard({ match, liveData, cachedPredictions, onSavePredictions, isAdmin, onEdit }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const cached = cachedPredictions?.[String(match.ptfFixtureId)];

  const fetchAndSave = async () => {
    if (loading) return;
    setLoading(true); setErr("");
    try {
      let fixtureId = match.ptfFixtureId ? String(match.ptfFixtureId) : null;

      // Auto-resolve fixture ID by team name if not set
      if (!fixtureId) {
        const fr = await fetch("/api/ptf/fixtures");
        if (fr.ok) {
          const { fixtures } = await fr.json();
          const found = findPtfFixture(fixtures || [], match.home, match.away);
          if (found) fixtureId = found.id;
        }
        if (!fixtureId) { setErr("Could not find PTF fixture for this match"); return; }
      }

      const r = await fetch(`/api/ptf/predictions?fixtureid=${encodeURIComponent(fixtureId)}`);
      const j = await r.json();
      if (!r.ok) { setErr(j.error || "Failed"); return; }
      onSavePredictions(String(fixtureId), { ...j, fetchedAt: new Date().toISOString() });
    } catch { setErr("Network error"); }
    finally { setLoading(false); }
  };

  const scoreH = liveData?.homeScore ?? (match.played ? match.scoreHome : null);
  const scoreA = liveData?.awayScore ?? (match.played ? match.scoreAway : null);

  const winners = useMemo(() => {
    if (!cached?.predictions?.length || scoreH == null || scoreA == null) return null;
    const h = parseInt(scoreH, 10), a = parseInt(scoreA, 10);
    if (isNaN(h) || isNaN(a)) return null;
    return computeWinners(cached.predictions, h, a);
  }, [cached, scoreH, scoreA]);

  const showFooter = cached || err;

  return (
    <article className="match">
      <div className="head">
        <span className="chip">M{match.num}{match.group ? " · Grp " + match.group : ""}</span>
        <span className="teams">{match.home} <span style={{ color: "var(--chalk-dim)" }}>vs</span> {match.away}</span>
        {match.played ? <span className="score">{match.scoreHome} – {match.scoreAway}</span> : <span className="chip">{match.date || "Upcoming"}</span>}
        {isAdmin && <button className="btn sm" onClick={() => onEdit(match)}>{match.played ? "Edit" : "Enter result"}</button>}
        {isAdmin && match.home && match.away && match.home !== "TBD" && match.away !== "TBD" && (
          <button className="btn sm" onClick={fetchAndSave} disabled={loading}>
            {loading ? "Fetching…" : "Fetch PTF"}
          </button>
        )}
      </div>
      {match.played && (
        <div className="body">
          <span className="chip gold" title={RULE_HELP[match.rule]}>{match.rule}</span>
          {match._rollover ? (
            <span className="chip">Pot {rs0(match._pot)} → league fund</span>
          ) : (
            <>
              <span className="chip green">{match.winners.length} winner{match.winners.length > 1 ? "s" : ""} · {rs(match._share)} each</span>
              {match.winners.map((w) => <span className="winner-tag" key={w}>{w}</span>)}
            </>
          )}
        </div>
      )}
      <LiveScoreStrip liveData={liveData} />
      {showFooter && (
        <div style={{ padding: "6px 12px", borderTop: "1px dashed var(--line)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {cached?.fetchedAt && (
            <span style={{ fontSize: 11, color: "var(--chalk-dim)" }}>{timeAgo(cached.fetchedAt)}</span>
          )}
          {err && <span style={{ fontSize: 11, color: "var(--loss)" }}>{err}</span>}
          {winners ? (
            <span className={"chip " + (winners.rule === 4 ? "" : "gold")}>
              Rule {winners.rule}{winners.rule === 4 ? " — rollover" : winners.names.length ? ": " + winners.names.join(", ") : ""}
            </span>
          ) : cached?.predictions?.length > 0 && scoreH == null && (
            <span style={{ fontSize: 11, color: "var(--chalk-dim)" }}>{cached.predictions.length} predictions — waiting for score</span>
          )}
        </div>
      )}
    </article>
  );
}

const SS_LIVE_KEY = "wc26_live_map";
const SS_LIVE_TS_KEY = "wc26_live_ts";

/* ---------- Matches ---------- */
function Matches({ data, calc, isAdmin, onEdit, onSavePredictions, onBatchSavePredictions }) {
  const [liveMap, setLiveMap] = useState(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(SS_LIVE_KEY) || "{}");
      // Old format was keyed by wc26 game ID (small integers like "1","2").
      // New format is keyed by pool match id (strings like "match_abc").
      // If the stored keys look like small integers, discard the stale cache.
      const keys = Object.keys(stored);
      if (keys.length && keys.every(k => /^\d+$/.test(k))) {
        sessionStorage.removeItem(SS_LIVE_KEY);
        sessionStorage.removeItem(SS_LIVE_TS_KEY);
        return {};
      }
      return stored;
    }
    catch { return {}; }
  });
  const [lastFetchedAt, setLastFetchedAt] = useState(() => {
    try { return parseInt(sessionStorage.getItem(SS_LIVE_TS_KEY) || "0", 10); }
    catch { return 0; }
  });
  const [liveLoading, setLiveLoading] = useState(false);

  const secondsSince = Math.floor((Date.now() - lastFetchedAt) / 1000);
  const cooldownLeft = Math.max(0, 60 - secondsSince);

  const fetchLive = async () => {
    if (cooldownLeft > 0 || liveLoading) return;
    setLiveLoading(true);
    try {
      // Fetch live scores + PTF fixture map in parallel
      const [liveRes, fixturesRes] = await Promise.all([
        fetch("/api/wc26/games"),
        fetch("/api/ptf/fixtures"),
      ]);
      if (!liveRes.ok) return;

      const { live } = await liveRes.json();
      const { fixtures: ptfFixtures } = fixturesRes.ok ? await fixturesRes.json() : { fixtures: [] };

      // Match each live game to a pool match and PTF fixture by team name
      const newMap = {};
      const liveMatchPtfIds = [];

      for (const g of (live || [])) {
        const poolMatch = data.matches.find(
          (m) => teamsMatch(m.home, g.homeTeam) && teamsMatch(m.away, g.awayTeam)
        );
        if (!poolMatch) continue;
        newMap[String(poolMatch.id)] = g;

        // Resolve PTF fixture ID: saved on match or auto-detect from fixture map
        let ptfId = poolMatch.ptfFixtureId ? String(poolMatch.ptfFixtureId) : null;
        if (!ptfId && ptfFixtures?.length) {
          const found = findPtfFixture(ptfFixtures, poolMatch.home, poolMatch.away);
          if (found) ptfId = found.id;
        }
        if (ptfId) liveMatchPtfIds.push(ptfId);
      }

      setLiveMap(newMap);
      const ts = Date.now();
      setLastFetchedAt(ts);
      try {
        sessionStorage.setItem(SS_LIVE_KEY, JSON.stringify(newMap));
        sessionStorage.setItem(SS_LIVE_TS_KEY, String(ts));
      } catch {}

      // Auto-fetch PTF predictions for live matches not cached in the last 5 minutes.
      // Only when admin is logged in — non-admins can't write to the pool.
      if (isAdmin && liveMatchPtfIds.length) {
        const stale = liveMatchPtfIds.filter((id) => {
          const cached = data.ptfPredictions?.[id];
          return !cached?.fetchedAt || Date.now() - new Date(cached.fetchedAt).getTime() > 5 * 60 * 1000;
        });

        if (stale.length) {
          const results = await Promise.all(
            stale.map(async (ptfId) => {
              try {
                const r = await fetch(`/api/ptf/predictions?fixtureid=${encodeURIComponent(ptfId)}`);
                if (!r.ok) return null;
                const j = await r.json();
                return [ptfId, { ...j, fetchedAt: new Date().toISOString() }];
              } catch { return null; }
            })
          );
          const batch = Object.fromEntries(results.filter(Boolean));
          if (Object.keys(batch).length) onBatchSavePredictions(batch);
        }
      }
    } catch { /* silent */ }
    finally { setLiveLoading(false); }
  };

  // Tick every second while in cooldown so the countdown label updates live.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [cooldownLeft > 0]);

  useEffect(() => { fetchLive(); }, []);

  const groups = { group: [], knockout: [] };
  [...data.matches].sort((a, b) => a.num - b.num).forEach((m) => groups[m.stage]?.push(m));
  const Section = ({ title, list, fee, pot }) => (
    <section style={{ marginBottom: 22 }}>
      <h2 className="disp" style={{ fontSize: 16, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px", color: "var(--chalk-dim)" }}>
        {title} <span className="mono" style={{ fontSize: 12 }}>· Rs {fee}/entry · pot {rs0(pot)}</span>
      </h2>
      {list.length === 0 && <p style={{ fontSize: 13, color: "var(--chalk-dim)" }}>No results entered yet.</p>}
      {list.map((m) => (
        <MatchCard key={m.id} match={m} liveData={liveMap[String(m.id)]}
          cachedPredictions={data.ptfPredictions} onSavePredictions={onSavePredictions}
          isAdmin={isAdmin} onEdit={onEdit} />
      ))}
    </section>
  );
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button className="btn sm" onClick={fetchLive} disabled={liveLoading || cooldownLeft > 0}>
          {liveLoading ? "Refreshing…" : cooldownLeft > 0 ? `Refresh in ${cooldownLeft}s` : "⚡ Refresh live scores"}
        </button>
      </div>
      <Section title="Group stage" list={groups.group} fee={data.config.groupFee} pot={calc.groupPot} />
      <Section title="Knockout stage" list={groups.knockout} fee={data.config.knockoutFee} pot={calc.koPot} />
    </>
  );
}

/* ---------- Fixtures (admin) ---------- */
function FixturesTab({ data, onAdd, onEdit, onImport }) {
  const fixtures = [...data.matches].filter((x) => !x.played).sort((a, b) => a.num - b.num);
  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <button className="btn primary" onClick={onAdd}>+ Add fixture</button>
        <button className="btn" onClick={onImport}>Import 72 group fixtures</button>
      </div>
      {fixtures.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--chalk-dim)" }}>No upcoming fixtures. Add them individually or import the group stage above.</p>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table>
            <thead><tr>
              <th>#</th><th>Stage</th><th>Grp</th><th>Date</th><th>Home</th><th>Away</th><th></th>
            </tr></thead>
            <tbody>
              {fixtures.map((f) => (
                <tr key={f.id}>
                  <td className="mono">{f.num}</td>
                  <td><span className="chip">{f.stage === "group" ? "Grp" : "KO"}</span></td>
                  <td style={{ color: "var(--chalk-dim)" }}>{f.group || "—"}</td>
                  <td style={{ fontSize: 12, color: "var(--chalk-dim)" }}>{f.date || "—"}</td>
                  <td style={{ fontWeight: 600 }}>{f.home}</td>
                  <td style={{ fontWeight: 600 }}>{f.away}</td>
                  <td><button className="btn sm" onClick={() => onEdit(f)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function FixtureEditor({ data, fixture, onClose, onSave }) {
  const isNew = !fixture;
  const nextNum = data.matches.length ? Math.max(...data.matches.map((m) => m.num)) + 1 : 1;
  const [f, setF] = useState(fixture || {
    id: "fx" + Date.now(), num: nextNum, stage: "group",
    group: "", date: "", home: "", away: "",
    played: false, scoreHome: "", scoreAway: "", rule: "Rule 1", winners: [],
  });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const valid = f.home.trim() && f.away.trim();
  return (
    <Modal title={isNew ? "Add fixture" : `Edit M${f.num}`} onClose={onClose}>
      <div className="grid2">
        <div><label className="f">Match #</label>
          <input type="number" value={f.num} onChange={(e) => set("num", +e.target.value || 0)} /></div>
        <div><label className="f">Stage</label>
          <select value={f.stage} onChange={(e) => set("stage", e.target.value)}>
            <option value="group">Group</option>
            <option value="knockout">Knockout</option>
          </select></div>
      </div>
      <div className="grid2">
        <div><label className="f">Group</label>
          <input value={f.group} onChange={(e) => set("group", e.target.value)} placeholder="A – L" /></div>
        <div><label className="f">Date</label>
          <input value={f.date} onChange={(e) => set("date", e.target.value)} placeholder="Jun 11, 2026" /></div>
      </div>
      <div className="grid2">
        <div><label className="f">Home team</label>
          <input value={f.home} onChange={(e) => set("home", e.target.value)} placeholder="e.g. Brazil" /></div>
        <div><label className="f">Away team</label>
          <input value={f.away} onChange={(e) => set("away", e.target.value)} placeholder="e.g. Japan" /></div>
      </div>
      <div><label className="f">PTF Fixture ID <span style={{ color: "var(--chalk-dim)", textTransform: "none", letterSpacing: 0 }}>(optional — from predictthefootball.com)</span></label>
        <input type="number" min="1" value={f.ptfFixtureId ?? ""} placeholder="e.g. 5"
          onChange={(e) => set("ptfFixtureId", e.target.value ? +e.target.value : undefined)} /></div>
      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <button className="btn primary" disabled={!valid} style={!valid ? { opacity: 0.5 } : {}}
          onClick={() => onSave(f, false)}>Save fixture</button>
        {!isNew && <button className="btn danger" onClick={() => onSave(f, true)}>Delete fixture</button>}
      </div>
    </Modal>
  );
}

/* ---------- Money ---------- */
function Money({ data, calc, isAdmin, onTogglePay }) {
  return (
    <>
      <div className="grid2" style={{ marginBottom: 14 }}>
        <div className="card stat"><div className="k">Total collection</div><div className="v mono" style={{ color: "var(--gold)" }}>{rs0(calc.totalCollection)}</div></div>
        <div className="card stat"><div className="k">League fund</div><div className="v mono">{rs0(calc.leagueFund)}</div></div>
        <div className="card stat"><div className="k">Entries paid</div><div className="v mono">{calc.paidIn} / {calc.counts.all}</div></div>
        <div className="card stat"><div className="k">Payouts done</div><div className="v mono">{calc.paidOut} / {calc.counts.all}</div></div>
      </div>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table>
          <thead><tr>
            <th>Participant</th><th>Type</th><th className="num">Entry due</th><th className="num">Total return</th>
            <th>Entry paid</th><th>Payout done</th>
          </tr></thead>
          <tbody>
            {calc.rows.map((r) => {
              const pay = data.payments?.[r.name] || {};
              const Cell = ({ field, on }) =>
                isAdmin ? (
                  <button className="btn sm" style={on ? { borderColor: "var(--grass)", color: "var(--grass)" } : {}}
                    onClick={() => onTogglePay(r.name, field)}>{on ? "✓ Yes" : "Mark"}</button>
                ) : (
                  <span className={"chip " + (on ? "green" : "")}>{on ? "✓" : "—"}</span>
                );
              return (
                <tr key={r.name}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td><span className="chip">{TYPES[r.type].short}</span></td>
                  <td className="num">{rs0(r.entry)}</td>
                  <td className="num">{rs(r.finalReturn)}</td>
                  <td><Cell field="entryPaid" on={!!pay.entryPaid} /></td>
                  <td><Cell field="payoutDone" on={!!pay.payoutDone} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------- Rules ---------- */
function RulesView({ config, calc }) {
  return (
    <>
      <div className="rulecard"><b>Rule 1 — Exact score.</b> Everyone who predicted the exact final score splits the match pot equally.</div>
      <div className="rulecard"><b>Rule 2 — Goal difference.</b> No exact score? Correct goal difference in favor of the winning team wins. For a draw, anyone who predicted a draw wins.</div>
      <div className="rulecard"><b>Rule 3 — Right team.</b> No score or GD match? Everyone who picked the winning team shares the pot.</div>
      <div className="rulecard"><b>Rule 4 — Unclaimed draw.</b> If the match is a draw and nobody predicted a draw, the pot rolls over into the league fund for the top three.</div>
      <div className="rulecard"><b>Enrollment.</b> Full members play everything and compete for the league. Group-only and Knockout-only members pay for and play their stage only. Match pots: {calc.counts.group}×{config.groupFee} = {rs0(calc.groupPot)} (group), {calc.counts.ko}×{config.knockoutFee} = {rs0(calc.koPot)} (knockout).</div>
      <div className="rulecard"><b>Knockouts.</b> Score after 120 minutes counts as the final result.</div>
      <div className="rulecard"><b>League.</b> The league fund ({rs0(calc.leagueFund)} incl. rollovers) is split 50 / 30 / 20 between the top three Full members by total winnings after the final.</div>
      <div className="rulecard">You're responsible for your own predictions in the prediction app. Forget one, and you just made someone richer 😄</div>
    </>
  );
}

/* ---------- Modals ---------- */
function Modal({ title, onClose, children }) {
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-label={title}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <h2 className="disp" style={{ fontSize: 17, textTransform: "uppercase" }}>{title}</h2>
          <button className="btn sm" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function UserPinGate({ onUnlock }) {
  const [v, setV] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!v || busy) return;
    setBusy(true);
    const ok = await apiUserVerify(v).catch(() => false);
    setBusy(false);
    if (ok) onUnlock(v); else setErr(true);
  };
  return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div className="card" style={{ width: "100%", maxWidth: 360 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>USA · Canada · Mexico</div>
        <h1 className="disp" style={{ fontSize: 22, marginBottom: 16 }}>World Cup 2026 Pool</h1>
        <label className="f">Access PIN</label>
        <input type="password" value={v} autoFocus
          onChange={(e) => { setV(e.target.value); setErr(false); }}
          onKeyDown={(e) => e.key === "Enter" && submit()} />
        {err && <p style={{ color: "var(--loss)", fontSize: 13, marginTop: 6 }}>Wrong PIN.</p>}
        <div style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={submit} disabled={busy}>{busy ? "Checking…" : "Enter pool"}</button>
        </div>
      </div>
    </main>
  );
}

function PinModal({ onOk, onClose }) {
  const [v, setV] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!v || busy) return;
    setBusy(true);
    const ok = await apiVerify(v).catch(() => false);
    setBusy(false);
    if (ok) onOk(v); else setErr(true);
  };
  return (
    <Modal title="Admin access" onClose={onClose}>
      <label className="f">Admin PIN</label>
      <input type="password" value={v} autoFocus
        onChange={(e) => { setV(e.target.value); setErr(false); }}
        onKeyDown={(e) => e.key === "Enter" && submit()} />
      {err && <p style={{ color: "var(--loss)", fontSize: 13, marginTop: 6 }}>Wrong PIN.</p>}
      <div style={{ marginTop: 14 }}>
        <button className="btn primary" onClick={submit} disabled={busy}>{busy ? "Checking…" : "Unlock"}</button>
      </div>
    </Modal>
  );
}

function MatchEditor({ data, match, onClose, onSave, onSavePredictions }) {
  const isNew = !match;
  const [m, setM] = useState(match || {
    id: "", num: 0, stage: "group", group: "",
    home: "", away: "", played: true, scoreHome: "", scoreAway: "",
    rule: "Rule 1", winners: [],
  });
  const set = (k, v) => setM((x) => ({ ...x, [k]: v }));

  const unplayed = isNew
    ? [...data.matches].filter((x) => !x.played).sort((a, b) => a.num - b.num)
    : [];

  const pickFixture = (id) => {
    const f = data.matches.find((x) => x.id === id);
    if (!f) { setM((prev) => ({ ...prev, id: "", num: 0, home: "", away: "", group: "", stage: "group" })); return; }
    setM((prev) => ({ ...prev, id: f.id, num: f.num, stage: f.stage, home: f.home, away: f.away, group: f.group ?? "", ptfFixtureId: f.ptfFixtureId }));
  };

  const toggleWinner = (name) =>
    set("winners", m.winners.includes(name) ? m.winners.filter((x) => x !== name) : [...m.winners, name]);

  const eligible = data.participants.filter(m.stage === "group" ? inGroup : inKO);
  const cleanWinners = m.winners.filter((w) => eligible.some((p) => p.name === w));
  const pot = eligible.length * (m.stage === "group" ? data.config.groupFee : data.config.knockoutFee);
  const rollover = m.rule === "Rule 4" || cleanWinners.length === 0;
  const valid = isNew
    ? !!(m.id && m.scoreHome !== "" && m.scoreAway !== "")
    : true; // editing an existing match is always allowed

  const ResultFields = () => (
    <>
      <div className="grid2">
        <div><label className="f">Score — {m.home || "home"}</label>
          <input type="number" min="0" value={m.scoreHome} onChange={(e) => set("scoreHome", e.target.value)} /></div>
        <div><label className="f">Score — {m.away || "away"}</label>
          <input type="number" min="0" value={m.scoreAway} onChange={(e) => set("scoreAway", e.target.value)} /></div>
      </div>
      <label className="f">Rule decider</label>
      <select value={m.rule} onChange={(e) => set("rule", e.target.value)}>
        {RULES.map((r) => <option key={r} value={r}>{r} — {RULE_HELP[r]}</option>)}
      </select>
      {m.rule !== "Rule 4" && (
        <>
          <label className="f">Winners — only {m.stage === "group" ? "group-stage" : "knockout"} players listed ({eligible.length})</label>
          <div className="winnergrid">
            {eligible.map((p) => (
              <label key={p.name}>
                <input type="checkbox" checked={m.winners.includes(p.name)} onChange={() => toggleWinner(p.name)} />
                {p.name}
              </label>
            ))}
          </div>
        </>
      )}
      <p style={{ marginTop: 10, fontSize: 13, color: "var(--chalk-dim)" }}>
        Pot: <b className="mono" style={{ color: "var(--gold)" }}>{rs0(pot)}</b>
        {rollover
          ? " → rolls over to the league fund (no winners)"
          : <> ÷ {cleanWinners.length} = <b className="mono" style={{ color: "var(--grass)" }}>{rs(pot / cleanWinners.length)}</b> each</>}
      </p>
    </>
  );

  return (
    <Modal title={isNew ? "Add match result" : `Edit M${m.num} result`} onClose={onClose}>
      {isNew ? (
        <>
          {unplayed.length === 0 ? (
            <p style={{ color: "var(--chalk-dim)", fontSize: 13, margin: "6px 0 12px" }}>
              No upcoming fixtures — add them in the <b style={{ color: "var(--chalk)" }}>Fixtures</b> tab first.
            </p>
          ) : (
            <>
              <label className="f">Fixture</label>
              <select value={m.id} onChange={(e) => pickFixture(e.target.value)}>
                <option value="">— select an upcoming fixture —</option>
                {unplayed.map((f) => (
                  <option key={f.id} value={f.id}>
                    M{f.num} · {f.home} vs {f.away}{f.group ? ` · Grp ${f.group}` : ""}
                  </option>
                ))}
              </select>
              {m.id && (
                <>
                  <p style={{ margin: "10px 0 2px", fontWeight: 700, fontStretch: "85%", fontSize: 15 }}>
                    {m.home} <span style={{ color: "var(--chalk-dim)", fontWeight: 400 }}>vs</span> {m.away}
                    {m.group ? <span className="chip" style={{ marginLeft: 8 }}>Grp {m.group}</span> : null}
                  </p>
                  <PtfPredictionsPanel fixture={m} eligible={eligible}
                    cachedPredictions={data.ptfPredictions}
                    onApplyWinners={(names) => set("winners", names)}
                    onApplyRule={(rule) => set("rule", rule)}
                    onApplyScore={(h, a) => { set("scoreHome", String(h)); set("scoreAway", String(a)); }}
                    onSavePredictions={onSavePredictions} />
                  <ResultFields />
                </>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div className="grid2">
            <div><label className="f">Match #</label>
              <input type="number" value={m.num} onChange={(e) => set("num", +e.target.value || 0)} /></div>
            <div><label className="f">Stage</label>
              <select value={m.stage} onChange={(e) => set("stage", e.target.value)}>
                <option value="group">Group (Rs {data.config.groupFee})</option>
                <option value="knockout">Knockout (Rs {data.config.knockoutFee})</option>
              </select></div>
          </div>
          <div className="grid2">
            <div><label className="f">Home team</label><input value={m.home} onChange={(e) => set("home", e.target.value)} placeholder="e.g. Brazil" /></div>
            <div><label className="f">Away team</label><input value={m.away} onChange={(e) => set("away", e.target.value)} placeholder="e.g. Japan" /></div>
          </div>
          <label className="f" style={{ display: "flex", gap: 8, alignItems: "center", textTransform: "none", fontSize: 13, letterSpacing: 0 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={m.played} onChange={(e) => set("played", e.target.checked)} />
            Result is in (uncheck to revert to upcoming)
          </label>
          <PtfPredictionsPanel fixture={m} eligible={eligible}
            cachedPredictions={data.ptfPredictions}
            onApplyWinners={(names) => set("winners", names)}
            onApplyRule={(rule) => set("rule", rule)}
            onApplyScore={(h, a) => { set("scoreHome", String(h)); set("scoreAway", String(a)); }}
            onSavePredictions={onSavePredictions} />
          {m.played && <ResultFields />}
        </>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <button className="btn primary" disabled={!valid} style={!valid ? { opacity: 0.5 } : {}}
          onClick={() => onSave({ ...m, played: true, winners: cleanWinners }, false)}>
          {isNew ? "Save result" : "Verify result"}
        </button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

function parseParticipantsCsv(text) {
  const SKIP = new Set(["full name", "name", "fullname", "entry_type", "enrollment"]);
  return text
    .split(/\r?\n/)
    .map((l) => l.split(",").map((s) => s.trim()))
    .filter((cols) => cols[0] && !SKIP.has(cols[0].toLowerCase()))
    .map((cols) => {
      const name = cols[0];
      const raw = (cols[1] || "full").toLowerCase().replace(/[^a-z]/g, "");
      const type = raw === "knockout" || raw === "ko" ? "knockout" : raw === "group" ? "group" : "full";
      const paid = (cols[2] || "").toLowerCase().trim() === "paid";
      return { name, type, paid };
    });
}

/* ---------- Participants manager (admin) ---------- */
function ParticipantsModal({ data, config, onClose, onSave }) {
  const [list, setList] = useState(data.participants.map((p) => ({ ...p })));
  const [payments, setPayments] = useState({ ...(data.payments || {}) });
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("full");
  const [removing, setRemoving] = useState(null);
  const [importMsg, setImportMsg] = useState("");
  const csvRef = useRef(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const hasWins = (name) =>
    data.matches.some((m) => (m.winners || []).includes(name));

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    if (list.some((p) => p.name.toLowerCase() === name.toLowerCase())) return;
    setList([...list, { name, type: newType }]);
    setNewName("");
  };

  const togglePaid = (name) =>
    setPayments((p) => ({ ...p, [name]: { ...(p[name] || {}), entryPaid: !p[name]?.entryPaid } }));

  const handleCsvImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseParticipantsCsv(ev.target.result);
      if (!rows.length) { setImportMsg("No valid rows found"); return; }
      let added = 0, updated = 0;
      const nextList = [...list];
      const nextPay = { ...payments };
      rows.forEach(({ name, type, paid }) => {
        const i = nextList.findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
        if (i >= 0) { nextList[i] = { ...nextList[i], type }; updated++; }
        else { nextList.push({ name, type }); added++; }
        nextPay[name] = { ...(nextPay[name] || {}), entryPaid: paid };
      });
      setList(nextList);
      setPayments(nextPay);
      setImportMsg(`${added} added, ${updated} updated`);
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  return (
    <Modal title="Participants" onClose={onClose}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label className="f">Add participant</label>
          <input value={newName} placeholder="Name" onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()} />
        </div>
        <div>
          <label className="f">Enrollment</label>
          <select value={newType} onChange={(e) => setNewType(e.target.value)}>
            {Object.entries(TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
          </select>
        </div>
        <button className="btn primary" onClick={add}>Add</button>
        <button className="btn sm" onClick={() => csvRef.current?.click()}>Import CSV</button>
        <input ref={csvRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleCsvImport} />
      </div>
      <p style={{ fontSize: 11.5, color: "var(--chalk-dim)", marginTop: 6, lineHeight: 1.6 }}>
        CSV format: <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11 }}>Full Name, full|group|knockout, paid|unpaid</span>
        {" "}— one row per person. Header row is skipped. Existing names are updated, new ones are added.
      </p>
      {importMsg && (
        <p style={{ fontSize: 12, color: "var(--grass)", marginTop: 4 }}>{importMsg}</p>
      )}

      <div style={{ marginTop: 14, fontSize: 12, color: "var(--chalk-dim)" }}>
        {list.length} participants · {list.filter(inGroup).length} group · {list.filter(inKO).length} knockout · {list.filter(inLeague).length} league. Entry due updates with type.
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input value={search} placeholder="Search by name…"
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 140, padding: "7px 10px", fontSize: 13 }} />
        {[["name","Name"],["type","Type"],["entry","Entry"],["paid","Paid"]].map(([k, label]) => {
          const active = sortKey === k;
          return (
            <button key={k} className="btn sm"
              style={active ? { borderColor: "var(--gold)", color: "var(--gold)" } : {}}
              onClick={() => { if (active) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("asc"); } }}>
              {label}{active ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 6 }}>
        {list
          .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
          .sort((a, b) => {
            let va, vb;
            if (sortKey === "name")  { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
            else if (sortKey === "type")  { va = a.type; vb = b.type; }
            else if (sortKey === "entry") { va = entryFor(a, config); vb = entryFor(b, config); }
            else { va = payments[a.name]?.entryPaid ? 0 : 1; vb = payments[b.name]?.entryPaid ? 0 : 1; }
            if (va < vb) return sortDir === "asc" ? -1 : 1;
            if (va > vb) return sortDir === "asc" ? 1 : -1;
            return 0;
          })
          .map((p) => (
            <div className="prow" key={p.name}>
              <span className="pname">{p.name}</span>
              <select value={p.type}
                onChange={(e) => setList(list.map((x) => x.name === p.name ? { ...x, type: e.target.value } : x))}>
                {Object.entries(TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
              </select>
              <span className="mono" style={{ fontSize: 12, color: "var(--chalk-dim)", minWidth: 72, textAlign: "right" }}>
                {rs0(entryFor(p, config))}
              </span>
              <button className="btn sm" style={payments[p.name]?.entryPaid ? { borderColor: "var(--grass)", color: "var(--grass)" } : {}}
                onClick={() => togglePaid(p.name)}>
                {payments[p.name]?.entryPaid ? "✓ Paid" : "Unpaid"}
              </button>
              {removing === p.name ? (
                <button className="btn sm danger" onClick={() => { setList(list.filter((x) => x.name !== p.name)); setRemoving(null); }}>
                  Confirm{hasWins(p.name) ? " (has wins!)" : ""}
                </button>
              ) : (
                <button className="btn sm danger" onClick={() => setRemoving(p.name)}>✕</button>
              )}
            </div>
          ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button className="btn primary" onClick={() => onSave(list, payments)}>Save changes</button>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--chalk-dim)", marginTop: 10 }}>
        Changing types changes match pots for every match in that stage. Removing someone with recorded wins will redistribute past prizes — avoid unless correcting a mistake.
      </p>
    </Modal>
  );
}

// Normalize a team name for fuzzy comparison (lowercase, letters/digits only)
function normTeam(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
// Returns true if two team names are likely the same (substring match after normalization)
function teamsMatch(a, b) {
  const na = normTeam(a), nb = normTeam(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}
// Find best-matching PTF fixture for a pool match by home/away team names
function findPtfFixture(fixtures, home, away) {
  return fixtures.find(f => teamsMatch(f.homeTeam, home) && teamsMatch(f.awayTeam, away)) ?? null;
}

function computeWinners(predictions, aH, aA) {
  const exactScore  = predictions.filter(p => p.predHome === aH && p.predAway === aA);
  const aGD         = aH - aA;
  const correctGD   = predictions.filter(p => (p.predHome - p.predAway) === aGD);
  const aResult     = Math.sign(aH - aA);
  const correctTeam = predictions.filter(p => Math.sign(p.predHome - p.predAway) === aResult);
  const isDraw      = aResult === 0;
  const anyPredDraw = predictions.some(p => p.predHome === p.predAway);
  if (exactScore.length)          return { rule: 1, names: exactScore.map(p => p.name) };
  if (correctGD.length)           return { rule: 2, names: correctGD.map(p => p.name) };
  if (correctTeam.length)         return { rule: 3, names: correctTeam.map(p => p.name) };
  if (isDraw && !anyPredDraw)     return { rule: 4, names: [] };
  return null;
}

function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

function PtfPredictionsPanel({ fixture, eligible, onApplyWinners, onApplyRule, onApplyScore, cachedPredictions, onSavePredictions }) {
  // ptfFixtureId is the confirmed ID; fixture.num is just a fallback guess
  const confirmedId = fixture.ptfFixtureId != null ? String(fixture.ptfFixtureId) : null;
  const initialId = confirmedId ?? (fixture.num ? String(fixture.num) : "");
  const [ptfId, setPtfId] = useState(initialId);
  const [autoDetected, setAutoDetected] = useState(null); // fixture ID found by team-name lookup
  const [result, setResult] = useState(() => (initialId && cachedPredictions?.[initialId]) || null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const initScore = (r) => ({ h: r?.actualHome != null ? String(r.actualHome) : "", a: r?.actualAway != null ? String(r.actualAway) : "" });
  const [liveH, setLiveH] = useState(() => initScore((initialId && cachedPredictions?.[initialId]) || null).h);
  const [liveA, setLiveA] = useState(() => initScore((initialId && cachedPredictions?.[initialId]) || null).a);

  const go = async () => {
    if (loading) return;
    setLoading(true); setErr(""); setResult(null); setLiveH(""); setLiveA("");
    try {
      let resolvedId = ptfId;

      // If no confirmed ID was set, or the user left it as the match-number default,
      // try to find the real fixture ID by matching team names
      if (!confirmedId && fixture.home && fixture.away) {
        const fr = await fetch("/api/ptf/fixtures");
        if (fr.ok) {
          const { fixtures } = await fr.json();
          const found = findPtfFixture(fixtures || [], fixture.home, fixture.away);
          if (found && found.id !== resolvedId) {
            resolvedId = found.id;
            setPtfId(found.id);
            setAutoDetected(found);
          }
        }
      }

      if (!resolvedId) { setErr("Enter a PTF fixture ID"); setLoading(false); return; }
      const r = await fetch(`/api/ptf/predictions?fixtureid=${encodeURIComponent(resolvedId)}`);
      const j = await r.json();
      if (!r.ok) { setErr(j.error || "Failed to fetch"); return; }
      const withTime = { ...j, fetchedAt: new Date().toISOString() };
      setResult(withTime);
      const s = initScore(withTime);
      setLiveH(s.h); setLiveA(s.a);
      onSavePredictions?.(resolvedId, withTime);

      // Auto-apply: compute winners from actual score (or suggestedWinners) and push to form
      const scoreH = j.actualHome != null ? j.actualHome : null;
      const scoreA = j.actualAway != null ? j.actualAway : null;
      const winners = (scoreH !== null && scoreA !== null && j.predictions?.length)
        ? computeWinners(j.predictions, scoreH, scoreA)
        : j.suggestedWinners ?? null;
      if (scoreH !== null && scoreA !== null && onApplyScore) onApplyScore(scoreH, scoreA);
      if (winners && onApplyRule) {
        onApplyRule("Rule " + winners.rule);
        if (winners.rule !== 4 && onApplyWinners) {
          const matched = eligible.filter((p) =>
            winners.names.some((n) =>
              n.toLowerCase().includes(p.name.toLowerCase()) ||
              p.name.toLowerCase().includes(n.toLowerCase())
            )
          ).map((p) => p.name);
          onApplyWinners(matched);
        }
      }
    } catch { setErr("Network error"); }
    finally { setLoading(false); }
  };

  const liveWinners = useMemo(() => {
    if (!result?.predictions?.length || liveH === "" || liveA === "") return null;
    const aH = parseInt(liveH, 10), aA = parseInt(liveA, 10);
    if (isNaN(aH) || isNaN(aA)) return null;
    return computeWinners(result.predictions, aH, aA);
  }, [result, liveH, liveA]);

  const activeWinners = liveWinners ?? result?.suggestedWinners ?? null;


  return (
    <div style={{ margin: "12px 0", padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: 8, border: "1px solid var(--line)" }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>PTF Predictions</div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <label className="f">PTF fixture ID</label>
          <input type="number" min="1" value={ptfId} placeholder="e.g. 5"
            onChange={(e) => { setPtfId(e.target.value); setResult(null); setErr(""); }}
            onKeyDown={(e) => e.key === "Enter" && go()} />
        </div>
        <button className="btn sm" onClick={go} disabled={loading}
          style={{ marginBottom: 1 }}>{loading ? "…" : result ? "Refresh" : "Fetch"}</button>
      </div>
      {autoDetected && (
        <p style={{ fontSize: 11, color: "var(--chalk-dim)", marginTop: 4 }}>
          Auto-detected: fixture #{autoDetected.id} · {autoDetected.homeTeam} vs {autoDetected.awayTeam}
        </p>
      )}
      {err && <p style={{ color: "var(--loss)", fontSize: 13, marginTop: 6 }}>{err}</p>}
      {result && (
        <div style={{ marginTop: 10 }}>
          {result.matchTitle && (
            <p style={{ fontSize: 13, marginBottom: 4 }}>
              <b>{result.matchTitle}</b>
              {result.actualScore && <span style={{ color: "var(--chalk-dim)" }}> · Final: {result.actualScore}</span>}
            </p>
          )}
          {result.fetchedAt && (
            <p style={{ fontSize: 11, color: "var(--chalk-dim)", marginBottom: 8 }}>
              Cached {timeAgo(result.fetchedAt)}
            </p>
          )}

          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--chalk-dim)" }}>Live score</span>
            <input type="number" min="0" value={liveH} placeholder="H"
              onChange={(e) => setLiveH(e.target.value)}
              style={{ width: 52, padding: "5px 8px", fontSize: 14, textAlign: "center" }} />
            <span style={{ color: "var(--chalk-dim)", fontWeight: 700 }}>–</span>
            <input type="number" min="0" value={liveA} placeholder="A"
              onChange={(e) => setLiveA(e.target.value)}
              style={{ width: 52, padding: "5px 8px", fontSize: 14, textAlign: "center" }} />
            {liveWinners && (
              <span className={"chip " + (liveWinners.rule === 4 ? "" : "gold")} style={{ marginLeft: 4 }}>
                Rule {liveWinners.rule}{liveWinners.rule === 4 ? " — rollover" : liveWinners.names.length ? ": " + liveWinners.names.join(", ") : ""}
              </span>
            )}
            {!liveWinners && result.suggestedWinners && (
              <span className={"chip " + (result.suggestedWinners.rule === 4 ? "" : "gold")} style={{ marginLeft: 4 }}>
                Rule {result.suggestedWinners.rule}{result.suggestedWinners.rule === 4 ? " — rollover" : result.suggestedWinners.names.length ? ": " + result.suggestedWinners.names.join(", ") : ""}
              </span>
            )}
          </div>

          <div style={{ maxHeight: 160, overflowY: "auto" }}>
            {result.predictions.map((p, i) => {
              const isWinner = activeWinners?.names?.includes(p.name);
              return (
                <div key={i} style={{ display: "flex", gap: 8, padding: "3px 0", borderBottom: "1px solid rgba(244,247,240,0.06)", fontSize: 13 }}>
                  <span style={{ flex: 1, color: isWinner ? "var(--gold)" : undefined }}>{p.name}</span>
                  <span className="mono" style={{ color: isWinner ? "var(--gold)" : "var(--chalk-dim)", fontSize: 12 }}>
                    {p.predHome}–{p.predAway}
                  </span>
                </div>
              );
            })}
          </div>
          {!result.predictions.length && (
            <p style={{ color: "var(--chalk-dim)", fontSize: 13 }}>No predictions found — check the fixture ID.</p>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsModal({ data, onClose, onSave, adminPin }) {
  const [c, setC] = useState({ ...data.config });
  const set = (k, v) => setC((x) => ({ ...x, [k]: v }));
  const [ptfEmail, setPtfUsername] = useState("");
  const [ptfPass, setPtfPass] = useState("");
  const [ptfStatus, setPtfStatus] = useState(""); // "" | "connecting" | "connected" | "error"
  const [ptfError, setPtfError] = useState("");
  const [ptfLoginAt, setPtfLoginAt] = useState(null);
  const [wc26Email, setWc26Email] = useState("");
  const [wc26Pass, setWc26Pass] = useState("");
  const [wc26Status, setWc26Status] = useState(""); // "" | "connecting" | "connected" | "error"
  const [wc26Error, setWc26Error] = useState("");

  useEffect(() => {
    fetch("/api/admin/ptf-credentials", { headers: { "x-admin-pin": adminPin } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) { setPtfUsername(d.username || ""); setPtfLoginAt(d.loginAt || null); } })
      .catch(() => {});
  }, [adminPin]);

  const connectPtf = async () => {
    setPtfStatus("connecting");
    setPtfError("");
    try {
      const r = await fetch("/api/ptf/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": adminPin },
        body: JSON.stringify({ username: ptfEmail, password: ptfPass }), // API still calls it username internally
      });
      if (r.ok) {
        setPtfStatus("connected");
        setPtfLoginAt(new Date().toISOString());
        setPtfPass("");
      } else {
        const d = await r.json().catch(() => ({}));
        setPtfError(d.error || "Login failed");
        setPtfStatus("error");
      }
    } catch { setPtfStatus("error"); setPtfError("Network error"); }
  };

  const connectWc26 = async () => {
    setWc26Status("connecting");
    setWc26Error("");
    try {
      const r = await fetch("/api/wc26/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": adminPin },
        body: JSON.stringify({ email: wc26Email, password: wc26Pass }),
      });
      if (r.ok) {
        setWc26Status("connected");
        setWc26Pass("");
      } else {
        const d = await r.json().catch(() => ({}));
        setWc26Error(d.error || "Connection failed");
        setWc26Status("error");
      }
    } catch { setWc26Status("error"); setWc26Error("Network error"); }
  };

  return (
    <Modal title="Pool settings" onClose={onClose}>
      <label className="f">Pool name</label>
      <input value={c.poolName} onChange={(e) => set("poolName", e.target.value)} />
      <div className="grid3">
        <div><label className="f">Group fee</label><input type="number" value={c.groupFee} onChange={(e) => set("groupFee", +e.target.value || 0)} /></div>
        <div><label className="f">KO fee</label><input type="number" value={c.knockoutFee} onChange={(e) => set("knockoutFee", +e.target.value || 0)} /></div>
        <div><label className="f">League fee</label><input type="number" value={c.leagueFee} onChange={(e) => set("leagueFee", +e.target.value || 0)} /></div>
      </div>
      <div className="grid2">
        <div><label className="f">Group matches</label><input type="number" value={c.groupMatchCount} onChange={(e) => set("groupMatchCount", +e.target.value || 0)} /></div>
        <div><label className="f">Knockout matches</label><input type="number" value={c.knockoutMatchCount} onChange={(e) => set("knockoutMatchCount", +e.target.value || 0)} /></div>
      </div>
      <label className="f" style={{ display: "flex", gap: 8, alignItems: "center", textTransform: "none", fontSize: 13, letterSpacing: 0 }}>
        <input type="checkbox" style={{ width: "auto" }} checked={c.leagueFinalized} onChange={(e) => set("leagueFinalized", e.target.checked)} />
        Finalize league — award 50/30/20 prizes to the top 3 Full members
      </label>
      <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>PTF Integration</div>
        <p style={{ fontSize: 11.5, color: "var(--chalk-dim)", marginBottom: 8, lineHeight: 1.5 }}>
          Enter your <b style={{ color: "var(--chalk)" }}>predict.football</b> credentials.
          Sessions are obtained and refreshed automatically — no cookie copying needed.
        </p>
        {ptfLoginAt && ptfStatus !== "connected" && (
          <p style={{ fontSize: 11.5, color: "var(--grass)", marginBottom: 8 }}>
            ✓ Last connected {new Date(ptfLoginAt).toLocaleString()}
          </p>
        )}
        <label className="f">Email</label>
        <input type="email" value={ptfEmail} onChange={(e) => setPtfUsername(e.target.value)} placeholder="your@email.com" autoComplete="email" />
        <label className="f">Password</label>
        <input type="password" value={ptfPass} onChange={(e) => setPtfPass(e.target.value)} placeholder="PTF password" autoComplete="current-password" />
        {ptfError && <p style={{ color: "#f87171", fontSize: 12, marginTop: 4 }}>{ptfError}</p>}
        <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn" disabled={ptfStatus === "connecting" || !ptfEmail || !ptfPass} onClick={connectPtf}>
            {ptfStatus === "connecting" ? "Connecting…" : ptfStatus === "connected" ? "✓ Connected" : "Connect PTF"}
          </button>
          {ptfStatus === "connected" && (
            <span style={{ fontSize: 12, color: "var(--chalk-dim)" }}>Session saved — predictions will auto-refresh on expiry</span>
          )}
        </div>
      </div>
      <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Live Scores (worldcup26.ir)</div>
        <p style={{ fontSize: 11.5, color: "var(--chalk-dim)", marginBottom: 8, lineHeight: 1.5 }}>
          Create a free account on <b style={{ color: "var(--chalk)" }}>worldcup26.ir</b> and connect here.
          The token is valid for ~84 days — reconnect when it expires.
        </p>
        <label className="f">Email</label>
        <input type="email" value={wc26Email} onChange={(e) => setWc26Email(e.target.value)} placeholder="your@email.com" />
        <label className="f">Password</label>
        <input type="password" value={wc26Pass} onChange={(e) => setWc26Pass(e.target.value)} placeholder="Password" />
        {wc26Error && <p style={{ color: "#f87171", fontSize: 12, marginTop: 4 }}>{wc26Error}</p>}
        <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn" disabled={wc26Status === "connecting" || !wc26Email || !wc26Pass} onClick={connectWc26}>
            {wc26Status === "connecting" ? "Connecting…" : wc26Status === "connected" ? "✓ Connected" : "Connect"}
          </button>
          {wc26Status === "connected" && (
            <span style={{ fontSize: 12, color: "var(--chalk-dim)" }}>Token saved — ⚡ Live button is now active</span>
          )}
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--chalk-dim)", marginTop: 14 }}>
        The admin PIN is set with the ADMIN_PIN environment variable on Vercel, not here.
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button className="btn primary" onClick={() => onSave({ ...data, config: c })}>Save settings</button>
      </div>
    </Modal>
  );
}

/* ---------- First-run setup (admin already unlocked) ---------- */
function SetupWizard({ onDone }) {
  const [c, setC] = useState({ ...DEFAULT_CONFIG });
  const [names, setNames] = useState("");
  const [preload, setPreload] = useState(true);
  const set = (k, v) => setC((x) => ({ ...x, [k]: v }));
  const parsed = names.split("\n").map((s) => s.trim()).filter(Boolean);
  return (
    <main>
      <div className="eyebrow" style={{ marginTop: 8 }}>First-time setup · admin</div>
      <h1 className="disp" style={{ marginBottom: 14 }}>Create the World Cup 2026 pool</h1>
      <div className="card">
        <label className="f">Pool name</label>
        <input value={c.poolName} onChange={(e) => set("poolName", e.target.value)} />
        <div className="grid3">
          <div><label className="f">Group fee /match</label><input type="number" value={c.groupFee} onChange={(e) => set("groupFee", +e.target.value || 0)} /></div>
          <div><label className="f">Knockout fee /match</label><input type="number" value={c.knockoutFee} onChange={(e) => set("knockoutFee", +e.target.value || 0)} /></div>
          <div><label className="f">League fee</label><input type="number" value={c.leagueFee} onChange={(e) => set("leagueFee", +e.target.value || 0)} /></div>
        </div>
        <div className="grid2">
          <div><label className="f">Group matches</label><input type="number" value={c.groupMatchCount} onChange={(e) => set("groupMatchCount", +e.target.value || 0)} /></div>
          <div><label className="f">Knockout matches</label><input type="number" value={c.knockoutMatchCount} onChange={(e) => set("knockoutMatchCount", +e.target.value || 0)} /></div>
        </div>
        <label className="f">Participants — one name per line, optional ({parsed.length} so far)</label>
        <textarea rows={7} value={names} onChange={(e) => setNames(e.target.value)} placeholder={"Aadesh Baral\nAbhinit Karna\n…"} />
        <p style={{ fontSize: 12, color: "var(--chalk-dim)", marginTop: 6 }}>
          Everyone starts as a Full member; switch anyone to Group-only or Knockout-only later in Participants, and add more people any time.
        </p>
        <label className="f" style={{ display: "flex", gap: 8, alignItems: "center", textTransform: "none", fontSize: 13, letterSpacing: 0 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={preload} onChange={(e) => setPreload(e.target.checked)} />
          Preload all 72 group-stage fixtures (teams, groups, dates) as upcoming matches
        </label>
        <div style={{ marginTop: 14 }}>
          <button className="btn primary"
            onClick={() => onDone({
              config: c,
              participants: parsed.map((name) => ({ name, type: "full" })),
              matches: preload ? makeGroupStageMatches() : [], payments: {},
            })}>
            Create pool
          </button>
        </div>
      </div>
    </main>
  );
}
