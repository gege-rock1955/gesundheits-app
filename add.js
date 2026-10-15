// Eintragen: Plus-Menü mit Foto, Barcode, Schnell-Eintrag, Zuletzt gegessen, Gewicht, Wasser.
import { sb, S, ACT, $, esc, fmt, SLOTS, DAYS, MESS, put, toast, buzz, uid, slotNow, todayISO, dayKey, val, render, go, relLabel } from "./core.js";

// ---------- Blatt (Bottom Sheet) ----------
let lastFocus = null, stopCam = null;
export function openSheet(html, mount) {
  closeSheet(); lastFocus = document.activeElement;
  const bg = document.createElement("div"); bg.className = "sheet-bg"; bg.id = "sheet";
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Eintragen"><div class="grip" aria-hidden="true"></div>${html}</div>`;
  bg.addEventListener("click", e => { if (e.target === bg) closeSheet(); });
  document.body.append(bg); document.body.classList.add("noscroll");
  requestAnimationFrame(() => bg.classList.add("open"));
  mount?.(bg.querySelector(".sheet"));
  bg.querySelector("input:not([type=file]),button")?.focus({ preventScroll: true });
}
export function closeSheet() {
  stopCam?.(); stopCam = null;
  const el = $("#sheet"); if (!el) return; el.remove(); document.body.classList.remove("noscroll"); lastFocus?.focus?.({ preventScroll: true });
}
document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#sheet")) closeSheet(); });
ACT["sheet-close"] = closeSheet;

const slotSelect = (sel = slotNow()) => `<label>Mahlzeit<select name="slot">${SLOTS.map(([k, l]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
const day = () => S.date || todayISO();

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
      <button class="qa" data-act="wasser"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/></svg>Wasser +250 ml<small>${water ? fmt(water / 1000, 2) + " l heute" : ""}</small></button>
      <button class="qa" data-act="cardio"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l4-8h5l3 8M10 9 8 5H6"/></svg>Cardio${val(day(), "cardio") ? `<small>${fmt(val(day(), "cardio").minuten)} min eingetragen</small>` : ""}</button>
      ${work ? `<button class="qa" data-act="kantine"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13h16a8 8 0 0 1-16 0zM12 5v4M8 7v2M16 7v2"/></svg>Kantine</button>` : `<button class="qa" data-go="training"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v16M18 4v16M3 8v8M21 8v8M6 12h12"/></svg>Training</button>`}
    </div>
    ${rc.length ? `<div class="eyebrow">Zuletzt gegessen</div><div class="recent">${rc.map((e, i) => `<button class="rc" data-act="recent" data-i="${i}"><b>${esc(e.name)}</b><span class="num">${fmt(e.kcal)} kcal · ${fmt(e.eiweiss)} g</span></button>`).join("")}</div>` : ""}`,
  sh => { sh._recent = rc; sh.querySelector("#foto-in").addEventListener("change", ev => { const f = ev.target.files?.[0]; if (f) photoForm(f); }); });
};
ACT.kantine = () => { closeSheet(); S.view = "woche"; render(); setTimeout(() => document.querySelector(`input[data-d="${dayKey(day())}"][data-k="kcal"]`)?.focus(), 50); };
ACT.recent = t => { const e = $("#sheet .sheet")?._recent?.[+t.dataset.i]; if (!e) return;
  saveEntry({ name: e.name, kcal: e.kcal, eiweiss: e.eiweiss, kh: e.kh, fett: e.fett, menge: e.menge, einheit: e.einheit, slot: day() === todayISO() ? slotNow() : e.slot, quelle: "zuletzt" }); };

