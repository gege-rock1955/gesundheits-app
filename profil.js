// Profil: Streak, Wochen-Quests, Monats-Rückblick, Supplements-Woche, dazu alle Bereiche als Kacheln.
import { S, ACT, VIEWS, esc, fmt, render, todayISO, addDays, monday, dayKey, dateLabel, parse, dayTotals, goals, trainDays, val, streak, activeDay, trendWeights, e1rm, weekOf, DAYS } from "./core.js";

const hasData = d => { const w = S.weeks[weekOf(d)] || {}; return Object.keys(w.plan || {}).length > 0 || !!(w.kantine_tag || {})[dayKey(d)] || S.log.some(e => e.datum === d); };
const weekDays = (mon = monday(todayISO())) => Array.from({ length: 7 }, (_, i) => addDays(mon, i));

export function quests() {
  const t = todayISO(), mon = monday(t), days = weekDays(mon).filter(d => d <= t), g = goals(), inW = d => d >= mon && d <= addDays(mon, 6);
  const q = [
    { id: "eiweiss", l: `Eiweißziel (${fmt(g.eiweiss)} g) an 5 Tagen`, n: days.filter(d => hasData(d) && dayTotals(d).p >= g.eiweiss).length, z: 5 },
    { id: "kcal", l: "Kalorienziel an 5 Tagen eingehalten", n: days.filter(d => hasData(d) && dayTotals(d).k <= goals(d).kcal).length, z: 5 },
    { id: "training", l: `${trainDays().length} Trainings`, n: S.trainings.filter(x => inW(x.datum)).length, z: trainDays().length || 3 },
    { id: "wiegen", l: "4× wiegen", n: S.vals.filter(v => v.quelle === "gewicht" && inW(v.datum)).length, z: 4 },
    { id: "wasser", l: "2 Liter Wasser an 5 Tagen", n: days.filter(d => (+val(d, "wasser")?.ml || 0) >= 2000).length, z: 5 }];
  return q.map(x => ({ ...x, done: x.n >= x.z }));
}
export function streakChip() { const n = streak(); return n ? `<span class="chip gold" title="Tage am Stück mit Einträgen">${n} Tag${n > 1 ? "e" : ""} in Folge</span>` : ""; }

