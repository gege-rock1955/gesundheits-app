// Körper: Energiebilanz (gegessen vs. verbraucht) und Fortschrittsfotos mit Posen-Hilfslinien und Vorher/Nachher.
import { sb, S, ACT, VIEWS, $, esc, fmt, put, toast, buzz, render, todayISO, addDays, monday, dayKey, dateLabel, relLabel, dayTotals, burn, bmr, DAYS, isWE, weekOf, imgTag, hydrateImgs, DEMO } from "./core.js";

// ---------- Bilanz ----------
const has = d => { const w = S.weeks[weekOf(d)] || {}; return Object.keys(w.plan || {}).length > 0 || !!(w.kantine_tag || {})[dayKey(d)] || S.log.some(e => e.datum === d); };
export function balance(d) { const e = dayTotals(d).k, b = burn(d); return { d, eat: e, burn: b.total, b, diff: e - b.total, ok: has(d) }; }
const sgn = v => (v > 0 ? "+" : v < 0 ? "−" : "±") + fmt(Math.abs(v));
export function bilanzCard() {
  const t = todayISO(), mon = monday(t), days = Array.from({ length: 7 }, (_, i) => addDays(mon, i)).filter(d => d <= t).map(balance).filter(x => x.ok);
  if (!days.length) return "";
  const sum = days.reduce((a, x) => a + x.diff, 0);
  return `<section class="card"><div class="row"><h2>Energiebilanz</h2><span class="muted">diese Woche</span></div>
    <div class="kpis three"><div><span class="muted">Bilanz</span><b class="num ${sum < 0 ? "neg" : "pos"}">${sgn(sum)}</b><small>kcal seit Montag</small></div>
    <div><span class="muted">≈ Fett</span><b class="num">${sum < 0 ? "−" : "+"}${fmt(Math.abs(sum) / 7700, 2)} kg</b><small>rechnerisch</small></div>
    <div><span class="muted">Ø pro Tag</span><b class="num ${sum < 0 ? "neg" : "pos"}">${sgn(sum / days.length)}</b><small>kcal</small></div></div>
    <div class="tablewrap"><table class="mtab"><thead><tr><th scope="col">Tag</th><th scope="col">Gegessen</th><th scope="col">Verbraucht</th><th scope="col">Bilanz</th></tr></thead><tbody>
    ${days.map(x => `<tr><th scope="row">${DAYS.find(y => y[0] === dayKey(x.d))[1]}${x.d === t ? " (bisher)" : ""}</th><td>${fmt(x.eat)}</td><td title="Alltag ${fmt(x.b.base)} + Cardio ${fmt(x.b.cardio)} + Kraft ${fmt(x.b.kraft)}">${fmt(x.burn)}${x.b.cardio || x.b.kraft ? "*" : ""}</td><td class="${x.diff < 0 ? "neg" : "pos"}">${sgn(x.diff)}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="muted">Verbraucht = Grundumsatz ${fmt(bmr())} kcal × Alltag (Wochentag ×${fmt(S.set.aktivitaet?.wt || 1.35, 2)}, Wochenende ×${fmt(S.set.aktivitaet?.we || 1.2, 2)})${days.some(x => x.b.cardio || x.b.kraft) ? " · * inkl. Cardio/Krafttraining" : ""}. Alles Schätzwerte – der Gewichtstrend zeigt nach 2–3 Wochen, wie gut sie passen.</div></section>`;
}
export function todayBalanceChip(d) { if (!has(d)) return ""; const x = balance(d); return `<span class="chip ${x.diff < 0 ? "" : "warn"}">Bilanz ${sgn(x.diff)} kcal</span>`; }

// ---------- Fortschrittsfotos ----------
const POSES = [["vorne", "Vorne"], ["seite", "Seite"], ["hinten", "Hinten"]];
const photos = pose => S.vals.filter(v => v.quelle === "foto-" + pose && v.werte?.pfad).sort((a, b) => a.datum.localeCompare(b.datum));
export function fotosCard() {
  const pose = S.pose || "vorne", list = photos(pose), all = POSES.reduce((n, [p]) => n + photos(p).length, 0);
  const a = list.find(v => v.datum === S.cmpA) || list[0], b = list.find(v => v.datum === S.cmpB) || list[list.length - 1];
  return `<section class="card"><div class="row"><h2>Fortschrittsfotos</h2><button class="small ghost" data-act="pf-neu">+ Foto</button></div>
    <div class="seg" role="group" aria-label="Pose">${POSES.map(([p, l]) => `<button class="small" data-act="pf-pose" data-p="${p}" aria-pressed="${p === pose}">${l} <span class="muted">${photos(p).length}</span></button>`).join("")}</div>
    ${!all ? `<div class="muted">Am besten alle 2–4 Wochen morgens, gleiches Licht, gleiche Pose. Die Fotos sind privat und nur mit deinem Login sichtbar.</div>` : ""}
    ${list.length >= 2 ? `<div class="cmp" style="--x:${S.cmpX ?? 50}%">${imgTag("storage:" + a.werte.pfad, "Vorher " + a.datum, "cmp-a")}${imgTag("storage:" + b.werte.pfad, "Nachher " + b.datum, "cmp-b")}<span class="cmp-l">${dateLabel(a.datum, { day: "numeric", month: "short", year: "2-digit" })}</span><span class="cmp-r">${dateLabel(b.datum, { day: "numeric", month: "short", year: "2-digit" })}</span></div>
      <label>Vorher / Nachher vergleichen<input type="range" min="0" max="100" value="${S.cmpX ?? 50}" data-cmp aria-label="Trennlinie verschieben"></label>
      <div class="grid2"><label>Vorher<select data-cmpsel="A">${list.map(v => `<option value="${v.datum}" ${v === a ? "selected" : ""}>${v.datum}</option>`).join("")}</select></label><label>Nachher<select data-cmpsel="B">${list.map(v => `<option value="${v.datum}" ${v === b ? "selected" : ""}>${v.datum}</option>`).join("")}</select></label></div>` : ""}
    ${list.length ? `<div class="thumbs">${list.slice().reverse().map(v => `<button class="thumb" data-act="pf-open" data-d="${v.datum}" data-p="${pose}" aria-label="Foto vom ${v.datum} öffnen">${imgTag("storage:" + v.werte.pfad, "Foto " + v.datum, "")}<span>${dateLabel(v.datum, { day: "numeric", month: "short" })}</span></button>`).join("")}</div>` : ""}</section>`;
}
ACT["pf-pose"] = t => { S.pose = t.dataset.p; S.cmpA = S.cmpB = null; render(); };
document.addEventListener("input", e => { if (e.target.dataset.cmp != null) { S.cmpX = +e.target.value; e.target.closest(".card").querySelector(".cmp").style.setProperty("--x", S.cmpX + "%"); } });
document.addEventListener("change", e => { const k = e.target.dataset.cmpsel; if (k) { S["cmp" + k] = e.target.value; render(); } });

// Silhouette als Hilfslinie (gleiche Position bei jedem Foto)
const GUIDE = { vorne: `<ellipse cx="50" cy="13" rx="8" ry="10"/><path d="M36 30 Q50 24 64 30 L70 58 L64 60 L62 92 L58 140 L52 140 L50 98 L48 140 L42 140 L38 92 L36 60 L30 58 Z"/>`,
  seite: `<ellipse cx="52" cy="13" rx="8" ry="10"/><path d="M44 28 Q56 26 60 34 L62 60 Q64 78 58 92 L56 140 L48 140 L46 94 Q40 76 42 58 Z"/>`,
  hinten: `<ellipse cx="50" cy="13" rx="8" ry="10"/><path d="M34 30 Q50 26 66 30 L70 58 L64 60 L62 92 L58 140 L52 140 L50 98 L48 140 L42 140 L38 92 L36 60 L30 58 Z"/>` };
let camStop = null;
ACT["pf-neu"] = async () => {
  const { openSheet, closeSheet } = await import("./add.js"); const pose = S.pose || "vorne";
  openSheet(`<div class="sheet-head"><h2>Fortschrittsfoto</h2><div class="seg">${POSES.map(([p, l]) => `<button class="small" data-act="pf-sp" data-p="${p}" aria-pressed="${p === pose}">${l}</button>`).join("")}</div></div>
    <div class="pfcam"><video id="pfv" playsinline muted aria-label="Kamerabild"></video><svg class="guide" viewBox="0 0 100 150" aria-hidden="true" preserveAspectRatio="xMidYMid meet">${GUIDE[pose]}</svg></div>
    <div class="row"><label class="btn ghost filebtn" for="pf-file" style="flex:1">Aus Galerie</label><input id="pf-file" type="file" accept="image/*" hidden><button id="pf-shot" style="flex:1">Foto aufnehmen</button></div>
    <p class="muted">Stell dich in die Umrisse. Tipp: Selbstauslöser oder jemand anderes drückt ab.</p>`,
  async sh => {
    const v = sh.querySelector("#pfv");
    try { const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } } }); v.srcObject = st; await v.play(); camStop = () => st.getTracks().forEach(x => x.stop()); (await import("./add.js")).sheetCleanup.push(() => { camStop?.(); camStop = null; }); }
    catch (e) { sh.querySelector(".pfcam").innerHTML = `<div class="empty">Kamera nicht verfügbar – wähle ein Foto aus der Galerie.</div>`; sh.querySelector("#pf-shot").hidden = true; }
    const save = async blob => { camStop?.(); camStop = null; await savePhoto(blob, S.pose || "vorne"); closeSheet(); };
    sh.querySelector("#pf-shot").onclick = () => { const c = document.createElement("canvas"), s = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight)); c.width = v.videoWidth * s; c.height = v.videoHeight * s; c.getContext("2d").drawImage(v, 0, 0, c.width, c.height); c.toBlob(save, "image/jpeg", 0.8); buzz(30); };
    sh.querySelector("#pf-file").onchange = async e => { const f = e.target.files?.[0]; if (f) save(await shrink(f)); };
  });
};
ACT["pf-sp"] = t => { S.pose = t.dataset.p; const g = document.querySelector(".pfcam .guide"); if (g) g.innerHTML = GUIDE[S.pose]; document.querySelectorAll('[data-act="pf-sp"]').forEach(b => b.setAttribute("aria-pressed", b.dataset.p === S.pose)); };
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try { const img = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = url; });
    const s = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement("canvas"); c.width = img.naturalWidth * s; c.height = img.naturalHeight * s; c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, "image/jpeg", 0.8)); } finally { URL.revokeObjectURL(url); }
}
async function savePhoto(blob, pose) {
  const d = todayISO(), path = `${S.user.id}/fortschritt/${d}_${pose}_${Date.now().toString(36)}.jpg`;
  const { error } = await sb.storage.from("fotos").upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) return toast(navigator.onLine ? "Upload fehlgeschlagen: " + error.message : "Für Fotos brauchst du Internet", "warn");
  const old = S.vals.find(v => v.datum === d && v.quelle === "foto-" + pose); if (old?.werte?.pfad) await sb.storage.from("fotos").remove([old.werte.pfad]);
  S.vals = S.vals.filter(v => v !== old); S.vals.push({ datum: d, quelle: "foto-" + pose, werte: { pfad: path } }); render();
  await put("tageswerte", "upsert", { datum: d, quelle: "foto-" + pose, werte: { pfad: path } }); toast("Foto gespeichert");
}
ACT["pf-open"] = async t => {
  const { openSheet } = await import("./add.js"); const v = S.vals.find(x => x.datum === t.dataset.d && x.quelle === "foto-" + t.dataset.p); if (!v) return;
  openSheet(`<div class="sheet-head"><h2>${dateLabel(v.datum, { day: "numeric", month: "long", year: "numeric" })}</h2><span class="muted">${t.dataset.p}</span></div>
    ${imgTag("storage:" + v.werte.pfad, "Fortschrittsfoto", "shot tall")}<button class="ghost danger" data-act="pf-del" data-d="${v.datum}" data-p="${t.dataset.p}">Foto löschen</button>`);
};
ACT["pf-del"] = async t => {
  if (t.dataset.sure !== "1") { t.dataset.sure = "1"; t.textContent = "Wirklich löschen?"; return; }
  const q = "foto-" + t.dataset.p, v = S.vals.find(x => x.datum === t.dataset.d && x.quelle === q); if (!v) return;
  S.vals = S.vals.filter(x => x !== v); (await import("./add.js")).closeSheet(); render();
  await sb.storage.from("fotos").remove([v.werte.pfad]); await put("tageswerte", "delete", null, { datum: v.datum, quelle: q }); toast("Foto gelöscht");
};
