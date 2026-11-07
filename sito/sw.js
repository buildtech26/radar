// Radar · funziona anche senza rete (in metro, in aula): la pagina dalla cache, le notizie dall'ultima volta.
const VERSIONE = "radar-v28";
const GUSCIO = ["./", "index.html", "privacy.html", "privacy-en.html", "stile.css", "app.js", "lingua.js", "conto.js", "config.js", "icona.svg", "manifest.webmanifest", "icona-180.png", "icona-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSIONE).then((c) => c.addAll(GUSCIO)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== VERSIONE).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;   // immagini e link esterni: niente cache
  if (url.pathname.endsWith("/dati.json")) {
    // notizie: prima la rete, se manca l'ultima copia
    e.respondWith(
      fetch(e.request).then((r) => {
        const copia = r.clone();
        caches.open(VERSIONE).then((c) => c.put("dati.json", copia));
        return r;
      }).catch(() => caches.match("dati.json"))
    );
    return;
  }
  // pagina: subito dalla cache, e intanto la aggiorno per la prossima volta
  e.respondWith(
    caches.match(e.request).then((inCache) => {
      const rete = fetch(e.request).then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(VERSIONE).then((c) => c.put(e.request, copia)); }
        return r;
      }).catch(() => inCache);
      return inCache || rete;
    })
  );
});
