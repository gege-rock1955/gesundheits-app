// Einfacher Offline-Cache für die App-Hülle; Daten kommen immer live aus Supabase.
const C = "wt-v13";
const FILES = ["./", "index.html", "style.css", "app.js", "core.js", "add.js", "training.js", "trends.js", "koerper.js", "profil.js", "demo.js", "config.js", "manifest.webmanifest", "icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  const req = e.request.mode === "navigate" ? new Request(u.href, { cache: "no-cache" }) : new Request(e.request, { cache: "no-cache" });
  e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