async function saveEntry(f) {
  const row = { id: uid(), datum: day(), slot: f.slot || slotNow(), name: (f.name || "Essen").trim().slice(0, 120), quelle: f.quelle || "manuell",
    kcal: f.kcal === "" || f.kcal == null ? null : +f.kcal, eiweiss: f.eiweiss === "" || f.eiweiss == null ? null : +f.eiweiss,
    kh: f.kh ?? null, fett: f.fett ?? null, menge: f.menge ? +f.menge : null, einheit: f.einheit || null, barcode: f.barcode || null,
    foto_pfad: f.foto_pfad || null, status: f.status || "fertig" };
  S.log.push({ ...row, created_at: new Date().toISOString() }); closeSheet(); buzz(15); render();
  await put("eintraege", "insert", row);
  toast(row.status === "offen" ? "Foto gespeichert – Schätzung folgt" : `${row.name} eingetragen`);
}

// ---------- Schnell eintragen ----------
ACT.quick = () => openSheet(`<div class="sheet-head"><h2>Schnell eintragen</h2><button class="small ghost" data-act="plus">Zurück</button></div>
  <form id="qf" class="form"><label class="wide">Was?<input name="name" required maxlength="120" placeholder="z. B. Banane, Skyr, Proteinriegel" autocomplete="off"></label>
  ${slotSelect()}<label>Menge (g)<input name="menge" type="number" inputmode="decimal" min="0" step="1"></label>
  <label>kcal<input name="kcal" type="number" inputmode="decimal" min="0" step="1" required></label><label>Eiweiß g<input name="eiweiss" type="number" inputmode="decimal" min="0" step="0.1"></label>
  <button class="wide">Speichern</button></form>`,
  sh => sh.querySelector("#qf").onsubmit = e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); saveEntry({ ...f, einheit: f.menge ? "g" : null }); });

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
    <form id="pf" class="form"><label class="wide">Was ist drauf? (optional)<input name="name" maxlength="120" placeholder="z. B. Kantine: Schnitzel, Kartoffelsalat" autocomplete="off"></label>
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
function setVal(quelle, werte) {
  const d = day(), row = S.vals.find(v => v.datum === d && v.quelle === quelle);
  if (row) row.werte = werte; else S.vals.push({ datum: d, quelle, werte });
  return put("tageswerte", "upsert", { datum: d, quelle, werte });
}
ACT.gewicht = () => {
  const last = [...S.vals].filter(v => v.quelle === "gewicht").sort((a, b) => b.datum.localeCompare(a.datum))[0];
  const cur = val(day(), "gewicht")?.kg ?? last?.werte?.kg ?? S.set.profil?.gewicht_kg ?? "";
  openSheet(`<div class="sheet-head"><h2>Gewicht</h2><span class="muted">${esc(relLabel(day()))}</span></div>
    <form id="gf" class="form"><label class="wide">Gewicht in kg<input name="kg" type="number" inputmode="decimal" min="30" max="300" step="0.1" required value="${cur}"></label>
    <p class="muted wide">Am besten morgens nach dem Aufstehen wiegen. Die App glättet Schwankungen im Trend.</p><button class="wide">Speichern</button></form>`,
  sh => sh.querySelector("#gf").onsubmit = async e => { e.preventDefault(); const kg = Math.round(+new FormData(e.target).get("kg") * 10) / 10; closeSheet(); buzz(15); render(); await setVal("gewicht", { kg }); toast(`${fmt(kg, 1)} kg gespeichert`); });
};
ACT.wasser = async () => { const ml = (+(val(day(), "wasser")?.ml) || 0) + 250; closeSheet(); buzz(15); render(); await setVal("wasser", { ml }); toast(`Wasser: ${fmt(ml / 1000, 2)} l`); };

