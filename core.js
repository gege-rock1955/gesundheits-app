// Gemeinsamer Kern: Verbindung, Zustand, Hilfen, Rechnen, Offline-Warteschlange.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fmt = (n, d = 0) => Number(n || 0).toLocaleString("de-DE", { maximumFractionDigits: d });
export const DAYS = [["mo", "Mo", 1], ["di", "Di", 1], ["mi", "Mi", 1], ["do", "Do", 1], ["fr", "Fr", 1], ["sa", "Sa", 0], ["so", "So", 0]];
export const SLOTS = [["frueh", "Früh"], ["mittag", "Mittag"], ["abend", "Abend"], ["snack", "Snack"]];
export const AREA = ["Obst & Gemüse", "Kühlregal", "Konserven", "Trockenware", "Wurst & Käse", "Sonstiges"];

// Zustand der App (wird beim Start aus Supabase geladen)
export const S = {
  user: null, ing: {}, rec: {}, weeks: {}, week: null, stock: {}, set: {}, fav: {}, deals: [], dev: {}, ex: {}, plans: [],
  log: [], vals: [], trainings: [], sets: [], view: "heute", date: null, session: null, timer: null
};
export const ACT = {};    // data-act="name" → Funktion(element, event)
export const hooks = { render() { }, go() { } };
export const render = () => hooks.render();
export const go = v => hooks.go(v);
export const VIEWS = {};  // Name → () => HTML

// ---------- Datum ----------
export const iso = d => d.toLocaleDateString("sv-SE");
export const parse = s => new Date(s + "T12:00:00");
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const todayISO = () => iso(new Date());
export const dayKey = s => DAYS[(parse(s).getDay() + 6) % 7][0];
export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(); const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
}
export const weekOf = s => isoWeek(parse(s));
export const monday = s => addDays(s, -((parse(s).getDay() + 6) % 7));
export const dateLabel = (s, opt = { weekday: "long", day: "numeric", month: "long" }) => parse(s).toLocaleDateString("de-DE", opt);
export function relLabel(s) { const t = todayISO(); return s === t ? "Heute" : s === addDays(t, -1) ? "Gestern" : s === addDays(t, 1) ? "Morgen" : dateLabel(s, { weekday: "short", day: "numeric", month: "short" }); }
export function slotNow() { const h = new Date().getHours(); return h < 10 ? "frueh" : h < 15 ? "mittag" : h < 21 ? "abend" : "snack"; }
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => (Math.random() * 16 | 0).toString(16)));

// ---------- Rückmeldung ----------
export function toast(t, kind = "") { const d = document.createElement("div"); d.className = "toast " + kind; d.setAttribute("role", "status"); d.textContent = t; document.body.append(d); setTimeout(() => d.remove(), 2600); }
export function status(t) { const el = $("#status"); if (el) el.textContent = t || ""; }
export function buzz(p = 12) { try { navigator.vibrate?.(p); } catch (e) { } }
// Holt alle Zeilen einer Abfrage seitenweise (Supabase liefert max. 1000 pro Anfrage).
export async function all(make, page = 1000) {
  const out = []; for (let i = 0; ; i += page) { const rows = await q(make().range(i, i + page - 1)); out.push(...rows); if (rows.length < page) return out; }
}
export async function q(p) { const { data, error } = await p; if (error) { console.error(error); throw error; } return data; }

// ---------- Offline-Warteschlange ----------
const OB = "outbox-v1";
const obGet = () => { try { return JSON.parse(localStorage.getItem(OB) || "[]"); } catch (e) { return []; } };
const obSet = a => { try { localStorage.setItem(OB, JSON.stringify(a)); } catch (e) { } };
const isNet = e => !navigator.onLine || e instanceof TypeError || /fetch|network|load failed/i.test(String(e?.message || e));
async function exec(j) {
  let x = sb.from(j.table);
  if (j.op === "insert") x = x.insert(j.row);
  else if (j.op === "upsert") x = x.upsert(j.row);
  else if (j.op === "update") x = x.update(j.row).match(j.match);
  else x = x.delete().match(j.match);
  const { error } = await x; if (error) throw error;
}
// Schreibt sofort oder merkt sich den Vorgang, wenn kein Netz da ist.
export async function put(table, op, row, match) {
  const j = { table, op, row, match };
  if (obGet().length) { obSet([...obGet(), j]); pending(); flush(); return; }
  try { await exec(j); }
  catch (e) { if (isNet(e)) { obSet([...obGet(), j]); pending(); } else { toast("Fehler: " + (e.message || e), "warn"); throw e; } }
}
function pending() { const n = obGet().length; status(n ? `Offline · ${n} Änderung${n > 1 ? "en" : ""} warten` : ""); }
let flushing = false;
export async function flush() {
  if (flushing || !navigator.onLine) return pending(); flushing = true;
  try { let a = obGet(); while (a.length) { try { await exec(a[0]); } catch (e) { if (isNet(e)) break; console.error("verworfen", a[0], e); } a = obGet().slice(1); obSet(a); } }
  finally { flushing = false; pending(); }
}
window.addEventListener("online", flush);

