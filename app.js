// Wochenteller – Hauptteil: Laden, Ansichten Heute/Woche/Einkauf/Mehr, Navigation, Login.
import { sb, S, ACT, VIEWS, hooks, $, esc, fmt, q, all, put, flush, toast, buzz, status, DAYS, AREA, isoWeek, iso, todayISO, addDays, dayKey, monday, weekOf, dateLabel, relLabel,
  portion, goals, trainDays, dayTimeline, val, weekRow } from "./core.js";
import { closeSheet } from "./add.js";
import { tendonCard } from "./training.js";
import { weekReview, reviewCard } from "./trends.js";

// ---------- Laden ----------
async function loadAll() {
  status("Synchronisiere …");
  const t = todayISO();
  const [ing, rec, wks, st, set, fav, deals, dev, ex, plans, log, vals, trs, sets] = await Promise.all([
    q(sb.from("zutaten").select("*")), q(sb.from("rezepte").select("*")),
    all(() => sb.from("wochen").select("*").order("woche")),
    q(sb.from("bestand").select("*")), q(sb.from("einstellungen").select("*")),
    q(sb.from("favoriten").select("*")), q(sb.from("angebote").select("*").gte("bis", t)),
    q(sb.from("geraete").select("*")), q(sb.from("uebungen").select("*")),
    q(sb.from("trainingsplaene").select("*").eq("aktiv", true)),
    all(() => sb.from("eintraege").select("*").order("created_at")),
    all(() => sb.from("tageswerte").select("*").order("datum")),
    all(() => sb.from("trainings").select("*").order("datum")),
    all(() => sb.from("saetze").select("*").order("created_at"))]);
  S.ing = Object.fromEntries(ing.map(x => [x.id, x])); S.rec = Object.fromEntries(rec.map(x => [x.id, x]));
  S.weeks = Object.fromEntries(wks.map(x => [x.woche, x]));
  S.stock = Object.fromEntries(st.map(x => [x.zutat_id, +x.menge])); S.set = Object.fromEntries(set.map(x => [x.key, x.value]));
  S.fav = Object.fromEntries(fav.map(x => [x.id, x])); S.deals = deals;
  S.dev = Object.fromEntries(dev.map(x => [x.id, x])); S.ex = Object.fromEntries(ex.map(x => [x.id, x])); S.plans = plans;
  S.log = log; S.vals = vals; S.trainings = trs; S.sets = sets;
  S.date = S.date || t; S.week = ensureWeek(isoWeek()); S.ready = true;
  status(""); flush();
}
function ensureWeek(w) { return S.weeks[w] = S.weeks[w] || { woche: w, plan: {}, kantine_tag: {} }; }
async function saveWeek(w) { await put("wochen", "upsert", { woche: w.woche, plan: w.plan || {}, kantine_tag: w.kantine_tag || {} }); }

// ---------- Heute ----------
const gear = `<button class="icon" data-go="mehr" aria-label="Einstellungen und Vorrat"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button>`;
const SLOTL = { frueh: "Früh", mittag: "Mittag", abend: "Abend", snack: "Snack" };