// ---------- Messwerte ----------
ACT.messung = () => {
  const c = val(day(), "messung") || {};
  openSheet(`<div class="sheet-head"><h2>Messwerte</h2><span class="muted">${esc(relLabel(day()))}</span></div>
    <form id="mf" class="form">${MESS.map(([k, l, u, dec]) => `<label>${l}${u ? ` (${u})` : ""}<input name="${k}" type="number" inputmode="decimal" min="0" step="${dec ? "0.1" : "1"}" value="${c[k] ?? ""}"></label>`).join("")}
    <p class="muted wide">Nur ausfüllen, was du gemessen hast. Leere Felder werden ignoriert.</p><button class="wide">Speichern</button></form>`,
  sh => sh.querySelector("#mf").onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target), w = {};
    MESS.forEach(([k]) => { const v = f.get(k); if (v !== "" && v != null) w[k] = +v; });
    if (!Object.keys(w).length) return toast("Bitte mindestens einen Wert eintragen");
    closeSheet(); buzz(15); render(); await setVal("messung", w); toast("Messwerte gespeichert"); });
};

// ---------- Cardio (Ergometer usw.) ----------
// Kalorien aus Watt: mechanische Arbeit / Wirkungsgrad ~22 %; ohne Watt grobe Schätzung über die Dauer.
export const cardioKcal = (min, watt) => watt > 0 ? Math.round(watt * min * 60 / 4184 / 0.22) : Math.round(min * 6);
ACT.cardio = () => {
  const c = val(day(), "cardio") || {};
  openSheet(`<div class="sheet-head"><h2>Cardio</h2><span class="muted">${esc(relLabel(day()))}</span></div>
    <form id="cf" class="form"><label class="wide">Art<input name="art" value="${esc(c.art || "Ergometer")}" maxlength="40"></label>
    <label>Minuten<input name="minuten" type="number" inputmode="numeric" min="1" max="600" required value="${c.minuten || ""}"></label>
    <label>Watt (Ø, falls bekannt)<input name="watt" type="number" inputmode="numeric" min="0" max="600" value="${c.watt || ""}"></label>
    <div class="wide total" id="ck"></div><button class="wide">Speichern</button></form>`,
  sh => { const f = sh.querySelector("#cf"), out = sh.querySelector("#ck");
    const calc = () => { const k = cardioKcal(+f.minuten.value || 0, +f.watt.value || 0); out.innerHTML = `ca. <b class="num">${fmt(k)} kcal</b> verbraucht`; return k; };
    f.addEventListener("input", calc); calc();
    f.onsubmit = async e => { e.preventDefault(); const w = { art: f.art.value.trim() || "Cardio", minuten: +f.minuten.value, watt: +f.watt.value || null, kcal: calc() };
      closeSheet(); buzz(15); await setVal("cardio", w); render(); toast(`${w.art}: ${w.minuten} min · ca. ${fmt(w.kcal)} kcal`); }; });
};

// ---------- Barcode ----------
const OFF = "https://world.openfoodfacts.org/api/v2/product/";
async function lookup(code) {
  const key = "off-" + code; try { const c = JSON.parse(localStorage.getItem(key) || "null"); if (c) return c; } catch (e) { }
  const r = await fetch(`${OFF}${encodeURIComponent(code)}.json?fields=product_name,product_name_de,brands,nutriments,serving_quantity,quantity`);
  const j = await r.json(); if (j.status !== 1 || !j.product) return null;
  const p = j.product, n = p.nutriments || {};
  const out = { code, name: [p.brands?.split(",")[0], p.product_name_de || p.product_name].filter(Boolean).join(" – ") || "Produkt " + code,
    kcal: +(n["energy-kcal_100g"] ?? (n.energy_100g ? n.energy_100g / 4.184 : 0)) || 0, eiweiss: +n.proteins_100g || 0, kh: +n.carbohydrates_100g || 0, fett: +n.fat_100g || 0,
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
      saveEntry({ name: p.name, menge: g, einheit: "g", slot: f.slot.value, kcal: Math.round(p.kcal * g / 100), eiweiss: Math.round(p.eiweiss * g / 10) / 10, kh: Math.round(p.kh * g / 10) / 10, fett: Math.round(p.fett * g / 10) / 10, barcode: code, quelle: "barcode" }); }; });
}
