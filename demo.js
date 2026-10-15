// Demo-Modus: komplette Test-Datenbank im Browser (localStorage). Wird mit ?demo geöffnet.
// Verhält sich wie die benötigten Teile von Supabase: lesen, filtern, einfügen, ändern, löschen, Fotos.
const KEY = "wochenteller-demo-db";
const PK = { wochen: ["woche"], bestand: ["zutat_id"], einstellungen: ["key"], tageswerte: ["datum", "quelle"] };
const pk = t => PK[t] || ["id"];
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const iso = d => d.toLocaleDateString("sv-SE");
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

const TRAIN = {"geraete": [{"id": "latzug", "name": "Latzug", "gewicht_schritt": 1, "gewicht_min": 3}, {"id": "tbar", "name": "T-Bar-Rudern (brustgestützt)", "gewicht_schritt": 1, "gewicht_min": 3}, {"id": "rudermaschine", "name": "Rudermaschine sitzend", "gewicht_schritt": 1, "gewicht_min": 3}, {"id": "beinpresse", "name": "Beinpresse", "gewicht_schritt": 1, "gewicht_min": 3}, {"id": "beinstrecker", "name": "Beinstrecker", "gewicht_schritt": 1, "gewicht_min": 3}, {"id": "beinbeuger", "name": "Beinbeuger sitzend", "gewicht_schritt": 1, "gewicht_min": 3}, {"id": "bauchpresse", "name": "Bauchpresse", "gewicht_schritt": 1, "gewicht_min": 3}, {"id": "brustpresse", "name": "Brustpresse", "gewicht_schritt": 1, "gewicht_min": 3}, {"id": "schulterpresse", "name": "Schulterdrück-Maschine", "gewicht_schritt": 1, "gewicht_min": 3}], "uebungen": [{"id": "latzug-breit", "name": "Latzug breit zur Brust", "geraet_id": "latzug", "muskeln": ["Latissimus", "Bizeps"], "hinweis": "Fokus auf breiten Latissimus"}, {"id": "tbar-rudern", "name": "T-Bar-Rudern brustgestützt", "geraet_id": "tbar", "muskeln": ["Rücken Mitte", "Latissimus"], "hinweis": "Volle Entlastung von Beinen/Rücken"}, {"id": "rudern-sitzend", "name": "Rudern sitzend an der Maschine", "geraet_id": "rudermaschine", "muskeln": ["Rücken Mitte", "Hintere Schulter"], "hinweis": "Mit Brustpolster, Stabilität im Sitzen"}, {"id": "bizeps-curl", "name": "Bizeps-Curls an der Maschine", "geraet_id": "bizepsmaschine", "muskeln": ["Bizeps"], "hinweis": "Isoliertes Finish für den Bizeps"}, {"id": "beinpresse", "name": "Beinpresse", "geraet_id": "beinpresse", "muskeln": ["Quadrizeps", "Gesäß"], "hinweis": "Druck rein aus den Fersen; Sprunggelenk starr"}, {"id": "beinstrecker", "name": "Beinstrecker", "geraet_id": "beinstrecker", "muskeln": ["Quadrizeps"], "hinweis": "Vorderseite; keine Sehnenbelastung"}, {"id": "beinbeuger", "name": "Beinbeuger sitzend", "geraet_id": "beinbeuger", "muskeln": ["Beinbeuger"], "hinweis": "Isolierte Oberschenkelrückseite"}, {"id": "bauchpresse", "name": "Bauchpresse an der Maschine", "geraet_id": "bauchpresse", "muskeln": ["Bauch"], "hinweis": "Geführter Crunch"}, {"id": "brustpresse", "name": "Brustpresse", "geraet_id": "brustpresse", "muskeln": ["Brust", "Trizeps", "Vordere Schulter"], "hinweis": "Sichere Führung im Sitzen"}, {"id": "schulterdruecken", "name": "Schulterdrücken an der Maschine", "geraet_id": "schulterpresse", "muskeln": ["Schulter", "Trizeps"], "hinweis": "Sitzender Ersatz für stehendes Drücken"}, {"id": "seitheben", "name": "Seitheben Maschine / Kabel", "geraet_id": "seitheben", "muskeln": ["Seitliche Schulter"], "hinweis": "Im Sitzen"}, {"id": "trizeps-kabel", "name": "Trizepsdrücken am Kabelzug", "geraet_id": "kabelzug", "muskeln": ["Trizeps"], "hinweis": "Im Sitzen ausführen zur Entlastung"}], "plan": [{"name": "Tag 1 · Rücken & Bizeps", "uebungen": [{"uebung_id": "latzug-breit", "saetze": 3, "wdh_min": 8, "wdh_max": 12}, {"uebung_id": "tbar-rudern", "saetze": 3, "wdh_min": 8, "wdh_max": 10}, {"uebung_id": "rudern-sitzend", "saetze": 3, "wdh_min": 10, "wdh_max": 12}, {"uebung_id": "bizeps-curl", "saetze": 3, "wdh_min": 10, "wdh_max": 12}]}, {"name": "Tag 2 · Beine & Bauch", "uebungen": [{"uebung_id": "beinpresse", "saetze": 3, "wdh_min": 10, "wdh_max": 12}, {"uebung_id": "beinstrecker", "saetze": 3, "wdh_min": 12, "wdh_max": 15}, {"uebung_id": "beinbeuger", "saetze": 3, "wdh_min": 10, "wdh_max": 12}, {"uebung_id": "bauchpresse", "saetze": 3, "wdh_min": 12, "wdh_max": 15}]}, {"name": "Tag 3 · Brust, Schulter & Trizeps", "uebungen": [{"uebung_id": "brustpresse", "saetze": 3, "wdh_min": 8, "wdh_max": 11}, {"uebung_id": "schulterdruecken", "saetze": 3, "wdh_min": 8, "wdh_max": 11}, {"uebung_id": "seitheben", "saetze": 3, "wdh_min": 12, "wdh_max": 15}, {"uebung_id": "trizeps-kabel", "saetze": 3, "wdh_min": 10, "wdh_max": 12}]}]};