VIEWS.heute = () => {
  const t = todayISO(), d = S.date || t, isToday = d === t, tl = dayTimeline(d), g = goals();
  const k = tl.reduce((s, x) => s + x.k, 0), p = tl.reduce((s, x) => s + x.p, 0), rest = g.kcal - k, open = tl.filter(x => x.pending).length;
  const train = trainDays().includes(dayKey(d)), mon = monday(d), water = +(val(d, "wasser")?.ml) || 0, kg = val(d, "gewicht")?.kg, cardio = val(d, "cardio");
  const head = isToday ? (rest >= 0 ? `Noch ${fmt(rest)} kcal bis zum Ziel` : `${fmt(-rest)} kcal über dem Ziel`) : d < t ? `${fmt(k)} kcal · ${fmt(p)} g Eiweiß` : `Geplant: ${fmt(k)} kcal`;
  const strip = Array.from({ length: 7 }, (_, i) => { const dd = addDays(mon, i), l = DAYS[i][1], has = dd < t && dayTimeline(dd).some(x => x.entry || x.kantine && !x.open);
    return `<button class="ds ${dd === d ? "now" : ""} ${dd === t ? "is-today" : ""} ${dd < t ? "past" : ""}" data-act="day" data-date="${dd}" aria-label="${dateLabel(dd)}" aria-pressed="${dd === d}"><span>${l}</span><i class="${trainDays().includes(DAYS[i][0]) ? "tr" : has ? "ok" : ""}"></i></button>`; }).join("");
  const done = S.trainings.some(x => x.datum === d), plan = S.plans[0], deal = S.deals[0];
  const rv = isToday && ["so", "mo"].includes(dayKey(t)) ? (dayKey(t) === "so" ? reviewCard(weekReview(mon), "Deine Woche") : reviewCard(weekReview(addDays(mon, -7)), "Letzte Woche")) : "";
  return `<section class="hero"><div class="row"><span class="muted" style="font-size:14px">${isToday ? dateLabel(d) : `<b>${esc(relLabel(d))}</b> · ${dateLabel(d, { day: "numeric", month: "long" })}`}</span>
      <span class="hero-nav"><button class="icon" data-act="shift" data-n="-1" aria-label="Vorheriger Tag"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button>${isToday ? "" : `<button class="small ghost" data-act="day" data-date="${t}">Heute</button>`}<button class="icon" data-act="shift" data-n="1" aria-label="Nächster Tag"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>${gear}</span></div>
    <h2>${head}</h2><div class="strip" role="group" aria-label="Tage dieser Woche">${strip}</div></section>
  <section class="card"><div class="meter"><div class="row"><b>Energie</b><span class="muted"><b class="v">${fmt(k)}</b> / ${fmt(g.kcal)} kcal</span></div>
      <div class="track ${k > g.kcal ? "over" : ""}"><i style="width:${Math.min(100, k / g.kcal * 100)}%"></i></div></div>
    <div class="meter"><div class="row"><b>Eiweiß</b><span class="muted"><b class="v">${fmt(p)}</b> / ${fmt(g.eiweiss)} g</span></div>
      <div class="track ice"><i style="width:${Math.min(100, p / g.eiweiss * 100)}%"></i></div></div>
    <div class="seg chips">${train ? `<span class="chip">Trainingstag</span>` : `<span class="chip">Ruhetag</span>`}
      <button class="chip ice" data-act="wasser-direkt" aria-label="250 ml Wasser eintragen">Wasser ${water ? fmt(water / 1000, 2) + " l" : "eintragen"} +</button>
      ${cardio ? `<button class="chip gold" data-act="cardio">${esc(cardio.art || "Cardio")} ${fmt(cardio.minuten)} min · ~${fmt(cardio.kcal)} kcal</button>` : ""}
      <button class="chip" data-act="gewicht">${kg ? fmt(kg, 1) + " kg" : "Gewicht eintragen"}</button>
      ${open ? `<span class="chip gold">${open} Foto${open > 1 ? "s" : ""} wartet auf Schätzung</span>` : ""}</div></section>
  ${tendonCard(true) && train && isToday ? tendonCard(true) : ""}
  <div class="row" style="padding:4px 4px 0"><h2>${isToday ? "Dein Tag" : "Essen"}</h2><button class="small ghost" data-go="woche">Woche planen</button></div>
  <div class="tl">${tl.length ? tl.map(x => { const tag = x.entry ? `button data-act="entry" data-id="${x.entry.id}"` : x.open ? `button data-act="kantine"` : "div";
      return `<${tag} class="tli ${x.planned ? "plan" : ""} ${x.pending ? "pending" : ""} ${x.open ? "open" : ""}"><span class="slot">${SLOTL[x.slot] || ""}</span><span class="tm"><b>${esc(x.name)}</b><span class="muted">${esc(x.det)}</span></span><span class="tv"><b>${x.pending ? "?" : fmt(x.k)}</b> kcal<br>${x.pending ? "–" : fmt(x.p)} g</span></${tag.split(" ")[0]}>`; }).join("")
    : `<div class="empty">Noch nichts eingetragen. Tippe unten auf „+“.</div>`}</div>
  ${rv}
  ${deal && isToday ? `<button class="radar" data-go="einkauf"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg><span><b>Radar:</b> ${esc(deal.produkt)} bei ${esc(deal.haendler)}${S.deals.length > 1 ? ` · +${S.deals.length - 1} weitere` : ""}</span></button>` : ""}
  ${train && plan && isToday && !done ? `<section class="card"><div class="row"><h2>Training</h2><span class="muted">${esc(plan.name)}</span></div>
    <div class="seg">${plan.tage.map((x, i) => `<button data-act="start" data-i="${i}" data-plan="${esc(plan.id)}">${esc(x.name)}</button>`).join("")}</div></section>` : ""}`;
};
ACT.day = t => { S.date = t.dataset.date; buzz(8); render(); };
ACT.shift = t => shiftDay(+t.dataset.n);
ACT["wasser-direkt"] = () => ACT.wasser();
function shiftDay(n) { S.date = addDays(S.date || todayISO(), n); buzz(8); render(); const v = $("#view"); v.classList.remove("slide-l", "slide-r"); void v.offsetWidth; v.classList.add(n > 0 ? "slide-l" : "slide-r"); }

