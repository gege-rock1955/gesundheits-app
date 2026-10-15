// Training: Pläne, Satz-Logging, Pausen-Timer, letzte Werte, Rekorde, Sehnen-Ampel.
import { sb, S, ACT, VIEWS, DEMO, $, esc, fmt, q, put, toast, buzz, uid, todayISO, e1rm, render, relLabel } from "./core.js";

const LEGS = ["beine", "quadrizeps", "oberschenkel", "beinbeuger", "waden", "wade", "gesäß", "po", "adduktoren", "abduktoren"];
const isLeg = e => (e?.muskeln || []).some(m => LEGS.some(l => String(m).toLowerCase().includes(l)));
const restPref = () => { try { return +localStorage.getItem("pause") || 90; } catch (e) { return 90; } };

// ---------- Sehnen-Ampel ----------
export function tendon() {
  const t = S.trainings.filter(x => x.schmerz_wert != null).sort((a, b) => (b.created_at || b.datum).localeCompare(a.created_at || a.datum)).map(x => +x.schmerz_wert);
  if (!t.length) return null;
  const rising = t.length >= 3 && t[0] > t[1] && t[1] > t[2];
  if (t[0] >= 5) return { lvl: "rot", label: "Sehne gereizt", text: "Heute Beine leicht halten oder weglassen, kein Wadenheben und keine Sprünge. Bleibt es über mehrere Tage so, lass es ärztlich oder physiotherapeutisch anschauen.", last: t.slice(0, 6) };
  if (t[0] >= 3 || rising) return { lvl: "gelb", label: "Vorsicht", text: "Beinübungen heute etwa 10 % leichter und langsam absenken. Beim Training sollte der Schmerz höchstens bei 3 von 10 liegen.", last: t.slice(0, 6) };
  return { lvl: "gruen", label: "Sehne ruhig", text: "Normal trainieren. Nach dem Training kurz den Schmerz eintragen.", last: t.slice(0, 6) };
}
export function tendonCard(compact = false) {
  const s = tendon(); if (!s) return "";
  const ic = { rot: `<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>`, gelb: `<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16h.01"/>`, gruen: `<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>` }[s.lvl];
  return `<div class="ampel ${s.lvl}" role="status"><svg viewBox="0 0 24 24" aria-hidden="true">${ic}</svg><div><b>Achillessehne: ${s.label}</b>${compact ? "" : `<div>${s.text}</div>`}<div class="muted num">Letzte Werte: ${s.last.join(" · ")} von 10</div></div></div>`;
}

// ---------- Übersicht ----------
VIEWS.training = () => {
  if (S.session || restoreSession()) return sessionView();
  const recent = [...S.trainings].sort((a, b) => (b.created_at || b.datum).localeCompare(a.created_at || a.datum)).slice(0, 5);
  return `${tendonCard()}
  ${S.plans.length ? S.plans.map(pl => `<section class="card"><h2>${esc(pl.name)}</h2>${pl.tage.map((t, i) => `<div class="day"><div class="row"><h3>${esc(t.name)}</h3><button class="small" data-act="start" data-i="${i}" data-plan="${esc(pl.id)}">Starten</button></div><div class="muted">${t.uebungen.map(u => esc(S.ex[u.uebung_id]?.name || u.uebung_id)).join(" · ")}</div></div>`).join("")}</section>`).join("")
    : `<div class="empty">Noch kein Trainingsplan. Schick mir deinen Plan im Chat, ich trage ihn ein.</div>`}
  ${recent.length ? `<section class="card"><h2>Zuletzt</h2>${recent.map(t => { const n = S.sets.filter(x => x.training_id === t.id).length; return `<button class="lrow" data-act="tr-open" data-id="${esc(t.id)}"><span><b>${esc(t.tag_name || "Training")}</b> <span class="muted">${esc(relLabel(t.datum))}</span></span><span class="muted num">${n} Sätze${t.schmerz_wert != null ? ` · Sehne ${t.schmerz_wert}/10` : ""} ›</span></button>`; }).join("")}</section>` : ""}`;
};