function monthRecap(ym) {
  const t = todayISO(), first = ym + "-01", days = []; for (let d = first; d.startsWith(ym) && d <= t; d = addDays(d, 1)) days.push(d);
  if (!days.length) return null;
  const inM = d => d.startsWith(ym), tw = trendWeights().filter(p => inM(p.d)), data = days.filter(hasData), tot = data.map(dayTotals);
  const sets = [...S.sets].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")), best = {}; let prs = 0, top = null;
  sets.forEach(x => { const v = e1rm(x.gewicht, x.wdh), d = (x.created_at || "").slice(0, 10);
    if (inM(d) && best[x.uebung_id] && v > best[x.uebung_id] + 0.01) { prs++; const gain = v - best[x.uebung_id]; if (!top || gain > top.gain) top = { gain, name: S.ex[x.uebung_id]?.name || x.uebung_id, kg: x.gewicht, wdh: x.wdh }; }
    best[x.uebung_id] = Math.max(best[x.uebung_id] || 0, v); });
  let run = 0, longest = 0; days.forEach(d => { run = activeDay(d) ? run + 1 : 0; longest = Math.max(longest, run); });
  return { ym, w0: tw[0]?.trend, w1: tw[tw.length - 1]?.trend, tr: S.trainings.filter(x => inM(x.datum)).length,
    cardio: S.vals.filter(v => v.quelle === "cardio" && inM(v.datum)).reduce((a, v) => a + (+v.werte?.minuten || 0), 0),
    aktiv: days.filter(activeDay).length, n: days.length, k: tot.length ? tot.reduce((a, x) => a + x.k, 0) / tot.length : null, p: tot.length ? tot.reduce((a, x) => a + x.p, 0) / tot.length : null, prs, top, longest };
}
function recapCard() {
  const ym = S.month || todayISO().slice(0, 7), r = monthRecap(ym), title = parse(ym + "-15").toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  const prevM = (() => { const d = parse(ym + "-15"); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })(), nextM = (() => { const d = parse(ym + "-15"); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 7); })();
  const dw = r && r.w0 != null && r.w1 != null ? r.w1 - r.w0 : null;
  return `<section class="card recap"><div class="row"><h2>Monats-Rückblick</h2><span><button class="icon" data-act="month" data-m="${prevM}" aria-label="Vormonat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button>${nextM <= todayISO().slice(0, 7) ? `<button class="icon" data-act="month" data-m="${nextM}" aria-label="Nächster Monat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>` : ""}</span></div>
    <div class="eyebrow">${esc(title)}</div>
    ${!r ? `<div class="muted">Für diesen Monat gibt es noch keine Daten.</div>` : `<div class="kpis">
      <div><span class="muted">Gewicht (Trend)</span><b class="num">${dw == null ? "–" : (dw > 0 ? "+" : dw < 0 ? "−" : "±") + fmt(Math.abs(dw), 1) + " kg"}</b><small>${r.w1 != null ? "jetzt " + fmt(r.w1, 1) + " kg" : "noch nicht gewogen"}</small></div>
      <div><span class="muted">Trainings</span><b class="num">${r.tr}</b><small>${r.cardio ? fmt(r.cardio) + " min Cardio" : "Kraft"}</small></div>
      <div><span class="muted">Ø Energie</span><b class="num">${r.k == null ? "–" : fmt(r.k)}</b><small>kcal pro Tag</small></div>
      <div><span class="muted">Ø Eiweiß</span><b class="num">${r.p == null ? "–" : fmt(r.p) + " g"}</b><small>pro Tag</small></div>
      <div><span class="muted">Aktive Tage</span><b class="num">${r.aktiv}/${r.n}</b><small>längste Serie ${r.longest}</small></div>
      <div><span class="muted">Rekorde</span><b class="num">${r.prs}</b><small>${r.top ? esc(r.top.name) + " " + fmt(r.top.kg, 1) + " × " + r.top.wdh : "neue Bestwerte"}</small></div></div>`}</section>`;
}
ACT.month = t => { S.month = t.dataset.m; render(); };

function suppWeek() {
  const list = S.set.supps || []; if (!list.length) return "";
  const days = weekDays(), t = todayISO();
  return `<section class="card"><div class="row"><h2>Supplements</h2><span class="muted">diese Woche</span></div><div class="tablewrap"><table class="mtab supp"><thead><tr><th scope="col">Mittel</th>${days.map((d, i) => `<th scope="col">${DAYS[i][1]}</th>`).join("")}</tr></thead><tbody>
    ${list.map(s => `<tr><th scope="row">${esc(s.n)}<small>${esc(s.dosis || "")}</small></th>${days.map(d => { const on = !!(val(d, "supps") || {})[s.n]; return `<td>${d > t ? "" : `<button class="tick ${on ? "on" : ""}" data-act="supp" data-n="${esc(s.n)}" data-date="${d}" aria-pressed="${on}" aria-label="${esc(s.n)} am ${dateLabel(d, { weekday: "long" })}">${on ? "✓" : ""}</button>`}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div></section>`;
}

VIEWS.profil = () => {
  const n = streak(), q = quests(), done = q.filter(x => x.done).length;
  return `<section class="card hero-card"><div class="streak"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/></svg><div><b class="num">${n}</b><span>${n === 1 ? "Tag" : "Tage"} in Folge eingetragen</span></div></div>
    <div class="muted">${n ? "Bleib dran – ein Eintrag pro Tag reicht, damit die Serie hält." : "Trag heute etwas ein, um eine Serie zu starten."}</div></section>
  <section class="card"><div class="row"><h2>Wochen-Ziele</h2><span class="muted num">${done}/${q.length} geschafft</span></div>
    ${q.map(x => `<div class="quest ${x.done ? "done" : ""}"><div class="row"><span>${x.done ? "✓ " : ""}${esc(x.l)}</span><b class="num">${Math.min(x.n, x.z)}/${x.z}</b></div><div class="track"><i style="width:${Math.min(100, x.n / x.z * 100)}%"></i></div></div>`).join("")}</section>
  ${recapCard()}${suppWeek()}${VIEWS.menu()}`;
};