// Wischen zwischen Tagen
let sx = null, sy = 0;
document.addEventListener("touchstart", e => { if (S.view !== "heute" || $("#sheet") || !e.target.closest("#view")) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
document.addEventListener("touchend", e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null; if (Math.abs(dx) > 70 && Math.abs(dy) < 50) shiftDay(dx < 0 ? 1 : -1); }, { passive: true });

// ---------- Woche ----------
VIEWS.woche = () => {
  const w = ensureWeek(weekOf(S.date || todayISO())), mon = monday(S.date || todayISO());
  const opts = r => `<option value="">– nichts –</option>` + Object.entries(S.rec).filter(([id]) => id !== "salat" && id !== "shake").sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([id, x]) => `<option value="${esc(id)}" ${r === id ? "selected" : ""}>${esc(x.name)}</option>`).join("");
  return `<section class="card"><div class="row"><div class="eyebrow">Woche ${esc(w.woche)}</div><span><button class="icon" data-act="wk" data-n="-7" aria-label="Vorherige Woche"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button><button class="icon" data-act="wk" data-n="7" aria-label="Nächste Woche"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button></span></div>
  ${DAYS.map(([d, l, work], i) => { const ds = addDays(mon, i), p = (w.plan || {})[d] || {}, o = (w.kantine_tag || {})[d] || {}, it = dayTimeline(ds), k = it.reduce((s, x) => s + x.k, 0), pr = it.reduce((s, x) => s + x.p, 0);
    return `<div class="day"><div class="row"><h3>${l} <span class="muted" style="font-weight:400">${dateLabel(ds, { day: "numeric", month: "numeric" })}</span></h3><span class="num muted">${fmt(k)} kcal · ${fmt(pr)} g</span></div>
      <select data-w="${esc(w.woche)}" data-d="${d}" data-f="rezept" aria-label="Abendessen ${l}">${opts(p.rezept)}</select>
      <label class="check"><input type="checkbox" data-w="${esc(w.woche)}" data-d="${d}" data-f="salat" ${p.salat ? "checked" : ""}> + Salat</label>
      ${work ? `<div class="grid2"><label>Mittag kcal<input type="number" inputmode="numeric" data-w="${esc(w.woche)}" data-d="${d}" data-k="kcal" value="${o.kcal || ""}" placeholder="${S.set.kantine?.kcal || 700}"></label><label>Eiweiß g<input type="number" inputmode="numeric" data-w="${esc(w.woche)}" data-d="${d}" data-k="eiweiss" value="${o.eiweiss || ""}" placeholder="${S.set.kantine?.eiweiss || 25}"></label>
        <label style="grid-column:1/-1">Was gab's? (optional)<input data-w="${esc(w.woche)}" data-d="${d}" data-k="notiz" value="${esc(o.notiz || "")}" maxlength="140"></label></div>` : ""}</div>`; }).join("")}</section>`;
};
ACT.wk = t => { S.date = addDays(S.date || todayISO(), +t.dataset.n); render(); };