function sessionView() {
  const s = S.session, rest = restPref();
  return `<section class="card"><div class="row"><h2>${esc(s.tag.name)}</h2><button class="small ghost" data-act="abbrechen">Abbrechen</button></div>
    <div class="muted">Pause nach jedem Satz</div><div class="seg">${[60, 90, 120, 180].map(x => `<button class="small" data-act="rest" data-v="${x}" aria-pressed="${x === rest}">${x < 120 ? x + " s" : x / 60 + " min"}</button>`).join("")}</div>
    ${s.adjust ? `<div class="hint warn">${esc(s.adjust)}</div>` : ""}</section>
  ${s.tag.uebungen.map((u, ui) => { const e = S.ex[u.uebung_id] || { name: u.uebung_id }; const step = stepOf(e); const last = s.last[u.uebung_id] || [];
    return `<section class="card ex"><div class="ex-head"><div><h3>${esc(e.name)}</h3><div class="muted">${u.saetze} × ${u.wdh_min}–${u.wdh_max} · ${esc(u.hinweis || e.hinweis || "")}</div></div>
      ${(e.muskeln || []).length ? `<div class="muscles">${e.muskeln.map(m => `<span class="chip">${esc(m)}</span>`).join("")}</div>` : ""}</div>
      ${e.animation_url ? `<img class="anim" src="${esc(e.animation_url)}" alt="Ausführung ${esc(e.name)}" loading="lazy">` : ""}
      <div class="hint">${esc(suggest(u, last, step))}</div>
      ${s.bestSet[u.uebung_id] ? `<div class="muted">Rekord: <span class="num">${fmt(s.bestSet[u.uebung_id].gewicht, 1)} kg × ${s.bestSet[u.uebung_id].wdh}</span></div>` : ""}
      <div class="sethead" aria-hidden="true"><span>Satz</span><span>Gewicht (kg)</span><span>Wdh.</span><span></span></div>
      ${s.sets[ui].map((st, si) => `<div class="set ${st.done ? "done" : ""}"><span class="num muted">${si + 1}</span>
        <div class="stepper"><button data-act="w" data-u="${ui}" data-s="${si}" data-d="-${step}" aria-label="Satz ${si + 1}: ${fmt(step, 1)} kg weniger">−</button><input class="sv num" type="text" inputmode="decimal" autocomplete="off" pattern="[0-9]+([,.][0-9]{1,2})?" data-sw="${ui}:${si}" value="${String(st.gewicht).replace(".", ",")}" aria-label="Gewicht Satz ${si + 1} in kg"><button data-act="w" data-u="${ui}" data-s="${si}" data-d="${step}" aria-label="Satz ${si + 1}: ${fmt(step, 1)} kg mehr">+</button></div>
        <div class="stepper"><button data-act="r" data-u="${ui}" data-s="${si}" data-d="-1" aria-label="Satz ${si + 1}: eine Wiederholung weniger">−</button><input class="sv num" type="number" inputmode="numeric" step="1" min="0" data-sr="${ui}:${si}" value="${st.wdh}" aria-label="Wiederholungen Satz ${si + 1}"><button data-act="r" data-u="${ui}" data-s="${si}" data-d="1" aria-label="Satz ${si + 1}: eine Wiederholung mehr">+</button></div>
        <button class="ok" data-act="done" data-u="${ui}" data-s="${si}" aria-label="Satz ${si + 1} erledigt" aria-pressed="${st.done}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg></button>
        <span class="prev">${last[si] ? `zuletzt ${fmt(last[si].gewicht, 1)} kg × ${last[si].wdh}` : ""}${st.pr ? ` <span class="chip gold">Rekord</span>` : ""}</span></div>`).join("")}
      <div class="row setbtns"><button class="small ghost" data-act="addset" data-u="${ui}">+ Satz</button>${s.sets[ui].length > 1 ? `<button class="small ghost" data-act="delset" data-u="${ui}">Letzten Satz entfernen</button>` : ""}</div></section>`; }).join("")}
  <section class="card"><h3>Achillessehne nach dem Training</h3><div class="muted">0 = gar nichts, 10 = starke Schmerzen</div>
    <div class="pain">${Array.from({ length: 11 }, (_, i) => `<button data-act="schmerz" data-v="${i}" aria-pressed="${s.schmerz === i}" class="p${i < 3 ? "g" : i < 5 ? "y" : "r"}">${i}</button>`).join("")}</div>
    <button data-act="fertig">Training speichern</button></section>`;
}
const stepOf = e => +(S.dev[e?.geraet_id]?.gewicht_schritt) || 1;
const startOf = e => +(S.dev[e?.geraet_id]?.gewicht_min) || 3;
function suggest(u, last, step) {
  if (!last?.length) return `Erstes Mal: mit wenig Gewicht starten und in ${fmt(step, 1)}-kg-Schritten steigern, bis ${u.wdh_max} Wdh. gerade noch sauber gehen.`;
  const allMax = last.length >= u.saetze && last.every(x => x.wdh >= u.wdh_max), w = Math.max(...last.map(x => +x.gewicht || 0));
  return allMax ? `Letztes Mal alle Sätze mit ${u.wdh_max} Wdh. bei ${fmt(w, 1)} kg → heute ${fmt(w + step, 1)} kg.` : `Letztes Mal ${fmt(w, 1)} kg – Ziel: ${u.wdh_max} Wdh. in allen Sätzen.`;
}

