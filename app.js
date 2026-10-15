import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (n, d = 0) => Number(n || 0).toLocaleString("de-DE", { maximumFractionDigits: d });
const DAYS = [["mo", "Mo", 1], ["di", "Di", 1], ["mi", "Mi", 1], ["do", "Do", 1], ["fr", "Fr", 1], ["sa", "Sa", 0], ["so", "So", 0]];
const AREA = ["Obst & Gemüse", "Kühlregal", "Konserven", "Trockenware", "Wurst & Käse", "Sonstiges"];

const S = { user: null, ing: {}, rec: {}, week: null, stock: {}, set: {}, fav: {}, deals: [], dev: {}, ex: {}, plans: [], view: "heute", session: null };

// ---------- Hilfen ----------
function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(); const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
}
const todayKey = () => DAYS[(new Date().getDay() + 6) % 7][0];
const todayISO = () => new Date().toLocaleDateString("sv-SE");
function toast(t) { const d = document.createElement("div"); d.className = "toast"; d.textContent = t; document.body.append(d); setTimeout(() => d.remove(), 2200); }
function status(t) { $("#status").textContent = t || ""; }
async function q(p) { const { data, error } = await p; if (error) { console.error(error); toast("Fehler: " + error.message); throw error; } return data; }

// ---------- Rechnen ----------
function nutr(id, qty) { const i = S.ing[id]; if (!i) return [0, 0]; const f = i.einheit === "g" ? qty / 100 : qty; return [(+i.kcal || 0) * f, (+i.eiweiss || 0) * f]; }
function portion(rid) { const r = S.rec[rid]; if (!r) return [0, 0]; let k = 0, p = 0; (r.zutaten || []).forEach(z => { const [a, b] = nutr(z.id, z.menge); k += a; p += b; }); const n = r.portionen || 1; return [k / n, p / n]; }
function dayItems(d, work) {
  const w = S.week || {}, plan = (w.plan || {})[d] || {}, items = [];
  if (S.rec.shake) { const [k, p] = portion("shake"); items.push(["Shake", k, p]); }
  if (work) { const base = S.set.kantine || { kcal: 700, eiweiss: 25 }; const o = (w.kantine_tag || {})[d]; const k = o?.kcal ? o : base; items.push([o?.kcal ? "Kantine" + (o.notiz ? ": " + o.notiz : "") : "Kantine (pauschal)", +k.kcal || 0, +k.eiweiss || 0]); }
  if (plan.rezept && S.rec[plan.rezept]) { const [k, p] = portion(plan.rezept); items.push([S.rec[plan.rezept].kurz || S.rec[plan.rezept].name, k, p]); }
  if (plan.salat && S.rec.salat) { const [k, p] = portion("salat"); items.push(["Salat", k, p]); }
  return items;
}
function needs() {
  const por = {}; DAYS.forEach(([d]) => { const p = (S.week?.plan || {})[d] || {};
    if (p.rezept && S.rec[p.rezept]) por[p.rezept] = (por[p.rezept] || 0) + 1;
    if (p.salat && S.rec.salat) por.salat = (por.salat || 0) + 1;
    if (S.rec.shake) por.shake = (por.shake || 0) + 1; });
  const need = {}, by = {};
  Object.entries(por).forEach(([rid, n]) => { const r = S.rec[rid]; const per = r.portionen || 1;
    const f = (rid === "salat" || rid === "shake") ? n : Math.ceil(n / per);
    (r.zutaten || []).forEach(z => { need[z.id] = (need[z.id] || 0) + z.menge * f; (by[z.id] = by[z.id] || new Set()).add(r.kurz || r.name); }); });
  return { need, by };
}

