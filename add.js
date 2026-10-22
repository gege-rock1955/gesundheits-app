// Eintragen: Plus-Menü mit Foto, Barcode, Schnell-Eintrag, Zuletzt gegessen, Gewicht, Wasser.
import { sb, S, ACT, $, esc, fmt, weekOf, SLOTS, slotTime, NUTR, breakdown, addN, imgTag, hydrateImgs, DAYS, MESS, put, toast, buzz, uid, slotNow, todayISO, dayKey, val, render, go, relLabel } from "./core.js";

// ---------- Blatt (Bottom Sheet) ----------
let lastFocus = null, stopCam = null;
export function openSheet(html, mount) {
  const keep = sheetDate; closeSheet(); sheetDate = keep; lastFocus = document.activeElement;
  const bg = document.createElement("div"); bg.className = "sheet-bg"; bg.id = "sheet";
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Eintragen"><div class="grip" aria-hidden="true"></div>${html}</div>`;
  bg.addEventListener("click", e => { if (e.target === bg) closeSheet(); });
  document.body.append(bg); document.body.classList.add("noscroll");
  requestAnimationFrame(() => bg.classList.add("open"));
  mount?.(bg.querySelector(".sheet")); hydrateImgs(bg);
  bg.querySelector("input:not([type=file]),button")?.focus({ preventScroll: true });
}
export const sheetCleanup = [];
export function closeSheet() {
  stopCam?.(); stopCam = null; sheetDate = null; while (sheetCleanup.length) { try { sheetCleanup.pop()(); } catch (e) { } }
  const el = $("#sheet"); if (!el) return; el.remove(); document.body.classList.remove("noscroll"); lastFocus?.focus?.({ preventScroll: true });
}
document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#sheet")) closeSheet(); });
ACT["sheet-close"] = closeSheet;