ACT.start = async t => {
  const pl = S.plans.find(p => p.id === (t.dataset.plan || S.plans[0]?.id)); if (!pl) return; const tag = pl.tage[+t.dataset.i || 0]; const ids = tag.uebungen.map(u => u.uebung_id);
  let rows = S.sets.filter(x => ids.includes(x.uebung_id));
  try { rows = await q(sb.from("saetze").select("uebung_id,gewicht,wdh,training_id,nr,created_at").in("uebung_id", ids).order("created_at", { ascending: false }).limit(1000)); } catch (e) { }
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const last = {}, best = {}, bestSet = {};
  ids.forEach(id => { const r = rows.filter(x => x.uebung_id === id); if (!r.length) return; const tid = r[0].training_id; last[id] = r.filter(x => x.training_id === tid).sort((a, b) => a.nr - b.nr);
    r.forEach(x => { const v = e1rm(x.gewicht, x.wdh); if (v > (best[id] || 0)) { best[id] = v; bestSet[id] = x; } }); });
  const tn = tendon(), f = tn?.lvl === "rot" ? 0.8 : tn?.lvl === "gelb" ? 0.9 : 1; let adjusted = false;
  const sets = tag.uebungen.map(u => { const e = S.ex[u.uebung_id], dv = S.dev[e?.geraet_id] || {}, step = stepOf(e), l = last[u.uebung_id];
    let w = l?.length ? Math.max(...l.map(x => +x.gewicht || 0)) : startOf(e);
    if (l?.length >= u.saetze && l.every(x => x.wdh >= u.wdh_max)) w += step;
    if (f < 1 && isLeg(e) && w > startOf(e)) { w = Math.max(startOf(e), Math.round(w * f / step) * step); adjusted = true; }
    return Array.from({ length: u.saetze }, () => ({ gewicht: w, wdh: u.wdh_min, done: false })); });
  S.session = { id: uid(), plan: pl, tag, sets, last, best, bestSet, schmerz: null, adjust: adjusted ? `Beinübungen wegen der Sehne um ${Math.round((1 - f) * 100)} % leichter vorgeschlagen.` : "" };
  S.view = "training"; persist(); render(); window.scrollTo(0, 0);
};
// Laufendes Training überlebt Neuladen und App-Wechsel
export const SK = DEMO ? "laufendes-training-demo" : "laufendes-training";
export function persist() { try { if (S.session) localStorage.setItem(SK, JSON.stringify({ ...S.session, plan: { id: S.session.plan.id, name: S.session.plan.name }, savedAt: Date.now() })); else localStorage.removeItem(SK); } catch (e) { } }
export function restoreSession() { try { const x = JSON.parse(localStorage.getItem(SK) || "null"); if (x && Date.now() - x.savedAt < 6 * 3600e3) { S.session = x; return true; } localStorage.removeItem(SK); } catch (e) { } return false; }
ACT.abbrechen = t => { if (t.dataset.sure !== "1") { t.dataset.sure = "1"; t.textContent = "Wirklich abbrechen?"; return; } S.session = null; persist(); stopTimer(); render(); };
ACT.rest = t => { try { localStorage.setItem("pause", t.dataset.v); } catch (e) { } render(); };
// Jeder Satz wird einzeln geändert – andere Sätze bleiben, wie sie sind.
const round = v => Math.round(v * 100) / 100;
ACT.w = t => { const st = S.session.sets[t.dataset.u][t.dataset.s]; st.gewicht = Math.max(0, round(st.gewicht + +t.dataset.d)); buzz(6); persist(); render(); };
ACT.r = t => { const st = S.session.sets[t.dataset.u][t.dataset.s]; st.wdh = Math.max(0, st.wdh + +t.dataset.d); buzz(6); persist(); render(); };
ACT.addset = t => { const arr = S.session.sets[t.dataset.u], prev = arr[arr.length - 1] || { gewicht: 3, wdh: 8 }; arr.push({ gewicht: prev.gewicht, wdh: prev.wdh, done: false }); persist(); render(); };
ACT.delset = t => { const arr = S.session.sets[t.dataset.u]; if (arr.length > 1) arr.pop(); persist(); render(); };
document.addEventListener("change", e => {
  const t = e.target, k = t.dataset.sw || t.dataset.sr; if (!k || !S.session) return;
  const [ui, si] = k.split(":").map(Number), st = S.session.sets[ui]?.[si]; if (!st) return;
  const v = Math.max(0, parseFloat(String(t.value).replace(",", ".")) || 0);
  if (t.dataset.sw) st.gewicht = round(v); else st.wdh = Math.round(v);
  persist(); render();
});
ACT.done = t => {
  const s = S.session, ui = +t.dataset.u, si = +t.dataset.s, st = s.sets[ui][si], id = s.tag.uebungen[ui].uebung_id;
  st.done = !st.done; buzz(st.done ? 20 : 8);
  if (st.done) {
    const v = e1rm(st.gewicht, st.wdh);
    if (st.gewicht > 0 && s.best[id] && v > s.best[id] + 0.01) { st.pr = true; s.best[id] = v; s.bestSet[id] = { gewicht: st.gewicht, wdh: st.wdh }; buzz([40, 60, 40]); toast(`Neuer Rekord: ${S.ex[id]?.name || id} ${fmt(st.gewicht, 1)} kg × ${st.wdh}`, "pr"); }
    else if (!s.best[id] && st.gewicht > 0) { s.best[id] = v; s.bestSet[id] = { gewicht: st.gewicht, wdh: st.wdh }; }
    const lastSet = ui === s.sets.length - 1 && si === s.sets[ui].length - 1; if (!lastSet) startTimer(restPref());
  } else st.pr = false;
  persist(); render();
};
ACT.schmerz = t => { S.session.schmerz = +t.dataset.v; buzz(10); persist(); render(); };
ACT.fertig = async () => {
  const s = S.session; const done = s.sets.flatMap((arr, ui) => arr.map((x, si) => ({ ...x, ui, si }))).filter(x => x.done);
  if (!done.length) return toast("Noch kein Satz abgehakt");
  if (s.schmerz == null) return toast("Bitte noch kurz die Sehne bewerten (0–10)");
  const tr = { id: s.id, plan_id: s.plan.id, tag_name: s.tag.name, datum: todayISO(), schmerz: s.schmerz >= 3, schmerz_wert: s.schmerz };
  const rows = done.map(x => ({ id: uid(), training_id: s.id, uebung_id: s.tag.uebungen[x.ui].uebung_id, nr: x.si + 1, gewicht: x.gewicht, wdh: x.wdh }));
  S.trainings.push({ ...tr, created_at: new Date().toISOString() }); rows.forEach(r => S.sets.push({ ...r, created_at: new Date().toISOString() }));
  const prs = done.filter(x => x.pr).length, vol = done.reduce((a, x) => a + x.gewicht * x.wdh, 0);
  S.session = null; persist(); stopTimer(); render(); window.scrollTo(0, 0);
  await put("trainings", "insert", tr); await put("saetze", "insert", rows);
  toast(`Gespeichert · ${done.length} Sätze · ${fmt(vol)} kg bewegt${prs ? ` · ${prs} Rekord${prs > 1 ? "e" : ""}` : ""}`);
};