// ---------- Einkauf ----------
function needs() {
  const w = S.week, por = {};
  DAYS.forEach(([d]) => { const p = (w?.plan || {})[d] || {};
    if (p.rezept && S.rec[p.rezept]) por[p.rezept] = (por[p.rezept] || 0) + 1;
    if (p.salat && S.rec.salat) por.salat = (por.salat || 0) + 1;
    if (S.rec.shake) por.shake = (por.shake || 0) + 1; });
  const need = {}, by = {};
  Object.entries(por).forEach(([rid, n]) => { const r = S.rec[rid]; const per = r.portionen || 1; const f = (rid === "salat" || rid === "shake") ? n : Math.ceil(n / per);
    (r.zutaten || []).forEach(z => { need[z.id] = (need[z.id] || 0) + z.menge * f; (by[z.id] = by[z.id] || new Set()).add(r.kurz || r.name); }); });
  return { need, by };
}
VIEWS.einkauf = () => {
  const { need, by } = needs(); const groups = {}, covered = [];
  let checked = {}; try { checked = JSON.parse(localStorage.getItem("ek-" + S.week.woche) || "{}"); } catch (e) { }
  Object.entries(need).forEach(([id, qty]) => { const i = S.ing[id]; if (!i) return; const miss = qty - (S.stock[id] || 0);
    if (miss <= 0.001) { covered.push(i.name); return; }
    const buy = i.packung ? `${Math.ceil(miss / i.packung - 1e-9)}× ${i.pack_name || fmt(i.packung) + " " + i.einheit}` : `${Math.ceil(miss - 1e-9)} ${i.einheit === "g" ? "g" : "Stk"}`;
    const deal = S.deals.find(x => x.fav === id || (S.fav[x.fav]?.name || "").toLowerCase().includes(i.name.toLowerCase().split(" ")[0]));
    (groups[i.bereich || "Sonstiges"] = groups[i.bereich || "Sonstiges"] || []).push({ id, name: i.name, buy, deal, det: [...by[id]].join(", ") }); });
  const keys = Object.keys(groups).sort((a, b) => AREA.indexOf(a) - AREA.indexOf(b));
  const list = keys.length ? keys.map(g => `<div class="eyebrow" style="margin-top:6px">${esc(g)}</div>${groups[g].map(x => `<label class="li ${checked[x.id] ? "done" : ""}"><input type="checkbox" data-ek="${esc(x.id)}" ${checked[x.id] ? "checked" : ""}><div><div class="nm">${esc(x.name)}</div><div class="muted">${esc(x.det)}${x.deal ? ` · <b style="color:var(--paprika)">${esc(x.deal.haendler)} ${esc(x.deal.preis)}</b>` : ""}</div></div><span class="buy num">${esc(x.buy)}</span></label>`).join("")}`).join("") : `<div class="muted">Alles da – nichts zu kaufen.</div>`;
  const deals = S.deals.slice().sort((a, b) => (a.bis || "").localeCompare(b.bis || ""));
  return `<section class="card"><h2>Einkaufsliste</h2><div class="list">${list}</div>
    ${covered.length ? `<div class="muted"><b>Schon da:</b> ${covered.map(esc).join(", ")}</div>` : ""}
    <button class="ghost" data-act="eingekauft">Einkauf erledigt → Vorrat auffüllen</button></section>
  <section class="card"><h2>Favoriten-Radar</h2>${deals.length ? deals.map(d => `<div class="li deal"><span class="chip warn">${esc(d.haendler)}</span><div><div class="nm">${esc(d.produkt)}</div><div class="muted">${esc(d.bedingung || "")}${d.bis ? " · bis " + new Date(d.bis + "T12:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : ""}${d.pruefen ? ` · <b>prüfen:</b> ${esc(d.pruefen)}` : ""}</div></div><div class="price num">${esc(d.preis || "")}<small>${esc(d.grundpreis || "")}</small></div></div>`).join("") : `<div class="muted">Keine aktuellen Treffer. Der Scan läuft montags.</div>`}</section>`;
};
ACT.eingekauft = async () => {
  const { need } = needs(); const rows = [];
  Object.entries(need).forEach(([id, qty]) => { const i = S.ing[id]; if (!i) return; const miss = qty - (S.stock[id] || 0); if (miss <= 0) return;
    const add = i.packung ? Math.ceil(miss / i.packung - 1e-9) * i.packung : Math.ceil(miss - 1e-9); S.stock[id] = (S.stock[id] || 0) + add; rows.push({ zutat_id: id, menge: S.stock[id] }); });
  try { localStorage.removeItem("ek-" + S.week.woche); } catch (x) { }
  render(); if (rows.length) await put("bestand", "upsert", rows); toast("Vorrat aufgefüllt");
};

// ---------- Mehr ----------
VIEWS.mehr = () => { const g = goals(), photos = S.log.filter(e => e.foto_pfad && !e.foto_gesichert);
  return `<section class="card"><h2>Ziele</h2><form id="ziele" class="grid2"><label>kcal pro Tag<input name="kcal" type="number" inputmode="numeric" value="${g.kcal}" min="1000" max="5000"></label><label>Eiweiß g pro Tag<input name="eiweiss" type="number" inputmode="numeric" value="${g.eiweiss}" min="40" max="300"></label><button style="grid-column:1/-1" class="ghost">Ziele speichern</button></form></section>
  <section class="card"><h2>Essensfotos</h2><div class="muted" id="fotostat">${photos.length} Foto${photos.length === 1 ? "" : "s"} online · Speicher wird geprüft …</div>
    <div class="muted">Fotos werden beim Hochladen auf ca. 150 KB verkleinert. 1 GB kostenloser Speicher reicht für mehrere tausend Fotos.</div>
    ${photos.length ? `<button class="ghost" data-act="fotos-zip">Alle Fotos herunterladen (ZIP)</button>` : ""}
    ${S.zipped?.length ? `<button class="ghost danger" data-act="fotos-del">${S.zipped.length} gesicherte Fotos online löschen</button><div class="muted">Fotos, die noch auf eine Schätzung warten, bleiben online.</div>` : ""}</section>
  <section class="card"><h2>Daten</h2>
    <div class="muted">Sichere regelmäßig alle Daten auf dein Gerät, etwa einmal im Monat. Der Export öffnet sich auch in Excel.</div>
    <button class="ghost" data-act="export">Alle Daten exportieren (ZIP)</button>
    <label class="btn ghost filebtn" for="imp-in">Gewicht aus anderer App importieren (CSV)</label><input id="imp-in" type="file" accept=".csv,.txt,text/csv,text/plain" hidden>
    <div class="muted">Funktioniert mit Exporten aus Samsung Health, Google Fit, Waagen-Apps oder Excel: Jede Zeile braucht ein Datum und ein Gewicht in kg.</div></section>
  <section class="card"><h2>Vorrat</h2><div class="grid2">${Object.entries(S.ing).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([id, i]) => `<label>${esc(i.name)}<input type="number" inputmode="decimal" data-stock="${esc(id)}" value="${S.stock[id] || 0}"><span class="muted">${i.einheit === "g" ? "g / ml" : "Stück"}</span></label>`).join("")}</div></section>
  <section class="card"><h2>Rezepte</h2>${Object.values(S.rec).map(r => { const [k, p] = portion(r.id); return `<details><summary>${esc(r.name)} <span class="muted num">${fmt(k)} kcal · ${fmt(p)} g</span></summary><ul>${(r.zutaten || []).map(z => `<li>${fmt(z.menge, 2)} ${S.ing[z.id]?.einheit === "g" ? "g" : "×"} ${esc(S.ing[z.id]?.name || z.id)}</li>`).join("")}</ul><p class="muted">${esc(r.zubereitung || "")}</p></details>`; }).join("") || `<div class="muted">Keine Rezepte.</div>`}</section>
  <section class="card"><h2>Geräte</h2>${Object.values(S.dev).map(d => `<div class="row"><span>${esc(d.name)}</span><span class="muted num">${fmt(d.gewicht_schritt, 1)} kg-Stufen</span></div>`).join("") || `<div class="muted">Noch keine Geräte.</div>`}
    <details><summary>+ Gerät hinzufügen</summary><form id="newdev" class="grid2" style="margin-top:8px"><label style="grid-column:1/-1">Name<input name="name" required></label><label>Gewichtsstufe kg<input name="schritt" type="number" step="0.5" value="5"></label><label>Startgewicht kg<input name="min" type="number" step="0.5" value="0"></label><button style="grid-column:1/-1">Speichern</button></form></details></section>
  <section class="card"><button class="ghost" data-act="logout">Abmelden</button><div class="muted">Daten liegen in deiner eigenen Supabase-Datenbank (Frankfurt).</div></section>`; };
async function fotoStat() {
  const el = $("#fotostat"); if (!el) return;
  const { data } = await sb.storage.from("fotos").list(S.user.id, { limit: 1000 });
  const n = data?.length || 0, mb = (data || []).reduce((a, x) => a + (+x.metadata?.size || 0), 0) / 1048576;
  if ($("#fotostat")) $("#fotostat").textContent = `${n} Foto${n === 1 ? "" : "s"} online · ${fmt(mb, 1)} MB von 1.000 MB`;
}
ACT["fotos-zip"] = async t => {
  const list = S.log.filter(e => e.foto_pfad && !e.foto_gesichert); if (!list.length) return;
  t.disabled = true; t.textContent = "Lade Fotos …";
  try {
    const { zipSync } = await import("https://cdn.jsdelivr.net/npm/fflate@0.8.2/+esm"); const files = {}, ok = [];
    for (const [i, e] of list.entries()) { t.textContent = `Lade Foto ${i + 1} von ${list.length} …`;
      const { data } = await sb.storage.from("fotos").download(e.foto_pfad); if (!data) continue;
      const nm = `${e.datum}_${(e.name || "essen").replace(/[^\wäöüÄÖÜß-]+/g, "-").slice(0, 40)}_${e.id.slice(0, 6)}.jpg`;
      files[nm] = [new Uint8Array(await data.arrayBuffer()), { level: 0 }]; if (e.status !== "offen") ok.push(e.id); }
    const blob = new Blob([zipSync(files)], { type: "application/zip" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `essensfotos-${todayISO()}.zip`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    S.zipped = ok; toast(`${Object.keys(files).length} Fotos heruntergeladen`);
  } catch (e) { toast("Download fehlgeschlagen: " + (e.message || e), "warn"); }
  render();
};
ACT["fotos-del"] = async t => {
  if (t.dataset.sure !== "1") { t.dataset.sure = "1"; t.textContent = "Sicher? Die ZIP-Datei ist gespeichert?"; return; }
  const list = S.log.filter(e => S.zipped?.includes(e.id)); t.disabled = true;
  const { error } = await sb.storage.from("fotos").remove(list.map(e => e.foto_pfad));
  if (error) return toast("Löschen fehlgeschlagen: " + error.message, "warn");
  for (const e of list) { e.foto_gesichert = true; await put("eintraege", "update", { foto_gesichert: true }, { id: e.id }); }
  S.zipped = []; render(); toast(`${list.length} Fotos online gelöscht`);
};
// ---------- Export ----------
const TABLES = ["eintraege", "tageswerte", "trainings", "saetze", "wochen", "rezepte", "zutaten", "bestand", "einstellungen", "favoriten", "geraete", "uebungen", "trainingsplaene", "angebote", "filialen"];
function csv(rows) {
  if (!rows.length) return "";
  const flat = rows.map(r => { const o = {}; Object.entries(r).forEach(([k, v]) => { if (k === "user_id") return; if (k === "werte" && v && typeof v === "object") Object.entries(v).forEach(([a, b]) => o[a] = b); else o[k] = v; }); return o; });
  const cols = [...new Set(flat.flatMap(o => Object.keys(o)))];
  const cell = v => { if (v == null) return ""; if (typeof v === "number") return String(v).replace(".", ","); if (typeof v === "object") v = JSON.stringify(v); v = String(v); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  return "\ufeff" + [cols.join(";"), ...flat.map(o => cols.map(c => cell(o[c])).join(";"))].join("\r\n");
}
ACT.export = async t => {
  t.disabled = true; const old = t.textContent;
  try {
    const { zipSync, strToU8 } = await import("https://cdn.jsdelivr.net/npm/fflate@0.8.2/+esm"); const data = {}, files = {};
    for (const tb of TABLES) { t.textContent = `Lade ${tb} …`; data[tb] = await all(() => sb.from(tb).select("*")); }
    files["alle_daten.json"] = strToU8(JSON.stringify({ exportiert: new Date().toISOString(), app: "Wochenteller", daten: data }, null, 1));
    ["eintraege", "tageswerte", "trainings", "saetze"].forEach(tb => { if (data[tb].length) files[`${tb}.csv`] = strToU8(csv(data[tb])); });
    const blob = new Blob([zipSync(files)], { type: "application/zip" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `wochenteller-export-${todayISO()}.zip`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(`Export fertig · ${Object.values(data).reduce((n, r) => n + r.length, 0)} Zeilen`);
  } catch (e) { toast("Export fehlgeschlagen: " + (e.message || e), "warn"); }
  t.disabled = false; t.textContent = old;
};

// ---------- Import: Gewicht aus beliebiger CSV/Text-Datei ----------
function parseWeights(text) {
  const byDay = {};
  text.split(/\r?\n/).forEach(line => {
    let d = null, m;
    if ((m = line.match(/(\d{4})-(\d{2})-(\d{2})/))) d = `${m[1]}-${m[2]}-${m[3]}`;
    else if ((m = line.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/))) d = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    if (!d || d > todayISO() || d < "1990-01-01") return;
    const rest = line.replace(m[0], " ").replace(/\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?/g, " ").replace(/\b\d{10,}\b/g, " ");
    const nums = (rest.match(/\d{2,3}(?:[.,]\d{1,2})?/g) || []).map(x => +x.replace(",", ".")).filter(x => x >= 35 && x <= 300);
    if (nums.length) (byDay[d] = byDay[d] || []).push(nums[0]);
  });
  return Object.entries(byDay).map(([d, a]) => ({ d, kg: Math.round(a.reduce((s, x) => s + x, 0) / a.length * 10) / 10 })).sort((a, b) => a.d.localeCompare(b.d));
}
document.addEventListener("change", async e => {
  if (e.target.id !== "imp-in") return; const f = e.target.files?.[0]; if (!f) return;
  const rows = parseWeights(await f.text()), have = new Set(S.vals.filter(v => v.quelle === "gewicht").map(v => v.datum)), neu = rows.filter(r => !have.has(r.d));
  if (!rows.length) return toast("Keine Gewichtswerte erkannt. Schick mir die Datei im Chat, dann passe ich den Import an.", "warn");
  const { openSheet, closeSheet: close } = await import("./add.js");
  openSheet(`<div class="sheet-head"><h2>Gewicht importieren</h2><span class="muted">${esc(f.name)}</span></div>
    <div class="kpis three"><div><span class="muted">Gefunden</span><b class="num">${rows.length}</b></div><div><span class="muted">Neu</span><b class="num">${neu.length}</b></div><div><span class="muted">Bereich</span><b class="num">${fmt(Math.min(...rows.map(r => r.kg)), 0)}–${fmt(Math.max(...rows.map(r => r.kg)), 0)}</b></div></div>
    <div class="muted">Von ${dateLabel(rows[0].d, { day: "numeric", month: "short", year: "numeric" })} bis ${dateLabel(rows[rows.length - 1].d, { day: "numeric", month: "short", year: "numeric" })}. Tage, die schon ein Gewicht haben, bleiben unverändert.</div>
    <div class="tablewrap"><table class="mtab"><thead><tr><th scope="col">Datum</th><th scope="col">kg</th></tr></thead><tbody>${neu.slice(-5).map(r => `<tr><th scope="row">${r.d}</th><td>${fmt(r.kg, 1)}</td></tr>`).join("")}</tbody></table></div>
    <button id="imp-go" ${neu.length ? "" : "disabled"}>${neu.length} Werte importieren</button>`,
  sh => sh.querySelector("#imp-go").onclick = async () => {
    const add = neu.map(r => ({ datum: r.d, quelle: "gewicht", werte: { kg: r.kg, import: f.name.slice(0, 60) } }));
    S.vals.push(...add); close(); render();
    for (let i = 0; i < add.length; i += 500) await put("tageswerte", "upsert", add.slice(i, i + 500));
    toast(`${add.length} Gewichtswerte importiert`); });
  e.target.value = "";
});

ACT.back = () => go(S.prev && S.prev !== S.view ? S.prev : "heute");
ACT.logout = async () => { await sb.auth.signOut(); location.reload(); };

// ---------- Rendern & Navigation ----------
const TITLES = { heute: "Heute", woche: "Woche planen", einkauf: "Einkauf", training: "Training", trends: "Trends", mehr: "Mehr" };
function render() {
  if (!S.ready) return;
  document.querySelectorAll("#tabs [data-v]").forEach(b => b.setAttribute("aria-current", b.dataset.v === S.view ? "page" : "false"));
  $("header.top").hidden = S.view === "heute"; $("#title").textContent = TITLES[S.view] || "";
  $("#back").hidden = !["woche", "mehr"].includes(S.view);
  $("#view").innerHTML = VIEWS[S.view]();
  if (S.view === "mehr") fotoStat();
}
function go(v) { if (!S.ready) return; closeSheet(); if (!["woche", "mehr"].includes(S.view)) S.prev = S.view; S.view = v; if (v !== "heute" && v !== "woche") S.date = S.date || todayISO(); render(); window.scrollTo(0, 0); }
hooks.render = render; hooks.go = go;

document.addEventListener("click", async e => {
  const t = e.target.closest("[data-go],[data-act],#tabs [data-v]"); if (!t || t.disabled) return;
  if (t.dataset.v && t.closest("#tabs")) { buzz(6); return go(t.dataset.v); }
  if (t.dataset.go) return go(t.dataset.go);
  const fn = ACT[t.dataset.act]; if (fn) { e.preventDefault(); await fn(t, e); }
});
document.addEventListener("change", async e => {
  const t = e.target;
  if (t.dataset.f) { const w = ensureWeek(t.dataset.w), d = t.dataset.d; w.plan = w.plan || {}; w.plan[d] = { ...(w.plan[d] || {}), [t.dataset.f]: t.type === "checkbox" ? t.checked : t.value }; render(); await saveWeek(w); toast("Gespeichert"); }
  if (t.dataset.k) { const w = ensureWeek(t.dataset.w), d = t.dataset.d; w.kantine_tag = w.kantine_tag || {}; const o = { ...(w.kantine_tag[d] || {}) };
    if (t.dataset.k === "notiz") { if (t.value.trim()) o.notiz = t.value.trim(); else delete o.notiz; } else { const v = parseFloat(t.value); if (v > 0) o[t.dataset.k] = v; else delete o[t.dataset.k]; }
    if (o.kcal) w.kantine_tag[d] = o; else delete w.kantine_tag[d]; render(); await saveWeek(w); toast("Gespeichert"); }
  if (t.dataset.stock) { const v = Math.max(0, parseFloat(t.value) || 0); S.stock[t.dataset.stock] = v; await put("bestand", "upsert", { zutat_id: t.dataset.stock, menge: v }); toast("Vorrat gespeichert"); }
  if (t.dataset.ek) { let c = {}; try { c = JSON.parse(localStorage.getItem("ek-" + S.week.woche) || "{}"); } catch (x) { } c[t.dataset.ek] = t.checked; try { localStorage.setItem("ek-" + S.week.woche, JSON.stringify(c)); } catch (x) { } t.closest(".li").classList.toggle("done", t.checked); buzz(10); }
});
document.addEventListener("submit", async e => {
  if (e.target.id === "newdev") { e.preventDefault(); const f = new FormData(e.target); const name = f.get("name").trim(); if (!name) return;
    const id = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const row = { id, name, gewicht_schritt: +f.get("schritt") || 5, gewicht_min: +f.get("min") || 0 };
    S.dev[id] = row; render(); await put("geraete", "upsert", row); toast("Gerät gespeichert"); }
  if (e.target.id === "ziele") { e.preventDefault(); const f = new FormData(e.target); const v = { ...(S.set.ziel || {}), kcal: +f.get("kcal") || 2200, eiweiss: +f.get("eiweiss") || 170 };
    S.set.ziel = v; render(); await put("einstellungen", "upsert", { key: "ziel", value: v }); toast("Ziele gespeichert"); }
});

// ---------- Login ----------
function loginView(msg = "", email = "") {
  S.ready = false; $("#tabs").hidden = true; $("header.top").hidden = false; $("#back").hidden = true; $("#title").textContent = "Wochenteller";
  $("#view").innerHTML = `<section class="card"><h2>Anmelden</h2><p class="muted">Deine Daten liegen in deiner eigenen Datenbank. Nur du kommst mit diesem Login daran.</p>
    <form id="login" class="grid2" style="grid-template-columns:1fr"><label>E-Mail<input name="email" type="email" autocomplete="email" required></label><label>Passwort<input name="pw" type="password" autocomplete="current-password" required></label>
    <button>Anmelden</button></form>${msg ? `<div class="hint">${esc(msg)}</div>` : ""}</section>`;
  const form = $("#login"); form.email.value = email;
  form.onsubmit = async e => { e.preventDefault(); const c = { email: String(form.email.value || "").trim(), password: String(form.pw.value || "") };
    const { error } = await sb.auth.signInWithPassword(c);
    if (error) loginView("Anmeldung fehlgeschlagen: " + (error.message === "Email not confirmed" ? "Bitte zuerst den Link in der Bestätigungs-Mail antippen." : error.message), c.email); else boot(); };
}
async function boot() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return loginView();
  S.user = data.session.user; $("#tabs").hidden = false;
  try { await loadAll(); } catch (e) { $("#view").innerHTML = `<div class="empty">Keine Verbindung zur Datenbank. <button class="ghost" onclick="location.reload()">Neu laden</button></div>`; status("Offline"); return; }
  render();
}
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => { });
boot();