function isoWeek(d = new Date()) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const w = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - w); const y = t.getUTCFullYear(); return `${y}-W${String(Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7)).padStart(2, "0")}`; }

// kh, zucker, fett, ges_fett, ballast, salz je 100 g bzw. je Stück
const N = (kh, zucker, fett, ges_fett, ballast, salz, naehr_quelle = "Richtwert", bild = null) => ({ kh, zucker, fett, ges_fett, ballast, salz, naehr_quelle, bild });
const NUTRI = {
  milch: N(4.8, 4.8, 1.5, 1.0, 0, 0.13, "Etikett", "img/milch-naehrwerte.jpg"), whey: N(5.4, 4.1, 7.3, 3.0, null, 0.34, "Etikett", "img/whey-naehrwerte.jpg"),
  schinken: N(1.0, 1.0, 1.9, 0.8, null, 2.3, "Etikett", "img/schinken-naehrwerte.jpg"), magerquark: N(4, 4, 0.3, 0.2, 0, 0.1), skyr: N(4, 4, 0.2, 0.1, 0, 0.1),
  eier: N(0.4, 0.4, 5.3, 1.6, 0, 0.2), thunfisch: N(0, 0, 1, 0.3, 0, 0.9), kaese: N(0.1, 0.1, 28, 18, 0, 1.6), mais: N(15, 4, 1.2, 0.2, 3, 0.5),
  zwiebel: N(6.5, 4.7, 0.1, 0, 1.8, 0), eisberg: N(10, 10, 0.7, 0.1, 6, 0.05), dinkelmehl: N(69, 1, 1.8, 0.3, 4, 0.01), backpulver: N(0, 0, 0, 0, 0, 0), tomaten: N(4.5, 4, 0.2, 0, 1.5, 0.03)
};
export function seed(history = true) {
  const db = {
    zutaten: [
      ["whey", "Whey-Pulver", "g", 1000, "Dose 1 kg", 392, 74, "Sonstiges"], ["milch", "Milch 1,5 % (ml)", "g", 1000, "Liter", 46, 3.4, "Kühlregal"],
      ["magerquark", "Magerquark", "g", 500, "Becher 500 g", 67, 12, "Kühlregal"], ["skyr", "Skyr", "g", 500, "Becher 500 g", 63, 11, "Kühlregal"],
      ["eier", "Eier", "Stk", null, null, 75, 6.5, "Kühlregal"], ["thunfisch", "Thunfisch naturell", "g", 150, "Dose 150 g", 110, 25, "Konserven"],
      ["kaese", "Reibekäse", "g", 150, "Packung 150 g", 350, 25, "Wurst & Käse"], ["mais", "Mais", "g", 300, "Dose 300 g", 80, 2.5, "Konserven"],
      ["zwiebel", "Zwiebel", "Stk", null, null, 30, 0.9, "Obst & Gemüse"], ["eisberg", "Eisbergsalat", "Stk", null, null, 70, 5, "Obst & Gemüse"],
      ["dinkelmehl", "Dinkelmehl", "g", 1000, "Packung 1 kg", 340, 12, "Trockenware"], ["backpulver", "Backpulver", "Stk", null, null, 0, 0, "Trockenware"],
      ["schinken", "Kochschinken", "g", 100, "Packung 100 g", 101, 20, "Wurst & Käse"], ["tomaten", "Passierte Tomaten", "g", 500, "Packung 500 g", 30, 1.5, "Konserven"]
    ].map(([id, name, einheit, packung, pack_name, kcal, eiweiss, bereich]) => ({ id, name, einheit, packung, pack_name, kcal, eiweiss, bereich, ...(NUTRI[id] || {}) })),
    rezepte: [
      { id: "shake", name: "Morgen-Shake", kurz: "Shake", portionen: 1, zutaten: [{ id: "milch", menge: 250 }, { id: "whey", menge: 30 }], zubereitung: "Schütteln." },
      { id: "salat", name: "Beilagensalat", kurz: "Salat", portionen: 1, zutaten: [{ id: "eisberg", menge: 0.5 }, { id: "zwiebel", menge: 0.5 }], zubereitung: "" },
      { id: "koefte", name: "Eiweiß-Köfte", kurz: "Köfte", portionen: 2, zutaten: [{ id: "skyr", menge: 500 }, { id: "thunfisch", menge: 150 }, { id: "eier", menge: 3 }, { id: "zwiebel", menge: 0.5 }, { id: "kaese", menge: 150 }, { id: "mais", menge: 150 }], zubereitung: "40 min bei 180 °C." },
      { id: "broetchen", name: "Low Carb Quark-Brötchen", kurz: "Quark-Brötchen", bild: "img/rezept-low-carb-quark-broetchen.jpg", portionen: 2, zutaten: [{ id: "magerquark", menge: 500 }, { id: "dinkelmehl", menge: 160 }, { id: "eier", menge: 3 }, { id: "backpulver", menge: 1 }, { id: "schinken", menge: 200 }], zubereitung: "25 min bei 180 °C." },
      { id: "pizza", name: "Protein-Pizza Thunfisch", kurz: "Pizza", portionen: 1, zutaten: [{ id: "magerquark", menge: 500 }, { id: "dinkelmehl", menge: 340 }, { id: "tomaten", menge: 200 }, { id: "kaese", menge: 200 }, { id: "thunfisch", menge: 100 }], zubereitung: "" }],
    wochen: [], bestand: [{ zutat_id: "eier", menge: 10 }, { zutat_id: "milch", menge: 2000 }],
    einstellungen: [{ key: "ziel", value: { kcal: 2200, eiweiss: 170 } }, { key: "trainingstage", value: ["di", "do", "so"] }, { key: "kantine", value: { kcal: 700, eiweiss: 25 } }],
    favoriten: [], filialen: [],
    angebote: [{ id: "demo1", haendler: "Beispiel-Markt", produkt: "Beispiel: Skyr 500 g", preis: "0,99 €", grundpreis: "1,98 €/kg", bis: day(3), bedingung: "Demo-Angebot", fav: "skyr" }],
    geraete: TRAIN.geraete, uebungen: TRAIN.uebungen,
    trainingsplaene: [{ id: "plan", name: "3-Tage Hypertrophie (Demo)", aktiv: true, tage: TRAIN.plan }],
    eintraege: [], tageswerte: [], trainings: [], saetze: []
  };
  const plan = { mo: { rezept: "koefte", salat: true }, di: { rezept: "koefte", salat: true }, mi: { rezept: "broetchen" }, do: { rezept: "broetchen" }, fr: { rezept: "koefte" }, sa: { rezept: "pizza" }, so: {} };
  for (let w = -2; w <= 0; w++) { const d = new Date(); d.setDate(d.getDate() + w * 7); db.wochen.push({ woche: isoWeek(d), plan: history || w === 0 ? plan : {}, kantine_tag: {} }); }
  if (history) {
    let kg = 109.2; const r = (a, b) => a + Math.random() * (b - a);
    for (let i = 14; i >= 1; i--) {
      const d = day(-i); kg += r(-0.35, 0.25);
      if (Math.random() < 0.8) db.tageswerte.push({ datum: d, quelle: "gewicht", werte: { kg: Math.round(kg * 10) / 10 } });
      db.tageswerte.push({ datum: d, quelle: "wasser", werte: { ml: 250 * Math.round(r(4, 10)) } });
      if (Math.random() < 0.5) db.eintraege.push({ id: uid(), datum: d, slot: "snack", name: ["Banane", "Skyr natur", "Proteinriegel", "Apfel"][i % 4], kcal: [105, 126, 210, 80][i % 4], eiweiss: [1.3, 22, 20, 0.4][i % 4], quelle: "manuell", status: "fertig", created_at: d + "T15:00:00" });
      const wd = new Date(d + "T12:00").getDay();
      if ([2, 4, 0].includes(wd)) { const tag = TRAIN.plan[[2, 4, 0].indexOf(wd)], id = uid(), sw = r(0, 3) | 0;
        db.trainings.push({ id, plan_id: "plan", tag_name: tag.name, datum: d, schmerz: sw >= 3, schmerz_wert: sw, created_at: d + "T18:30:00" });
        tag.uebungen.forEach(u => { const w0 = 3 + ((14 - i) / 7 | 0); for (let n = 1; n <= u.saetze; n++) db.saetze.push({ id: uid(), training_id: id, uebung_id: u.uebung_id, nr: n, gewicht: w0, wdh: u.wdh_min + (r(0, 3) | 0), created_at: d + "T18:3" + n + ":00" }); }); }
      if (wd === 2) db.tageswerte.push({ datum: d, quelle: "cardio", werte: { art: "Ergometer", minuten: 40, watt: 150, kcal: 391 } });
    }
  }
  save(db); return db;
}
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
const save = db => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { } };
export function resetDemo(history) { return seed(history); }