// ---------- Gespeichertes Training ansehen / löschen ----------
ACT["tr-open"] = async t => {
  const tr = S.trainings.find(x => x.id === t.dataset.id); if (!tr) return;
  const { openSheet } = await import("./add.js");
  const sets = S.sets.filter(x => x.training_id === tr.id).sort((a, b) => (a.uebung_id + a.nr).localeCompare(b.uebung_id + b.nr));
  const by = {}; sets.forEach(x => (by[x.uebung_id] = by[x.uebung_id] || []).push(x));
  openSheet(`<div class="sheet-head"><h2>${esc(tr.tag_name || "Training")}</h2><span class="muted">${esc(relLabel(tr.datum))}</span></div>
    ${Object.entries(by).map(([id, xs]) => `<div><b>${esc(S.ex[id]?.name || id)}</b><div class="muted num">${xs.map(x => `${fmt(x.gewicht, 1)} kg × ${x.wdh}`).join(" · ")}</div></div>`).join("") || `<div class="muted">Keine Sätze gespeichert.</div>`}
    ${tr.schmerz_wert != null ? `<div class="muted">Achillessehne: ${tr.schmerz_wert} von 10</div>` : ""}
    <button class="ghost danger" data-act="tr-del" data-id="${esc(tr.id)}">Training löschen</button>`);
};
ACT["tr-del"] = async t => {
  if (t.dataset.sure !== "1") { t.dataset.sure = "1"; t.textContent = "Wirklich löschen? Alle Sätze gehen verloren."; return; }
  const id = t.dataset.id; S.trainings = S.trainings.filter(x => x.id !== id); S.sets = S.sets.filter(x => x.training_id !== id);
  const { closeSheet } = await import("./add.js"); closeSheet(); render();
  await put("saetze", "delete", null, { training_id: id }); await put("trainings", "delete", null, { id }); toast("Training gelöscht");
};

