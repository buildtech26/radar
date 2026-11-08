// Radar · funziona anche senza rete (in metro, in aula): la pagina dalla cache, le notizie dall'ultima volta.
const VERSIONE = "radar-v34";
const GUSCIO = ["./", "index.html", "privacy.html", "privacy-en.html", "stile.css", "app.js", "lingua.js", "conto.js", "config.js", "icona.svg", "manifest.webmanifest", "icona-180.png", "icona-192.png"];

// cache: "reload" = i file freschi dal sito, non la copia che il browser tiene fino a 10 minuti (GitHub Pages):
// senza, una versione nuova poteva installarsi con dentro l'app.js vecchio
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSIONE).then((c) => c.addAll(GUSCIO.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
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
  // pagina: subito dalla cache, e intanto la aggiorno per la prossima volta (chiedendo al sito se è cambiata,
  // non alla copia del browser)
  e.respondWith(
    caches.match(e.request).then((inCache) => {
      // l'apertura della pagina (mode "navigate") non si può ricopiare con opzioni: si richiede per indirizzo
      const fresca = e.request.mode === "navigate" ? new Request(e.request.url, { cache: "no-cache" }) : new Request(e.request, { cache: "no-cache" });
      const rete = fetch(fresca).then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(VERSIONE).then((c) => c.put(e.request, copia)); }
        return r;
      }).catch(() => inCache);
      return inCache || rete;
    })
  );
});

// ---------------------------------------------------------------- notifiche
// Le manda il giro orario su GitHub (notifica.py): { titolo, testo, url, tag }. iOS vuole che ogni push mostri
// davvero una notifica, quindi anche un messaggio storto ne mostra una.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { testo: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.titolo || "Radar", {
    body: d.testo || "",
    icon: "icona-192.png",
    tag: d.tag || undefined,
    lang: d.lingua || undefined,
    data: { url: d.url || "./" },
  }));
});

// toccandola: il Radar già aperto va in primo piano e apre la notizia; se è chiuso si apre lì
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil((async () => {
    const finestre = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const aperta = finestre.find((c) => c.url.startsWith(self.registration.scope));
    if (aperta) {
      try { await aperta.focus(); } catch { /* resta dov'è */ }
      aperta.postMessage({ radar: "apri", url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