// ---------- Rechnen ----------
export function nutr(id, qty) { const i = S.ing[id]; if (!i) return [0, 0]; const f = i.einheit === "g" ? qty / 100 : qty; return [(+i.kcal || 0) * f, (+i.eiweiss || 0) * f]; }
export function portion(rid) { const r = S.rec[rid]; if (!r) return [0, 0]; let k = 0, p = 0; (r.zutaten || []).forEach(z => { const [a, b] = nutr(z.id, z.menge); k += a; p += b; }); const n = r.portionen || 1; return [k / n, p / n]; }
export const goals = () => ({ kcal: +(S.set.ziel?.kcal) || 2200, eiweiss: +(S.set.ziel?.eiweiss) || 170 });
export const trainDays = () => S.set.trainingstage || ["di", "do", "so"];
export const weekRow = s => S.weeks[weekOf(s)] || {};

// Alles, was an einem Tag gegessen wird: Plan (Shake, Kantine, Abendessen) + eigene Einträge.
export function dayTimeline(s) {
  const d = dayKey(s), work = DAYS.find(x => x[0] === d)[2], w = weekRow(s), plan = (w.plan || {})[d] || {}, out = [];
  const logs = S.log.filter(e => e.datum === s), past = s < todayISO();
  if (S.rec.shake) {
    const [k, p] = portion("shake");
    const det = (S.rec.shake.zutaten || []).map(z => { const i = S.ing[z.id] || {}; const n = String(i.name || z.id).split(" (")[0]; return `${fmt(z.menge)} ${i.einheit === "g" ? (/\bml\b/.test(i.name || "") ? "ml" : "g") : "×"} ${n}`; }).join(", ");
    out.push({ slot: "frueh", name: "Shake", det, k, p });
  }
  if (work) {
    const base = S.set.kantine || { kcal: 700, eiweiss: 25 }, o = (w.kantine_tag || {})[d];
    if (o?.kcal) out.push({ slot: "mittag", name: "Kantine", det: o.notiz || "eingetragen", k: +o.kcal, p: +o.eiweiss || 0, kantine: true });
    else if (!logs.some(e => e.slot === "mittag")) out.push({ slot: "mittag", name: "Kantine", det: "pauschal geschätzt – tippe zum Eintragen", k: +base.kcal, p: +base.eiweiss, kantine: true, open: true });
  }
  if (plan.rezept && S.rec[plan.rezept]) {
    let [k, p] = portion(plan.rezept); let det = past ? "laut Plan" : "geplant";
    if (plan.salat && S.rec.salat) { const [a, b] = portion("salat"); k += a; p += b; det += " · mit Salat"; }
    out.push({ slot: "abend", name: S.rec[plan.rezept].kurz || S.rec[plan.rezept].name, det, k, p, planned: !past });
  }
  logs.forEach(e => out.push({ slot: e.slot || "snack", name: e.name, k: +e.kcal || 0, p: +e.eiweiss || 0, entry: e, pending: e.status === "offen",
    det: e.status === "offen" ? "Foto – Schätzung folgt" : [e.menge ? `${fmt(e.menge)} ${e.einheit || "g"}` : "", { foto: "Foto", barcode: "gescannt", zuletzt: "wie zuletzt" }[e.quelle] || ""].filter(Boolean).join(" · ") || "eingetragen" }));
  const order = SLOTS.map(x => x[0]);
  return out.sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
}
export function dayTotals(s) { const t = dayTimeline(s); return { k: t.reduce((a, x) => a + x.k, 0), p: t.reduce((a, x) => a + x.p, 0), open: t.filter(x => x.pending).length }; }
export const val = (s, quelle) => S.vals.find(v => v.datum === s && v.quelle === quelle)?.werte || null;
export const MESS = [
  ["bauch", "Bauchumfang", "cm", 1], ["fett", "Körperfett", "%", 1], ["puls", "Ruhepuls", "bpm", 0],
  ["sys", "Blutdruck oben", "mmHg", 0], ["dia", "Blutdruck unten", "mmHg", 0], ["schlaf", "Schlaf", "h", 1], ["schritte", "Schritte", "", 0]];
export function series(key) { return S.vals.filter(v => v.quelle === "messung" && v.werte?.[key] != null && v.werte[key] !== "").map(v => ({ d: v.datum, v: +v.werte[key] })).sort((a, b) => a.d.localeCompare(b.d)); }
export function weights() { return S.vals.filter(v => v.quelle === "gewicht" && +v.werte?.kg > 0).map(v => ({ d: v.datum, kg: +v.werte.kg })).sort((a, b) => a.d.localeCompare(b.d)); }
// Trendgewicht wie bei MacroFactor: geglätteter Verlauf, der Tagesschwankungen ausgleicht.
export function trendWeights() { const w = weights(); let t = null; return w.map(x => { t = t == null ? x.kg : t + 0.15 * (x.kg - t); return { ...x, trend: t }; }); }
export const e1rm = (kg, r) => (+kg || 0) * (1 + (+r || 0) / 30);