const slotSelect = (sel = slotNow()) => `<label>Zeit<select name="slot">${SLOTS.map(([k, l]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${slotTime(k) ? slotTime(k) + " · " + l : l + " · jetzt"}</option>`).join("")}</select></label>`;
let sheetDate = null; // Datum, wenn ein Blatt aus dem Verlauf geöffnet wurde
const day = () => sheetDate || S.date || todayISO();
const fromT = t => { sheetDate = t?.dataset?.date || null; };

function recent() {
  const seen = new Set(), out = [];
  [...S.log].sort((a, b) => (b.created_at || b.datum).localeCompare(a.created_at || a.datum)).forEach(e => {
    const key = e.name.trim().toLowerCase(); if (e.status === "offen" || !(+e.kcal > 0) || seen.has(key)) return; seen.add(key); out.push(e); });
  return out.slice(0, 8);
}

// ---------- Plus-Menü ----------
ACT.plus = () => {
  const d = day(), work = DAYS.find(x => x[0] === dayKey(d))[2], water = +(val(d, "wasser")?.ml) || 0, rc = recent();
  openSheet(`<div class="sheet-head"><h2>Eintragen</h2><span class="muted">${esc(relLabel(d))}</span></div>
    <div class="quick">
      <label class="qa" for="foto-in"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Foto vom Essen</label>
      <input id="foto-in" type="file" accept="image/*" capture="environment" hidden>
      <button class="qa" data-act="scan"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M7 8v8M10 8v8M13 8v8M16 8v8"/></svg>Barcode</button>
      <button class="qa" data-act="quick"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19h14M7 15l8-8 3 3-8 8H7z"/></svg>Schnell eintragen</button>
      <button class="qa" data-act="gewicht"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 10a4 4 0 0 1 6 0l-2 2"/></svg>Gewicht</button>
      <button class="qa" data-act="messung"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg>Messwerte</button>
      <button class="qa" data-act="wasser-sheet"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/></svg>Wasser<small>${water ? fmt(water / 1000, 2) + " l heute" : ""}</small></button>
      <button class="qa" data-act="cardio"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l4-8h5l3 8M10 9 8 5H6"/></svg>Cardio${val(day(), "cardio") ? `<small>${fmt(val(day(), "cardio").minuten)} min eingetragen</small>` : ""}</button>
      ${work ? `<button class="qa" data-act="kantine"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13h16a8 8 0 0 1-16 0zM12 5v4M8 7v2M16 7v2"/></svg>Mittagessen</button>` : `<button class="qa" data-go="training"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v16M18 4v16M3 8v8M21 8v8M6 12h12"/></svg>Training</button>`}
    </div>
    ${rc.length ? `<div class="eyebrow">Zuletzt gegessen</div><div class="recent">${rc.map((e, i) => `<button class="rc" data-act="recent" data-i="${i}"><b>${esc(e.name)}</b><span class="num">${fmt(e.kcal)} kcal · ${fmt(e.eiweiss)} g</span></button>`).join("")}</div>` : ""}`,
  sh => { sh._recent = rc; sh.querySelector("#foto-in").addEventListener("change", ev => { const f = ev.target.files?.[0]; if (f) photoForm(f); }); });
};
// Mittagessen direkt eintragen (wird im Wochenplan beim Tag gespeichert)
ACT.kantine = t => { fromT(t); const d = day(), w = S.weeks[weekOf(d)] || {}, o = (w.kantine_tag || {})[dayKey(d)] || {};
  openSheet(`<div class="sheet-head"><h2>Mittagessen</h2><span class="muted">${esc(relLabel(d))} · 11:30</span></div>
    <form id="mf2" class="form"><label class="wide">Was gab's?<input name="notiz" maxlength="140" value="${esc(o.notiz || "")}" placeholder="z. B. Lachs, Kartoffelsalat 100 g, Salat, 1 Ei"></label>
    <label>kcal<input name="kcal" type="number" inputmode="numeric" min="0" required value="${o.kcal || ""}"></label><label>Eiweiß g<input name="eiweiss" type="number" inputmode="decimal" min="0" value="${o.eiweiss || ""}"></label>
    <p class="muted wide">Werte unklar? Schick mir ein Foto im Chat, ich schätze sie und trage sie ein.</p>
    <button class="wide">Speichern</button>${o.kcal ? `<button type="button" class="ghost danger wide" data-act="mittag-del">Eintrag löschen</button>` : ""}</form>`,
  sh => sh.querySelector("#mf2").onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target), k = dayKey(d), wk = S.weeks[weekOf(d)] = S.weeks[weekOf(d)] || { woche: weekOf(d), plan: {}, kantine_tag: {} };
    wk.kantine_tag = { ...(wk.kantine_tag || {}), [k]: { kcal: +f.get("kcal"), eiweiss: +String(f.get("eiweiss") || 0).replace(",", "."), ...(String(f.get("notiz")).trim() ? { notiz: String(f.get("notiz")).trim() } : {}) } };
    closeSheet(); buzz(15); render(); await put("wochen", "upsert", { woche: wk.woche, plan: wk.plan || {}, kantine_tag: wk.kantine_tag }); toast("Mittagessen gespeichert"); });
};
ACT["mittag-del"] = async t => { if (t.dataset.sure !== "1") { t.dataset.sure = "1"; t.textContent = "Wirklich löschen?"; return; }
  const d = day(), wk = S.weeks[weekOf(d)]; if (!wk) return; const kt = { ...(wk.kantine_tag || {}) }; delete kt[dayKey(d)]; wk.kantine_tag = kt;
  closeSheet(); render(); await put("wochen", "upsert", { woche: wk.woche, plan: wk.plan || {}, kantine_tag: kt }); toast("Gelöscht"); };
ACT.recent = t => { const e = $("#sheet .sheet")?._recent?.[+t.dataset.i]; if (!e) return;
  saveEntry({ name: e.name, kcal: e.kcal, eiweiss: e.eiweiss, kh: e.kh, fett: e.fett, menge: e.menge, einheit: e.einheit, slot: day() === todayISO() ? slotNow() : e.slot, quelle: "zuletzt" }); };

async function saveEntry(f) {
  const row = { id: uid(), datum: day(), slot: f.slot || slotNow(), name: (f.name || "Essen").trim().slice(0, 120), quelle: f.quelle || "manuell",
    kcal: f.kcal === "" || f.kcal == null ? null : +f.kcal, eiweiss: f.eiweiss === "" || f.eiweiss == null ? null : +f.eiweiss,
    kh: f.kh ?? null, fett: f.fett ?? null, zucker: f.zucker ?? null, salz: f.salz ?? null, menge: f.menge ? +f.menge : null, einheit: f.einheit || null, barcode: f.barcode || null,
    foto_pfad: f.foto_pfad || null, status: f.status || "fertig" };
  S.log.push({ ...row, created_at: new Date().toISOString() }); closeSheet(); buzz(15); render();
  await put("eintraege", "insert", row);
  toast(row.status === "offen" ? "Foto gespeichert – Schätzung folgt" : `${row.name} eingetragen`);
}

// ---------- Details: Zutaten mit allen Nährwerten ----------
const nf = (v, d) => v == null ? "–" : fmt(v, d);
export function nutrTable(rows, total, head = "Zutat") {
  const cols = NUTR.filter(([k]) => k !== "ges_fett" && k !== "ballast");
  return `<div class="tablewrap"><table class="ntab"><thead><tr><th scope="col">${head}</th>${cols.map(([, l, u]) => `<th scope="col">${l.replace("davon ", "")}${u && u !== "kcal" ? ` (${u})` : u === "kcal" ? " (kcal)" : ""}</th>`).join("")}</tr></thead><tbody>
    ${rows.map(r => `<tr><th scope="row">${esc(r.name)}<small>${r.menge != null ? fmt(r.menge, r.unit === "Stk" ? 2 : 0) + " " + r.unit : ""}${r.quelle === "Etikett" ? " · Etikett" : r.quelle ? " · Richtwert" : ""}</small></th>${cols.map(([k, , , d]) => `<td>${nf(r.v[k], d)}</td>`).join("")}</tr>`).join("")}</tbody>
    <tfoot><tr><th scope="row">Summe</th>${cols.map(([k, , , d]) => `<td>${total["_miss_" + k] && total[k] != null ? "≥ " : ""}${nf(total[k], d)}</td>`).join("")}</tr></tfoot></table></div>`;
}
ACT.detail = t => {
  fromT(t); const recs = (t.dataset.recs || "").split(",").filter(id => S.rec[id]); if (!recs.length) return;
  let rows = [], total = {}; recs.forEach(id => { const b = breakdown(id); rows = rows.concat(b.rows); total = addN(total, b.total); });
  const r0 = S.rec[recs[0]], labels = rows.filter(r => r.bild), extra = total.ges_fett != null || total.ballast != null;
  openSheet(`<div class="sheet-head"><h2>${esc(recs.map(id => S.rec[id].kurz || S.rec[id].name).join(" + "))}</h2><span class="muted">${esc(relLabel(day()))}${t.dataset.time ? " · " + esc(t.dataset.time) : ""}</span></div>
    ${imgTag(r0.bild, r0.name)}
    ${nutrTable(rows, total)}
    ${extra ? `<div class="muted">Davon gesättigte Fettsäuren ${nf(total.ges_fett, 1)} g · Ballaststoffe ${nf(total.ballast, 1)} g</div>` : ""}
    <div class="muted">Werte pro Portion. „Etikett“ = von deinem Foto, „Richtwert“ = Durchschnittswert. „≥“ heißt: Für eine Zutat fehlt der Wert noch.</div>
    ${labels.map(r => `<details><summary>Etikett: ${esc(r.name)}</summary>${imgTag(r.bild, "Nährwerttabelle " + r.name, "shot label")}</details>`).join("")}
    ${recs[0] !== "shake" ? `<button class="ghost" data-go="woche">Abendessen ändern</button>` : ""}`);
};

// ---------- Schnell eintragen ----------
// Eigene Lebensmittel: alles, was du schon eingetragen oder gescannt hast – Favoriten und Häufiges zuerst
function catalog() {
  const by = new Map();
  [...S.log].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")).forEach(e => { if (e.status === "offen" || !(+e.kcal > 0)) return;
    const k = e.name.trim().toLowerCase(), x = by.get(k) || { n: 0 }; by.set(k, { ...x, ...e, n: x.n + 1 }); });
  try { Object.keys(localStorage).filter(k => k.startsWith("off-")).forEach(k => { const p = JSON.parse(localStorage.getItem(k)); const g = p.portion || 100, key = p.name.toLowerCase();
    if (!by.has(key)) by.set(key, { name: p.name, kcal: Math.round(p.kcal * g / 100), eiweiss: Math.round(p.eiweiss * g / 10) / 10, menge: g, einheit: "g", barcode: p.code, n: 0 }); }); } catch (e) { }
  const fav = new Set((S.set.essfav || []).map(x => x.toLowerCase()));
  return [...by.values()].map(x => ({ ...x, fav: fav.has(x.name.trim().toLowerCase()) })).sort((a, b) => (b.fav - a.fav) || (b.n - a.n) || a.name.localeCompare(b.name));
}
function foodList(q, items) {
  const f = items.filter(x => !q || x.name.toLowerCase().includes(q.toLowerCase())).slice(0, 12);
  return f.length ? f.map(x => { const i = items.indexOf(x); return `<div class="food"><button type="button" class="star ${x.fav ? "on" : ""}" data-act="food-fav" data-i="${i}" aria-pressed="${x.fav}" aria-label="${esc(x.name)} als Favorit">${x.fav ? "★" : "☆"}</button><button type="button" class="fadd" data-act="food-add" data-i="${i}"><b>${esc(x.name)}</b><span class="muted num">${fmt(x.kcal)} kcal · ${fmt(x.eiweiss, 1)} g${x.menge ? " · " + fmt(x.menge) + " " + (x.einheit || "g") : ""}${x.n > 1 ? " · " + x.n + "×" : ""}</span></button></div>`; }).join("")
    : q ? `<div class="muted">Noch nicht in deiner Liste – unten mit Werten eintragen.</div>` : "";
}
ACT.quick = () => { const items = catalog();
  openSheet(`<div class="sheet-head"><h2>Essen eintragen</h2><button class="small ghost" data-act="plus">Zurück</button></div>
  <form id="qf" class="form"><label class="wide">Was? (sucht in deinen Lebensmitteln)<input name="name" required maxlength="120" placeholder="z. B. Banane, Skyr, Proteinriegel" autocomplete="off"></label>
  <div class="wide foods" id="qres">${foodList("", items)}</div>
  ${slotSelect()}<label>Menge (g)<input name="menge" type="number" inputmode="decimal" min="0" step="1"></label>
  <label>kcal<input name="kcal" type="number" inputmode="decimal" min="0" step="1" required></label><label>Eiweiß g<input name="eiweiss" type="number" inputmode="decimal" min="0" step="0.1"></label>
  <button class="wide">Speichern</button></form>`,
  sh => { sh._items = items; const f = sh.querySelector("#qf");
    f.name.addEventListener("input", () => { sh.querySelector("#qres").innerHTML = foodList(f.name.value.trim(), items); });
    f.onsubmit = e => { e.preventDefault(); const v = Object.fromEntries(new FormData(e.target)); saveEntry({ ...v, einheit: v.menge ? "g" : null }); }; }); };
ACT["food-add"] = t => { const sh = $("#sheet .sheet"), x = sh?._items?.[+t.dataset.i]; if (!x) return;
  saveEntry({ name: x.name, kcal: x.kcal, eiweiss: x.eiweiss, kh: x.kh, fett: x.fett, zucker: x.zucker, salz: x.salz, menge: x.menge, einheit: x.einheit, barcode: x.barcode, slot: sh.querySelector("[name=slot]")?.value, quelle: "zuletzt" }); };
ACT["food-fav"] = async t => { const sh = $("#sheet .sheet"), x = sh?._items?.[+t.dataset.i]; if (!x) return;
  const k = x.name.trim().toLowerCase(), cur = (S.set.essfav || []).filter(n => n.toLowerCase() !== k); if (!x.fav) cur.push(x.name.trim());
  S.set.essfav = cur; x.fav = !x.fav; buzz(10); t.classList.toggle("on", x.fav); t.textContent = x.fav ? "★" : "☆"; t.setAttribute("aria-pressed", x.fav);
  await put("einstellungen", "upsert", { key: "essfav", value: cur }); };

// ---------- Foto ----------
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, "image/jpeg", 0.72));
  } finally { URL.revokeObjectURL(url); }
}
async function photoForm(file) {
  let blob; try { blob = await shrink(file); } catch (e) { return toast("Foto konnte nicht gelesen werden", "warn"); }
  const prev = URL.createObjectURL(blob);
  openSheet(`<div class="sheet-head"><h2>Foto vom Essen</h2><span class="muted num">${fmt(blob.size / 1024)} KB</span></div>
    <img class="shot" src="${prev}" alt="Dein Foto">
    <form id="pf" class="form"><label class="wide">Was ist drauf? (optional)<input name="name" maxlength="120" placeholder="z. B. Mittag: Schnitzel, Kartoffelsalat" autocomplete="off"></label>
    ${slotSelect()}<span></span>
    <label>kcal (optional)<input name="kcal" type="number" inputmode="decimal" min="0"></label><label>Eiweiß g (optional)<input name="eiweiss" type="number" inputmode="decimal" min="0" step="0.1"></label>
    <p class="muted wide">Ohne Werte wird das Foto später geschätzt. Bis dahin zählt es mit 0 kcal.</p>
    <button class="wide">Speichern</button></form>`,
  sh => sh.querySelector("#pf").onsubmit = async e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const btn = e.target.querySelector("button"); btn.disabled = true; btn.textContent = "Lädt hoch …";
    const id = uid(), path = `${S.user.id}/${day()}_${id}.jpg`;
    const { error } = await sb.storage.from("fotos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
    URL.revokeObjectURL(prev);
    if (error) { btn.disabled = false; btn.textContent = "Speichern"; return toast(navigator.onLine ? "Upload fehlgeschlagen: " + error.message : "Für Fotos brauchst du Internet", "warn"); }
    const has = f.kcal !== "";
    saveEntry({ ...f, name: f.name || "Foto vom Essen", quelle: "foto", foto_pfad: path, status: has ? "fertig" : "offen" });
  });
}

// ---------- Eintrag ansehen / ändern / löschen ----------
ACT.entry = async t => {
  const e = S.log.find(x => x.id === t.dataset.id); if (!e) return;
  let img = "";
  if (e.foto_pfad && !e.foto_gesichert) { const { data } = await sb.storage.from("fotos").createSignedUrl(e.foto_pfad, 600); if (data?.signedUrl) img = `<img class="shot" src="${esc(data.signedUrl)}" alt="Foto: ${esc(e.name)}">`; }
  openSheet(`<div class="sheet-head"><h2>${esc(e.name)}</h2><span class="muted">${esc(relLabel(e.datum))}</span></div>${img}
    <form id="ef" class="form"><label class="wide">Name<input name="name" required maxlength="120" value="${esc(e.name)}"></label>
    ${slotSelect(e.slot)}<label>Menge (g)<input name="menge" type="number" inputmode="decimal" min="0" value="${e.menge ?? ""}"></label>
    <label>kcal<input name="kcal" type="number" inputmode="decimal" min="0" value="${e.kcal ?? ""}"></label><label>Eiweiß g<input name="eiweiss" type="number" inputmode="decimal" min="0" step="0.1" value="${e.eiweiss ?? ""}"></label>
    <button class="wide">Speichern</button><button type="button" class="ghost danger wide" data-act="entry-del" data-id="${e.id}">Löschen</button></form>`,
  sh => sh.querySelector("#ef").onsubmit = async ev => {
    ev.preventDefault(); const f = Object.fromEntries(new FormData(ev.target));
    const ch = { name: f.name.trim(), slot: f.slot, menge: f.menge ? +f.menge : null, kcal: f.kcal === "" ? null : +f.kcal, eiweiss: f.eiweiss === "" ? null : +f.eiweiss };
    ch.status = ch.kcal != null ? "fertig" : e.status; Object.assign(e, ch); closeSheet(); render();
    await put("eintraege", "update", ch, { id: e.id }); toast("Gespeichert"); });
};
ACT["entry-del"] = async t => {
  if (t.dataset.sure !== "1") { t.dataset.sure = "1"; t.textContent = "Wirklich löschen?"; return; }
  const e = S.log.find(x => x.id === t.dataset.id); if (!e) return;
  S.log = S.log.filter(x => x !== e); closeSheet(); render();
  if (e.foto_pfad && !e.foto_gesichert) await sb.storage.from("fotos").remove([e.foto_pfad]);
  await put("eintraege", "delete", null, { id: e.id }); toast("Gelöscht");
};

// ---------- Gewicht & Wasser ----------
const delBtn = q => val(day(), q) ? `<button type="button" class="ghost danger wide" data-act="val-del" data-q="${q}">Eintrag löschen</button>` : "";
ACT["val-del"] = async t => {
  if (t.dataset.sure !== "1") { t.dataset.sure = "1"; t.textContent = "Wirklich löschen?"; return; }
  const d = day(), q = t.dataset.q; S.vals = S.vals.filter(v => !(v.datum === d && v.quelle === q)); closeSheet(); buzz(20); render();
  await put("tageswerte", "delete", null, { datum: d, quelle: q }); toast("Gelöscht");
};
function setVal(quelle, werte) { return setValOn(day(), quelle, werte); }
export function setValOn(d, quelle, werte) {
  const row = S.vals.find(v => v.datum === d && v.quelle === quelle);
  if (row) row.werte = werte; else S.vals.push({ datum: d, quelle, werte });
  return put("tageswerte", "upsert", { datum: d, quelle, werte });
}
// Supplements abhaken (Heute und Wochenübersicht im Profil)
ACT.supp = async t => { const d = t.dataset.date || day(), n = t.dataset.n, cur = { ...(val(d, "supps") || {}) };
  if (cur[n]) delete cur[n]; else cur[n] = true; buzz(10); const p = setValOn(d, "supps", cur); render(); await p; };
export const vessels = () => S.set.gefaesse?.length ? S.set.gefaesse : [{ n: "Glas", ml: 300 }, { n: "Flasche", ml: 500 }, { n: "Große Flasche", ml: 750 }];
ACT.gewicht = t => { fromT(t);
  const last = [...S.vals].filter(v => v.quelle === "gewicht").sort((a, b) => b.datum.localeCompare(a.datum))[0];
  const cur = val(day(), "gewicht")?.kg ?? last?.werte?.kg ?? S.set.profil?.gewicht_kg ?? "";
  openSheet(`<div class="sheet-head"><h2>Gewicht</h2><span class="muted">${esc(relLabel(day()))}</span></div>
    <form id="gf" class="form"><label class="wide">Gewicht in kg<input name="kg" type="number" inputmode="decimal" min="30" max="300" step="0.1" required value="${cur}"></label>
    <p class="muted wide">Am besten morgens nach dem Aufstehen wiegen. Die App glättet Schwankungen im Trend.</p><button class="wide">Speichern</button>${delBtn("gewicht")}</form>`,
  sh => sh.querySelector("#gf").onsubmit = async e => { e.preventDefault(); const kg = Math.round(+new FormData(e.target).get("kg") * 10) / 10; const p = setVal("gewicht", { kg }); closeSheet(); buzz(15); render(); await p; toast(`${fmt(kg, 1)} kg gespeichert`); });
};
ACT.wasser = async () => { const ml = (+(val(day(), "wasser")?.ml) || 0) + 250; const p = setVal("wasser", { ml }); closeSheet(); buzz(15); render(); await p; toast(`Wasser: ${fmt(ml / 1000, 2)} l`); };
ACT["wasser-sheet"] = t => { fromT(t); const ml = +(val(day(), "wasser")?.ml) || 0;
  openSheet(`<div class="sheet-head"><h2>Wasser</h2><span class="muted">${esc(relLabel(day()))}</span></div>
    <form id="wf" class="form"><label class="wide">Menge in Litern<input name="l" type="number" inputmode="decimal" min="0" max="10" step="0.05" value="${ml ? ml / 1000 : ""}"></label>
    <div class="wide vessels">${vessels().map(g => `<button type="button" class="ghost" data-act="wasser-plus" data-d="${+g.ml}">+ ${esc(g.n)} <small>${fmt(g.ml)} ml</small></button>`).join("")}<button type="button" class="ghost" data-act="wasser-plus" data-d="-250">− 250 ml</button></div>
    <button class="wide">Speichern</button>${delBtn("wasser")}</form>`,
  sh => sh.querySelector("#wf").onsubmit = async e => { e.preventDefault(); const l = +String(new FormData(e.target).get("l")).replace(",", ".") || 0; const p = setVal("wasser", { ml: Math.round(l * 1000) }); closeSheet(); render(); await p; toast("Gespeichert"); }); };
ACT["wasser-plus"] = t => { const f = $("#wf"); const v = Math.max(0, (+String(f.l.value).replace(",", ".") || 0) + +t.dataset.d / 1000); f.l.value = Math.round(v * 100) / 100; };

// ---------- Messwerte ----------
ACT.messung = t => { fromT(t);
  const c = val(day(), "messung") || {};
  openSheet(`<div class="sheet-head"><h2>Messwerte</h2><span class="muted">${esc(relLabel(day()))}</span></div>
    <form id="mf" class="form">${MESS.map(([k, l, u, dec]) => `<label>${l}${u ? ` (${u})` : ""}<input name="${k}" type="number" inputmode="decimal" min="0" step="${dec ? "0.1" : "1"}" value="${c[k] ?? ""}"></label>`).join("")}
    <p class="muted wide">Nur ausfüllen, was du gemessen hast. Leere Felder werden ignoriert.</p><button class="wide">Speichern</button>${delBtn("messung")}</form>`,
  sh => sh.querySelector("#mf").onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target), w = {};
    MESS.forEach(([k]) => { const v = f.get(k); if (v !== "" && v != null) w[k] = +v; });
    if (!Object.keys(w).length) return toast("Bitte mindestens einen Wert eintragen");
    const p = setVal("messung", w); closeSheet(); buzz(15); render(); await p; toast("Messwerte gespeichert"); });
};

// ---------- Cardio (Ergometer usw.) ----------
// Kalorien aus Watt: mechanische Arbeit / Wirkungsgrad ~22 %; ohne Watt grobe Schätzung über die Dauer.
export const cardioKcal = (min, watt) => watt > 0 ? Math.round(watt * min * 60 / 4184 / 0.22) : Math.round(min * 6);
ACT.cardio = t => { fromT(t);
  const c = val(day(), "cardio") || {};
  openSheet(`<div class="sheet-head"><h2>Cardio</h2><span class="muted">${esc(relLabel(day()))}</span></div>
    <form id="cf" class="form"><label class="wide">Art<input name="art" value="${esc(c.art || "Ergometer")}" maxlength="40"></label>
    <label>Minuten<input name="minuten" type="number" inputmode="numeric" min="1" max="600" required value="${c.minuten || ""}"></label>
    <label>Watt (Ø, falls bekannt)<input name="watt" type="number" inputmode="numeric" min="0" max="600" value="${c.watt || ""}"></label>
    <div class="wide total" id="ck"></div><button class="wide">Speichern</button>${delBtn("cardio")}</form>`,
  sh => { const f = sh.querySelector("#cf"), out = sh.querySelector("#ck");
    const calc = () => { const k = cardioKcal(+f.minuten.value || 0, +f.watt.value || 0); out.innerHTML = `ca. <b class="num">${fmt(k)} kcal</b> verbraucht`; return k; };
    f.addEventListener("input", calc); calc();
    f.onsubmit = async e => { e.preventDefault(); const w = { art: f.art.value.trim() || "Cardio", minuten: +f.minuten.value, watt: +f.watt.value || null, kcal: calc() };
      const p = setVal("cardio", w); closeSheet(); buzz(15); render(); await p; toast(`${w.art}: ${w.minuten} min · ca. ${fmt(w.kcal)} kcal`); }; });
};

// ---------- Barcode ----------
const OFF = "https://world.openfoodfacts.org/api/v2/product/";
async function lookup(code) {
  const key = "off-" + code; try { const c = JSON.parse(localStorage.getItem(key) || "null"); if (c) return c; } catch (e) { }
  const r = await fetch(`${OFF}${encodeURIComponent(code)}.json?fields=product_name,product_name_de,brands,nutriments,serving_quantity,quantity`);
  const j = await r.json(); if (j.status !== 1 || !j.product) return null;
  const p = j.product, n = p.nutriments || {};
  const out = { code, name: [p.brands?.split(",")[0], p.product_name_de || p.product_name].filter(Boolean).join(" – ") || "Produkt " + code,
    kcal: +(n["energy-kcal_100g"] ?? (n.energy_100g ? n.energy_100g / 4.184 : 0)) || 0, eiweiss: +n.proteins_100g || 0, kh: +n.carbohydrates_100g || 0, fett: +n.fat_100g || 0, zucker: +n.sugars_100g || 0, salz: +n.salt_100g || 0,
    portion: +p.serving_quantity || 0, packung: p.quantity || "" };
  try { localStorage.setItem(key, JSON.stringify(out)); } catch (e) { }
  return out;
}
ACT.scan = () => {
  openSheet(`<div class="sheet-head"><h2>Barcode scannen</h2><button class="small ghost" data-act="plus">Zurück</button></div>
    <div class="cam"><video id="cam" playsinline muted aria-label="Kamerabild"></video><div class="cam-line" aria-hidden="true"></div></div>
    <p class="muted" id="scanmsg">Halte den Strichcode in den Rahmen.</p>
    <form id="bc" class="form"><label class="wide">Oder Nummer eintippen<input name="code" inputmode="numeric" pattern="[0-9]{6,14}" placeholder="4001234567890"></label><button class="wide ghost">Suchen</button></form>`,
  async sh => {
    sh.querySelector("#bc").onsubmit = e => { e.preventDefault(); const c = new FormData(e.target).get("code").trim(); if (c) found(c); };
    const video = sh.querySelector("#cam"), msg = sh.querySelector("#scanmsg"); let done = false;
    const hit = c => { if (done) return; done = true; buzz([30, 40, 30]); found(c); };
    try {
      if ("BarcodeDetector" in window && (await BarcodeDetector.getSupportedFormats?.() || []).includes("ean_13")) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream; await video.play();
        const det = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] }); let alive = true;
        stopCam = () => { alive = false; stream.getTracks().forEach(t => t.stop()); };
        const loop = async () => { if (!alive || done) return; try { const r = await det.detect(video); if (r[0]?.rawValue) return hit(r[0].rawValue); } catch (e) { } setTimeout(loop, 200); };
        loop();
      } else {
        const { BrowserMultiFormatReader } = await import("https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm");
        const ctl = await new BrowserMultiFormatReader().decodeFromConstraints({ video: { facingMode: "environment" } }, video, res => { if (res) hit(res.getText()); });
        stopCam = () => ctl.stop();
      }
    } catch (e) { msg.textContent = "Kamera nicht verfügbar. Gib die Nummer unten ein."; }
  });
};
async function found(code) {
  stopCam?.(); stopCam = null;
  const msg = $("#scanmsg"); if (msg) msg.textContent = `Suche ${code} …`;
  let p = null; try { p = await lookup(code); } catch (e) { }
  if (!p) { if (msg) msg.textContent = `Nicht gefunden (${code}). Trag es über „Schnell eintragen“ ein.`; return; }
  const g0 = p.portion || 100;
  openSheet(`<div class="sheet-head"><h2>${esc(p.name)}</h2><span class="muted">${esc(p.packung)}</span></div>
    <div class="row muted"><span>pro 100 g</span><span class="num">${fmt(p.kcal)} kcal · ${fmt(p.eiweiss, 1)} g Eiweiß</span></div>
    <form id="pf2" class="form"><label>Menge (g)<input name="menge" type="number" inputmode="decimal" min="1" step="1" value="${g0}" required></label>${slotSelect()}
    <div class="wide total" id="tot"></div><button class="wide">Eintragen</button></form>
    <p class="muted">Daten: Open Food Facts</p>`,
  sh => { const f = sh.querySelector("#pf2"), tot = sh.querySelector("#tot");
    const calc = () => { const g = +f.menge.value || 0; tot.innerHTML = `<b class="num">${fmt(p.kcal * g / 100)} kcal</b> · <span class="num">${fmt(p.eiweiss * g / 100, 1)} g Eiweiß</span>`; };
    f.menge.addEventListener("input", calc); calc();
    f.onsubmit = e => { e.preventDefault(); const g = +f.menge.value || 0;
      saveEntry({ name: p.name, menge: g, einheit: "g", slot: f.slot.value, kcal: Math.round(p.kcal * g / 100), eiweiss: Math.round(p.eiweiss * g / 10) / 10, kh: Math.round(p.kh * g / 10) / 10, fett: Math.round(p.fett * g / 10) / 10, zucker: Math.round((p.zucker || 0) * g / 10) / 10, salz: Math.round((p.salz || 0) * g) / 100, barcode: code, quelle: "barcode" }); }; });
}
