// Trends: Wochenrückblick, Gewichtstrend, Energie & Eiweiß, Training pro Muskel, Sehne.
import { S, VIEWS, esc, fmt, todayISO, addDays, monday, parse, dayTotals, goals, trainDays, trendWeights, dateLabel } from "./core.js";
import { tendonCard } from "./training.js";

const W = 340, H = 150, PL = 34, PR = 8, PT = 10, PB = 22;
const short = s => parse(s).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" });

// Tippen auf einen Punkt/Balken zeigt den Wert unter dem Diagramm
document.addEventListener("click", e => { const t = e.target.closest("[data-tip]"); if (!t) return; const cap = t.closest("figure")?.querySelector(".tipline"); if (cap) cap.textContent = t.dataset.tip; });

function axisY(min, max, fmtV) {
  const ticks = [min, (min + max) / 2, max], y = v => PT + (H - PT - PB) * (1 - (v - min) / (max - min || 1));
  return { y, svg: ticks.map(v => `<line x1="${PL}" x2="${W - PR}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${PL - 6}" y="${y(v) + 4}" class="ax" text-anchor="end">${fmtV(v)}</text>`).join("") };
}

export function weightChart(days = 90) {
  const from = addDays(todayISO(), -days), pts = trendWeights().filter(p => p.d >= from);
  if (!pts.length) return `<div class="empty">Noch keine Gewichtswerte. Tippe unten auf „+“ → Gewicht.</div>`;
  const all = pts.flatMap(p => [p.kg, p.trend]), lo = Math.floor(Math.min(...all) - 0.5), hi = Math.ceil(Math.max(...all) + 0.5);
  const { y, svg } = axisY(lo, hi, v => fmt(v, 0));
  const t0 = parse(pts[0].d).getTime(), t1 = Math.max(parse(pts[pts.length - 1].d).getTime(), t0 + 864e5);
  const x = s => PL + (W - PL - PR) * ((parse(s).getTime() - t0) / (t1 - t0));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.d).toFixed(1)},${y(p.trend).toFixed(1)}`).join("");
  const last = pts[pts.length - 1];
  return `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gewichtsverlauf, Trend aktuell ${fmt(last.trend, 1)} kg">${svg}
    ${pts.map(p => `<circle cx="${x(p.d)}" cy="${y(p.kg)}" r="4" class="dot-soft" data-tip="${short(p.d)}: ${fmt(p.kg, 1)} kg gewogen · Trend ${fmt(p.trend, 1)} kg"><title>${short(p.d)}: ${fmt(p.kg, 1)} kg</title></circle>`).join("")}
    ${pts.length > 1 ? `<path d="${line}" class="ln"/>` : ""}
    <text x="${PL}" y="${H - 4}" class="ax">${short(pts[0].d)}</text><text x="${W - PR}" y="${H - 4}" class="ax" text-anchor="end">${short(last.d)}</text></svg>
    <figcaption><span class="lg"><i class="sw ln"></i>Trend</span><span class="lg"><i class="sw dot"></i>gewogen</span><span class="tipline muted">Tippe auf einen Punkt</span></figcaption></figure>`;
}

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
  const t = todayISO(), days = Array.from({ length: 7 }, (_, i) => addDays(mon, i)).filter(d => d <= t);
  if (!days.length) return null;
  const tot = days.map(dayTotals), avgK = tot.reduce((a, x) => a + x.k, 0) / days.length, avgP = tot.reduce((a, x) => a + x.p, 0) / days.length;
  const tr = S.trainings.filter(x => x.datum >= mon && x.datum <= addDays(mon, 6)).length;
  const tw = trendWeights(), wEnd = [...tw].reverse().find(p => p.d <= addDays(mon, 6)), wStart = [...tw].reverse().find(p => p.d < mon);
  return { mon, n: days.length, avgK, avgP, tr, plan: trainDays().length, dW: wEnd && wStart ? wEnd.trend - wStart.trend : null };
}
export function reviewCard(r, title) {
  if (!r) return ""; const g = goals();
  return `<section class="card review"><div class="eyebrow">${esc(title)} · ${short(r.mon)}–${short(addDays(r.mon, 6))}</div>
    <div class="kpis"><div><span class="muted">Ø Energie</span><b class="num">${fmt(r.avgK)}</b><small>Ziel ${fmt(g.kcal)} kcal</small></div>
    <div><span class="muted">Ø Eiweiß</span><b class="num">${fmt(r.avgP)} g</b><small>Ziel ${fmt(g.eiweiss)} g</small></div>
    <div><span class="muted">Training</span><b class="num">${r.tr}/${r.plan}</b><small>Einheiten</small></div>
    <div><span class="muted">Gewicht</span><b class="num">${r.dW == null ? "–" : (r.dW > 0 ? "+" : r.dW < 0 ? "−" : "±") + fmt(Math.abs(r.dW), 1) + " kg"}</b><small>Trend</small></div></div>
    ${r.n < 7 ? `<div class="muted">Bisher ${r.n} von 7 Tagen.</div>` : ""}</section>`;
}

function muscles(days = 7) {
  const from = addDays(todayISO(), -days + 1), ids = new Set(S.trainings.filter(t => t.datum >= from).map(t => t.id)), cnt = {};
  S.sets.filter(x => ids.has(x.training_id)).forEach(x => (S.ex[x.uebung_id]?.muskeln || ["Sonstiges"]).slice(0, 2).forEach(m => cnt[m] = (cnt[m] || 0) + 1));
  const rows = Object.entries(cnt).sort((a, b) => b[1] - a[1]); if (!rows.length) return `<div class="muted">In den letzten 7 Tagen noch keine Sätze gespeichert.</div>`;
  const max = Math.max(...rows.map(r => r[1]), 10);
  return `<div class="hbars">${rows.map(([m, n]) => `<div class="hb"><span>${esc(m)}</span><div class="track"><i style="width:${n / max * 100}%"></i></div><b class="num">${n}</b></div>`).join("")}</div><div class="muted">Sätze pro Muskel · 10–20 pro Woche gelten als gutes Muskelaufbau-Volumen.</div>`;
}

VIEWS.trends = () => {
  const t = todayISO(), g = goals(), days = Array.from({ length: 14 }, (_, i) => addDays(t, i - 13));
  const rows = days.map(d => { const x = dayTotals(d); return { d, k: x.k, p: x.p, open: x.open, today: d === t }; });
  const last7 = rows.slice(-7), avg = k => last7.reduce((a, r) => a + r[k], 0) / 7;
  const tw = trendWeights(), cur = tw[tw.length - 1], ago = d => [...tw].reverse().find(p => p.d <= addDays(t, -d));
  const d7 = cur && ago(7) ? cur.trend - ago(7).trend : null, d30 = cur && ago(30) ? cur.trend - ago(30).trend : null;
  const sgn = v => v == null ? "–" : (v > 0 ? "+" : v < 0 ? "−" : "±") + fmt(Math.abs(v), 1) + " kg";
  const mon = monday(t), prev = addDays(mon, -7), wk4 = Array.from({ length: 4 }, (_, i) => addDays(mon, -7 * (3 - i)));
  return `${reviewCard(weekReview(prev), "Letzte Woche")}${reviewCard(weekReview(mon), "Diese Woche")}
  <section class="card"><div class="row"><h2>Gewicht</h2><button class="small ghost" data-act="gewicht">+ Gewicht</button></div>
    <div class="kpis three"><div><span class="muted">Trend</span><b class="num">${cur ? fmt(cur.trend, 1) + " kg" : "–"}</b></div><div><span class="muted">7 Tage</span><b class="num">${sgn(d7)}</b></div><div><span class="muted">30 Tage</span><b class="num">${sgn(d30)}</b></div></div>
    ${weightChart()}</section>
  <section class="card"><div class="row"><h2>Energie</h2><span class="muted num">Ø 7 Tage ${fmt(avg("k"))} kcal</span></div>${barChart(rows.map(r => ({ d: r.d, v: r.k, open: r.open, today: r.today })), g.kcal, "b-basil", "kcal", "Kalorien der letzten 14 Tage")}</section>
  <section class="card"><div class="row"><h2>Eiweiß</h2><span class="muted num">Ø 7 Tage ${fmt(avg("p"))} g</span></div>${barChart(rows.map(r => ({ d: r.d, v: r.p, today: r.today })), g.eiweiss, "b-ice", "g", "Eiweiß der letzten 14 Tage")}</section>
  <section class="card"><h2>Training</h2>
    <div class="kpis four">${wk4.map(m => `<div><span class="muted">ab ${short(m)}</span><b class="num">${S.trainings.filter(x => x.datum >= m && x.datum <= addDays(m, 6)).length}</b></div>`).join("")}</div>
    ${muscles()}</section>
  ${tendonCard() ? `<section class="card"><h2>Achillessehne</h2>${tendonCard()}</section>` : ""}
  <p class="muted" style="text-align:center">Alle Ernährungswerte sind Schätzungen aus Plan und Einträgen.</p>`;
};