// ---------- Laden ----------
async function loadAll() {
  status("Synchronisiere …");
  const [ing, rec, wk, st, set, fav, deals, dev, ex, plans] = await Promise.all([
    q(sb.from("zutaten").select("*")), q(sb.from("rezepte").select("*")),
    q(sb.from("wochen").select("*").eq("woche", isoWeek()).maybeSingle()),
    q(sb.from("bestand").select("*")), q(sb.from("einstellungen").select("*")),
    q(sb.from("favoriten").select("*")), q(sb.from("angebote").select("*").gte("bis", todayISO())),
    q(sb.from("geraete").select("*")), q(sb.from("uebungen").select("*")),
    q(sb.from("trainingsplaene").select("*").eq("aktiv", true))]);
  S.ing = Object.fromEntries(ing.map(x => [x.id, x])); S.rec = Object.fromEntries(rec.map(x => [x.id, x]));
  S.week = wk || { woche: isoWeek(), plan: {}, kantine_tag: {} };
  S.stock = Object.fromEntries(st.map(x => [x.zutat_id, +x.menge])); S.set = Object.fromEntries(set.map(x => [x.key, x.value]));
  S.fav = Object.fromEntries(fav.map(x => [x.id, x])); S.deals = deals;
  S.dev = Object.fromEntries(dev.map(x => [x.id, x])); S.ex = Object.fromEntries(ex.map(x => [x.id, x])); S.plans = plans;
  status("");
}
async function saveWeek() { await q(sb.from("wochen").upsert({ woche: S.week.woche, plan: S.week.plan || {}, kantine_tag: S.week.kantine_tag || {} })); }