function builder(table) {
  const st = { op: "select", filters: [], order: null, range: null, limit: null, single: 0, payload: null };
  const api = {
    select() { return api; }, eq(k, v) { st.filters.push(r => r[k] === v); return api; }, gte(k, v) { st.filters.push(r => r[k] >= v); return api; },
    lte(k, v) { st.filters.push(r => r[k] <= v); return api; }, in(k, v) { st.filters.push(r => v.includes(r[k])); return api; },
    match(m) { st.filters.push(r => Object.entries(m).every(([k, v]) => r[k] === v)); return api; },
    order(k, o = {}) { st.order = [k, o.ascending !== false]; return api; }, limit(n) { st.limit = n; return api; }, range(a, b) { st.range = [a, b]; return api; },
    insert(p) { st.op = "insert"; st.payload = p; return api; }, upsert(p) { st.op = "upsert"; st.payload = p; return api; },
    update(p) { st.op = "update"; st.payload = p; return api; }, delete() { st.op = "delete"; return api; },
    maybeSingle() { st.single = 1; return api; }, single() { st.single = 2; return api; },
    then(res, rej) { return Promise.resolve().then(run).then(res, rej); }
  };
  function run() {
    const db = load() || seed(false); const rows = db[table] = db[table] || []; const now = new Date().toISOString();
    const pass = r => st.filters.every(f => f(r));
    if (st.op === "select") {
      let out = rows.filter(pass);
      if (st.order) { const [k, asc] = st.order; out = out.slice().sort((a, b) => String(a[k] ?? "").localeCompare(String(b[k] ?? "")) * (asc ? 1 : -1)); }
      if (st.range) out = out.slice(st.range[0], st.range[1] + 1); if (st.limit) out = out.slice(0, st.limit);
      return { data: st.single ? out[0] || null : out, error: null };
    }
    if (st.op === "insert" || st.op === "upsert") {
      const list = (Array.isArray(st.payload) ? st.payload : [st.payload]).map(r => ({ ...r }));
      for (const r of list) {
        if (pk(table)[0] === "id" && !r.id) r.id = uid(); if (!r.created_at) r.created_at = now;
        const i = rows.findIndex(x => pk(table).every(k => x[k] === r[k]));
        if (i >= 0) { if (st.op === "insert") return { data: null, error: { message: "Eintrag existiert schon" } }; rows[i] = { ...rows[i], ...r, updated_at: now }; } else rows.push(r);
      }
      save(db); return { data: st.single ? list[0] : list, error: null };
    }
    if (st.op === "update") { rows.filter(pass).forEach(r => Object.assign(r, st.payload, { updated_at: now })); save(db); return { data: null, error: null }; }
    if (st.op === "delete") {
      const gone = rows.filter(pass); db[table] = rows.filter(r => !pass(r));
      if (table === "trainings") { const ids = new Set(gone.map(r => r.id)); db.saetze = (db.saetze || []).filter(s => !ids.has(s.training_id)); }
      save(db); return { data: null, error: null };
    }
  }
  return api;
}
const files = new Map();
const storage = { from: () => ({
  upload: async (p, blob) => { files.set(p, blob); return { data: { path: p }, error: null }; },
  list: async (folder) => ({ data: [...files.entries()].filter(([p]) => p.startsWith(folder + "/")).map(([p, b]) => ({ name: p.split("/").pop(), metadata: { size: b.size } })), error: null }),
  createSignedUrl: async p => ({ data: files.has(p) ? { signedUrl: URL.createObjectURL(files.get(p)) } : null, error: null }),
  download: async p => ({ data: files.get(p) || null, error: files.has(p) ? null : { message: "nicht gefunden" } }),
  remove: async ps => { ps.forEach(p => files.delete(p)); return { data: [], error: null }; }
}) };
export function createDemo(history = true) {
  if (!load()) seed(history);
  const user = { id: "demo-user", email: "demo@beispiel.de" };
  return { from: builder, storage, auth: { getSession: async () => ({ data: { session: { user } } }), signInWithPassword: async () => ({ error: null }), signOut: async () => { } } };
}
