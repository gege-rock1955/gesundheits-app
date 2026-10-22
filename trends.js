// Trends: Wochenrückblick, Gewichtstrend, Energie & Eiweiß, Training pro Muskel, Sehne.
import { S, ACT, VIEWS, esc, fmt, todayISO, addDays, monday, parse, dayTotals, goals, trainDays, trendWeights, dateLabel, weekOf, MESS, series, render } from "./core.js";

// Nur Tage mit echten Daten (Wochenplan oder Einträge) zählen für Durchschnitte
const hasData = d => { const w = S.weeks[weekOf(d)] || {}; return Object.keys(w.plan || {}).length > 0 || Object.keys(w.kantine_tag || {}).length > 0 || S.log.some(e => e.datum === d); };
import { tendonCard } from "./training.js";
import { bilanzCard, fotosCard } from "./koerper.js";

const W = 340, H = 150, PL = 34, PR = 8, PT = 10, PB = 22;
const short = s => parse(s).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" });

// Tippen auf einen Punkt/Balken zeigt den Wert unter dem Diagramm
document.addEventListener("click", e => { const t = e.target.closest("[data-tip]"); if (!t) return; const cap = t.closest("figure")?.querySelector(".tipline"); if (cap) cap.textContent = t.dataset.tip; });

function axisY(min, max, fmtV) {
  const ticks = [min, (min + max) / 2, max], y = v => PT + (H - PT - PB) * (1 - (v - min) / (max - min || 1));
  return { y, svg: ticks.map(v => `<line x1="${PL}" x2="${W - PR}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${PL - 6}" y="${y(v) + 4}" class="ax" text-anchor="end">${fmtV(v)}</text>`).join("") };
}