// ---------- Pausen-Timer ----------
let tick = null;
function bar() { let el = $("#timer"); if (!el) { el = document.createElement("div"); el.id = "timer"; el.setAttribute("role", "timer"); document.body.append(el); } return el; }
export function startTimer(sec) { S.timer = { end: Date.now() + sec * 1000 }; clearInterval(tick); tick = setInterval(draw, 250); draw(); }
export function stopTimer() { S.timer = null; clearInterval(tick); $("#timer")?.remove(); }
function draw() {
  if (!S.timer) return stopTimer();
  const left = Math.max(0, Math.round((S.timer.end - Date.now()) / 1000));
  const el = bar(); const txt = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  if (el.dataset.t !== txt) { el.dataset.t = txt; el.innerHTML = `<span>Pause</span><b class="num">${txt}</b><button class="small ghost" data-act="tmr" data-d="-15" aria-label="15 Sekunden weniger">−15</button><button class="small ghost" data-act="tmr" data-d="15" aria-label="15 Sekunden mehr">+15</button><button class="small" data-act="tmr" data-d="0">Weiter</button>`; }
  if (left <= 0) { stopTimer(); buzz([300, 150, 300]); beep(); toast("Pause vorbei – nächster Satz"); }
}
ACT.tmr = t => { const d = +t.dataset.d; if (!d || !S.timer) return stopTimer(); S.timer.end += d * 1000; draw(); };
let ac = null;
function beep() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); [0, 0.25].forEach(o => { const g = ac.createGain(), os = ac.createOscillator(); os.frequency.value = 880; g.gain.setValueAtTime(0.15, ac.currentTime + o); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + o + 0.2); os.connect(g).connect(ac.destination); os.start(ac.currentTime + o); os.stop(ac.currentTime + o + 0.2); }); } catch (e) { } }