// ---------- Views ----------
const V = {};
// Tagesablauf mit Zeitfenster und Detailzeile (für „Heute“)
function dayTimeline(d, work) {
  const w = S.week || {}, plan = (w.plan || {})[d] || {}, out = [];
  if (S.rec.shake) { const [k, p] = portion("shake"); const det = (S.rec.shake.zutaten || []).map(z => { const i = S.ing[z.id] || {}; const n = String(i.name || z.id).split(" (")[0]; return `${fmt(z.menge)} ${i.einheit === "g" ? (/\bml\b/.test(i.name || "") ? "ml" : "g") : "×"} ${n}`; }).join(", ");
    out.push({ slot: "Früh", name: "Shake", det, k, p }); }
  if (work) { const base = S.set.kantine || { kcal: 700, eiweiss: 25 }; const o = (w.kantine_tag || {})[d];
    out.push(o?.kcal ? { slot: "Mittag", name: "Kantine", det: o.notiz || "eingetragen", k: +o.kcal, p: +o.eiweiss || 0 }
      : { slot: "Mittag", name: "Kantine", det: "pauschal geschätzt – tippe zum Eintragen", k: +base.kcal, p: +base.eiweiss, open: true }); }
  if (plan.rezept && S.rec[plan.rezept]) { let [k, p] = portion(plan.rezept); let det = "geplant";
    if (plan.salat && S.rec.salat) { const [a, b] = portion("salat"); k += a; p += b; det += " · mit Salat"; }
    out.push({ slot: "Abend", name: S.rec[plan.rezept].kurz || S.rec[plan.rezept].name, det, k, p, planned: true }); }
  return out;
}
const TRAIN = () => S.set.trainingstage || ["di", "do", "so"];
V.heute = () => {
  const d = todayKey(), work = DAYS.find(x => x[0] === d)[2];
  const tl = dayTimeline(d, work); const k = tl.reduce((s, x) => s + x.k, 0), p = tl.reduce((s, x) => s + x.p, 0);
  const goal = S.set.ziel?.kcal || 2200, pgoal = S.set.ziel?.eiweiss || 170, rest = goal - k;
  const train = TRAIN().includes(d), plan = S.plans[0], ti = DAYS.findIndex(x => x[0] === d);
  const head = rest >= 0 ? `Noch ${fmt(rest)} kcal bis zum Ziel` : `${fmt(-rest)} kcal über dem Ziel`;
  const strip = DAYS.map(([dd, l], i) => `<div class="ds ${i === ti ? "now" : i < ti ? "past" : ""}"><span>${l}</span><i class="${TRAIN().includes(dd) ? "tr" : i < ti ? "ok" : ""}"></i></div>`).join("");
  const deal = S.deals[0];
  return `<section class="hero"><div class="muted" style="font-size:14px">${new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</div>
    <h2>${head}</h2><div class="strip" aria-label="Woche">${strip}</div></section>
  <section class="card"><div class="meter"><div class="row"><b>Energie</b><span class="muted"><b class="v">${fmt(k)}</b> / ${fmt(goal)} kcal</span></div>
      <div class="track ${k > goal ? "over" : ""}"><i style="width:${Math.min(100, k / goal * 100)}%"></i></div></div>
    <div class="meter"><div class="row"><b>Eiweiß</b><span class="muted"><b class="v">${fmt(p)}</b> / ${fmt(pgoal)} g</span></div>
      <div class="track ice"><i style="width:${Math.min(100, p / pgoal * 100)}%"></i></div></div>
    <div class="seg" style="gap:8px">${train ? `<span class="chip">Trainingstag</span><span class="chip gold">Achillessehne: Check nach dem Training</span>` : `<span class="chip">Ruhetag</span>`}<span class="chip" style="background:var(--line);color:var(--muted)">Schätzwerte</span></div></section>
  <div class="row" style="padding:4px 4px 0"><h2>Dein Tag</h2></div>
  <div class="tl">${tl.map(x => `<${x.open ? `button data-act="kantine"` : "div"} class="tli ${x.planned ? "plan" : ""}"><span class="slot">${x.slot}</span><span class="tm"><b>${esc(x.name)}</b><span class="muted">${esc(x.det)}</span></span><span class="tv"><b>${fmt(x.k)}</b> kcal<br>${fmt(x.p)} g</span></${x.open ? "button" : "div"}>`).join("")}</div>
  ${work && !tl.find(x => x.open) ? `<button class="ghost small" data-act="kantine">Kantine ändern</button>` : ""}
  ${deal ? `<button class="radar" data-go="einkauf"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg><span><b>Radar:</b> ${esc(deal.produkt)} bei ${esc(deal.haendler)}${S.deals.length > 1 ? ` · +${S.deals.length - 1} weitere` : ""}</span></button>` : ""}
  ${train && plan ? `<section class="card"><h2>Training</h2><div class="muted">${esc(plan.name)}</div>
    <div class="seg">${plan.tage.map((t, i) => `<button data-act="start" data-i="${i}">${esc(t.name)}</button>`).join("")}</div></section>` : ""}`;
};
V.woche = () => {
  const opts = r => `<option value="">– nichts –</option>` + Object.entries(S.rec).filter(([id]) => id !== "salat" && id !== "shake").sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([id, x]) => `<option value="${id}" ${r === id ? "selected" : ""}>${esc(x.name)}</option>`).join("");
  return `<section class="card"><div class="eyebrow">Woche ${esc(S.week.woche)}</div>${DAYS.map(([d, l, work]) => {
    const p = (S.week.plan || {})[d] || {}, o = (S.week.kantine_tag || {})[d] || {};
    const it = dayItems(d, work), k = it.reduce((s, x) => s + x[1], 0), pr = it.reduce((s, x) => s + x[2], 0);
    return `<div class="day"><div class="row"><h3>${l}</h3><span class="num muted">${fmt(k)} kcal · ${fmt(pr)} g</span></div>
      <select data-d="${d}" data-f="rezept" aria-label="Gericht ${l}">${opts(p.rezept)}</select>
      <label style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="checkbox" style="width:20px" data-d="${d}" data-f="salat" ${p.salat ? "checked" : ""}> + Salat</label>
      ${work ? `<div class="grid2"><label>Mittag kcal<input type="number" inputmode="numeric" data-d="${d}" data-k="kcal" value="${o.kcal || ""}" placeholder="${S.set.kantine?.kcal || 700}"></label><label>Eiweiß g<input type="number" inputmode="numeric" data-d="${d}" data-k="eiweiss" value="${o.eiweiss || ""}" placeholder="${S.set.kantine?.eiweiss || 25}"></label></div>` : ""}</div>`;
  }).join("")}</section>`;
};
V.einkauf = () => {
  const { need, by } = needs(); const groups = {}, covered = [];
  let checked = {}; try { checked = JSON.parse(localStorage.getItem("ek-" + S.week.woche) || "{}"); } catch (e) { }
  Object.entries(need).forEach(([id, qty]) => { const i = S.ing[id]; if (!i) return; const miss = qty - (S.stock[id] || 0);
    if (miss <= 0.001) { covered.push(i.name); return; }
    const buy = i.packung ? `${Math.ceil(miss / i.packung - 1e-9)}× ${i.pack_name || fmt(i.packung) + " " + i.einheit}` : `${Math.ceil(miss - 1e-9)} ${i.einheit === "g" ? "g" : "Stk"}`;
    const deal = S.deals.find(x => x.fav === id || (S.fav[x.fav]?.name || "").toLowerCase().includes(i.name.toLowerCase().split(" ")[0]));
    (groups[i.bereich || "Sonstiges"] = groups[i.bereich || "Sonstiges"] || []).push({ id, name: i.name, buy, deal, det: [...by[id]].join(", ") }); });
  const keys = Object.keys(groups).sort((a, b) => AREA.indexOf(a) - AREA.indexOf(b));
  const list = keys.length ? keys.map(g => `<div class="eyebrow" style="margin-top:6px">${esc(g)}</div>${groups[g].map(x => `<div class="li ${checked[x.id] ? "done" : ""}"><input type="checkbox" data-ek="${x.id}" ${checked[x.id] ? "checked" : ""} aria-label="${esc(x.name)}"><div><div class="nm">${esc(x.name)}</div><div class="muted">${esc(x.det)}${x.deal ? ` · <b style="color:var(--paprika)">${esc(x.deal.haendler)} ${esc(x.deal.preis)}</b>` : ""}</div></div><span class="buy num">${esc(x.buy)}</span></div>`).join("")}`).join("") : `<div class="muted">Alles da – nichts zu kaufen.</div>`;
  const deals = S.deals.slice().sort((a, b) => (a.bis || "").localeCompare(b.bis || ""));
  return `<section class="card"><h2>Einkaufsliste</h2><div class="list">${list}</div>
    ${covered.length ? `<div class="muted"><b>Schon da:</b> ${covered.map(esc).join(", ")}</div>` : ""}
    <button class="ghost" data-act="eingekauft">Einkauf erledigt → Vorrat auffüllen</button></section>
  <section class="card"><h2>Favoriten-Radar</h2>${deals.length ? deals.map(d => `<div class="li deal"><span class="chip warn">${esc(d.haendler)}</span><div><div class="nm">${esc(d.produkt)}</div><div class="muted">${esc(d.bedingung || "")}${d.bis ? " · bis " + new Date(d.bis + "T12:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : ""}${d.pruefen ? ` · <b>prüfen:</b> ${esc(d.pruefen)}` : ""}</div></div><div class="price num">${esc(d.preis || "")}<small>${esc(d.grundpreis || "")}</small></div></div>`).join("") : `<div class="muted">Keine aktuellen Treffer. Der Scan läuft montags.</div>`}</section>`;
};
V.training = () => {
  if (S.session) return sessionView();
  if (!S.plans.length) return `<div class="empty">Noch kein Trainingsplan. Schick mir deinen Plan im Chat, ich trage ihn ein.</div>`;
  return S.plans.map(pl => `<section class="card"><h2>${esc(pl.name)}</h2>${pl.tage.map((t, i) => `<div class="day"><div class="row"><h3>${esc(t.name)}</h3><button class="small" data-act="start" data-i="${i}" data-plan="${pl.id}">Starten</button></div><div class="muted">${t.uebungen.map(u => esc(S.ex[u.uebung_id]?.name || u.uebung_id)).join(" · ")}</div></div>`).join("")}</section>`).join("");
};
function sessionView() {
  const s = S.session;
  return `<section class="card"><div class="row"><h2>${esc(s.tag.name)}</h2><button class="small ghost" data-act="abbrechen">Abbrechen</button></div><div class="muted">Pause 90–120 s · 2 s drücken/ziehen, 2 s zurück</div></section>
  ${s.tag.uebungen.map((u, ui) => { const e = S.ex[u.uebung_id] || { name: u.uebung_id }; const dv = S.dev[e.geraet_id] || {}; const step = +dv.gewicht_schritt || 5;
    const last = s.last[u.uebung_id]; const sug = suggestion(u, last, step);
    return `<section class="card ex"><div class="ex-head"><div><h3>${esc(e.name)}</h3><div class="muted">${u.saetze} × ${u.wdh_min}–${u.wdh_max} · ${esc(u.hinweis || e.hinweis || "")}</div></div>
      ${(e.muskeln || []).length ? `<div class="muscles">${e.muskeln.map(m => `<span class="chip">${esc(m)}</span>`).join("")}</div>` : ""}</div>
      ${e.animation_url ? `<img class="anim" src="${esc(e.animation_url)}" alt="Ausführung ${esc(e.name)}" loading="lazy">` : ""}
      ${sug ? `<div class="hint">${esc(sug)}</div>` : ""}
      ${s.sets[ui].map((st, si) => `<div class="set ${st.done ? "done" : ""}"><span class="num muted">${si + 1}</span>
        <div class="stepper"><button data-act="w" data-u="${ui}" data-s="${si}" data-d="-${step}" aria-label="weniger Gewicht">−</button><span>${fmt(st.gewicht, 1)} kg</span><button data-act="w" data-u="${ui}" data-s="${si}" data-d="${step}" aria-label="mehr Gewicht">+</button></div>
        <div class="stepper"><button data-act="r" data-u="${ui}" data-s="${si}" data-d="-1" aria-label="weniger Wiederholungen">−</button><span>${st.wdh} ×</span><button data-act="r" data-u="${ui}" data-s="${si}" data-d="1" aria-label="mehr Wiederholungen">+</button></div>
        <button class="ok" data-act="done" data-u="${ui}" data-s="${si}" aria-label="Satz erledigt">✓</button></div>`).join("")}</section>`; }).join("")}
  <section class="card"><div class="muted">Achillessehne heute?</div><div class="seg"><button data-act="schmerz" data-v="0" aria-pressed="${s.schmerz === false}">Schmerzfrei</button><button data-act="schmerz" data-v="1" aria-pressed="${s.schmerz === true}">Schmerzen</button></div>
  <button data-act="fertig">Training speichern</button></section>`;
}
function suggestion(u, last, step) {
  if (!last?.length) return "Erstes Mal: leichtes Gewicht wählen, Technik zuerst.";
  const allMax = last.length >= u.saetze && last.every(x => x.wdh >= u.wdh_max);
  const w = Math.max(...last.map(x => +x.gewicht || 0));
  return allMax ? `Letztes Mal alle Sätze mit ${u.wdh_max} Wdh. bei ${fmt(w, 1)} kg geschafft → heute ${fmt(w + step, 1)} kg.` : `Letztes Mal ${fmt(w, 1)} kg – Ziel: ${u.wdh_max} Wdh. in allen Sätzen.`;
}
V.mehr = () => `<section class="card"><h2>Vorrat</h2><div class="grid2">${Object.entries(S.ing).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([id, i]) => `<label>${esc(i.name)}<input type="number" inputmode="decimal" data-stock="${id}" value="${S.stock[id] || 0}"><span class="muted">${i.einheit === "g" ? "g / ml" : "Stück"}</span></label>`).join("")}</div></section>
  <section class="card"><h2>Rezepte</h2>${Object.values(S.rec).map(r => { const [k, p] = portion(r.id); return `<details><summary>${esc(r.name)} <span class="muted num">${fmt(k)} kcal · ${fmt(p)} g</span></summary><ul>${(r.zutaten || []).map(z => `<li>${fmt(z.menge, 2)} ${S.ing[z.id]?.einheit === "g" ? "g" : "×"} ${esc(S.ing[z.id]?.name || z.id)}</li>`).join("")}</ul><p class="muted">${esc(r.zubereitung || "")}</p></details>`; }).join("") || `<div class="muted">Keine Rezepte.</div>`}</section>
  <section class="card"><h2>Geräte</h2>${Object.values(S.dev).map(d => `<div class="row"><span>${esc(d.name)}</span><span class="muted num">${fmt(d.gewicht_schritt, 1)} kg-Stufen</span></div>`).join("") || `<div class="muted">Noch keine Geräte.</div>`}
    <details><summary>+ Gerät hinzufügen</summary><form id="newdev" class="grid2" style="margin-top:8px"><label style="grid-column:1/-1">Name<input name="name" required></label><label>Gewichtsstufe kg<input name="schritt" type="number" step="0.5" value="5"></label><label>Startgewicht kg<input name="min" type="number" step="0.5" value="0"></label><button style="grid-column:1/-1">Speichern</button></form></details></section>
  <section class="card"><button class="ghost" data-act="logout">Abmelden</button><div class="muted">Daten liegen in deiner eigenen Supabase-Datenbank.</div></section>`;

// ---------- Render & Events ----------
function render() {
  document.querySelectorAll("#tabs button").forEach(b => b.setAttribute("aria-current", b.dataset.v === S.view ? "page" : "false"));
  $("#title").parentElement.hidden = S.view === "heute"; $("#title").textContent = { heute: "Heute", woche: "Woche", einkauf: "Einkauf", training: "Training", mehr: "Mehr" }[S.view];
  $("#view").innerHTML = V[S.view]();
}
function go(v) { if (!S.week || $("#tabs").hidden) return; S.view = v; render(); window.scrollTo(0, 0); }

document.addEventListener("click", async e => {
  const t = e.target.closest("[data-go],[data-act],#tabs button"); if (!t) return;
  if (t.closest("#tabs")) return go(t.dataset.v);
  if (t.dataset.go) return go(t.dataset.go);
  const a = t.dataset.act;
  if (a === "logout") { await sb.auth.signOut(); location.reload(); }
  if (a === "kantine") { S.view = "woche"; render(); $(`input[data-d="${todayKey()}"][data-k="kcal"]`)?.focus(); }
  if (a === "start") return startSession(t.dataset.plan || S.plans[0].id, +t.dataset.i);
  if (a === "abbrechen") { S.session = null; render(); }
  if (a === "w" || a === "r") { const arr = S.session.sets[t.dataset.u], si = +t.dataset.s, st = arr[si];
    if (a === "w") { st.gewicht = Math.max(0, st.gewicht + +t.dataset.d); arr.slice(si + 1).forEach(x => { if (!x.done) x.gewicht = st.gewicht; }); }
    else st.wdh = Math.max(0, st.wdh + +t.dataset.d); render(); }
  if (a === "done") { const st = S.session.sets[t.dataset.u][t.dataset.s]; st.done = !st.done; render(); }
  if (a === "schmerz") { S.session.schmerz = t.dataset.v === "1"; render(); }
  if (a === "fertig") return finishSession();
  if (a === "eingekauft") return afterShop();
});
document.addEventListener("change", async e => {
  const t = e.target;
  if (t.dataset.f) { const d = t.dataset.d; S.week.plan = S.week.plan || {}; S.week.plan[d] = { ...(S.week.plan[d] || {}), [t.dataset.f]: t.type === "checkbox" ? t.checked : t.value }; render(); await saveWeek(); toast("Gespeichert"); }
  if (t.dataset.k) { const d = t.dataset.d; S.week.kantine_tag = S.week.kantine_tag || {}; const o = { ...(S.week.kantine_tag[d] || {}) }; const v = parseFloat(t.value); if (v > 0) o[t.dataset.k] = v; else delete o[t.dataset.k]; if (o.kcal) S.week.kantine_tag[d] = o; else delete S.week.kantine_tag[d]; render(); await saveWeek(); toast("Gespeichert"); }
  if (t.dataset.stock) { const v = Math.max(0, parseFloat(t.value) || 0); S.stock[t.dataset.stock] = v; await q(sb.from("bestand").upsert({ zutat_id: t.dataset.stock, menge: v })); toast("Vorrat gespeichert"); }
  if (t.dataset.ek) { let c = {}; try { c = JSON.parse(localStorage.getItem("ek-" + S.week.woche) || "{}"); } catch (x) { } c[t.dataset.ek] = t.checked; try { localStorage.setItem("ek-" + S.week.woche, JSON.stringify(c)); } catch (x) { } t.closest(".li").classList.toggle("done", t.checked); }
});
document.addEventListener("submit", async e => {
  if (e.target.id === "newdev") { e.preventDefault(); const f = new FormData(e.target); const name = f.get("name").trim(); if (!name) return;
    const id = name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const row = { id, name, gewicht_schritt: +f.get("schritt") || 5, gewicht_min: +f.get("min") || 0 };
    await q(sb.from("geraete").upsert(row)); S.dev[id] = row; render(); toast("Gerät gespeichert"); }
});

async function startSession(planId, i) {
  const pl = S.plans.find(p => p.id === planId); const tag = pl.tage[i]; const ids = tag.uebungen.map(u => u.uebung_id);
  const rows = await q(sb.from("saetze").select("uebung_id,gewicht,wdh,training_id,created_at").in("uebung_id", ids).order("created_at", { ascending: false }).limit(200));
  const last = {}; ids.forEach(id => { const r = rows.filter(x => x.uebung_id === id); if (r.length) { const tid = r[0].training_id; last[id] = r.filter(x => x.training_id === tid); } });
  const sets = tag.uebungen.map(u => { const l = last[u.uebung_id]; const step = +(S.dev[S.ex[u.uebung_id]?.geraet_id]?.gewicht_schritt) || 5;
    let w = l?.length ? Math.max(...l.map(x => +x.gewicht || 0)) : (+(S.dev[S.ex[u.uebung_id]?.geraet_id]?.gewicht_min) || 0);
    if (l?.length >= u.saetze && l.every(x => x.wdh >= u.wdh_max)) w += step;
    return Array.from({ length: u.saetze }, () => ({ gewicht: w, wdh: u.wdh_min, done: false })); });
  S.session = { plan: pl, tag, sets, last, schmerz: null }; S.view = "training"; render(); window.scrollTo(0, 0);
}
async function finishSession() {
  const s = S.session; const done = s.sets.flatMap((arr, ui) => arr.map((x, si) => ({ ...x, ui, si }))).filter(x => x.done);
  if (!done.length) return toast("Noch kein Satz abgehakt");
  const tr = await q(sb.from("trainings").insert({ plan_id: s.plan.id, tag_name: s.tag.name, schmerz: s.schmerz }).select().single());
  await q(sb.from("saetze").insert(done.map(x => ({ training_id: tr.id, uebung_id: s.tag.uebungen[x.ui].uebung_id, nr: x.si + 1, gewicht: x.gewicht, wdh: x.wdh }))));
  S.session = null; render(); toast(`Training gespeichert · ${done.length} Sätze`);
}
async function afterShop() {
  const { need } = needs(); const rows = [];
  Object.entries(need).forEach(([id, qty]) => { const i = S.ing[id]; if (!i) return; const miss = qty - (S.stock[id] || 0); if (miss <= 0) return;
    const add = i.packung ? Math.ceil(miss / i.packung - 1e-9) * i.packung : Math.ceil(miss - 1e-9); S.stock[id] = (S.stock[id] || 0) + add; rows.push({ zutat_id: id, menge: S.stock[id] }); });
  if (rows.length) await q(sb.from("bestand").upsert(rows));
  try { localStorage.removeItem("ek-" + S.week.woche); } catch (x) { }
  render(); toast("Vorrat aufgefüllt");
}

// ---------- Login ----------
function loginView(msg = "", email = "") {
  $("#tabs").hidden = true; $("#title").parentElement.hidden = false; $("#title").textContent = "Wochenteller";
  $("#view").innerHTML = `<section class="card"><h2>Anmelden</h2><p class="muted">Deine Daten liegen in deiner eigenen Datenbank. Nur du kommst mit diesem Login daran.</p>
    <form id="login" class="grid2" style="grid-template-columns:1fr"><label>E-Mail<input name="email" type="email" autocomplete="email" required></label><label>Passwort<input name="pw" type="password" autocomplete="current-password" minlength="8" required></label>
    <button>Anmelden</button><button type="button" class="ghost" id="signup">Erstes Mal? Konto anlegen</button></form>${msg ? `<div class="hint">${esc(msg)}</div>` : ""}</section>`;
  const form = $("#login"); form.email.value = email;
  const read = () => ({ email: String(form.email.value || "").trim(), password: String(form.pw.value || "") });
  form.onsubmit = async e => { e.preventDefault(); const c = read(); const { error } = await sb.auth.signInWithPassword(c); if (error) loginView("Anmeldung fehlgeschlagen: " + (error.message === "Email not confirmed" ? "Bitte zuerst den Link in der Bestätigungs-Mail antippen." : error.message), c.email); else boot(); };
  $("#signup").onclick = async () => {
    const c = read();
    if (!c.email || !form.email.checkValidity()) return loginView("Bitte zuerst deine E-Mail-Adresse eintragen.", c.email);
    if (c.password.length < 8) return loginView("Bitte ein Passwort mit mindestens 8 Zeichen eintragen, dann auf „Konto anlegen“ tippen.", c.email);
    const { error } = await sb.auth.signUp({ ...c, options: { emailRedirectTo: location.origin + location.pathname } });
    loginView(error ? "Fehler: " + error.message : "Konto angelegt. Öffne jetzt die Bestätigungs-Mail und tipp auf den Link, dann hier anmelden.", c.email);
  };
}
async function boot() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return loginView();
  S.user = data.session.user; $("#tabs").hidden = false;
  try { await loadAll(); } catch (e) { return; }
  render();
}
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => { });
boot();