// Liniendiagramm für Gewicht und Messwerte; trend = geglättete Linie, sonst Verbindungslinie.
function lineChart(pts, { unit, dec = 1, label, hint = "Tippe auf einen Punkt", trend = false }) {
  const vals = pts.flatMap(p => trend ? [p.v, p.t] : [p.v]), span = Math.max(...vals) - Math.min(...vals), pad = Math.max(0.5, span * 0.1);
  const lo = Math.floor(Math.min(...vals) - pad), hi = Math.ceil(Math.max(...vals) + pad), { y, svg } = axisY(lo, hi, v => fmt(v, 0));
  const t0 = parse(pts[0].d).getTime(), t1 = Math.max(parse(pts[pts.length - 1].d).getTime(), t0 + 864e5);
  const x = s => PL + (W - PL - PR) * ((parse(s).getTime() - t0) / (t1 - t0)), r = pts.length > 120 ? 2.5 : 4;
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.d).toFixed(1)},${y(trend ? p.t : p.v).toFixed(1)}`).join("");
  const lbl = s => (t1 - t0) > 200 * 864e5 ? parse(s).toLocaleDateString("de-DE", { month: "short", year: "2-digit" }) : short(s);
  const last = pts[pts.length - 1];
  return `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}, zuletzt ${fmt(last.v, dec)} ${unit}">${svg}
    ${pts.length > 1 ? `<path d="${path}" class="ln"/>` : ""}
    ${pts.map(p => `<circle cx="${x(p.d)}" cy="${y(p.v)}" r="${r}" class="dot-soft" data-tip="${short(p.d)}: ${fmt(p.v, dec)} ${unit}${trend ? ` · Trend ${fmt(p.t, 1)} ${unit}` : ""}"><title>${short(p.d)}: ${fmt(p.v, dec)} ${unit}</title></circle>`).join("")}
    <text x="${PL}" y="${H - 4}" class="ax">${lbl(pts[0].d)}</text><text x="${W - PR}" y="${H - 4}" class="ax" text-anchor="end">${lbl(last.d)}</text></svg>
    <figcaption>${trend ? `<span class="lg"><i class="sw ln"></i>Trend</span><span class="lg"><i class="sw dot"></i>gewogen</span>` : ""}<span class="tipline muted">${hint}</span></figcaption></figure>`;
}
const fromDate = days => days ? addDays(todayISO(), -days) : "0000-00-00";
export function weightChart(days = 90) {
  const pts = trendWeights().filter(p => p.d >= fromDate(days)).map(p => ({ d: p.d, v: p.kg, t: p.trend }));
  return pts.length ? lineChart(pts, { unit: "kg", label: "Gewichtsverlauf", trend: true }) : `<div class="empty">Keine Gewichtswerte in diesem Zeitraum. Tippe unten auf „+“ → Gewicht.</div>`;
}

// Monatsübersicht für Langzeit-Auswertung
function months(days) {
  const from = fromDate(days), t = todayISO(), map = {};
  const add = (d, k, v) => { if (d < from || d > t) return; const m = d.slice(0, 7); (map[m] = map[m] || { kcal: [], p: [], tr: 0, cardio: 0, w: null })[k] = v(map[m][k]); };
  const dates = new Set([...S.log.map(e => e.datum), ...Object.values(S.weeks).flatMap(w => { const mon = monday(isoDateOfWeek(w.woche)); return Array.from({ length: 7 }, (_, i) => addDays(mon, i)); })]);
  [...dates].filter(d => d >= from && d <= t && hasData(d)).forEach(d => { const x = dayTotals(d); add(d, "kcal", a => [...a, x.k]); add(d, "p", a => [...a, x.p]); });
  S.trainings.forEach(x => add(x.datum, "tr", n => n + 1));
  S.vals.filter(v => v.quelle === "cardio").forEach(v => add(v.datum, "cardio", n => n + (+v.werte?.minuten || 0)));
  trendWeights().forEach(p => add(p.d, "w", () => p.trend));
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  const rows = Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  if (!rows.length) return "";
  return `<section class="card"><h2>Monate</h2><div class="tablewrap"><table class="mtab"><thead><tr><th scope="col">Monat</th><th scope="col">Gewicht</th><th scope="col">Ø kcal</th><th scope="col">Ø Eiweiß</th><th scope="col">Kraft</th><th scope="col">Cardio</th></tr></thead><tbody>
    ${rows.map(([m, r]) => `<tr><th scope="row">${parse(m + "-15").toLocaleDateString("de-DE", { month: "short", year: "numeric" })}</th><td>${r.w ? fmt(r.w, 1) : "–"}</td><td>${avg(r.kcal) != null ? fmt(avg(r.kcal)) : "–"}</td><td>${avg(r.p) != null ? fmt(avg(r.p)) + " g" : "–"}</td><td>${r.tr}</td><td>${r.cardio ? fmt(r.cardio) + " min" : "–"}</td></tr>`).join("")}
    </tbody></table></div><div class="muted">Gewicht = Trend am Monatsende · Durchschnitt nur über Tage mit Daten.</div></section>`;
}
function isoDateOfWeek(w) { const [y, n] = w.split("-W").map(Number), j4 = new Date(Date.UTC(y, 0, 4)), mon = new Date(j4); mon.setUTCDate(j4.getUTCDate() - ((j4.getUTCDay() + 6) % 7) + (n - 1) * 7); return mon.toISOString().slice(0, 10); }

// Messwerte (Bauch, Körperfett, Puls, Blutdruck, Schlaf, Schritte)
function metricsCard(days) {
  const have = MESS.map(([k, l, u, dec]) => ({ k, l, u, dec, s: series(k) })).filter(m => m.s.length);
  const head = `<div class="row"><h2>Messwerte</h2><button class="small ghost" data-act="messung">+ Messen</button></div>`;
  if (!have.length) return `<section class="card">${head}<div class="muted">Noch keine Messwerte. Trag z. B. Bauchumfang, Ruhepuls oder Schlaf über „+“ → Messwerte ein.</div></section>`;
  const sel = have.find(m => m.k === S.metric) || have[0], from = fromDate(days);
  const ago = (s, n) => [...s].reverse().find(p => p.d <= addDays(todayISO(), -n));
  return `<section class="card">${head}<div class="mlist">${have.map(m => { const last = m.s[m.s.length - 1], old = ago(m.s, 30), dlt = old ? last.v - old.v : null;
      return `<button class="mrow" data-act="metric" data-k="${m.k}" aria-pressed="${m === sel}"><span>${m.l}</span><b class="num">${fmt(last.v, m.dec)} ${m.u}</b><small class="muted num">${dlt == null ? "" : (dlt > 0 ? "+" : dlt < 0 ? "−" : "±") + fmt(Math.abs(dlt), m.dec) + " in 30 T"}</small></button>`; }).join("")}</div>
    ${(() => { const pts = sel.s.filter(p => p.d >= from); return pts.length ? lineChart(pts, { unit: sel.u, dec: sel.dec, label: sel.l }) : `<div class="muted">Keine ${sel.l}-Werte in diesem Zeitraum.</div>`; })()}</section>`;
}
ACT.metric = t => { S.metric = t.dataset.k; render(); };
ACT.range = t => { S.range = +t.dataset.r; render(); };

function barChart(rows, goal, cls, unit, label) {
  const raw = Math.max(goal * 1.1, ...rows.map(r => r.v)), st = raw > 1000 ? 500 : raw > 200 ? 50 : 10, max = Math.ceil(raw / st) * st, { y, svg } = axisY(0, max, v => fmt(v)), n = rows.length, bw = (W - PL - PR) / n;
  return `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${svg}
    ${rows.map((r, i) => { const h = Math.max(0, y(0) - y(r.v)), xx = PL + i * bw + 2;
      return `<g data-tip="${dateLabel(r.d, { weekday: "short", day: "numeric", month: "short" })}: ${fmt(r.v)} ${unit}${r.open ? " (Foto offen)" : ""}"><rect x="${xx - 2}" y="${PT}" width="${bw}" height="${H - PT - PB}" fill="transparent"/>
        ${r.v ? `<path d="M${xx},${y(0)}v${-Math.max(0, h - 4)}q0,-4 4,-4h${Math.max(0, bw - 12)}q4,0 4,4v${Math.max(0, h - 4)}z" class="${cls} ${r.today ? "today" : ""}"/>` : ""}
        <text x="${xx + (bw - 4) / 2}" y="${H - 6}" class="ax" text-anchor="middle">${parse(r.d).toLocaleDateString("de-DE", { weekday: "narrow" })}</text><title>${fmt(r.v)} ${unit}</title></g>`; }).join("")}
    <line x1="${PL}" x2="${W - PR}" y1="${y(goal)}" y2="${y(goal)}" class="goal"/><text x="${W - PR}" y="${y(goal) - 4}" class="ax" text-anchor="end">Ziel ${fmt(goal)}</text></svg>
    <figcaption><span class="tipline muted">Tippe auf einen Tag</span></figcaption></figure>`;
}

export function weekReview(mon) {
  const t = todayISO(), days = Array.from({ length: 7 }, (_, i) => addDays(mon, i)).filter(d => d <= t && hasData(d));
  if (!days.length) return null;
  const tot = days.map(dayTotals), avgK = tot.reduce((a, x) => a + x.k, 0) / days.length, avgP = tot.reduce((a, x) => a + x.p, 0) / days.length;
  const tr = S.trainings.filter(x => x.datum >= mon && x.datum <= addDays(mon, 6)).length;
  const cardio = S.vals.filter(v => v.quelle === "cardio" && v.datum >= mon && v.datum <= addDays(mon, 6)).reduce((a, v) => a + (+v.werte?.minuten || 0), 0);
  const tw = trendWeights(), wEnd = [...tw].reverse().find(p => p.d <= addDays(mon, 6)), wStart = [...tw].reverse().find(p => p.d < mon);
  return { mon, n: days.length, avgK, avgP, tr, cardio, plan: trainDays().length, dW: wEnd && wStart ? wEnd.trend - wStart.trend : null };
}
export function reviewCard(r, title) {
  if (!r) return ""; const g = goals();
  return `<section class="card review"><div class="eyebrow">${esc(title)} · ${short(r.mon)}–${short(addDays(r.mon, 6))}</div>
    <div class="kpis"><div><span class="muted">Ø Energie</span><b class="num">${fmt(r.avgK)}</b><small>Ziel ${fmt(g.kcal)} kcal</small></div>
    <div><span class="muted">Ø Eiweiß</span><b class="num">${fmt(r.avgP)} g</b><small>Ziel ${fmt(g.eiweiss)} g</small></div>
    <div><span class="muted">Training</span><b class="num">${r.tr}/${r.plan}</b><small>Kraft${r.cardio ? ` · ${fmt(r.cardio)} min Cardio` : ""}</small></div>
    <div><span class="muted">Gewicht</span><b class="num">${r.dW == null ? "–" : (r.dW > 0 ? "+" : r.dW < 0 ? "−" : "±") + fmt(Math.abs(r.dW), 1) + " kg"}</b><small>Trend</small></div></div>
    ${r.n < 7 ? `<div class="muted">Ø aus ${r.n} Tag${r.n > 1 ? "en" : ""} mit Daten.</div>` : ""}</section>`;
}

function muscles(days = 7) {
  const from = addDays(todayISO(), -days + 1), ids = new Set(S.trainings.filter(t => t.datum >= from).map(t => t.id)), cnt = {};
  S.sets.filter(x => ids.has(x.training_id)).forEach(x => (S.ex[x.uebung_id]?.muskeln || ["Sonstiges"]).slice(0, 2).forEach(m => cnt[m] = (cnt[m] || 0) + 1));
  const rows = Object.entries(cnt).sort((a, b) => b[1] - a[1]); if (!rows.length) return `<div class="muted">In den letzten 7 Tagen noch keine Sätze gespeichert.</div>`;
  const max = Math.max(...rows.map(r => r[1]), 10);
  return `<div class="hbars">${rows.map(([m, n]) => `<div class="hb"><span>${esc(m)}</span><div class="track"><i style="width:${n / max * 100}%"></i></div><b class="num">${n}</b></div>`).join("")}</div><div class="muted">Sätze pro Muskel · 10–20 pro Woche gelten als gutes Muskelaufbau-Volumen.</div>`;
}

VIEWS.koerper = VIEWS.trends = () => {
  const t = todayISO(), g = goals(), days = Array.from({ length: 14 }, (_, i) => addDays(t, i - 13));
  const rows = days.map(d => { const ok = hasData(d), x = ok ? dayTotals(d) : { k: 0, p: 0, open: 0 }; return { d, k: x.k, p: x.p, open: x.open, today: d === t, ok }; });
  const last7 = rows.slice(-7).filter(r => r.ok), avg = k => last7.length ? last7.reduce((a, r) => a + r[k], 0) / last7.length : 0;
  const tw = trendWeights(), cur = tw[tw.length - 1], ago = d => [...tw].reverse().find(p => p.d <= addDays(t, -d));
  const d7 = cur && ago(7) ? cur.trend - ago(7).trend : null, d30 = cur && ago(30) ? cur.trend - ago(30).trend : null;
  const sgn = v => v == null ? "–" : (v > 0 ? "+" : v < 0 ? "−" : "±") + fmt(Math.abs(v), 1) + " kg";
  const mon = monday(t), prev = addDays(mon, -7), wk4 = Array.from({ length: 4 }, (_, i) => addDays(mon, -7 * (3 - i)));
  const R = S.range ?? 90;
  return `<div class="seg range" role="group" aria-label="Zeitraum">${[[90, "3 Monate"], [365, "1 Jahr"], [0, "Alles"]].map(([r, l]) => `<button class="small" data-act="range" data-r="${r}" aria-pressed="${R === r}">${l}</button>`).join("")}</div>
  ${bilanzCard()}${reviewCard(weekReview(mon), "Diese Woche")}${reviewCard(weekReview(prev), "Letzte Woche")}
  <section class="card"><div class="row"><h2>Gewicht</h2><button class="small ghost" data-act="gewicht">+ Gewicht</button></div>
    <div class="kpis three"><div><span class="muted">Trend</span><b class="num">${cur ? fmt(cur.trend, 1) + " kg" : "–"}</b></div><div><span class="muted">7 Tage</span><b class="num">${sgn(d7)}</b></div><div><span class="muted">30 Tage</span><b class="num">${sgn(d30)}</b></div></div>
    ${weightChart(R)}</section>
  ${metricsCard(R)}
  ${fotosCard()}
  <section class="card"><div class="row"><h2>Energie</h2><span class="muted num">${last7.length ? `Ø ${last7.length} Tage ${fmt(avg("k"))} kcal` : "noch keine Daten"}</span></div>${barChart(rows.map(r => ({ d: r.d, v: r.k, open: r.open, today: r.today })), g.kcal, "b-basil", "kcal", "Kalorien der letzten 14 Tage")}</section>
  <section class="card"><div class="row"><h2>Eiweiß</h2><span class="muted num">${last7.length ? `Ø ${last7.length} Tage ${fmt(avg("p"))} g` : ""}</span></div>${barChart(rows.map(r => ({ d: r.d, v: r.p, today: r.today })), g.eiweiss, "b-ice", "g", "Eiweiß der letzten 14 Tage")}</section>
  <section class="card"><h2>Training</h2>
    <div class="kpis four">${wk4.map(m => `<div><span class="muted">ab ${short(m)}</span><b class="num">${S.trainings.filter(x => x.datum >= m && x.datum <= addDays(m, 6)).length}</b></div>`).join("")}</div>
    ${muscles()}</section>
  ${tendonCard() ? `<section class="card"><h2>Achillessehne</h2>${tendonCard()}</section>` : ""}
  ${R !== 90 ? months(R) : ""}
  <p class="muted" style="text-align:center">Alle Ernährungswerte sind Schätzungen aus Plan und Einträgen.</p>`;
};
