// Radar · logica della pagina.
// I testi delle notizie arrivano da siti esterni: vanno sempre nel DOM come testo (textContent), mai come HTML.

import * as conto from "./conto.js";
import { NOTIFICHE } from "./config.js";
import { L, LOCALE, lingua, impostaLingua, loc } from "./lingua.js";

// ---------------------------------------------------------------- utilità

const $ = (s, r = document) => r.querySelector(s);
const RIDOTTO = matchMedia("(prefers-reduced-motion: reduce)");

// l'aspetto: "auto" segue il chiaro/scuro del dispositivo, oppure "chiaro" o "scuro" fissi. Vale per questo
// dispositivo (radar.aspetto, come la barra laterale): sul telefono si può volere scuro e sul PC chiaro.
// index.html lo applica già prima del disegno; qui lo si cambia e si segue il dispositivo quando cambia.
const SCURO = matchMedia("(prefers-color-scheme: dark)");
function sceltaAspetto() {
  try { const a = localStorage.getItem("radar.aspetto"); return a === "chiaro" || a === "scuro" ? a : "auto"; } catch { return "auto"; }
}
function applicaAspetto() {
  const a = sceltaAspetto();
  const s = a === "auto" ? (SCURO.matches ? "scuro" : "chiaro") : a;
  document.documentElement.setAttribute("data-aspetto", s);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", s === "scuro" ? "#000000" : "#f2f2f7");
}
function impostaAspetto(a) {
  try { a === "auto" ? localStorage.removeItem("radar.aspetto") : localStorage.setItem("radar.aspetto", a); } catch { /* resta per questa volta */ }
  applicaAspetto();
}
SCURO.addEventListener("change", applicaAspetto);
applicaAspetto();
function h(tag, attr, ...figli) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attr || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const f of figli.flat(Infinity)) if (f != null && f !== false) el.append(f instanceof Node ? f : String(f));
  return el;
}

const ICONE = {
  segnalibro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.5-6.5 4.5v-16a1 1 0 0 1 1-1z"/></svg>',
  segnalibroPieno: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.5-6.5 4.5v-16a1 1 0 0 1 1-1z"/></svg>',
  occhio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12s3.3-6 9-6c1.6 0 3 .5 4.2 1.1M21 12s-3.3 6-9 6c-1.6 0-3-.5-4.2-1.1"/><path d="M4 20L20 4"/></svg>',
  cestino: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 13h9l1-13"/></svg>',
  libro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2z"/><path d="M12 6.5v13"/></svg>',
  lente: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20"/></svg>',
  esterno: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4.5h5.5V10"/><path d="M19.5 4.5L11 13"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/></svg>',
  condividi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v11.5"/><path d="M8 7.5l4-4 4 4"/><path d="M8.5 10.5H7a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1.5"/></svg>',
  freccia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  laterale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M9.5 4.5v15"/></svg>',
  indietro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  calma: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="24" cy="24" r="6"/><path d="M24 8a16 16 0 0 1 16 16M24 2a22 22 0 0 1 22 22" opacity=".5"/></svg>',
  stella: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>',
  stellaPiena: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>',
  spunta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  radar: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="24" cy="24" r="19"/><circle cx="24" cy="24" r="11.5" opacity=".55"/><circle cx="24" cy="24" r="3.2" fill="currentColor" stroke="none"/><path d="M24 24L37 11"/></svg>',
  chiudi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  // il simbolo di ogni sezione (cerchi delle storie): gli stessi del widget
  sFinanza: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 17.5l5-5.5 4 3.5 7.5-8.5"/><path d="M15.5 7h4.5v4.5"/></svg>',
  sEconomia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 9.5L12 4l8.5 5.5z"/><path d="M4.5 20h15"/><path d="M6.5 12v5.5M10 12v5.5M14 12v5.5M17.5 12v5.5"/></svg>',
  sAi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z"/><path d="M18.5 15.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/></svg>',
  sTech: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="6.5" y="6.5" width="11" height="11" rx="2"/><rect x="9.75" y="9.75" width="4.5" height="4.5" rx=".8"/><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3"/></svg>',
  sScienza: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/></svg>',
};
function icona(nome, classe) {
  const t = document.createElement("template");
  t.innerHTML = ICONE[nome];   // stringhe fisse scritte qui sopra, non dati esterni
  const el = t.content.firstChild;
  el.setAttribute("aria-hidden", "true");
  if (classe) el.setAttribute("class", classe);
  return el;
}

const mem = {
  get(k, def) { try { const v = localStorage.getItem("radar." + k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem("radar." + k, JSON.stringify(v)); } catch { /* memoria piena o non disponibile: pazienza */ } },
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fmt = (x, dec) => x.toLocaleString(LOCALE(), { minimumFractionDigits: dec, maximumFractionDigits: dec });
const data = (ms, opzioni) => new Date(ms).toLocaleDateString(LOCALE(), opzioni);
const MINUS = "−";

// ---------------------------------------------------------------- molle (fisica alla Apple: smorzamento + risposta)

// Parte sempre dal valore attuale con la velocità attuale: si può riprendere a metà corsa senza scatti.
function molla({ da, a, velocita = 0, smorzamento = 1, risposta = 0.35, aggiorna, fine }) {
  if (RIDOTTO.matches) smorzamento = Math.max(1, smorzamento);
  const k = (2 * Math.PI / risposta) ** 2;
  const c = (4 * Math.PI * smorzamento) / risposta;
  const soglia = Math.max(0.001, Math.abs(a - da) * 0.001);
  let x = da, v = velocita, t0 = performance.now(), id = 0, fermata = false;
  const passo = (t) => {
    if (fermata) return;
    const dt = Math.min(0.064, (t - t0) / 1000);
    t0 = t;
    const n = Math.max(1, Math.ceil(dt / 0.004));
    for (let i = 0; i < n; i++) {
      const hh = dt / n;
      v += (-k * (x - a) - c * v) * hh;
      x += v * hh;
    }
    if (Math.abs(x - a) < soglia && Math.abs(v) < soglia * 10) {
      x = a; v = 0; aggiorna(x); fine && fine(); return;
    }
    aggiorna(x);
    id = requestAnimationFrame(passo);
  };
  id = requestAnimationFrame(passo);
  return { ferma() { fermata = true; cancelAnimationFrame(id); }, get valore() { return x; }, get velocita() { return v; } };
}
// dove arriverebbe un lancio con questa velocità (la stessa formula dello scorrimento di iOS)
const proietta = (v, d = 0.99) => ((v / 1000) * d) / (1 - d);
// resistenza progressiva oltre un bordo
const elastico = (oltre, dim, c = 0.55) => (oltre * dim * c) / (dim + c * Math.abs(oltre));

function velocitaDa(storia, adesso) {
  if (storia.length < 2) return 0;
  const ultimo = storia[storia.length - 1];
  if (adesso - ultimo[0] > 80) return 0;          // il dito si era fermato prima di alzarsi
  let i = storia.length - 1;
  while (i > 0 && ultimo[0] - storia[i - 1][0] < 100) i--;
  const primo = storia[i];
  const dt = (ultimo[0] - primo[0]) / 1000;
  return dt > 0 ? (ultimo[1] - primo[1]) / dt : 0;
}

// ---------------------------------------------------------------- profilo dell'utente
// Tutto quello che rende il Radar "tuo": nome, temi, mercati, paesi. Resta su questo dispositivo e, con
// l'account, si sincronizza così com'è (è un oggetto solo).
//   temi: { id: peso 1-3 } oppure null = non ancora scelti (valgono i temi proposti)
//   mercati: [simboli] oppure null = non ancora scelti (valgono i mercati proposti)
//   mio: il simbolo messo in evidenza (stella), o null
//   paesi: { it, eu, us, gb: true/false } da dove vengono le notizie (il "paese" della fonte in interessi.json);
//          null = non ancora scelti (valgono i paesi proposti, che dipendono dalla lingua dell'app)
//   sezioni: { finanza, economia, ai, tech, scienza: true/false } le sezioni da vedere; null = tutte. Una sezione
//          che non c'è (nata dopo) vale accesa. Le spente spariscono da Notizie e Per te, e i loro temi non contano.
//   interfaccia: "it" | "en", la lingua dell'app; null = la decide il browser (vedi lingua.js)
function nuovoProfilo() {
  // notifiche: un tema per sezione, { finanza: "etf", ai: "anthropic" } (vedi pannelloNotifiche)
  return { versione: 1, nome: "", temi: null, mercati: null, mio: null, paesi: null, sezioni: null, interfaccia: null, notifiche: null, fatto: false };
}
// I profili di prima avevano "lingue" ({ it, en }) al posto dei paesi: chi aveva già fatto le sue scelte tiene
// tutto quello che vedeva (l'inglese acceso = Europa, Stati Uniti e Regno Unito).
function normalizza(p) {
  const q = { ...nuovoProfilo(), ...(p || {}) };
  if (!q.paesi && q.lingue && q.fatto) {
    const en = q.lingue.en !== false;
    q.paesi = { it: q.lingue.it !== false, eu: en, us: en, gb: en };
  }
  delete q.lingue;
  return q;
}
function caricaProfilo() {
  const p = mem.get("profilo", null);
  return p ? normalizza(p) : nuovoProfilo();
}
function salvaProfilo() {
  mem.set("profilo", S.profilo);
  segnaTempo("profilo");
}
// quando è cambiato ogni pezzo: con l'account vince il più recente tra i dispositivi
function segnaTempo(...gruppi) {
  const ora = Date.now();
  for (const g of gruppi) S.tempi[g] = ora;
  mem.set("tempi", S.tempi);
  programmaSync();
}

// ---------------------------------------------------------------- stato

const S = {
  dati: null,
  caricato: 0,
  vista: "per-te",
  sezione: mem.get("sezione", "tutto"),
  periodo: mem.get("periodo", 90),
  filtroAgenda: "tutti",
  cerca: "",
  profilo: caricaProfilo(),
  salvate: mem.get("salvate", []),
  nascoste: new Set(mem.get("nascoste", [])),
  lette: mem.get("lette", []),
  storieViste: new Set(mem.get("storieViste", [])),   // le notizie già passate nelle storie (solo questo dispositivo)
  tempi: mem.get("tempi", {}),
  versioneTemi: 0,
};
// funzioni e non oggetti fissi: i nomi cambiano con la lingua
const SEZIONI = () => ({ finanza: L("Finanza", "Finance"), economia: L("Economia", "Economy"), ai: "AI", tech: "Tech", scienza: L("Scienza", "Science") });
const GRUPPI_TEMI = () => ({ finanza: L("Finanza", "Finance"), economia: L("Economia", "Economy"), ai: L("Intelligenza artificiale", "Artificial intelligence"), tech: L("Tecnologia", "Technology"), scienza: L("Scienza", "Science") });
// le chiavi restano quelle del catalogo (in italiano); si traduce solo quello che si vede
const CATEGORIE_MERCATI = ["Indici", "ETF", "Azioni", "Valute", "Materie prime", "Cripto"];
const nomeCategoria = (c) => L(c, { Indici: "Indices", ETF: "ETF", Azioni: "Stocks", Valute: "Currencies", "Materie prime": "Commodities", Cripto: "Crypto" }[c] || c);
const COLORE_SEZIONE = { finanza: "var(--finanza)", economia: "var(--economia)", ai: "var(--ai)", tech: "var(--tech)", scienza: "var(--scienza)" };
const COLORI_AGENDA = { bce: "#5856d6", fed: "#0a9396", usa: "#f08c00", euro: "#e8384f", conti: "#af52de" };
const TIPI_AGENDA = () => ({
  bce: { nome: L("BCE", "ECB"), colore: COLORI_AGENDA.bce },
  fed: { nome: "Fed", colore: COLORI_AGENDA.fed },
  usa: { nome: L("Inflazione USA", "US inflation"), colore: COLORI_AGENDA.usa },
  euro: { nome: L("Inflazione euro", "Euro inflation"), colore: COLORI_AGENDA.euro },
  conti: { nome: L("Trimestrali", "Earnings"), colore: COLORI_AGENDA.conti },
});
const FILTRI_AGENDA = () => [["tutti", L("Tutti", "All")], ["banche", L("Banche centrali", "Central banks"), ["bce", "fed"]], ["inflazione", L("Inflazione", "Inflation"), ["usa", "euro"]], ["conti", L("Trimestrali", "Earnings"), ["conti"]]];

// da dove vengono le notizie: l'ordine è quello in cui si mostrano
const PAESI = () => [["it", L("Italia", "Italy")], ["eu", L("Europa", "Europe")], ["us", L("Stati Uniti", "United States")], ["gb", L("Regno Unito", "United Kingdom")]];
// a chi non ha ancora scelto: in italiano Italia, Europa e Stati Uniti (lì escono quasi tutte le notizie sull'AI),
// in inglese Stati Uniti, Regno Unito ed Europa
const paesiProposti = () => (lingua() === "it" ? { it: true, eu: true, us: true, gb: false } : { it: false, eu: true, us: true, gb: true });
function paesiScelti() {
  const p = S.profilo.paesi || paesiProposti();
  const scelti = new Set(PAESI().map(([k]) => k).filter((k) => p[k]));
  return scelti.size ? scelti : new Set(Object.keys(paesiProposti()).filter((k) => paesiProposti()[k]));
}
// il paese lo scrive raccogli.py su ogni notizia; per i dati di prima lo si prende dalla fonte, o si deduce dalla lingua
function paeseDi(n) {
  if (n.paese) return n.paese;
  const f = S.dati?.fonti?.find((x) => x.nome === n.fonte);
  return f?.paese || (n.lingua === "it" ? "it" : "us");
}
// le testate di un paese, una volta sola ("Il Sole 24 Ore · Finanza" e "· Economia" → "Il Sole 24 Ore")
const fontiDi = (paese) => [...new Set((S.dati?.fonti || []).filter((f) => (f.paese || (f.lingua === "it" ? "it" : "us")) === paese).map((f) => f.nome.split(" · ")[0]))];

// le sezioni da vedere (vedi il profilo): sempre almeno una
function sezioniScelte() {
  const p = S.profilo.sezioni;
  const tutte = Object.keys(SEZIONI());
  const scelte = new Set(tutte.filter((k) => !p || p[k] !== false));
  return scelte.size ? scelte : new Set(tutte);
}
// le testate di una sezione, in breve: "Il Post, ANSA, HDblog e altre 7"
function fontiSezione(s) {
  const nomi = [...new Set((S.dati?.fonti || []).filter((f) => f.sezione === s).map((f) => f.nome.split(" · ")[0]))];
  if (nomi.length <= 4) return nomi.join(", ");
  return L(`${nomi.slice(0, 3).join(", ")} e altre ${nomi.length - 3}`, `${nomi.slice(0, 3).join(", ")} and ${nomi.length - 3} more`);
}

const leggero = (n) => ({ id: n.id, titolo: n.titolo, sommario: n.sommario, link: n.link, data: n.data, immagine: n.immagine, fonte: n.fonte, sezione: n.sezione, lingua: n.lingua, paese: n.paese });
// le salvate si portano dietro anche il testo lungo e la traduzione: dopo un paio di giorni la notizia esce da
// dati.json, e senza questi la sottopagina tornerebbe al solo riassunto, in lingua originale (anche offline)
const perSalvate = (n) => ({ ...leggero(n), ...(n.testo ? { testo: n.testo } : {}), ...(n.traduzione ? { traduzione: n.traduzione } : {}), salvataIl: Date.now() });
// quelle salvate prima (o arrivate dall'account senza) li prendono dalle notizie di oggi, finché ci sono. Senza
// segnare il tempo: è un completamento, non una scelta, e non deve vincere la sincronizzazione su un altro dispositivo
function completaSalvate() {
  if (!S.dati) return;
  let cambiate = false;
  S.salvate = S.salvate.map((s) => {
    const oggi = S.dati.notizie.find((x) => x.id === s.id);
    if (!oggi) return s;
    const extra = {};
    if (!s.testo && oggi.testo) extra.testo = oggi.testo;
    if (!s.traduzione && oggi.traduzione) extra.traduzione = oggi.traduzione;
    if (!Object.keys(extra).length) return s;
    cambiate = true;
    return { ...s, ...extra };
  });
  if (cambiate) salvaStato();
}
const salvata = (id) => S.salvate.some((n) => n.id === id);
const letta = (id) => S.lette.some((n) => n.id === id);

// ---------------------------------------------------------------- interessi e punteggio

const BORDO_PRIMA = "(?<![\\p{L}\\p{N}])";
const BORDO_DOPO = "(?![\\p{L}\\p{N}])";

const temiProposti = () => Object.fromEntries(S.dati.temi.filter((t) => t.predefinito).map((t) => [t.id, 2]));
const pesiTemi = () => S.profilo.temi ?? temiProposti();
// tutto il catalogo dei mercati, anche quelli che nell'ultimo giro non hanno dato prezzi (dati vecchi: solo quelli con prezzi)
const catalogo = () => S.dati.catalogo_mercati || S.dati.mercati;
const mercatiScelti = () => S.profilo.mercati ?? catalogo().filter((m) => m.predefinito).map((m) => m.simbolo);

// i mercati scelti che hanno prezzi, nell'ordine del catalogo, con quello in evidenza per primo
function mieiMercati() {
  const scelti = new Set(mercatiScelti());
  const lista = S.dati.mercati.filter((m) => scelti.has(m.simbolo));
  const mio = lista.find((m) => m.simbolo === S.profilo.mio);
  return mio ? [mio, ...lista.filter((m) => m !== mio)] : lista;
}
// quelli scelti ma rimasti senza prezzi in questo aggiornamento (fonte bloccata o in ritardo)
function mercatiMancanti() {
  const conDati = new Set(S.dati.mercati.map((m) => m.simbolo));
  const scelti = new Set(mercatiScelti());
  return catalogo().filter((m) => scelti.has(m.simbolo) && !conDati.has(m.simbolo));
}

const elenco = (v) => (v.length < 2 ? v.join("") : `${v.slice(0, -1).join(", ")} ${L("e", "and")} ${v.at(-1)}`);

// da dove viene ogni prezzo: lo dice la scheda, e la nota sotto lo spiega (le licenze chiedono di citarle)
function fonteDi(m) {
  if (m.fonte === "bce") return L("tasso BCE del ", "ECB rate of ") + data(m.ora, { day: "numeric", month: "short" });
  if (m.fonte === "coingecko") return "CoinGecko";
  return "";
}
// il codice da Borsa serve solo per ETF e azioni (VWCE, NVDA): per indici, cambi e materie prime è gergo di Yahoo
const codiceMercato = (m) => (m.categoria === "ETF" || m.categoria === "Azioni" ? m.simbolo.replace(/\.[A-Z]+$/, "") : "");
const descriviMercato = (m) => [nomeCategoria(m.categoria), codiceMercato(m), fonteDi(m)].filter(Boolean).join(" · ");
function notaPrezzi(extra = "") {
  return h("p", { class: "nota" },
    L("Prezzi: indici, ETF, azioni e materie prime da Yahoo Finance, con qualche minuto di ritardo; cambi dai tassi di riferimento della BCE, uno al giorno verso le 16; cripto dai ",
      "Prices: indices, ETFs, stocks and commodities from Yahoo Finance, a few minutes delayed; exchange rates from the ECB reference rates, once a day around 4 pm (Italian time); crypto from "),
    h("a", { href: "https://www.coingecko.com", target: "_blank", rel: "noopener" }, L("dati di CoinGecko", "CoinGecko data")),
    `. ${L("Possono contenere errori.", "They may contain errors.")} ${extra}`);
}

function impostaPeso(id, v) {
  const pesi = { ...pesiTemi() };
  if (v) pesi[id] = v; else delete pesi[id];
  S.profilo.temi = pesi;
  salvaProfilo();
  compilaTemi();
}
function impostaMercato(simbolo, acceso) {
  const l = mercatiScelti().filter((s) => s !== simbolo);
  S.profilo.mercati = acceso ? [...l, simbolo] : l;
  if (!acceso && S.profilo.mio === simbolo) S.profilo.mio = null;
  salvaProfilo();
}

function compilaTemi() {
  S.versioneTemi++;
  const pesi = pesiTemi();
  const sezioni = sezioniScelte();   // i temi di una sezione spenta restano scelti, ma non contano
  S.temi = S.dati.temi.map((t) => {
    const parti = t.parole.filter(Boolean).map((p) => esc(p.toLowerCase()) + (p.length <= 3 ? BORDO_DOPO : ""));
    return { id: t.id, nome: loc(t).nome, gruppo: t.gruppo, parole: t.parole, peso: sezioni.has(t.gruppo) ? pesi[t.id] || 0 : 0, re: new RegExp(`${BORDO_PRIMA}(?:${parti.join("|")})`, "iu") };
  });
  const nasc = (S.dati.nascondi || []).filter(Boolean).map(esc);
  S.reNascondi = nasc.length ? new RegExp(`${BORDO_PRIMA}(?:${nasc.join("|")})`, "iu") : null;
}

// conta anche il testo delle altre testate sullo stesso fatto: la versione inglese può nominare il tema che quella italiana tace
function valuta(n) {
  const quante = n.altre ? n.altre.length : 0;
  if (n._v && n._v.versione === S.versioneTemi && n._v.quante === quante) return n._v;
  let p = 0;
  const temi = [];
  const tutte = conAltre(n);
  for (const t of S.temi) {
    if (!t.peso) continue;
    const nelTitolo = tutte.some((x) => t.re.test(x.titolo));
    if (nelTitolo || tutte.some((x) => t.re.test(x.sommario))) {
      p += t.peso * (nelTitolo ? 2 : 1);
      temi.push(t.nome);
    }
  }
  n._v = { versione: S.versioneTemi, quante, p, temi };
  return n._v;
}

const oreDa = (n) => (n.data ? (Date.now() - n.data) / 36e5 : 24);

// lo stesso fatto da più testate ("gruppo", lo decide raccogli.py): se ne mostra una, le altre vanno in "Anche su".
// Prima quella nella lingua dell'app, poi quella col sommario, poi la più recente.
const preferita = (a, b) => (b.lingua === lingua()) - (a.lingua === lingua()) || !!b.sommario - !!a.sommario || (b.data || 0) - (a.data || 0);

function visibili() {
  const paesi = paesiScelti(), sezioni = sezioniScelte();
  const passa = (n) => paesi.has(paeseDi(n)) && sezioni.has(n.sezione) && !S.nascoste.has(n.id) && !(S.reNascondi && S.reNascondi.test(n.titolo));
  const gruppi = new Map(), via = new Set();
  for (const n of S.dati.notizie) {
    if (!n.gruppo) continue;
    if (S.nascoste.has(n.id)) via.add(n.gruppo);   // nascosta una, nascosto il fatto
    else if (passa(n)) (gruppi.get(n.gruppo) || gruppi.set(n.gruppo, []).get(n.gruppo)).push(n);
  }
  const fatti = new Set(), lista = [];
  for (const n of S.dati.notizie) {
    if (!n.gruppo) { if (passa(n)) lista.push(n); continue; }
    if (via.has(n.gruppo) || fatti.has(n.gruppo) || !gruppi.has(n.gruppo)) continue;
    fatti.add(n.gruppo);
    const [prima, ...altre] = gruppi.get(n.gruppo).sort(preferita);
    prima.altre = altre;
    lista.push(prima);
  }
  return lista;
}
const conAltre = (n) => [n, ...(n.altre || [])];

function sceltePerTe(max = 25) {
  const candidate = visibili()
    .map((n) => ({ n, v: valuta(n) }))
    .filter((x) => x.v.p > 0)
    .map((x) => ({ ...x, r: x.v.p * Math.pow(0.5, oreDa(x.n) / 18) }))   // un punto perde metà valore ogni 18 ore
    .sort((a, b) => b.r - a.r);
  const perFonte = {}, scelte = [];
  for (const x of candidate) {
    if ((perFonte[x.n.fonte] = (perFonte[x.n.fonte] || 0) + 1) > 3) continue;   // varietà: massimo 3 per fonte
    scelte.push(x.n);
    if (scelte.length >= max) break;
  }
  return scelte;
}

// ---------------------------------------------------------------- glossario

function compilaGlossario() {
  const ins = [], sens = [];
  S.mappaG = new Map();
  S.dati.glossario.forEach((v, i) => {
    // si riconoscono i nomi in tutte e due le lingue, qualunque sia quella dell'app
    for (const a of new Set([v.termine, ...v.alias, ...(v.en ? [v.en.termine, ...(v.en.alias || [])] : [])].filter(Boolean))) {
      if (a === a.toLowerCase()) { ins.push(a); S.mappaG.set("i:" + a, i); }
      else { sens.push(a); S.mappaG.set("s:" + a, i); }
    }
  });
  const re = (lista, flag) => {
    const parti = lista.sort((a, b) => b.length - a.length).map((a) => esc(a).replace(/'/g, "['’]"));
    return new RegExp(`${BORDO_PRIMA}(${parti.join("|")})${BORDO_DOPO}`, flag);
  };
  S.reGi = re(ins, "giu");
  S.reGs = re(sens, "gu");
}

function trovaTermini(testo) {
  const trovati = [];
  for (const [re, pre] of [[S.reGi, "i:"], [S.reGs, "s:"]]) {
    re.lastIndex = 0;
    for (const m of testo.matchAll(re)) {
      const chiave = pre + (pre === "i:" ? m[1].toLowerCase().replace(/’/g, "'") : m[1].replace(/’/g, "'"));
      const i = S.mappaG.get(chiave);
      if (i != null) trovati.push({ s: m.index, e: m.index + m[0].length, i });
    }
  }
  trovati.sort((a, b) => a.s - b.s || b.e - a.e);
  const uniche = [];
  let fine = -1;
  for (const t of trovati) if (t.s >= fine) { uniche.push(t); fine = t.e; }
  return uniche;
}

function testoConGlossario(testo, visti, max = 3) {
  const frammento = document.createDocumentFragment();
  let pos = 0;
  for (const t of trovaTermini(testo)) {
    if (visti.has(t.i) || visti.size >= max) continue;
    frammento.append(testo.slice(pos, t.s), h("button", { type: "button", class: "g", "data-g": t.i }, testo.slice(t.s, t.e)));
    pos = t.e;
    visti.add(t.i);
  }
  frammento.append(testo.slice(pos));
  return frammento;
}

// ---------------------------------------------------------------- tempi e numeri

// breve, per le schede: "ora", "12 min", "5 h", "ieri", "3 nov"
function fa(ms) {
  if (!ms) return "";
  const min = (Date.now() - ms) / 6e4;
  if (min < 1) return L("ora", "now");
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 60 * 20) return `${Math.round(min / 60)} h`;
  const g = giorniTra(ms, Date.now());
  if (g === 0) return `${Math.round(min / 60)} h`;
  if (g === 1) return L("ieri", "yesterday");
  return data(ms, { day: "numeric", month: "short" });
}
// in una frase: "adesso", "5 h fa", "ieri", "il 3 nov" (in inglese "just now", "5 h ago", "yesterday", "on 3 Nov")
function quandoFrase(ms) {
  const min = (Date.now() - ms) / 6e4;
  if (min < 1) return L("adesso", "just now");
  const f = fa(ms);
  if (/\d+ (min|h)$/.test(f)) return L(`${f} fa`, `${f} ago`);
  if (giorniTra(ms, Date.now()) === 1) return f;
  return L(`il ${f}`, `on ${f}`);
}
const inizioGiorno = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const giorniTra = (a, b) => Math.round((inizioGiorno(b) - inizioGiorno(a)) / 864e5);

function etichettaGiorno(ms) {
  const g = giorniTra(ms, Date.now());
  if (g <= 0) return L("Oggi", "Today");
  if (g === 1) return L("Ieri", "Yesterday");
  return data(ms, { weekday: "long", day: "numeric", month: "long" });
}

function decimali(m) { return m.prezzo < 10 ? 4 : m.prezzo >= 10000 ? 0 : 2; }
function unita(m) {
  if (m.simbolo.startsWith("^") || m.simbolo === "FTSEMIB.MI" || m.simbolo.endsWith("=X")) return "";
  return m.valuta === "EUR" ? " €" : m.valuta === "USD" ? " $" : "";
}
function pillola(v, etichetta) {
  if (v == null) return h("span", { class: "var pari" }, "—");
  const classe = Math.abs(v) < 0.005 ? "pari" : v > 0 ? "su" : "giu";
  const testo = (v > 0 ? "+" : v < 0 ? MINUS : "") + fmt(Math.abs(v), 2) + "%";
  return h("span", { class: `var ${classe}`, title: etichetta || null }, testo);
}

// ---------------------------------------------------------------- grafici

function serieDa(m, giorni) {
  const ultimo = m.serie[m.serie.length - 1][0];
  const da = ultimo - giorni * 864e5;
  const s = m.serie.filter(([t]) => t >= da);
  return s.length >= 2 ? s : m.serie.slice(-2);
}

const NS = "http://www.w3.org/2000/svg";
function svg(tag, attr) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attr)) el.setAttribute(k, v);
  return el;
}
let idGrafico = 0;

// riferimento: il valore da cui si misura (chiusura di ieri, o inizio periodo). Decide il colore e la riga tratteggiata.
function grafico(serie, { larghezza = 120, altezza = 28, area = false, base = false, classe = "spark", riferimento = null } = {}) {
  const valori = serie.map(([, c]) => c);
  const rif = riferimento ?? valori[0];
  const min = Math.min(...valori, base ? rif : Infinity), max = Math.max(...valori, base ? rif : -Infinity);
  const dy = max - min || 1, pad = 2;
  const x = (i) => (i / (serie.length - 1)) * larghezza;
  const y = (c) => pad + (1 - (c - min) / dy) * (altezza - pad * 2);
  const su = valori[valori.length - 1] >= rif;
  const el = svg("svg", { viewBox: `0 0 ${larghezza} ${altezza}`, preserveAspectRatio: "none", class: `${classe} ${su ? "su-c" : "giu-c"}`, "aria-hidden": "true" });
  const punti = valori.map((c, i) => `${x(i).toFixed(1)},${y(c).toFixed(1)}`).join(" ");
  if (area) {
    const id = `g${++idGrafico}`;
    const grad = svg("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.append(svg("stop", { offset: "0", "stop-color": "currentColor", "stop-opacity": "1" }), svg("stop", { offset: "1", "stop-color": "currentColor", "stop-opacity": "0" }));
    const defs = svg("defs", {});
    defs.append(grad);
    el.append(defs, svg("polygon", { points: `0,${altezza} ${punti} ${larghezza},${altezza}`, fill: `url(#${id})`, class: "area" }));
  }
  if (base) el.append(svg("line", { x1: 0, x2: larghezza, y1: y(rif), y2: y(rif), class: "base", "vector-effect": "non-scaling-stroke" }));
  el.append(svg("polyline", { points: punti, class: "linea", "vector-effect": "non-scaling-stroke" }));
  return el;
}

// ---------------------------------------------------------------- controllo a segmenti con indicatore a molla

function segmenti(opzioni, valore, alCambio, { piccoli = false, etichetta = "" } = {}) {
  const box = h("div", { class: "segmenti" + (piccoli ? " piccoli" : ""), role: "group", "aria-label": etichetta || null });
  const ind = h("div", { class: "indicatore", "aria-hidden": "true" });
  box.append(ind);
  const bottoni = new Map();
  let x = null, w = null, mx = null, mw = null;
  const disegna = () => { ind.style.transform = `translate3d(${x}px,0,0)`; ind.style.width = `${w}px`; };
  const posiziona = (anima) => {
    const b = bottoni.get(valore);
    if (!b || !b.offsetWidth) return;
    const tx = b.offsetLeft, tw = b.offsetWidth;
    if (!anima || x === null) { mx?.ferma(); mw?.ferma(); x = tx; w = tw; disegna(); return; }
    const vx = mx ? mx.velocita : 0, vw = mw ? mw.velocita : 0;
    mx?.ferma(); mw?.ferma();
    mx = molla({ da: x, a: tx, velocita: vx, risposta: 0.32, aggiorna: (v) => { x = v; disegna(); } });
    mw = molla({ da: w, a: tw, velocita: vw, risposta: 0.32, aggiorna: (v) => { w = v; disegna(); } });
  };
  for (const [v, testo] of opzioni) {
    const b = h("button", { type: "button", "aria-pressed": String(v === valore) }, testo);
    b.addEventListener("click", () => {
      if (v === valore) return;
      bottoni.get(valore).setAttribute("aria-pressed", "false");
      valore = v;
      b.setAttribute("aria-pressed", "true");
      posiziona(true);
      alCambio(v);
    });
    bottoni.set(v, b);
    box.append(b);
  }
  new ResizeObserver(() => posiziona(false)).observe(box);
  return box;
}

// ---------------------------------------------------------------- avviso in basso (con Annulla)

const avviso = { el: $("#avviso"), anim: null, timer: 0, p: 0 };
function mostraAvviso(testo, annulla, durata) {
  $("#avviso-testo").textContent = testo;
  const b = $("#avviso-azione");
  b.hidden = !annulla;
  b.onclick = () => { annulla && annulla(); nascondiAvviso(); };
  muoviAvviso(1);
  clearTimeout(avviso.timer);
  avviso.timer = setTimeout(nascondiAvviso, durata || (annulla ? 4500 : 2500));
}
function nascondiAvviso() { clearTimeout(avviso.timer); muoviAvviso(0); }
function muoviAvviso(a) {
  const v = avviso.anim ? avviso.anim.velocita : 0;
  avviso.anim?.ferma();
  avviso.anim = molla({
    da: avviso.p, a, velocita: v, risposta: 0.4, smorzamento: a ? 0.85 : 1,
    aggiorna: (p) => {
      avviso.p = p;
      avviso.el.style.opacity = Math.min(1, Math.max(0, p));
      avviso.el.style.pointerEvents = a && p > 0.5 ? "auto" : "none";   // sparito, non deve rubare i tocchi alla barra sotto
      avviso.el.style.transform = RIDOTTO.matches ? "translate3d(-50%,0,0)" : `translate3d(-50%,${(1 - p) * 150}%,0)`;
    },
  });
}

// ---------------------------------------------------------------- foglio dal basso

const F = { el: $("#foglio"), velo: $("#velo"), y: 0, h: 1, anim: null, aperto: false, prima: null, allaChiusura: null };

function impostaY(y) {
  F.y = y;
  const p = Math.max(0, Math.min(1, 1 - y / F.h));
  F.velo.style.opacity = p;
  if (RIDOTTO.matches) { F.el.style.transform = "none"; F.el.style.opacity = p; }   // con meno movimento: dissolvenza
  else F.el.style.transform = `translate3d(0,${y}px,0)`;
}
function animaFoglio(a, velocita = 0, smorzamento = 1) {
  F.anim?.ferma();
  F.anim = molla({
    da: F.y, a, velocita, smorzamento, risposta: 0.38, aggiorna: impostaY,
    fine: () => { if (!F.aperto) chiudiDavvero(); },
  });
}
function apriFoglio(titolo, contenuto, allaChiusura) {
  F.ritorno = null;   // lo rimette apriNotizia, dopo
  $("#foglio-titolo").textContent = titolo;
  $("#foglio-contenuto").replaceChildren(contenuto);
  $("#foglio-contenuto").scrollTop = 0;
  if (allaChiusura) F.allaChiusura = allaChiusura;
  if (F.el.hidden) {                 // era chiuso del tutto: entra dal basso
    F.prima = document.activeElement;
    F.velo.hidden = false;
    F.el.hidden = false;
    document.body.style.overflow = "hidden";
    F.h = F.el.offsetHeight;
    impostaY(F.h);
  }                                  // se si stava chiudendo, riparte da dov'è
  F.aperto = true;
  F.h = F.el.offsetHeight;
  animaFoglio(0);
  F.el.focus({ preventScroll: true });
}
function chiudiFoglio(velocita = 0) {
  if (!F.aperto) return;
  F.aperto = false;
  F.h = F.el.offsetHeight;
  animaFoglio(F.h, velocita);
}
function chiudiDavvero() {
  F.el.hidden = true;
  F.velo.hidden = true;
  F.ritorno = null;
  document.body.style.overflow = "";
  const poi = F.allaChiusura;
  F.allaChiusura = null;
  poi && poi();
  F.prima && F.prima.focus && F.prima.focus({ preventScroll: true });
}

// trascinare il foglio dalla presa o dal titolo: segue il dito, e al rilascio decide con la velocità
(function () {
  let inizio = null, storia = [];
  const zone = [F.el.querySelector(".presa"), F.el.querySelector(".testa-foglio")];
  for (const z of zone) {
    z.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      F.anim?.ferma();                              // lo riprendo da dov'è, anche a metà corsa
      F.h = F.el.offsetHeight;
      inizio = { y: e.clientY, base: F.y, id: e.pointerId };
      storia = [[e.timeStamp, e.clientY]];
      z.setPointerCapture(e.pointerId);
    });
    z.addEventListener("pointermove", (e) => {
      if (!inizio || e.pointerId !== inizio.id) return;
      let y = inizio.base + (e.clientY - inizio.y);
      if (y < 0) y = -elastico(-y, F.h);            // verso l'alto resiste
      impostaY(y);
      storia.push([e.timeStamp, e.clientY]);
      if (storia.length > 8) storia.shift();
    });
    const fine = (e) => {
      if (!inizio || e.pointerId !== inizio.id) return;
      inizio = null;
      const v = velocitaDa(storia, e.timeStamp);
      if (F.y + proietta(v) > F.h * 0.4) chiudiFoglio(v);
      else animaFoglio(0, v, 0.85);
    };
    z.addEventListener("pointerup", fine);
    z.addEventListener("pointercancel", fine);
  }
  F.velo.addEventListener("click", () => chiudiFoglio());
  $("#chiudi-foglio").addEventListener("click", () => chiudiFoglio());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && F.aperto) chiudiFoglio(); });
})();

// ---------------------------------------------------------------- schede notizia

// testi che tornano in più punti
const T = {
  salva: () => L("Salva", "Save"),
  togli: () => L("Togli", "Remove"),
  nascondi: () => L("Nascondi", "Hide"),
  salvaPerDopo: () => L("Salva per dopo", "Save for later"),
  togliSalvata: () => L("Togli dalle salvate", "Remove from saved"),
  accessoFatto: () => L("Accesso fatto: le tue scelte ti seguono", "Signed in: your choices follow you"),
};
const nomeLingua = (l) => ({ it: L("In italiano", "In Italian"), en: L("In inglese", "In English") }[l] || l);
const daLingua = (l) => ({ it: L("dall'italiano", "from Italian"), en: L("dall'inglese", "from English") }[l] || l);

function iniziale(fonte) {
  const parole = fonte.split(/[\s·]+/).filter((p) => p && !/^(il|la|lo|the|i|le)$/i.test(p));
  return (parole[0] || fonte)[0].toUpperCase();
}

// Il logo della fonte (file in sito/loghi, scaricati da loghi.py); senza logo, o se non si carica, l'iniziale
let loghi = { dati: null, mappa: new Map() };
function marchio(n) {
  if (loghi.dati !== S.dati) loghi = { dati: S.dati, mappa: new Map((S.dati?.fonti || []).filter((f) => f.logo).map((f) => [f.nome, f.logo])) };
  const lettera = () => h("span", { class: "mono", style: `--c:${COLORE_SEZIONE[n.sezione] || "var(--testo-3)"}`, "aria-hidden": "true" }, iniziale(n.fonte));
  const src = loghi.mappa.get(n.fonte);
  if (!src) return lettera();
  const img = h("img", { src, alt: "", width: "20", height: "20", loading: "lazy", decoding: "async" });
  const box = h("span", { class: "mono logo", "aria-hidden": "true" }, img);
  img.addEventListener("error", () => box.replaceWith(lettera()), { once: true });
  return box;
}

function scheda(n, { temi = [], compatta = false, inSalvate = false } = {}) {
  const art = h("article", { class: "card" + (letta(n.id) ? " letta" : ""), "data-id": n.id });
  const visti = new Set();
  // toccare la scheda apre la sottopagina nell'app; col Ctrl (o la rotella) il browser apre l'articolo come prima
  const titoloLink = h("a", { href: n.link, target: "_blank", rel: "noopener noreferrer" }, n.titolo);
  titoloLink.addEventListener("click", (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) { segnaLetta(n, art); return; }
    e.preventDefault();
    apriNotizia(n, art);
  });

  const testa = h("div", { class: "card-testa" },
    marchio(n),
    h("span", { class: "fonte" }, n.fonte),
    n.data ? h("span", { "aria-hidden": "true" }, "·") : null,
    n.data ? h("time", { datetime: new Date(n.data).toISOString() }, fa(n.data)) : null,
    // la lingua si scrive solo quando è diversa da quella dell'app
    n.lingua !== lingua() ? h("span", { class: "etichetta", title: nomeLingua(n.lingua) }, n.lingua.toUpperCase()) : null,
    salvata(n.id) ? h("span", { class: "segno", title: L("Salvata", "Saved") }, icona("segnalibroPieno")) : null,
  );
  // sul telefono il segnalibro resta sempre in vista: scorrere è la scorciatoia, non l'unico modo
  const bTocco = h("button", { type: "button", class: "salva-tocco", "aria-pressed": String(salvata(n.id)), "aria-label": salvata(n.id) ? T.togliSalvata() : T.salvaPerDopo() }, icona(salvata(n.id) ? "segnalibroPieno" : "segnalibro"));
  bTocco.addEventListener("click", () => (inSalvate ? togliSalvata(n, art) : alternaSalvata(n, art)));
  testa.append(bTocco);
  const testi = h("div", { class: "card-testi" }, h("h3", {}, titoloLink));
  if (!compatta && n.sommario) testi.append(h("p", { class: "sommario" }, testoConGlossario(n.sommario, visti)));
  const riga = h("div", { class: "card-riga" }, testi);
  if (!compatta && n.immagine) {
    const img = h("img", { class: "thumb", src: n.immagine, alt: "", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" });
    img.addEventListener("error", () => img.remove());
    // una miniatura (sotto i 400 px) allargata verrebbe sgranata: resta a lato anche con le foto grandi
    img.addEventListener("load", () => { if (img.naturalWidth < 400) riga.classList.add("foto-piccola"); }, { once: true });
    riga.append(img);
  }
  // parole del glossario che stanno solo nel titolo: diventano etichette sotto
  const chip = [];
  for (const t of trovaTermini(n.titolo)) {
    if (visti.has(t.i) || chip.length >= 2) continue;
    visti.add(t.i);
    chip.push(h("button", { type: "button", class: "parola premibile", "data-g": t.i }, icona("libro"), loc(S.dati.glossario[t.i]).termine));
  }
  const etichette = [...temi.slice(0, 2).map((t) => h("span", { class: "tema" }, t)), ...chip];
  // le altre testate sullo stesso fatto: un link ciascuna, la lingua solo se è diversa da quella dell'app
  const anche = !compatta && n.altre?.length
    ? h("div", { class: "anche" }, L("Anche su ", "Also on "), n.altre.map((a, i) => [i ? ", " : "",
      h("a", { href: a.link, target: "_blank", rel: "noopener noreferrer", onclick: () => segnaLetta(n, art) }, a.fonte),
      a.lingua !== lingua() ? h("span", { class: "etichetta" }, a.lingua.toUpperCase()) : null]))
    : null;
  const pannello = h("div", { class: "pannello" }, testa, riga, etichette.length ? h("div", { class: "temi" }, etichette) : null, anche);

  const destra = inSalvate ? null : "salva";
  const dietro = h("div", { class: "dietro", "aria-hidden": "true" },
    h("span", { class: "az-salva" }, icona("segnalibro"), salvata(n.id) ? T.togli() : T.salva()),
    h("span", { class: "az-nascondi" }, inSalvate ? T.togli() : T.nascondi(), icona(inSalvate ? "cestino" : "occhio")));

  const bSalva = h("button", { type: "button", "aria-label": T.salvaPerDopo(), title: T.salvaPerDopo(), "aria-pressed": String(salvata(n.id)) }, icona(salvata(n.id) ? "segnalibroPieno" : "segnalibro"));
  bSalva.addEventListener("click", () => alternaSalvata(n, art));
  const bVia = h("button", { type: "button", "aria-label": inSalvate ? T.togliSalvata() : T.nascondi(), title: inSalvate ? T.togliSalvata() : T.nascondi() }, icona(inSalvate ? "cestino" : "occhio"));
  bVia.addEventListener("click", () => (inSalvate ? togliSalvata(n, art) : nascondi(n, art)));
  const bottoni = h("div", { class: "bottoni-card" }, inSalvate ? null : bSalva, bVia);

  art.append(dietro, pannello, bottoni);
  abilitaScorrimento(art, pannello, {
    destra: destra ? () => alternaSalvata(n, art) : null,
    sinistra: () => (inSalvate ? togliSalvata(n, art) : nascondi(n, art)),
  });
  return art;
}

// ---------------------------------------------------------------- la notizia, nel foglio
// Toccando una scheda sale il foglio dal basso (lo stesso del glossario e di Il tuo Radar). Dentro, aperto c'è solo
// "In breve" (il testo della testata); Parole da sapere, Perché la vedi e Ne parlano anche sono tendine chiuse, con
// un'anteprima di cosa c'è dentro. In fondo: l'articolo intero sul sito del giornale, Salva e Condividi.
// (Il 06/11/2026 è stata provata anche una pagina intera che entra da destra: a Mattia piace di più il foglio.)

// una tendina: chiusa mostra il titolo e un'anteprima, toccata si apre (e si richiude)
function tendina(titolo, anteprima, ...contenuto) {
  const id = "tendina-" + Math.random().toString(36).slice(2, 8);
  const testa = h("button", { type: "button", class: "tendina-testa premibile", "aria-expanded": "false", "aria-controls": id },
    h("span", { class: "testi-parola" }, h("span", { class: "t" }, titolo), anteprima ? h("span", { class: "d" }, anteprima) : null),
    icona("freccia", "chevron"));
  const corpo = h("div", { class: "tendina-corpo", id }, h("div", {}, ...contenuto));
  corpo.inert = true;
  const box = h("div", { class: "tendina" }, testa, corpo);
  testa.addEventListener("click", () => {
    const apri = testa.getAttribute("aria-expanded") !== "true";
    testa.setAttribute("aria-expanded", String(apri));
    box.classList.toggle("aperta", apri);
    corpo.inert = !apri;
  });
  return box;
}

// art = la scheda da cui si arriva (per segnarla letta o salvata), o null
function apriNotizia(n, art) {
  segnaLetta(n, art);
  const box = h("div", { class: "notizia" });
  const zonaTitolo = h("h3", { class: "notizia-titolo" });   // lo riempie disegnaTesto: originale o tradotto
  if (n.immagine) {
    const img = h("img", { class: "notizia-foto", src: n.immagine, alt: "", decoding: "async", referrerpolicy: "no-referrer" });
    img.addEventListener("error", () => img.remove());
    box.append(img);
  }
  box.append(
    h("div", { class: "card-testa" },
      marchio(n),
      h("span", { class: "fonte" }, n.fonte),
      n.data ? [h("span", { "aria-hidden": "true" }, "·"), h("time", { datetime: new Date(n.data).toISOString() }, quandoFrase(n.data))] : null,
      n.lingua !== lingua() ? h("span", { class: "etichetta", title: nomeLingua(n.lingua) }, n.lingua.toUpperCase()) : null),
    zonaTitolo);

  // il testo intero che manda la testata (fino a ~700 caratteri), se c'è; le salvate lo ritrovano tra le notizie di oggi
  const oggi = S.dati?.notizie?.find((x) => x.id === n.id);
  const testo = n.testo || oggi?.testo || n.sommario;
  // la traduzione automatica (raccogli.py, Azure): titolo e testo, con l'originale a un tocco. Nella lingua dell'app
  // si mostra subito; in un'altra (oggi: l'italiano, con l'app in inglese) resta a un tocco, "Show in Italian"
  const tradotte = [n.traduzione, oggi?.traduzione].filter((t) => t && t.lingua && t.lingua !== n.lingua);
  const trad = tradotte.find((t) => t.lingua === lingua()) || tradotte[0] || null;
  const subito = !!trad && trad.lingua === lingua();
  let originale = !subito;
  const zonaTesto = h("div", {});
  const inLingua = (l) => ({ it: L("Mostra in italiano", "Show in Italian"), en: L("Mostra in inglese", "Show in English") }[l] || L("Mostra la traduzione", "Show translation"));
  const versoLingua = (l) => ({ it: L("in italiano", "into Italian"), en: L("in inglese", "into English") }[l] || "");
  function disegnaTesto() {
    const usa = trad && !originale;
    zonaTitolo.textContent = usa ? trad.titolo : n.titolo;
    zonaTitolo.lang = usa ? trad.lingua : n.lingua;
    const t = usa ? trad.testo || testo : testo;
    const parti = [t
      ? h("p", { class: "notizia-testo", lang: usa && trad.testo ? trad.lingua : n.lingua }, testoConGlossario(t, new Set(), 6))
      : h("p", { class: "notizia-testo vuoto" }, L(`${n.fonte} non manda un riassunto: la notizia intera è sul suo sito.`, `${n.fonte} doesn't send a summary: the full story is on its website.`))];
    if (trad) {
      const cambia = h("button", { type: "button", class: "link-piccolo premibile" }, usa ? L("Mostra l'originale", "Show original") : subito ? L("Mostra la traduzione", "Show translation") : inLingua(trad.lingua));
      cambia.addEventListener("click", () => { originale = !originale; disegnaTesto(); });
      const nota = usa
        ? (subito ? L(`Tradotto automaticamente ${daLingua(n.lingua)}`, `Machine-translated ${daLingua(n.lingua)}`) : L(`Tradotto automaticamente ${versoLingua(trad.lingua)}`, `Machine-translated ${versoLingua(trad.lingua)}`))
        : (subito ? L(`Testo originale, ${nomeLingua(n.lingua).toLowerCase()}`, `Original text, ${nomeLingua(n.lingua).toLowerCase()}`) : null);
      parti.push(h("p", { class: "nota-traduzione" }, ...(nota ? [nota, " · ", cambia] : [cambia])));
    }
    zonaTesto.replaceChildren(...parti);
  }
  disegnaTesto();
  box.append(h("div", { class: "gruppo-titolo" }, L("In breve", "In short")), zonaTesto);

  const tendine = [];
  // le parole difficili di titolo e testo (anche tradotti), ciascuna con la prima frase della spiegazione del glossario
  const parole = [...new Set(trovaTermini(`${n.titolo} ${testo || ""} ${trad?.titolo || ""} ${trad?.testo || ""}`).map((t) => t.i))].slice(0, 4).map((i) => ({ i, v: loc(S.dati.glossario[i]) }));
  if (parole.length) {
    tendine.push(tendina(L("Parole da sapere", "Words to know"), elenco(parole.map((p) => p.v.termine)),
      parole.map(({ i, v }) => h("button", { type: "button", class: "riga-parola premibile", "data-g": i },
        h("span", { class: "testi-parola" }, h("span", { class: "t" }, v.termine), h("span", { class: "d" }, v.testo.split(/(?<=[.!?])\s/)[0])),
        icona("freccia", "freccia")))));
  }
  const temi = valuta(n).temi.slice(0, 4);
  if (temi.length) {
    const cambia = h("button", { type: "button", class: "link-piccolo premibile" }, L("Cambia i tuoi temi", "Change your topics"));
    cambia.addEventListener("click", () => foglioProfilo("temi"));
    tendine.push(tendina(L("Perché la vedi", "Why you're seeing it"), temi.join(" · "),   // i nomi dei temi hanno già le "e"
      h("div", { class: "tendina-pad" },
        h("p", { class: "tendina-testo" }, L("Parla di temi che segui: per questo è più in alto in Per te.", "It's about topics you follow: that's why it ranks higher in For you.")),
        h("div", { class: "temi" }, temi.map((t) => h("span", { class: "tema" }, t))),
        cambia)));
  }
  if (n.altre?.length) {
    const nomi = [...new Set(n.altre.map((a) => a.fonte.split(" · ")[0]))];
    const anteprima = nomi.length > 2 ? L(`${nomi.slice(0, 2).join(", ")} e altre ${nomi.length - 2}`, `${nomi.slice(0, 2).join(", ")} and ${nomi.length - 2} more`) : elenco(nomi);
    tendine.push(tendina(L("Ne parlano anche", "Also covered by"), anteprima,
      n.altre.map((a) => h("a", { class: "riga-altra premibile", href: a.link, target: "_blank", rel: "noopener noreferrer" },
        marchio(a),
        h("span", { class: "testi-parola" }, h("span", { class: "t" }, a.fonte), h("span", { class: "d" }, a.titolo)),
        icona("esterno", "freccia")))));
  }
  if (tendine.length) box.append(h("div", { class: "tendine" }, tendine));

  // in fondo: l'articolo intero, poi salva e condividi
  const leggi = h("a", { class: "bottone-primario premibile", href: n.link, target: "_blank", rel: "noopener noreferrer" },
    L(`Leggi su ${n.fonte}`, `Read on ${n.fonte}`), icona("esterno"));
  const etichettaSalva = () => [icona(salvata(n.id) ? "segnalibroPieno" : "segnalibro"), salvata(n.id) ? L("Salvata", "Saved") : T.salva()];
  const bSalva = h("button", { type: "button", class: "bottone-secondario premibile", "aria-pressed": String(salvata(n.id)) }, etichettaSalva());
  bSalva.addEventListener("click", () => {
    alternaSalvata(n, art);
    bSalva.setAttribute("aria-pressed", String(salvata(n.id)));
    bSalva.replaceChildren(...etichettaSalva());
  });
  const bCondividi = h("button", { type: "button", class: "bottone-secondario premibile" }, icona("condividi"), L("Condividi", "Share"));
  bCondividi.addEventListener("click", async () => {
    if (navigator.share) { try { await navigator.share({ title: n.titolo, url: n.link }); } catch { /* chiuso senza condividere */ } return; }
    try { await navigator.clipboard.writeText(n.link); mostraAvviso(L("Link copiato", "Link copied")); } catch { mostraAvviso(L("Non riesco a copiare il link", "Couldn't copy the link")); }
  });
  box.append(h("div", { class: "notizia-azioni" }, leggi, h("div", { class: "riga-due" }, bSalva, bCondividi)),
    h("p", { class: "nota" }, L(`Il testo è di ${n.fonte}: Radar non riscrive le notizie.`, `The text is by ${n.fonte}: Radar doesn't rewrite the news.`)));

  apriFoglio(SEZIONI()[n.sezione] || L("Notizia", "Story"), box);
  F.ritorno = () => apriNotizia(n, art);   // dal glossario si torna qui
}

// scorrere una scheda: verso destra salva, verso sinistra nasconde.
// Segue il dito 1:1, al rilascio usa la velocità per capire dove "andrebbe", e si può riprendere a metà.
function abilitaScorrimento(card, pannello, { destra, sinistra }) {
  let x = 0, anim = null, inizio = null, direzione = null, storia = [], trascinata = false, oltre = false;
  const imposta = (v) => {
    x = v;
    pannello.style.transform = v ? `translate3d(${v}px,0,0)` : "";
    const W = card.offsetWidth;
    card.dataset.lato = v > 0.5 ? "salva" : v < -0.5 ? "nascondi" : "";
    card.style.setProperty("--p", Math.min(1, Math.abs(v) / (W * 0.3)).toFixed(3));
    const ora = v > W * 0.25 || v < -W * 0.3;
    if (ora !== oltre) { oltre = ora; card.classList.toggle("oltre", ora); if (ora && navigator.vibrate) navigator.vibrate(8); }
  };
  card.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" || e.target.closest(".g, .parola, .bottoni-card, .salva-tocco")) return;   // col mouse ci sono i bottoni
    anim?.ferma();
    inizio = { x: e.clientX, y: e.clientY, base: x, id: e.pointerId };
    direzione = null;
    trascinata = false;
    storia = [[e.timeStamp, e.clientX]];
  });
  card.addEventListener("pointermove", (e) => {
    if (!inizio || e.pointerId !== inizio.id) return;
    let dx = e.clientX - inizio.x;
    const dy = e.clientY - inizio.y;
    if (!direzione) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        direzione = "o";
        inizio.x = e.clientX;   // superata la soglia si parte da qui: niente salto di 10 px
        dx = 0;
        card.setPointerCapture(e.pointerId);
      } else if (Math.abs(dy) > 10) { inizio = null; return; }
      else return;
    }
    trascinata = true;
    const W = card.offsetWidth;
    let v = inizio.base + dx;
    if (v > 0 && !destra) v = elastico(v, W);
    else if (v > W * 0.45) v = W * 0.45 + elastico(v - W * 0.45, W);
    imposta(v);
    storia.push([e.timeStamp, e.clientX]);
    if (storia.length > 8) storia.shift();
  });
  const fine = (e) => {
    if (!inizio || e.pointerId !== inizio.id) return;
    inizio = null;
    if (direzione !== "o") return;
    const W = card.offsetWidth;
    const v = velocitaDa(storia, e.timeStamp);
    const arrivo = x + proietta(v);
    if (arrivo < -W * 0.3 && v <= 200) {
      anim = molla({ da: x, a: -W * 1.08, velocita: Math.min(v, -800), risposta: 0.3, aggiorna: imposta, fine: () => sinistra() });
    } else if (destra && arrivo > W * 0.25 && v >= -200) {
      destra();
      anim = molla({ da: x, a: 0, velocita: v, smorzamento: 0.8, risposta: 0.4, aggiorna: imposta });   // un lancio: un filo di rimbalzo
    } else {
      anim = molla({ da: x, a: 0, velocita: v, risposta: 0.32, aggiorna: imposta });
    }
  };
  card.addEventListener("pointerup", fine);
  card.addEventListener("pointercancel", fine);
  card.addEventListener("click", (e) => { if (trascinata) { e.preventDefault(); e.stopPropagation(); trascinata = false; } }, true);
  // la prima volta la scheda si sposta un po' da sola e torna: fa vedere che sotto c'è "Salva"
  card.sbircia = () => {
    if (RIDOTTO.matches || inizio || !destra) return;
    anim?.ferma();
    anim = molla({ da: x, a: card.offsetWidth * 0.18, risposta: 0.45, aggiorna: imposta, fine: () => {
      const t = setTimeout(() => { anim = molla({ da: x, a: 0, risposta: 0.45, aggiorna: imposta }); }, 450);
      anim = { ferma: () => clearTimeout(t) };
    } });
  };
}

// una volta sola, sul telefono: dove si salva e dove si nasconde
const MOUSE = matchMedia("(hover: hover) and (pointer: fine)");
function suggerisciScorrimento() {
  if (MOUSE.matches || mem.get("suggerito", false) || !["per-te", "notizie"].includes(S.vista)) return;
  clearTimeout(suggerisciScorrimento.timer);
  suggerisciScorrimento.timer = setTimeout(() => {
    if ($(".benvenuto") || F.aperto || mem.get("suggerito", false)) return;
    const card = [...document.querySelectorAll("#vista .card")].find((c) => { const r = c.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight - 80; });
    if (!card) return;
    mem.set("suggerito", true);
    card.sbircia?.();
    mostraAvviso(L("Scorri: a destra salvi, a sinistra nascondi", "Swipe right to save, left to hide"), null, 5000);
  }, 1200);
}

function collassa(el, poi) {
  if (RIDOTTO.matches || !el.isConnected) { el.remove(); poi && poi(); return; }
  const alt = el.offsetHeight;
  const gap = parseFloat(getComputedStyle(el.parentElement).rowGap) || 0;
  el.style.overflow = "hidden";
  el.style.pointerEvents = "none";
  molla({
    da: 1, a: 0, risposta: 0.32,
    aggiorna: (p) => { el.style.height = `${Math.max(0, alt * p)}px`; el.style.marginBottom = `${-(1 - p) * gap}px`; el.style.opacity = p; },
    fine: () => { el.remove(); poi && poi(); },
  });
}

// ---------------------------------------------------------------- azioni

// gruppi: quali parti sono cambiate ("salvate", "lette", "nascoste")
function salvaStato(...gruppi) {
  mem.set("salvate", S.salvate);
  mem.set("nascoste", [...S.nascoste].slice(-1500));
  mem.set("lette", S.lette);
  aggiornaPallino();
  if (gruppi.length) segnaTempo(...gruppi);
}
function segnaLetta(n, art) {
  S.lette = [leggero(n), ...S.lette.filter((x) => x.id !== n.id)].slice(0, 300);
  salvaStato("lette");
  art && art.classList.add("letta");
}
function alternaSalvata(n, art) {
  const era = salvata(n.id);
  if (era) S.salvate = S.salvate.filter((x) => x.id !== n.id);
  else S.salvate = [perSalvate(n), ...S.salvate];
  salvaStato("salvate");
  if (art) aggiornaSegno(art, !era);
  mostraAvviso(era ? L("Tolta dalle salvate", "Removed from saved") : L("Salvata per dopo", "Saved for later"), () => { alternaSalvataSilenziosa(n, era); disegna(); });
}
// aggiorna la scheda sul posto, così la molla che la riporta al centro non si interrompe
function aggiornaSegno(art, ora) {
  const testa = art.querySelector(".card-testa");
  testa.querySelector(".segno")?.remove();
  if (ora) testa.querySelector(".salva-tocco").before(h("span", { class: "segno", title: L("Salvata", "Saved") }, icona("segnalibroPieno")));
  const az = art.querySelector(".az-salva");
  if (az) az.replaceChildren(icona("segnalibro"), ora ? T.togli() : T.salva());
  for (const b of art.querySelectorAll(".bottoni-card button[aria-pressed], .salva-tocco")) {
    b.setAttribute("aria-pressed", String(ora));
    b.replaceChildren(icona(ora ? "segnalibroPieno" : "segnalibro"));
  }
  art.querySelector(".salva-tocco")?.setAttribute("aria-label", ora ? T.togliSalvata() : T.salvaPerDopo());
}
function alternaSalvataSilenziosa(n, eraSalvata) {
  if (eraSalvata) S.salvate = [perSalvate(n), ...S.salvate.filter((x) => x.id !== n.id)];
  else S.salvate = S.salvate.filter((x) => x.id !== n.id);
  salvaStato("salvate");
}
function nascondi(n, art) {
  S.nascoste.add(n.id);
  salvaStato("nascoste");
  collassa(art);
  mostraAvviso(L("Notizia nascosta", "Story hidden"), () => { S.nascoste.delete(n.id); salvaStato("nascoste"); disegna(); });
}
function togliSalvata(n, art) {
  const prima = S.salvate;
  S.salvate = S.salvate.filter((x) => x.id !== n.id);
  salvaStato("salvate");
  collassa(art, () => { if (!S.salvate.length) disegna(); });
  mostraAvviso(L("Tolta dalle salvate", "Removed from saved"), () => { S.salvate = prima; salvaStato("salvate"); disegna(); });
}
function aggiornaPallino() {
  const tab = $('.tab[data-vista="salvate"]');
  let p = tab.querySelector(".pallino");
  if (!S.salvate.length) { p && p.remove(); return; }
  if (!p) { p = h("span", { class: "pallino" }); tab.append(p); }
  p.textContent = S.salvate.length;
  p.setAttribute("aria-label", `${S.salvate.length} salvate`);
}

// tocchi su parole del glossario, ovunque nella pagina o nel foglio
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-g]");
  if (!g) return;
  e.preventDefault();
  e.stopPropagation();
  mostraTermine(Number(g.dataset.g));
}, true);

// ---------------------------------------------------------------- storie
// In cima a Per te, un cerchio per ogni sezione accesa, come le storie di Instagram. Dentro, una schermata per
// notizia: le più importanti delle ultime 24 ore di quella sezione (vicine ai tuoi temi, raccontate da più testate,
// recenti), al massimo 7 e 2 per testata. Avanzano da sole; un tocco a destra o a sinistra va avanti o indietro,
// tenere premuto ferma, scorrere in giù chiude, scorrere di lato cambia sezione. «Apri la notizia» apre il foglio
// di sempre, e intanto le storie restano ferme lì sotto.
// Le storie viste restano su questo dispositivo (radar.storieViste) e non segnano la notizia come letta: una
// schermata di 6 secondi non è una lettura. La segna letta solo «Apri la notizia».

const FONDO_SEZIONE = { finanza: ["#34c759", "#145a27"], economia: ["#ff9f0a", "#a33a00"], ai: ["#8e8cff", "#3a2fb0"], tech: ["#38b6ff", "#004e7a"], scienza: ["#ff5b84", "#8a0a2e"] };
const SIMBOLO_SEZIONE = { finanza: "sFinanza", economia: "sEconomia", ai: "sAi", tech: "sTech", scienza: "sScienza" };
const fondoSezione = (s) => FONDO_SEZIONE[s] || ["#8e8e93", "#3a3a3c"];
const STORIE_MAX = 7;

function storieDi(sezione) {
  const tutte = visibili().filter((n) => n.sezione === sezione && n.data);
  let recenti = tutte.filter((n) => oreDa(n) <= 24);
  if (recenti.length < 3) recenti = tutte.filter((n) => oreDa(n) <= 48);   // giornata magra: anche ieri
  const ordinate = recenti
    .map((n) => ({ n, r: (1 + valuta(n).p + 0.75 * (n.altre?.length || 0)) * Math.pow(0.5, Math.max(0, oreDa(n)) / 12) }))
    .sort((a, b) => b.r - a.r);
  const perFonte = {}, scelte = [];
  for (const { n } of ordinate) {
    if ((perFonte[n.fonte] = (perFonte[n.fonte] || 0) + 1) > 2) continue;
    scelte.push(n);
    if (scelte.length >= STORIE_MAX) break;
  }
  return scelte;
}
// le sezioni con almeno una storia; prima quelle con qualcosa di nuovo, poi le già viste (nell'ordine di sempre)
function gruppiStorie() {
  const nuove = (g) => g.notizie.some((n) => !S.storieViste.has(n.id));
  const gruppi = [...sezioniScelte()].filter((s) => SEZIONI()[s]).map((s) => ({ sezione: s, notizie: storieDi(s) })).filter((g) => g.notizie.length);
  for (const g of gruppi) g.nuove = nuove(g);
  return gruppi.sort((a, b) => b.nuove - a.nuove);
}

function strisciaStorie() {
  const gruppi = gruppiStorie();
  if (!gruppi.length) return null;
  const box = h("div", { class: "storie", role: "group", "aria-label": L("Storie", "Stories") });
  gruppi.forEach((g, i) => {
    const [c1, c2] = fondoSezione(g.sezione);
    const b = h("button", { type: "button", class: "storia-cerchio premibile" + (g.nuove ? " nuova" : ""), style: `--c1:${c1};--c2:${c2}` },
      h("span", { class: "anello", "aria-hidden": "true" }, h("span", { class: "disco" }, icona(SIMBOLO_SEZIONE[g.sezione] || "radar"))),
      h("span", { class: "nome" }, SEZIONI()[g.sezione]));
    b.setAttribute("aria-label", `${SEZIONI()[g.sezione]}: ${g.notizie.length} ${L("notizie", "stories")}${g.nuove ? L(", nuove", ", new") : ""}`);
    b.addEventListener("click", () => apriStorie(gruppi, i));
    box.append(b);
  });
  return box;
}
function rinfrescaStrisciaStorie() {
  if (S.vista !== "per-te") return;
  const vecchia = $("#vista .storie");
  if (!vecchia) return;
  const nuova = strisciaStorie();
  nuova ? vecchia.replaceWith(nuova) : vecchia.remove();
}
function segnaVistaStoria(id) {
  if (S.storieViste.has(id)) return;
  S.storieViste.add(id);
  mem.set("storieViste", [...S.storieViste].slice(-600));
}

function apriStorie(gruppi, g0) {
  const V = { g: g0, i: 0, t: 0, durata: 6000, ultimo: 0, raf: 0, tenuta: false, chiusa: false, y: 0, anim: null, animX: null, x: 0 };
  const prima = document.activeElement;
  const primaNonVista = (g) => Math.max(0, gruppi[g].notizie.findIndex((n) => !S.storieViste.has(n.id)));
  V.i = primaNonVista(g0);

  const fondo = h("div", { class: "storia-fondo", "aria-hidden": "true" });
  const barre = h("div", { class: "storia-barre", "aria-hidden": "true" });
  const testa = h("div", { class: "storia-testa" });
  const corpo = h("div", { class: "storia-corpo" });
  const azioni = h("div", { class: "storia-azioni" });
  const zonaSx = h("button", { type: "button", class: "storia-zona sx", "aria-label": L("Notizia precedente", "Previous story") });
  const zonaDx = h("button", { type: "button", class: "storia-zona dx", "aria-label": L("Notizia successiva", "Next story") });
  const scena = h("div", { class: "storia" }, fondo, barre, testa, corpo, zonaSx, zonaDx, azioni);
  const el = h("div", { class: "storie-schermo", role: "dialog", "aria-modal": "true", "aria-label": L("Storie", "Stories"), tabindex: "-1" }, scena);
  document.body.append(el);
  document.body.style.overflow = "hidden";
  el.focus({ preventScroll: true });

  // in pausa mentre si tiene premuto, mentre sopra c'è il foglio (la notizia aperta, il glossario…) o la pagina non si vede
  const inPausa = () => V.tenuta || !F.el.hidden || document.hidden;

  function mostra(entrata) {
    const g = gruppi[V.g], n = g.notizie[V.i];
    const sez = g.sezione, [c1, c2] = fondoSezione(sez);
    segnaVistaStoria(n.id);
    scena.style.setProperty("--c1", c1);
    scena.style.setProperty("--c2", c2);

    // la traduzione si mostra solo se è nella lingua dell'app (come nella notizia aperta)
    const trad = n.traduzione && n.traduzione.lingua === lingua() && n.traduzione.lingua !== n.lingua ? n.traduzione : null;
    const titolo = trad?.titolo || n.titolo;
    let breve = (trad?.testo || n.sommario || n.testo || "").trim();
    if (breve.length > 280) breve = breve.slice(0, 280).replace(/\s+\S*$/, "") + "…";
    V.t = 0;
    V.durata = 5000 + Math.min(5000, (titolo.length + breve.length) * 15);

    // fondo: la foto sfocata dietro e nitida nel riquadro; senza foto, la sfumatura della sezione col suo simbolo
    const senzaFoto = () => { scena.classList.add("senza-foto"); fondo.replaceChildren(icona(SIMBOLO_SEZIONE[sez] || "radar", "storia-simbolo")); };
    scena.classList.remove("senza-foto");
    if (n.immagine) {
      const dietro = h("img", { class: "sfocata", src: n.immagine, alt: "", decoding: "async", referrerpolicy: "no-referrer" });
      const davanti = h("img", { class: "nitida", src: n.immagine, alt: "", decoding: "async", referrerpolicy: "no-referrer" });
      davanti.addEventListener("error", senzaFoto, { once: true });
      fondo.replaceChildren(dietro, h("div", { class: "riquadro" }, davanti));
    } else senzaFoto();

    barre.replaceChildren(...g.notizie.map((_, k) => h("span", { class: "barra-storia" }, h("span", { class: "pieno", style: `transform:scaleX(${k < V.i ? 1 : 0})` }))));
    V.pieno = barre.children[V.i].firstChild;

    const bChiudi = h("button", { type: "button", class: "storia-chiudi premibile", "aria-label": L("Chiudi le storie", "Close stories") }, icona("chiudi"));
    bChiudi.addEventListener("click", () => chiudi());
    testa.replaceChildren(
      h("span", { class: "disco", "aria-hidden": "true" }, icona(SIMBOLO_SEZIONE[sez] || "radar")),
      h("span", { class: "sezione-nome" }, SEZIONI()[sez]),
      h("span", { class: "conta" }, `${V.i + 1}/${g.notizie.length}`),
      bChiudi);

    const temi = valuta(n).temi.slice(0, 2);
    const altre = [...new Set((n.altre || []).map((a) => a.fonte.split(" · ")[0]))];
    corpo.replaceChildren(...[   // replaceChildren, a differenza di h(), scriverebbe "null": i vuoti si tolgono
      h("div", { class: "storia-fonte" }, marchio(n), h("span", { class: "fonte" }, n.fonte), h("span", { "aria-hidden": "true" }, "·"),
        h("time", { datetime: new Date(n.data).toISOString() }, fa(n.data)),
        n.lingua !== lingua() && !trad ? h("span", { class: "etichetta" }, n.lingua.toUpperCase()) : null),
      h("h2", { class: "storia-titolo", lang: trad ? trad.lingua : n.lingua }, titolo),
      breve ? h("p", { class: "storia-breve", lang: trad?.testo ? trad.lingua : n.lingua }, breve) : null,
      trad ? h("p", { class: "storia-nota" }, L(`Tradotto automaticamente ${daLingua(n.lingua)}`, `Machine-translated ${daLingua(n.lingua)}`)) : null,
      temi.length || altre.length ? h("div", { class: "storia-temi" },
        temi.map((t) => h("span", { class: "tema" }, t)),
        altre.length ? h("span", { class: "anche-su" }, L("Anche su ", "Also on ") + (altre.length > 2 ? L(`${altre.slice(0, 2).join(", ")} e altre ${altre.length - 2}`, `${altre.slice(0, 2).join(", ")} and ${altre.length - 2} more`) : elenco(altre))) : null) : null,
    ].filter(Boolean));

    const bApri = h("button", { type: "button", class: "storia-apri premibile" }, L("Apri la notizia", "Open the story"), icona("freccia"));
    bApri.addEventListener("click", () => apriNotizia(n, null));
    const etSalva = () => (salvata(n.id) ? T.togliSalvata() : T.salvaPerDopo());
    const bSalva = h("button", { type: "button", class: "storia-salva premibile", "aria-pressed": String(salvata(n.id)), "aria-label": etSalva(), title: etSalva() }, icona(salvata(n.id) ? "segnalibroPieno" : "segnalibro"));
    bSalva.addEventListener("click", () => {
      alternaSalvata(n, null);
      bSalva.setAttribute("aria-pressed", String(salvata(n.id)));
      bSalva.setAttribute("aria-label", etSalva());
      bSalva.title = etSalva();
      bSalva.replaceChildren(icona(salvata(n.id) ? "segnalibroPieno" : "segnalibro"));
    });
    azioni.replaceChildren(bApri, bSalva);

    if (entrata && !RIDOTTO.matches) {
      scena.classList.remove("entra-dx", "entra-sx");
      void scena.offsetWidth;
      scena.classList.add(entrata > 0 ? "entra-dx" : "entra-sx");
    }
    // la foto della prossima, già pronta
    const dopo = g.notizie[V.i + 1] || gruppi[V.g + 1]?.notizie[primaNonVista(V.g + 1)];
    if (dopo?.immagine) { const p = new Image(); p.referrerPolicy = "no-referrer"; p.src = dopo.immagine; }
  }

  function avanti() {
    if (V.i < gruppi[V.g].notizie.length - 1) { V.i++; mostra(); }
    else if (V.g < gruppi.length - 1) cambiaGruppo(1);
    else chiudi();
  }
  function indietro() {
    if (V.i > 0) { V.i--; mostra(); }
    else if (V.g > 0) { V.g--; V.i = 0; mostra(-1); }
    else { V.t = 0; }   // la prima di tutte: riparte
  }
  function cambiaGruppo(d) {
    V.g += d;
    V.i = d > 0 ? primaNonVista(V.g) : 0;
    impostaX(0);
    mostra(d);
  }

  function giro(t) {
    const dt = V.ultimo ? Math.min(100, t - V.ultimo) : 0;
    V.ultimo = t;
    document.body.style.overflow = "hidden";   // il foglio, chiudendosi, rimette lo scorrimento della pagina: qui resta fermo
    if (!inPausa()) V.t += dt;
    const p = Math.min(1, V.t / V.durata);
    if (V.pieno) V.pieno.style.transform = `scaleX(${p})`;
    if (p >= 1) avanti();
    if (!V.chiusa) V.raf = requestAnimationFrame(giro);
  }

  // trascinare: in giù chiude (lo schermo segue il dito), di lato cambia sezione
  const impostaY = (y) => {
    V.y = y;
    const p = Math.max(0, Math.min(1, y / innerHeight));
    scena.style.transform = y ? `translate3d(0,${y}px,0) scale(${1 - p * 0.12})` : "";
    el.style.backgroundColor = `rgba(0,0,0,${(0.94 * (1 - p)).toFixed(3)})`;
  };
  const impostaX = (x) => { V.x = x; scena.style.translate = x ? `${x}px 0` : ""; };
  let tocco = null, annullaClick = false, timerTenuta = 0;
  scena.addEventListener("pointerdown", (e) => {
    if (e.button > 0 || e.target.closest(".storia-azioni, .storia-chiudi")) return;
    V.anim?.ferma(); V.animX?.ferma();
    tocco = { x: e.clientX, y: e.clientY, id: e.pointerId, dir: null, storia: [] };
    annullaClick = false;
    clearTimeout(timerTenuta);
    timerTenuta = setTimeout(() => { if (tocco && !tocco.dir) { V.tenuta = true; el.classList.add("tenuta"); annullaClick = true; } }, 220);
  });
  scena.addEventListener("pointermove", (e) => {
    if (!tocco || e.pointerId !== tocco.id) return;
    const dx = e.clientX - tocco.x, dy = e.clientY - tocco.y;
    if (!tocco.dir) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) tocco.dir = "v";
      else if (Math.abs(dx) > 10) tocco.dir = "o";
      else return;
      clearTimeout(timerTenuta);
      annullaClick = true;
      V.tenuta = true;
      tocco.x = e.clientX; tocco.y = e.clientY;   // si parte da qui: niente salto di 10 px
      try { scena.setPointerCapture(e.pointerId); } catch { /* puntatore già sparito: si segue lo stesso */ }
      return;
    }
    const W = scena.offsetWidth;
    tocco.storia.push([e.timeStamp, tocco.dir === "v" ? e.clientY : e.clientX]);
    if (tocco.storia.length > 8) tocco.storia.shift();
    if (tocco.dir === "v") impostaY(dy > 0 ? dy : -elastico(-dy, innerHeight, 0.2));
    else {
      const bordo = (dx > 0 && V.g === 0) || (dx < 0 && V.g === gruppi.length - 1);
      impostaX(bordo ? Math.sign(dx) * elastico(Math.abs(dx), W, 0.3) : dx);
    }
  });
  const fine = (e) => {
    if (!tocco || e.pointerId !== tocco.id) return;
    clearTimeout(timerTenuta);
    const t = tocco;
    tocco = null;
    V.tenuta = false;
    el.classList.remove("tenuta");
    const v = velocitaDa(t.storia, e.timeStamp);
    if (t.dir === "v") {
      if (V.y + proietta(v) > innerHeight * 0.22) chiudi(v);
      else V.anim = molla({ da: V.y, a: 0, velocita: v, risposta: 0.32, aggiorna: impostaY });
    } else if (t.dir === "o") {
      const W = scena.offsetWidth, arrivo = V.x + proietta(v);
      if (arrivo < -W * 0.25 && V.g < gruppi.length - 1) cambiaGruppo(1);
      else if (arrivo > W * 0.25 && V.g > 0) cambiaGruppo(-1);
      else V.animX = molla({ da: V.x, a: 0, velocita: v, risposta: 0.3, aggiorna: impostaX });
    }
  };
  scena.addEventListener("pointerup", fine);
  scena.addEventListener("pointercancel", fine);
  zonaSx.addEventListener("click", () => { if (annullaClick) { annullaClick = false; return; } indietro(); });
  zonaDx.addEventListener("click", () => { if (annullaClick) { annullaClick = false; return; } avanti(); });

  const tasti = (e) => {
    if (!F.el.hidden || V.chiusa) return;   // il foglio aperto sopra ha i suoi tasti
    if (e.key === "Escape") { e.preventDefault(); chiudi(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); avanti(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); indietro(); }
    else if (e.key === "ArrowDown" && V.g < gruppi.length - 1) { e.preventDefault(); cambiaGruppo(1); }
    else if (e.key === "ArrowUp" && V.g > 0) { e.preventDefault(); cambiaGruppo(-1); }
  };
  document.addEventListener("keydown", tasti);

  function chiudi(velocita = 0) {
    if (V.chiusa) return;
    V.chiusa = true;
    cancelAnimationFrame(V.raf);
    clearTimeout(timerTenuta);
    document.removeEventListener("keydown", tasti);
    el.style.pointerEvents = "none";
    const via = () => {
      el.remove();
      if (F.el.hidden) document.body.style.overflow = "";
      prima?.focus?.({ preventScroll: true });
      rinfrescaStrisciaStorie();
    };
    V.anim?.ferma();
    if (RIDOTTO.matches) { el.style.transition = "opacity 200ms"; el.style.opacity = "0"; setTimeout(via, 200); return; }
    V.anim = molla({ da: V.y, a: innerHeight, velocita: Math.max(velocita, 600), risposta: 0.32, aggiorna: impostaY, fine: via });
  }

  mostra();
  V.raf = requestAnimationFrame(giro);
}

// ---------------------------------------------------------------- viste

function intestazione(titolo, sotto) {
  const h1 = h("h1", { id: "titolo-vista" }, titolo);
  return h("div", { class: "intestazione" }, h1, sotto ? h("p", {}, sotto) : null);
}

function calendarino(e) {
  const d = new Date(e.t);
  return h("div", { class: "calendario", style: `--c:${COLORI_AGENDA[e.tipo] || "var(--accento)"}`, "aria-hidden": "true" },
    h("span", { class: "mese" }, d.toLocaleDateString(LOCALE(), { month: "short" }).replace(".", "")),
    h("span", { class: "num" }, d.getDate()));
}
function quantoManca(t) {
  const g = giorniTra(Date.now(), t);
  if (g <= 0) return L("oggi", "today");
  if (g === 1) return L("domani", "tomorrow");
  if (g <= 45) return L(`tra ${g} giorni`, `in ${g} days`);
  return "";
}

function vistaPerTe() {
  // niente saluto, nome, data e "aggiornato" in cima (scelto da Mattia l'08/11/2026): si parte dalle storie.
  // Il titolo resta solo per i lettori di schermo.
  const parti = [h("h1", { class: "sr" }, L("Per te", "For you"))];
  const storie = strisciaStorie();
  if (storie) parti.push(storie);
  if (Date.now() - S.dati.aggiornato > 3 * 36e5) parti.push(h("div", { class: "banner" }, L("L'aggiornamento automatico è in ritardo: le notizie nuove arrivano appena riparte.", "Automatic updates are running late: new stories will arrive as soon as they resume.")));
  // mercati e prossimo appuntamento non stanno più qui (scelto da Mattia l'08/11/2026): hanno le loro schede in basso
  const bInteressi = h("button", { type: "button", class: "link premibile" }, L("I tuoi temi", "Your topics"));
  bInteressi.addEventListener("click", () => foglioProfilo("temi"));
  parti.push(h("h2", { class: "sezione" }, L("Scelte per te", "Picked for you"), bInteressi));
  const scelte = sceltePerTe();
  if (!scelte.length) {
    const nessunTema = !Object.keys(pesiTemi()).length;
    parti.push(h("div", { class: "vuoto" }, icona("calma"),
      h("strong", {}, nessunTema ? L("Non hai ancora scelto dei temi", "You haven't picked any topics yet") : L("Niente di nuovo sui tuoi temi", "Nothing new on your topics")),
      nessunTema
        ? L("Tocca «I tuoi temi» qui sopra e scegli cosa ti interessa.", "Tap “Your topics” above and choose what interests you.")
        : L("Il resto è in Notizie. Puoi anche aggiungere temi da «I tuoi temi».", "Everything else is in News. You can also add topics from “Your topics”.")));
  } else {
    parti.push(h("div", { class: "lista" }, scelte.map((n) => scheda(n, { temi: valuta(n).temi }))));
    parti.push(h("p", { class: "fine-lista" }, L(`Sono le ${scelte.length} notizie più vicine ai tuoi interessi. Le altre sono in Notizie.`, `These are the ${scelte.length} stories closest to your interests. The rest are in News.`)));
  }
  return parti;
}

function vistaNotizie() {
  const input = h("input", { type: "search", placeholder: L("Cerca nelle notizie", "Search the news"), "aria-label": L("Cerca nelle notizie", "Search the news"), value: S.cerca, enterkeyhint: "search" });
  const lista = h("div", {});
  const riempi = () => {
    const q = S.cerca.trim().toLowerCase();
    let voci = visibili();
    voci = q ? voci.filter((n) => conAltre(n).some((x) => (x.titolo + " " + x.sommario + " " + x.fonte).toLowerCase().includes(q))) : S.sezione === "tutto" ? voci : voci.filter((n) => n.sezione === S.sezione);
    voci.sort((a, b) => (b.data || 0) - (a.data || 0));
    if (!voci.length) { lista.replaceChildren(h("div", { class: "vuoto" }, icona("lente"), h("strong", {}, q ? L("Nessun risultato", "No results") : L("Niente qui", "Nothing here")), q ? L(`Niente su «${S.cerca.trim()}» negli ultimi giorni.`, `Nothing about “${S.cerca.trim()}” in the last few days.`) : "")); return; }
    const gruppi = [];
    let giorno = null, corrente = null;
    for (const n of voci) {
      const g = n.data ? etichettaGiorno(n.data) : L("Senza data", "No date");
      if (g !== giorno) { giorno = g; corrente = h("div", { class: "lista" }); gruppi.push(h("h3", { class: "giorno" }, g), corrente); }
      corrente.append(scheda(n, { temi: valuta(n).temi }));
    }
    lista.replaceChildren(...gruppi, h("p", { class: "fine-lista" }, L(`${voci.length} notizie degli ultimi 7 giorni`, `${voci.length} stories from the last 7 days`)));
  };
  input.addEventListener("input", () => { S.cerca = input.value; seg.style.opacity = S.cerca.trim() ? 0.4 : 1; riempi(); });
  // "Tutto" in testa: tutte le sezioni scelte, mischiate per ora (con una sezione sola non serve)
  const mie = Object.entries(SEZIONI()).filter(([k]) => sezioniScelte().has(k));
  if (mie.length > 1) mie.unshift(["tutto", L("Tutto", "All")]);
  if (!mie.some(([k]) => k === S.sezione)) S.sezione = mie[0][0];
  const seg = segmenti(mie, S.sezione,(v) => { S.sezione = v; mem.set("sezione", v); S.cerca = ""; input.value = ""; seg.style.opacity = 1; riempi(); window.scrollTo({ top: 0 }); }, { etichetta: L("Sezione", "Section") });
  seg.style.transition = "opacity 160ms";
  seg.classList.add("a-misura");   // fino a 6 voci: larghe quanto il nome, così «Economia» ci sta anche sul telefono
  if (S.cerca.trim()) seg.style.opacity = 0.4;
  if (mie.length < 2) seg.hidden = true;   // una sezione sola: niente da scegliere
  riempi();
  return [intestazione(L("Notizie", "News")), h("label", { class: "cerca" }, icona("lente"), input), seg, lista];
}

function vistaMercati() {
  const griglia = h("div", { class: "griglia-mercati" });
  const etichettaPeriodo = { 1: L("oggi", "today"), 30: L("1 mese", "1 month"), 90: L("3 mesi", "3 months"), 365: L("1 anno", "1 year") };
  const miei = mieiMercati().map(loc);
  const riempi = () => {
    griglia.replaceChildren(...miei.map((m) => {
      const giornata = S.periodo === 1 && m.oggi;
      const s = giornata ? m.oggi.punti.map((c) => [0, c]) : serieDa(m, S.periodo === 1 ? 2 : S.periodo);
      const valori = s.map(([, c]) => c);
      const rif = giornata ? m.oggi.riferimento : valori[0];
      const varPeriodo = giornata ? m.var_giorno : (m.prezzo / rif - 1) * 100;
      const d = decimali(m), u = unita(m);
      const tuo = m.simbolo === S.profilo.mio;
      return h("div", { class: "titolo-mercato" + (tuo ? " tuo" : "") },
        h("div", { class: "riga1" },
          h("div", {}, h("div", { class: "nome" }, tuo ? icona("stellaPiena", "stellina") : null, m.nome), h("div", { class: "simbolo" }, descriviMercato(m))),
          // il numero grande racconta lo stesso periodo del grafico; quello di oggi sta sotto, piccolo
          h("div", {}, h("div", { class: "prezzo" }, fmt(m.prezzo, d) + u), h("div", { class: "variazione" }, h("span", {}, etichettaPeriodo[S.periodo]), pillola(varPeriodo, etichettaPeriodo[S.periodo])))),
        grafico(s, { larghezza: 320, altezza: 88, area: true, base: true, classe: "grafico", riferimento: rif }),
        h("div", { class: "riga2" },
          h("span", {}, `min ${fmt(Math.min(...valori), d)} · max ${fmt(Math.max(...valori), d)}`),
          S.periodo !== 1 ? h("span", { class: "oggi" }, L("oggi ", "today "), pillola(m.var_giorno, L("Oggi", "Today"))) : null));
    }));
  };
  const seg = segmenti([[1, L("1G", "1D")], [30, "1M"], [90, "3M"], [365, L("1A", "1Y")]], S.periodo, (v) => { S.periodo = v; mem.set("periodo", v); riempi(); }, { etichetta: L("Periodo", "Period") });
  riempi();
  const scegli = h("button", { type: "button", class: "link premibile" }, L("Scegli", "Choose"));
  scegli.addEventListener("click", () => foglioProfilo("mercati"));
  const ultima = Math.max(0, ...miei.filter((m) => m.fonte !== "bce").map((m) => m.ora || 0));
  const mancanti = mercatiMancanti().map(loc);
  const seguiti = miei.length + mancanti.length;
  return [
    intestazione(L("Mercati", "Markets"), ultima ? `${L("Ultimi prezzi", "Latest prices")}: ${new Date(ultima).toLocaleString(LOCALE(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""),
    h("h2", { class: "sezione sotto-titolo" }, seguiti === 1 ? L("1 mercato seguito", "1 market followed") : L(`${seguiti} mercati seguiti`, `${seguiti} markets followed`), scegli),
    mancanti.length
      ? h("div", { class: "banner" }, L(`In questo aggiornamento mancano i prezzi di ${elenco(mancanti.map((m) => m.breve || m.nome))}: la fonte non ha risposto. Riprova più tardi.`,
        `This update is missing prices for ${elenco(mancanti.map((m) => m.breve || m.nome))}: the source didn't respond. Try again later.`))
      : null,
    ...(miei.length
      ? [seg, griglia]
      : mancanti.length ? [] : [h("div", { class: "vuoto" }, icona("calma"), h("strong", {}, L("Non segui nessun mercato", "You're not following any markets")), L("Tocca «Scegli» per aggiungere indici, ETF, azioni, valute o cripto.", "Tap “Choose” to add indices, ETFs, stocks, currencies or crypto."))]),
    notaPrezzi(L("La linea tratteggiata è il punto di partenza: la chiusura di ieri per 1G (per le cripto, 24 ore fa), l'inizio del periodo per gli altri. Seguire un titolo qui non è un consiglio a comprarlo.",
      "The dotted line is the starting point: yesterday's close for 1D (for crypto, 24 hours ago), the start of the period for the others. Following a security here is not advice to buy it.")),
  ].filter(Boolean);
}

function vistaAgenda() {
  const adesso = Date.now();
  const eventi = S.dati.agenda.eventi.map((e) => ({ ...loc(e), t: new Date(`${e.data}T${e.ora || "00:00"}:00`).getTime() })).filter((e) => e.t > adesso - 2 * 36e5);
  const lista = h("div", {});
  const tipi = TIPI_AGENDA(), filtriAgenda = FILTRI_AGENDA();
  const riempi = () => {
    const filtro = filtriAgenda.find(([k]) => k === S.filtroAgenda);
    const scelti = filtro[2] ? eventi.filter((e) => filtro[2].includes(e.tipo)) : eventi;
    const gruppi = [];
    let mese = null, corrente = null;
    for (const e of scelti) {
      const m = data(e.t, { month: "long", year: "numeric" });
      if (m !== mese) { mese = m; corrente = h("div", { class: "lista" }); gruppi.push(h("h3", { class: "giorno" }, m), corrente); }
      const tipo = tipi[e.tipo] || { nome: e.tipo, colore: "var(--accento)" };
      const manca = quantoManca(e.t);
      const visti = new Set();
      corrente.append(h("div", { class: "evento" + (giorniTra(adesso, e.t) <= 7 ? " vicino" : ""), style: `--c:${tipo.colore}` },
        calendarino(e),
        h("div", { class: "corpo" },
          h("div", { class: "riga-su" },
            h("span", { class: "tipo" }, tipo.nome),
            h("span", {}, `· ${data(e.t, { weekday: "short" })} ${e.ora}`),
            e.da_confermare ? h("span", { class: "badge-incerto" }, L("· da confermare", "· to be confirmed")) : null,
            manca ? h("span", { class: "manca" }, manca) : null),
          h("h4", {}, e.titolo),
          e.dettaglio ? h("p", {}, testoConGlossario(e.dettaglio, visti, 2)) : null)));
    }
    lista.replaceChildren(...(gruppi.length ? gruppi : [h("div", { class: "vuoto" }, h("strong", {}, L("Nessun appuntamento", "No upcoming events")), L("I prossimi arrivano appena le banche centrali pubblicano il calendario.", "More will appear as soon as the central banks publish their calendars."))]));
  };
  const filtri = h("div", { class: "filtri", role: "group", "aria-label": L("Filtra", "Filter") });
  for (const [k, nome] of filtriAgenda) {
    const b = h("button", { type: "button", class: "filtro premibile", "aria-pressed": String(S.filtroAgenda === k) }, nome);
    b.addEventListener("click", () => {
      S.filtroAgenda = k;
      filtri.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      riempi();
    });
    filtri.append(b);
  }
  riempi();
  const a = S.dati.agenda;
  const fonti = Object.entries(a.fonti || {}).map(([k, url], i) => [i ? ", " : "", h("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, tipi[k]?.nome || k)]);
  return [
    intestazione(L("Agenda", "Calendar"), L("Gli appuntamenti che muovono i mercati", "The events that move the markets")),
    filtri, lista,
    h("p", { class: "nota" }, `${L(a.nota, a.nota_en || a.nota)} ${L("Ultimo controllo", "Last checked")}: ${data(a.aggiornata, { day: "numeric", month: "long", year: "numeric" })}. ${L("Fonti", "Sources")}: `, fonti, "."),
  ];
}

function vistaSalvate() {
  const parti = [intestazione(L("Salvate", "Saved"), S.salvate.length ? L(`${S.salvate.length} da leggere con calma`, `${S.salvate.length} to read later`) : "")];
  if (!S.salvate.length) {
    parti.push(h("div", { class: "vuoto" }, icona("segnalibro"), h("strong", {}, L("Ancora niente", "Nothing yet")), L("Tocca il segnalibro su una notizia, o scorrila verso destra, e la ritrovi qui.", "Tap the bookmark on a story, or swipe it right, and you'll find it here.")));
  } else {
    parti.push(h("div", { class: "lista" }, S.salvate.map((n) => scheda(n, { inSalvate: true }))));
  }
  const recenti = S.lette.slice(0, 15);
  if (recenti.length) {
    parti.push(h("h2", { class: "sezione" }, L("Lette di recente", "Recently read")));
    parti.push(h("div", { class: "lista" }, recenti.map((n) => scheda(n, { compatta: true }))));
  }
  parti.push(h("p", { class: "nota" }, conto.utente()
    ? L("Salvate e lette sono sincronizzate con il tuo account: le ritrovi su tutti i dispositivi.", "Saved and read stories are synced with your account: you'll find them on all your devices.")
    : L("Salvate e lette restano su questo dispositivo. Con un account (da Il tuo Radar → Tu) le ritrovi anche sugli altri.", "Saved and read stories stay on this device. With an account (from Your Radar → You) you'll find them on your other devices too.")));
  return parti;
}

// ---------------------------------------------------------------- fogli: glossario e interessi

function mostraTermine(i, daLista = false) {
  const ritorno = F.aperto ? F.ritorno : null;   // se si arriva da una notizia, si può tornarci
  const v = loc(S.dati.glossario[i]);
  const cat = GRUPPI_TEMI()[v.categoria] || "";
  const box = h("div", { class: "definizione", style: `--c:${COLORE_SEZIONE[v.categoria] || "var(--accento)"}` },
    h("div", { class: "categoria" }, cat),
    h("p", {}, v.testo),
    v.esempio ? h("div", { class: "esempio" }, v.esempio) : null);
  const correlate = visibili().filter((n) => trovaTermini(n.titolo + " " + n.sommario).some((t) => t.i === i)).slice(0, 3);
  if (correlate.length) {
    box.append(h("div", { class: "gruppo-titolo", style: "margin-top:1.5rem" }, L("Ne parlano adesso", "In the news now")),
      h("ul", { class: "voci-glossario" }, correlate.map((n) => h("li", {}, h("a", { href: n.link, target: "_blank", rel: "noopener noreferrer", style: "display:block;padding:.625rem 0", onclick: (e) => { if (e.ctrlKey || e.metaKey || e.shiftKey) { segnaLetta(n); return; } e.preventDefault(); apriNotizia(n, document.querySelector(`#vista .card[data-id="${n.id}"]`)); } },
        h("div", { class: "t", style: "font-weight:500" }, n.titolo), h("div", { class: "d" }, `${n.fonte} · ${fa(n.data)}`))))));
  }
  const tutto = h("button", { type: "button", class: "vedi premibile" }, daLista ? L("‹ Tutto il glossario", "‹ Full glossary") : L("Tutto il glossario ›", "Full glossary ›"));
  tutto.addEventListener("click", () => foglioGlossario());
  if (ritorno) {
    const torna = h("button", { type: "button", class: "vedi premibile" }, L("‹ Torna alla notizia", "‹ Back to the story"));
    torna.addEventListener("click", ritorno);
    box.append(torna, " ");
  }
  box.append(tutto);
  apriFoglio(v.termine, box);
}

function foglioGlossario() {
  // si cerca in tutte e due le lingue: chi legge in inglese può cercare "spread" o "inflation" e trovarla lo stesso
  const voci = S.dati.glossario.map((v, i) => ({ ...loc(v), i, tutte: [v.termine, ...(v.alias || []), v.en?.termine, ...(v.en?.alias || [])].filter(Boolean) }))
    .sort((a, b) => a.termine.localeCompare(b.termine, lingua()));
  const input = h("input", { type: "search", placeholder: L("Cerca una parola", "Search for a word"), "aria-label": L("Cerca una parola", "Search for a word") });
  const lista = h("div", {});
  const riempi = () => {
    const q = input.value.trim().toLowerCase();
    const filtrate = q ? voci.filter((v) => v.tutte.some((a) => a.toLowerCase().includes(q)) || v.testo.toLowerCase().includes(q)) : voci;
    const blocchi = [];
    let lettera = null, ul = null;
    for (const v of filtrate) {
      const l = v.termine[0].toUpperCase();
      if (l !== lettera) { lettera = l; ul = h("ul", { class: "voci-glossario" }); blocchi.push(h("div", { class: "lettera" }, l), ul); }
      const b = h("button", { type: "button" }, h("div", { class: "t" }, v.termine), h("div", { class: "d" }, v.testo));
      b.addEventListener("click", () => mostraTermine(v.i, true));
      ul.append(h("li", {}, b));
    }
    lista.replaceChildren(...(blocchi.length ? blocchi : [h("p", { class: "nota" }, L("Nessuna parola trovata.", "No words found."))]));
  };
  input.addEventListener("input", riempi);
  riempi();
  apriFoglio(L("Glossario", "Glossary"), h("div", {}, h("label", { class: "cerca" }, icona("lente"), input), lista));
}

// pastiglia da accendere e spegnere: la stessa nella presentazione e in Il tuo Radar
function pastiglia(testo, acceso, alCambio) {
  const b = h("button", { type: "button", class: "scelta premibile", "aria-pressed": String(acceso) }, icona("spunta", "spunta"), testo);
  b.addEventListener("click", () => {
    const on = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", String(on));
    alCambio(on);
  });
  return b;
}

function interruttore(nome, acceso, alCambio) {
  const input = h("input", { type: "checkbox", role: "switch", "aria-label": nome });
  input.checked = acceso;
  input.addEventListener("change", () => alCambio(input.checked));
  return h("label", { class: "interruttore" }, input, h("span", { class: "binario" }));
}

// "Il tuo Radar": nome, temi, mercati (con la stella per quello in evidenza), lingue. parte = "temi" | "mercati" per aprirlo lì.
function foglioProfilo(parte) {
  let cambiato = false;
  const segna = () => { cambiato = true; };

  const campo = h("input", { type: "text", class: "campo", value: S.profilo.nome, placeholder: L("Il tuo nome (facoltativo)", "Your name (optional)"), "aria-label": L("Il tuo nome", "Your name"), maxlength: "30", autocomplete: "given-name", enterkeyhint: "done" });
  campo.addEventListener("input", () => { S.profilo.nome = campo.value; salvaProfilo(); segna(); });
  campo.addEventListener("keydown", (e) => { if (e.key === "Enter") campo.blur(); });

  // prima la scelta semplice (le pastiglie, come nella presentazione), sotto il peso dei soli temi accesi
  const quantoConta = h("div", {});
  const disegnaPesi = () => {
    const p = pesiTemi(), sezioni = sezioniScelte();
    const accesi = S.dati.temi.filter((t) => p[t.id] && sezioni.has(t.gruppo)).map(loc);
    quantoConta.replaceChildren(...(accesi.length
      ? [h("div", { class: "gruppo-titolo" }, L("Quanto conta ciascuno", "How much each one matters")),
        h("div", { class: "gruppo" }, accesi.map((t) => h("div", { class: "riga-tema" },
          h("div", { class: "info" }, h("div", { class: "nome" }, t.nome)),
          segmenti([[1, L("Poco", "Low")], [2, L("Medio", "Medium")], [3, L("Molto", "High")]], p[t.id], (v) => { impostaPeso(t.id, v); segna(); }, { piccoli: true, etichetta: L(`Quanto conta: ${t.nome}`, `How much it matters: ${t.nome}`) })))),
        h("p", { class: "nota stretta" }, L("Più un tema conta, più in alto finiscono le sue notizie in Per te. Se il tema è nel titolo vale il doppio.", "The more a topic matters, the higher its stories rank in For you. A topic in the headline counts double."))]
      : [h("p", { class: "nota stretta" }, L("Nessun tema acceso: finché non ne scegli almeno uno, Per te resta vuoto.", "No topics on: For you stays empty until you pick at least one."))]));
  };
  disegnaPesi();
  // i temi, divisi per sezione: solo quelli delle sezioni accese
  const gruppiTemi = h("div", {});
  const disegnaGruppi = () => {
    const sezioni = sezioniScelte(), p = pesiTemi();
    gruppiTemi.replaceChildren(...Object.entries(GRUPPI_TEMI()).filter(([g]) => sezioni.has(g)).flatMap(([g, titolo]) => [
      h("div", { class: "gruppo-titolo" }, titolo),
      h("div", { class: "scelte nel-foglio" }, S.dati.temi.filter((t) => t.gruppo === g).map(loc).map((t) =>
        pastiglia(t.nome, !!p[t.id], (on) => { impostaPeso(t.id, on ? 2 : 0); segna(); disegnaPesi(); }))),
    ]));
  };
  disegnaGruppi();
  // le sezioni da vedere: sotto ognuna qualche testata. Almeno una resta accesa.
  const rigaSezione = ([k, nome]) => {
    const sw = interruttore(L(`Mostra la sezione ${nome}`, `Show the ${nome} section`), sezioniScelte().has(k), (on) => {
      const s = Object.fromEntries(Object.keys(SEZIONI()).map((x) => [x, sezioniScelte().has(x)]));
      s[k] = on;
      if (!Object.values(s).some(Boolean)) {
        sw.querySelector("input").checked = true;
        mostraAvviso(L("Tieni accesa almeno una sezione", "Keep at least one section on"));
        return;
      }
      S.profilo.sezioni = s;
      salvaProfilo();
      compilaTemi();
      segna();
      disegnaGruppi();
      disegnaPesi();
    });
    return h("div", { class: "riga-tema" }, h("div", { class: "info" }, h("div", { class: "nome" }, nome), h("div", { class: "parole" }, fontiSezione(k))), sw);
  };
  const temi = [
    h("div", { class: "gruppo-titolo" }, L("Sezioni", "Sections")),
    h("div", { class: "gruppo" }, Object.entries(GRUPPI_TEMI()).map(rigaSezione)),
    h("p", { class: "nota stretta" }, L("Quelle spente spariscono da Notizie e da Per te.", "The ones you turn off disappear from News and For you.")),
    h("p", { class: "nota stretta" }, L("Tocca i temi che ti interessano: le notizie che ne parlano finiscono in cima a Per te.", "Tap the topics you care about: stories about them go to the top of For you.")),
    gruppiTemi,
    quantoConta,
  ];

  const stelle = new Map(), accesi = new Map();
  const aggiornaStelle = () => {
    for (const [s, b] of stelle) {
      const on = S.profilo.mio === s;
      b.setAttribute("aria-pressed", String(on));
      b.replaceChildren(icona(on ? "stellaPiena" : "stella"));
    }
  };
  const scelti = new Set(mercatiScelti());
  const mercati = CATEGORIE_MERCATI.map((cat) => {
    const voci = catalogo().filter((m) => m.categoria === cat).map(loc);
    if (!voci.length) return null;
    return [h("div", { class: "gruppo-titolo" }, nomeCategoria(cat)), h("div", { class: "gruppo" }, voci.map((m) => {
      const stella = h("button", { type: "button", class: "stella premibile", "aria-label": L(`In evidenza: ${m.nome}`, `Highlight: ${m.nome}`), title: L("Metti in evidenza", "Highlight") });
      stelle.set(m.simbolo, stella);
      const sw = interruttore(L(`Segui ${m.nome}`, `Follow ${m.nome}`), scelti.has(m.simbolo), (on) => { impostaMercato(m.simbolo, on); aggiornaStelle(); segna(); });
      accesi.set(m.simbolo, sw.querySelector("input"));
      stella.addEventListener("click", () => {
        const on = S.profilo.mio !== m.simbolo;
        if (on && !mercatiScelti().includes(m.simbolo)) { impostaMercato(m.simbolo, true); accesi.get(m.simbolo).checked = true; }
        S.profilo.mio = on ? m.simbolo : null;
        salvaProfilo();
        aggiornaStelle();
        segna();
      });
      return h("div", { class: "riga-tema" }, h("div", { class: "info" }, h("div", { class: "nome" }, m.nome), codiceMercato(m) ? h("div", { class: "parole" }, codiceMercato(m)) : null), stella, sw);
    }))];
  });
  aggiornaStelle();

  // da dove vengono le notizie: sotto ogni paese le sue testate. Almeno uno resta acceso.
  const rigaPaese = ([k, nome]) => {
    const sw = interruttore(L(`Notizie da: ${nome}`, `News from: ${nome}`), paesiScelti().has(k), (on) => {
      const p = Object.fromEntries(PAESI().map(([x]) => [x, paesiScelti().has(x)]));
      p[k] = on;
      if (!Object.values(p).some(Boolean)) {
        sw.querySelector("input").checked = true;
        mostraAvviso(L("Tieni acceso almeno un paese", "Keep at least one country on"));
        return;
      }
      S.profilo.paesi = p;
      salvaProfilo();
      segna();
    });
    const testate = fontiDi(k);
    return h("div", { class: "riga-tema" }, h("div", { class: "info" }, h("div", { class: "nome" }, nome), testate.length ? h("div", { class: "parole" }, testate.join(", ")) : null), sw);
  };
  // la lingua dell'app: cambia subito tutto, e il foglio si riapre già tradotto
  const linguaApp = segmenti([["it", "Italiano"], ["en", "English"]], lingua(), (l) => applicaLingua(l, "tu"), { etichetta: L("Lingua dell'app", "App language") });
  const aspetto = segmenti([["auto", L("Automatico", "Automatic")], ["chiaro", L("Chiaro", "Light")], ["scuro", L("Scuro", "Dark")]], sceltaAspetto(), impostaAspetto, { etichetta: L("Aspetto", "Appearance") });
  const bInfo = h("button", { type: "button", class: "riga-link premibile" }, L("Info, fonti e privacy", "About, sources and privacy"), icona("freccia", "freccia"));
  bInfo.addEventListener("click", foglioInfo);
  const bRifai = h("button", { type: "button", class: "riga-link premibile" }, L("Rivedi la presentazione", "Replay the introduction"), icona("freccia", "freccia"));
  bRifai.addEventListener("click", () => {
    const prima = F.allaChiusura;
    F.allaChiusura = () => { prima && prima(); benvenuto(); };
    chiudiFoglio();
  });

  const pannelli = {
    temi: h("div", {}, temi),
    notifiche: pannelloNotifiche(() => scelta.querySelectorAll("button")[3]?.click()),   // [3] = "Tu"
    mercati: h("div", {},
      h("p", { class: "nota stretta" }, L("Accendi quelli da seguire. La stella ne mette uno in evidenza, primo e incorniciato: per esempio l'ETF del tuo piano di accumulo.", "Turn on the ones to follow. The star highlights one, first and framed: for example the ETF in your savings plan.")),
      mercati),
    tu: h("div", {},
      h("div", { class: "gruppo-titolo" }, "Account"),
      (SYNC.box = h("div", { class: "riquadro-conto" }, pannelloConto())),
      h("div", { class: "gruppo-titolo" }, L("Nome", "Name")),
      h("div", { class: "gruppo" }, h("div", { class: "riga-tema" }, campo)),
      h("div", { class: "gruppo-titolo" }, L("Lingua dell'app", "App language")),
      linguaApp,
      h("div", { class: "gruppo-titolo" }, L("Aspetto", "Appearance")),
      aspetto,
      h("p", { class: "nota stretta" }, L("Automatico segue il chiaro o lo scuro del dispositivo. La scelta vale solo su questo dispositivo.", "Automatic follows your device's light or dark setting. The choice applies to this device only.")),      h("div", { class: "gruppo-titolo" }, L("Notizie da", "News from")),
      h("div", { class: "gruppo" }, PAESI().map(rigaPaese)),
      h("p", { class: "nota stretta" }, L("Le notizie restano nella lingua della testata: quelle di Europa, Stati Uniti e Regno Unito sono in inglese.", "Stories stay in the language they were published in: the Italian ones are in Italian.")),
      h("div", { class: "gruppo" }, bInfo, bRifai),
      h("p", { class: "nota" }, conto.utente() ? L("Le scelte sono salvate qui e nel tuo account.", "Your choices are saved here and in your account.") : L("Senza account, queste scelte restano solo su questo dispositivo.", "Without an account, these choices stay on this device only."))),
  };
  const area = h("div", {});
  const mostraParte = (k) => { area.replaceChildren(pannelli[k]); $("#foglio-contenuto").scrollTop = 0; };
  const iniziale = pannelli[parte] ? parte : "temi";
  const scelta = segmenti([["temi", L("Temi", "Topics")], ["mercati", L("Mercati", "Markets")], ["notifiche", L("Notifiche", "Alerts")], ["tu", L("Tu", "You")]], iniziale, mostraParte, { etichetta: L("Parte", "Section") });
  mostraParte(iniziale);
  apriFoglio(L("Il tuo Radar", "Your Radar"), h("div", {}, h("div", { class: "segmenti-fissi" }, scelta), area), () => { if (cambiato) disegna(); });
}

// ---------------------------------------------------------------- notifiche
// Un tema per sezione (S.profilo.notifiche = { finanza: "etf", ai: "anthropic" }): viaggia col profilo, quindi vale
// su tutti i dispositivi dell'account. Quali dispositivi le ricevono lo decidono le iscrizioni (supabase/notifiche.sql).
// Le manda il giro orario su GitHub (notifica.py): solo con l'account, al massimo 2 al giorno per tema e 5 in tutto,
// dalle 8 alle 22. Su iPhone e iPad solo all'app aggiunta alla schermata Home (iOS 16.4 o più recente).

const PUSH = {
  supportate: "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && location.protocol === "https:",
  ios: /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
  dallaHome: matchMedia("(display-mode: standalone)").matches || navigator.standalone === true,
};
function chiaveVapid() {
  const b = atob(NOTIFICHE.chiave.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
// un'iscrizione fatta con una chiave vecchia non riceverebbe più niente: va rifatta
function stessaChiave(sub) {
  const k = sub.options && sub.options.applicationServerKey;
  if (!k) return true;
  const a = new Uint8Array(k), b = chiaveVapid();
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
async function iscrizioneQui() {
  if (!PUSH.supportate) return null;
  // ready aspetta per sempre se la cache dell'app non si è installata: meglio un "non so" dopo qualche secondo
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((ok) => setTimeout(() => ok(null), 4000))]);
  return reg ? reg.pushManager.getSubscription() : null;
}
// il permesso si chiede qui, subito dopo il tocco sull'interruttore: iOS lo vuole così
async function attivaNotifiche() {
  const permesso = await Notification.requestPermission();
  if (permesso !== "granted") {
    throw new Error(permesso === "denied"
      ? L("Le notifiche sono bloccate per il Radar: si riattivano dalle impostazioni del dispositivo.", "Notifications are blocked for Radar: turn them back on in your device settings.")
      : L("Notifiche non attivate.", "Notifications not turned on."));
  }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub && !stessaChiave(sub)) { await sub.unsubscribe(); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiaveVapid() });
  await conto.iscrivi(sub.toJSON(), lingua());
  mem.set("notifiche", { attive: true, rinnovate: Date.now() });
}
// anche senza rete il dispositivo smette subito: la riga sul server la toglie notifica.py al primo invio rifiutato
async function spegniNotifiche() {
  mem.set("notifiche", { attive: false, rinnovate: 0 });
  const sub = await iscrizioneQui().catch(() => null);
  if (!sub) return;
  try { await conto.disiscrivi(sub.endpoint); } catch { /* ci pensa notifica.py */ }
  try { await sub.unsubscribe(); } catch { /* già tolta */ }
}
// una volta al giorno, all'apertura: l'iscrizione si riscrive (il browser può cambiarla, la lingua pure)
async function rinfrescaNotifiche() {
  const stato = mem.get("notifiche", null);
  if (!stato?.attive || !PUSH.supportate || !conto.utente() || Notification.permission !== "granted") return;
  if (Date.now() - (stato.rinnovate || 0) < 864e5) return;
  try { await attivaNotifiche(); } catch { /* si riprova alla prossima apertura */ }
}

function pannelloNotifiche(vaiATu) {
  const stato = h("div", {});
  const disegnaStato = async () => {
    if (!conto.utente()) {
      const b = h("button", { type: "button", class: "riga-link premibile" }, L("Entra o crea l'account", "Sign in or create an account"), icona("freccia", "freccia"));
      b.addEventListener("click", vaiATu);
      stato.replaceChildren(h("p", { class: "nota stretta" }, L("Le notifiche hanno bisogno dell'account: così i temi scelti valgono su tutti i tuoi dispositivi.", "Alerts need an account, so the topics you pick work on all your devices.")), h("div", { class: "gruppo" }, b));
      return;
    }
    if (PUSH.ios && !PUSH.dallaHome) {
      stato.replaceChildren(h("p", { class: "nota stretta" }, L("Su iPhone e iPad le notifiche arrivano solo al Radar aggiunto alla schermata Home: in Safari tocca Condividi → Aggiungi alla schermata Home, poi apri il Radar da lì. Serve iOS 16.4 o più recente.", "On iPhone and iPad, alerts only reach Radar added to the Home Screen: in Safari tap Share → Add to Home Screen, then open Radar from there. iOS 16.4 or later is needed.")));
      return;
    }
    if (!PUSH.supportate) {
      stato.replaceChildren(h("p", { class: "nota stretta" }, L("Questo browser non riceve notifiche dai siti.", "This browser can't receive alerts from websites.")));
      return;
    }
    const bloccate = Notification.permission === "denied";
    const sub = await iscrizioneQui().catch(() => null);
    const accese = !bloccate && !!sub && !!mem.get("notifiche", null)?.attive;
    const sw = interruttore(L("Notifiche su questo dispositivo", "Alerts on this device"), accese, async (on) => {
      const input = sw.querySelector("input");
      input.disabled = true;
      try {
        if (on) {
          await attivaNotifiche();
          mostraAvviso(scelteNotifiche().length ? L("Notifiche attive su questo dispositivo", "Alerts on for this device") : L("Notifiche attive: ora scegli i temi qui sotto", "Alerts on: now pick the topics below"));
        } else {
          await spegniNotifiche();
          mostraAvviso(L("Niente più notifiche su questo dispositivo", "No more alerts on this device"));
        }
      } catch (e) {
        input.checked = !on;
        mostraAvviso(e.message || L("Non sono riuscito ad attivarle. Riprova tra poco.", "Couldn't turn them on. Please try again shortly."));
      } finally {
        input.disabled = false;
        disegnaStato();
      }
    });
    if (bloccate) sw.querySelector("input").disabled = true;
    stato.replaceChildren(
      h("div", { class: "gruppo" }, h("div", { class: "riga-tema" }, h("div", { class: "info" }, h("div", { class: "nome" }, L("Su questo dispositivo", "On this device"))), sw)),
      bloccate ? h("p", { class: "nota stretta" }, L("Le hai bloccate per il Radar: si riattivano dalle impostazioni del browser (su iPhone: Impostazioni → Notifiche → Radar).", "You've blocked them for Radar: turn them back on in your browser settings (on iPhone: Settings → Notifications → Radar).")) : null);
  };
  disegnaStato();

  // un tema per sezione, tra quelli della sezione (anche se non lo segui in Per te)
  const sezioni = sezioniScelte();
  const righe = Object.entries(GRUPPI_TEMI()).filter(([g]) => sezioni.has(g)).map(([g, nome]) => {
    const sel = h("select", { class: "scelta-notifica", "aria-label": L(`Notifiche di ${nome}`, `${nome} alerts`) },
      h("option", { value: "" }, L("Nessuno", "None")),
      S.dati.temi.filter((t) => t.gruppo === g).map(loc).map((t) => h("option", { value: t.id }, t.nome)));
    sel.value = (S.profilo.notifiche || {})[g] || "";
    sel.addEventListener("change", () => {
      const n = { ...(S.profilo.notifiche || {}) };
      if (sel.value) n[g] = sel.value; else delete n[g];
      S.profilo.notifiche = Object.keys(n).length ? n : null;
      salvaProfilo();
    });
    return h("div", { class: "riga-tema" }, h("div", { class: "info" }, h("div", { class: "nome" }, nome)), h("span", { class: "scelta-notifica-box" }, sel));
  });

  return h("div", {},
    stato,
    h("div", { class: "gruppo-titolo" }, L("Un tema per sezione", "One topic per section")),
    h("div", { class: "gruppo" }, righe),
    h("p", { class: "nota stretta" }, L("Ti avvisiamo quando esce una notizia con quel tema nel titolo. Al massimo 2 notifiche al giorno per tema e 5 in tutto, solo dalle 8 alle 22: quelle della notte arrivano alle 8. Se nella stessa ora escono più notizie sullo stesso tema, arrivano in una notifica sola.", "We'll alert you when a story has that topic in its headline. At most 2 alerts a day per topic and 5 in total, only from 8 am to 10 pm (Italian time): overnight ones arrive at 8. If several stories on the same topic come out in the same hour, they arrive as one alert.")),
    h("p", { class: "nota stretta" }, L("Il Radar guarda le notizie nuove una volta all'ora, quindi una notifica può arrivare fino a un'ora dopo. I temi valgono per tutti i tuoi dispositivi, l'interruttore solo per questo.", "Radar checks for new stories once an hour, so an alert can arrive up to an hour later. Topics apply to all your devices, the switch only to this one.")));
}
const scelteNotifiche = () => Object.values(S.profilo.notifiche || {}).filter(Boolean);

// dalla notifica: #notizia=<id>. Si apre la sottopagina sopra la vista di prima; se la notizia non c'è più, si dice
function apriDaNotifica(id) {
  const n = visibili().find((x) => conAltre(x).some((y) => y.id === id)) || S.dati.notizie.find((x) => x.id === id) || S.salvate.find((x) => x.id === id);
  if (!n) { mostraAvviso(L("Questa notizia non è più nel Radar", "This story is no longer in Radar")); return; }
  apriNotizia(n, document.querySelector(`.card[data-id="${CSS.escape(n.id)}"]`));
}
navigator.serviceWorker?.addEventListener("message", (e) => {
  if (e.data?.radar !== "apri" || !e.data.url) return;
  const u = new URL(e.data.url);
  if (u.hash) location.hash = u.hash;
});

function foglioInfo() {
  const fonti =Object.entries(SEZIONI()).map(([s, nome]) =>
    h("li", {}, h("strong", {}, `${nome}: `), S.dati.fonti.filter((f) => f.sezione === s).map((f) => f.nome).join(", ")));
  const ETICHETTA = L("Cancella i miei dati da questo dispositivo", "Delete my data from this device");
  let conferma = 0;
  const cancella = h("button", { type: "button", class: "bottone-pericolo premibile" }, ETICHETTA);
  cancella.addEventListener("click", async () => {
    if (conferma) await spegniNotifiche();
    if (conferma && conto.utente()) await conto.esci();
    if (!conferma) {
      cancella.textContent = conto.utente() ? L("Tocca di nuovo: cancella tutto qui ed esci (l'account resta)", "Tap again: delete everything here and sign out (the account stays)") : L("Tocca di nuovo: cancella nome, scelte e salvate", "Tap again: delete name, choices and saved stories");
      conferma = setTimeout(() => { conferma = 0; cancella.textContent = ETICHETTA; }, 4000);
      return;
    }
    try { Object.keys(localStorage).filter((k) => k.startsWith("radar.")).forEach((k) => localStorage.removeItem(k)); } catch { /* niente da cancellare */ }
    location.hash = "";
    location.reload();
  });
  const coingecko = h("a", { href: "https://www.coingecko.com", target: "_blank", rel: "noopener" }, L("dati di CoinGecko", "CoinGecko data"));
  const informativa = h("a", { href: L("privacy.html", "privacy-en.html"), target: "_blank" }, L("informativa completa", "full privacy notice"));
  // un ramo solo (non L): i link e l'elenco delle fonti sono nodi, e finirebbero spostati nella versione scartata
  apriFoglio(L("Info", "About"), h("div", { class: "testo-info" }, ...(lingua() === "it" ? [
    h("p", {}, "Radar raccoglie ogni ora le notizie di finanza, economia, intelligenza artificiale, tecnologia e scienza da testate italiane e straniere, e mette in cima quelle sui temi che hai scelto. Accanto ci sono i mercati che segui, l'agenda degli appuntamenti che muovono i prezzi e un glossario per le parole difficili."),
    h("h3", {}, "Non è consulenza finanziaria"),
    h("p", {}, "Notizie, prezzi, grafici e glossario servono a informarti, non a dirti cosa comprare o vendere. Prima di investire valuta la tua situazione e, se serve, chiedi a un consulente abilitato. Chi investe può perdere anche parte di quello che ha messo."),
    h("h3", {}, "Da dove arrivano i contenuti"),
    h("p", {}, "Di ogni notizia mostriamo solo titolo, qualche riga e la fonte, presi dai feed pubblici delle testate: per leggerla tutta vai sul loro sito. Titolo e testo delle notizie in inglese li traduce in automatico Microsoft Translator, e puoi sempre vedere l'originale."),
    h("ul", {}, fonti),
    h("p", {}, "Prezzi: i cambi sono i tassi di riferimento ufficiali della Banca centrale europea, pubblicati una volta al giorno verso le 16. Le cripto vengono dai ", coingecko,
      ". Indici, ETF, azioni e materie prime vengono da Yahoo Finance, con qualche minuto di ritardo. Tutti possono contenere errori, e se una fonte non risponde quei prezzi mancano finché non torna."),
    h("p", {}, "Le date dell'agenda vengono dalle pagine ufficiali di BCE, Fed, Eurostat e delle aziende."),
    h("h3", {}, "Privacy"),
    h("p", {}, "Non ci sono pubblicità né cookie di profilazione, e l'app non registra statistiche su cosa leggi. Senza account, nome, temi, mercati e salvate restano solo in questo browser."),
    h("p", {}, "L'account è facoltativo. Se lo crei conserviamo la tua email e le tue scelte (nome, temi, mercati, salvate, lette e nascoste; se accendi le notifiche, anche l'indirizzo del dispositivo per riceverle e quelle già inviate) su Supabase, in un server in Germania, solo per fartele ritrovare sugli altri dispositivi. Puoi scaricarle o eliminare l'account in ogni momento da Il tuo Radar → Tu."),
    h("p", {}, "Il sito, come ogni sito, riceve dal tuo browser dati tecnici come l'indirizzo IP; le immagini delle notizie arrivano direttamente dai siti delle testate."),
    h("p", {}, "Tutti i dettagli (chi è il titolare, i fornitori, per quanto teniamo i dati, i tuoi diritti) sono nell'", informativa, "."),
  ] : [
    h("p", {}, "Every hour, Radar collects finance, economy, artificial intelligence, technology and science news from Italian and international outlets, and puts the stories on the topics you chose at the top. Alongside are the markets you follow, a calendar of the events that move prices, and a glossary for the tricky words."),
    h("h3", {}, "This is not financial advice"),
    h("p", {}, "News, prices, charts and the glossary are there to inform you, not to tell you what to buy or sell. Before investing, consider your own situation and, if needed, talk to a licensed adviser. Investing can mean losing part of what you put in."),
    h("h3", {}, "Where the content comes from"),
    h("p", {}, "For each story we show only the headline, a few lines and the source, taken from the outlets' public feeds: to read it in full, go to their site. English stories can also be shown in Italian, machine-translated by Microsoft Translator."),
    h("ul", {}, fonti),
    h("p", {}, "Prices: exchange rates are the official reference rates of the European Central Bank, published once a day around 4 pm CET. Crypto prices come from ", coingecko,
      ". Indices, ETFs, stocks and commodities come from Yahoo Finance, delayed by a few minutes. Any of them may contain errors, and if a source doesn't respond those prices are missing until it's back."),
    h("p", {}, "Calendar dates come from the official pages of the ECB, the Fed, Eurostat and the companies."),
    h("h3", {}, "Privacy"),
    h("p", {}, "There are no ads and no profiling cookies, and the app keeps no statistics on what you read. Without an account, your name, topics, markets and saved stories stay in this browser only."),
    h("p", {}, "The account is optional. If you create one, we store your email and your choices (name, topics, markets, saved, read and hidden stories; if you turn alerts on, also your device's address for receiving them and the alerts already sent) on Supabase, on a server in Germany, only so you can find them on your other devices. You can download them or delete the account at any time from Your Radar → You."),
    h("p", {}, "Like any website, the site receives technical data from your browser, such as your IP address; news images load directly from the outlets' sites."),
    h("p", {}, "All the details (who the data controller is, the providers, how long we keep data, your rights) are in the ", informativa, "."),
  ]), cancella));
}

// ---------------------------------------------------------------- presentazione al primo avvio

function benvenuto() {
  if ($(".benvenuto") || !S.dati) return;
  const scelta = {
    nome: S.profilo.nome,
    temi: new Set(Object.keys(S.profilo.temi ?? {})),
    mercati: new Set(mercatiScelti()),
    mio: S.profilo.mio,
    paesi: new Set(paesiScelti()),
    paesiToccati: !!S.profilo.paesi,   // finché non li tocca, seguono la lingua (se la cambia dalla prima schermata)
    sezioni: new Set(sezioniScelte()),
  };
  // i temi scelti che si vedono: quelli delle sezioni accese
  const gruppoDi = (id) => S.dati.temi.find((t) => t.id === id)?.gruppo;
  const temiVisti = () => [...scelta.temi].filter((id) => scelta.sezioni.has(gruppoDi(id)));
  let passo = 0, attuale = null, bAvanti = null;

  const box = h("div", { class: "benvenuto", role: "dialog", "aria-modal": "true", "aria-labelledby": "bv-titolo" });
  const testa = h("div", { class: "bv-testa" });
  const corpo = h("div", { class: "bv-corpo" });
  const piede = h("div", { class: "bv-piede" });
  box.append(h("div", { class: "bv-colonna" }, testa, corpo, piede));
  document.body.append(box);
  document.body.style.overflow = "hidden";

  const sceltaMultipla = pastiglia;
  const punto = (titolo, testo) => h("div", { class: "bv-punto" }, h("strong", {}, titolo), h("span", {}, testo));

  const passi = [
    () => {
      const salta = h("button", { type: "button", class: "bottone-testo premibile" }, L("Salta: uso le scelte proposte", "Skip: use the suggested choices"));
      salta.addEventListener("click", () => {
        scelta.temi = new Set(Object.keys(temiProposti()));
        scelta.mercati = new Set(catalogo().filter((m) => m.predefinito).map((m) => m.simbolo));
        if (!scelta.paesiToccati) scelta.paesi = new Set(paesiScelti());
        finisci();
      });
      const giaConto = h("button", { type: "button", class: "bottone-testo premibile" }, L("Ho già un account", "I already have an account"));
      giaConto.addEventListener("click", mostraAccesso);
      return {
        titolo: L("Benvenuto in Radar", "Welcome to Radar"),
        testo: L("Finanza, economia, AI, tecnologia e scienza: ogni ora le notizie che contano, e in cima quelle sui temi che scegli tu.", "Finance, the economy, AI, tech and science: the news that matters, every hour, with the topics you choose at the top."),
        sopra: h("div", { class: "bv-logo", "aria-hidden": "true" }, icona("radar")),
        contenuto: h("div", {},
          h("div", { class: "bv-punti" },
            punto(L("Per te", "For you"), L("Le notizie sui tuoi temi, prima di tutto il resto.", "Stories on your topics, before everything else.")),
            punto(L("Mercati", "Markets"), L("Gli indici, gli ETF, le azioni e le cripto che decidi di seguire.", "The indices, ETFs, stocks and crypto you choose to follow.")),
            punto(L("Glossario", "Glossary"), L("Tocca una parola sottolineata e te la spieghiamo in parole semplici.", "Tap an underlined word and we explain it in plain language."))),
          h("p", { class: "bv-nota" }, L("Radar serve a informarti: non è consulenza finanziaria.", "Radar is here to inform you: it is not financial advice."))),
        avanti: L("Inizia", "Get started"),
        secondario: h("div", { class: "riga-bottoni centrati" }, conto.utente() ? null : giaConto, salta),
      };
    },
    () => {
      const campo = h("input", { type: "text", class: "campo grande", value: scelta.nome, placeholder: L("Il tuo nome", "Your name"), "aria-label": L("Il tuo nome", "Your name"), maxlength: "30", autocomplete: "given-name", enterkeyhint: "next" });
      campo.addEventListener("input", () => { scelta.nome = campo.value; });
      campo.addEventListener("keydown", (e) => { if (e.key === "Enter") bAvanti.click(); });
      return { titolo: L("Come ti chiami?", "What's your name?"), testo: L("Serve solo per salutarti. Puoi anche lasciarlo vuoto.", "It's only used to greet you. You can leave it blank."), contenuto: campo, avanti: L("Continua", "Continue") };
    },
    () => {
      if (!scelta.paesiToccati) scelta.paesi = new Set(paesiScelti());
      return {
        titolo: L("Da dove vuoi le notizie?", "Where do you want your news from?"),
        testo: L("Scegli i paesi delle testate. Potrai cambiarli quando vuoi, in Il tuo Radar → Tu.", "Pick the countries of the news outlets. You can change them any time, in Your Radar → You."),
        contenuto: h("div", {},
          h("div", { class: "scelte" }, PAESI().map(([k, nome]) =>
            sceltaMultipla(nome, scelta.paesi.has(k), (on) => { scelta.paesiToccati = true; on ? scelta.paesi.add(k) : scelta.paesi.delete(k); aggiornaBottone(); }))),
          h("p", { class: "bv-nota" }, L("Le notizie restano nella lingua originale: quelle di Europa, Stati Uniti e Regno Unito sono in inglese.", "Stories stay in their original language: the Italian ones are in Italian."))),
        avanti: L("Continua", "Continue"),
        pronto: () => scelta.paesi.size > 0,
        manca: L("Scegline almeno uno", "Pick at least one"),
      };
    },
    () => ({
      titolo: L("Quali notizie vuoi?", "Which news do you want?"),
      testo: L("Scegli le sezioni. Quelle che lasci spente non le vedrai, né in Notizie né in Per te. Potrai cambiarle quando vuoi, in Il tuo Radar → Temi.", "Pick the sections. The ones you leave off won't show up, in News or in For you. You can change them any time, in Your Radar → Topics."),
      contenuto: h("div", { class: "scelte" }, Object.entries(GRUPPI_TEMI()).map(([k, nome]) =>
        sceltaMultipla(nome, scelta.sezioni.has(k), (on) => { on ? scelta.sezioni.add(k) : scelta.sezioni.delete(k); aggiornaBottone(); }))),
      avanti: L("Continua", "Continue"),
      pronto: () => scelta.sezioni.size > 0,
      manca: L("Scegline almeno una", "Pick at least one"),
    }),
    () => ({
      titolo: L("Cosa ti interessa?", "What are you interested in?"),
      testo: L("Scegli i temi: le notizie che ne parlano finiranno in cima. Potrai cambiarli quando vuoi.", "Pick your topics: stories about them go to the top. You can change them any time."),
      contenuto: h("div", {}, Object.entries(GRUPPI_TEMI()).filter(([g]) => scelta.sezioni.has(g)).map(([g, nome]) => [
        h("div", { class: "bv-gruppo" }, nome),
        h("div", { class: "scelte" }, S.dati.temi.filter((t) => t.gruppo === g).map(loc).map((t) =>
          sceltaMultipla(t.nome, scelta.temi.has(t.id), (on) => { on ? scelta.temi.add(t.id) : scelta.temi.delete(t.id); aggiornaBottone(); }))),
      ])),
      avanti: L("Continua", "Continue"),
      pronto: () => temiVisti().length > 0,
      manca: L("Scegline almeno uno", "Pick at least one"),
    }),
    () => ({
      titolo: L("Quali mercati segui?", "Which markets do you follow?"),
      testo: L("Ti mostriamo prezzo e andamento di quelli che accendi. Alcuni sono già scelti: togli e aggiungi come vuoi.", "We show the price and trend of the ones you turn on. Some are already selected: remove and add as you like."),
      contenuto: h("div", {}, CATEGORIE_MERCATI.map((cat) => {
        const voci = catalogo().filter((m) => m.categoria === cat).map(loc);
        return voci.length ? [h("div", { class: "bv-gruppo" }, nomeCategoria(cat)), h("div", { class: "scelte" }, voci.map((m) =>
          sceltaMultipla(m.nome, scelta.mercati.has(m.simbolo), (on) => { on ? scelta.mercati.add(m.simbolo) : scelta.mercati.delete(m.simbolo); aggiornaBottone(); })))] : null;
      })),
      avanti: L("Continua", "Continue"),
      ultimo: () => scelta.mercati.size === 0,
    }),
    () => {
      const opzioni = [[null, L("Nessuno", "None")], ...catalogo().filter((m) => scelta.mercati.has(m.simbolo)).map(loc).map((m) => [m.simbolo, m.nome])];
      if (!opzioni.some(([s]) => s === scelta.mio)) scelta.mio = null;
      const gruppo = h("div", { class: "scelte", role: "radiogroup", "aria-label": L("Mercato in evidenza", "Highlighted market") });
      for (const [s, nome] of opzioni) {
        const b = h("button", { type: "button", class: "scelta premibile", role: "radio", "aria-checked": String(scelta.mio === s) }, icona(s ? "stellaPiena" : "spunta", "spunta"), nome);
        b.addEventListener("click", () => { scelta.mio = s; gruppo.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x === b))); });
        gruppo.append(b);
      }
      return {
        titolo: L("Ce n'è uno che conta di più?", "Is there one that matters most?"),
        testo: L("Quello che guardi per primo, per esempio l'indice o l'ETF in cui investi: lo mettiamo in cima e in evidenza. È facoltativo.", "The one you check first, for example the index or ETF you invest in: we put it at the top, highlighted. It's optional."),
        contenuto: gruppo,
        avanti: L("Fatto", "Done"),
        ultimo: () => true,
      };
    },
  ];

  function aggiornaBottone() {
    const ok = !attuale.pronto || attuale.pronto();
    bAvanti.disabled = !ok;
    bAvanti.textContent = ok ? (attuale.ultimo && attuale.ultimo() ? L("Fatto", "Done") : attuale.avanti) : attuale.manca;
  }

  function mostra(direzione) {
    attuale = passi[passo]();
    const indietro = h("button", { type: "button", class: "bv-indietro premibile", "aria-label": L("Indietro", "Back") }, icona("indietro"));
    indietro.addEventListener("click", () => { passo--; mostra(-1); });
    if (!passo) indietro.style.visibility = "hidden";
    // sulla prima schermata, in alto a destra, l'altra lingua: chi non legge l'italiano la trova prima di dover leggere
    let destra = h("span", { class: "bv-spazio" });
    if (!passo) {
      const altra = lingua() === "it" ? "en" : "it";
      destra = h("button", { type: "button", class: "bv-lingua premibile", lang: altra, "aria-label": altra === "en" ? "Use Radar in English" : "Usa Radar in italiano" }, altra.toUpperCase());
      destra.addEventListener("click", () => { applicaLingua(altra); mostra(0); });
    }
    testa.replaceChildren(indietro,
      h("div", { class: "bv-puntini", "aria-hidden": "true" }, passi.map((_, i) => h("span", { class: i === passo ? "su" : "" }))),
      destra);
    corpo.replaceChildren(...[attuale.sopra, h("h1", { id: "bv-titolo", tabindex: "-1" }, attuale.titolo), h("p", { class: "bv-testo" }, attuale.testo), attuale.contenuto].filter(Boolean));
    corpo.classList.remove("avanti", "indietro");
    void corpo.offsetWidth;
    if (direzione) corpo.classList.add(direzione < 0 ? "indietro" : "avanti");
    box.scrollTop = 0;
    bAvanti = h("button", { type: "button", class: "bottone-primario premibile" });
    bAvanti.addEventListener("click", () => {
      if (bAvanti.disabled) return;
      if (attuale.ultimo && attuale.ultimo()) finisci();
      else { passo++; mostra(1); }
    });
    piede.replaceChildren(...[bAvanti, attuale.secondario].filter(Boolean));
    aggiornaBottone();
    if (direzione) corpo.querySelector("h1").focus({ preventScroll: true });
  }

  // da un secondo dispositivo: si entra e si ritrovano le scelte, senza rifarle
  function mostraAccesso() {
    const indietro = h("button", { type: "button", class: "bv-indietro premibile", "aria-label": L("Indietro", "Back") }, icona("indietro"));
    indietro.addEventListener("click", () => { passo = 0; mostra(-1); });
    testa.replaceChildren(indietro, h("span", {}), h("span", { class: "bv-spazio" }));
    corpo.replaceChildren(
      h("h1", { id: "bv-titolo", tabindex: "-1" }, L("Bentornato", "Welcome back")),
      h("p", { class: "bv-testo" }, L("Entra come la prima volta, con Google o con l'email: ritrovi temi, mercati e salvate.", "Sign in the way you did the first time, with Google or email: your topics, markets and saved stories come back.")),
      formAccesso(() => {
        if (S.profilo.fatto) { compilaTemi(); disegna({ nuova: true }); chiudi(); return; }
        // l'account è nuovo o vuoto: si continua con la presentazione
        scelta.nome = S.profilo.nome;
        passo = 1;
        mostra(1);
      }));
    corpo.classList.remove("avanti", "indietro");
    void corpo.offsetWidth;
    corpo.classList.add("avanti");
    piede.replaceChildren();
    corpo.querySelector("h1").focus({ preventScroll: true });
  }

  function chiudi() {
    S.chiudiBenvenuto = null;
    molla({
      da: 1, a: 0, risposta: 0.35,
      aggiorna: (p) => { box.style.opacity = p; if (!RIDOTTO.matches) box.style.transform = `translate3d(0,${(1 - p) * 2}rem,0)`; },
      fine: () => { box.remove(); document.body.style.overflow = ""; },
    });
  }
  S.chiudiBenvenuto = chiudi;

  function finisci() {
    const vecchi = S.profilo.temi || {};
    S.profilo.nome = scelta.nome.trim();
    S.profilo.temi = Object.fromEntries([...scelta.temi].map((id) => [id, vecchi[id] || 2]));
    S.profilo.mercati = catalogo().map((m) => m.simbolo).filter((s) => scelta.mercati.has(s));
    S.profilo.mio = scelta.mio && scelta.mercati.has(scelta.mio) ? scelta.mio : null;
    S.profilo.paesi = Object.fromEntries(PAESI().map(([k]) => [k, scelta.paesi.has(k)]));
    S.profilo.sezioni = Object.fromEntries(Object.keys(SEZIONI()).map((k) => [k, scelta.sezioni.has(k)]));
    S.profilo.fatto = true;
    salvaProfilo();
    compilaTemi();
    disegna({ nuova: true });
    chiudi();
  }

  mostra(0);
}

// ---------------------------------------------------------------- account: sincronizzazione

const GRUPPI = ["profilo", "salvate", "lette", "nascoste"];
const SYNC = { corsa: null, timer: 0, ultima: mem.get("ultimaSync", 0), errore: "", box: null };

function adotta(g, v) {
  // la lingua dell'app: se l'account non ne ha ancora scelta una, resta quella di questo dispositivo
  if (g === "profilo") S.profilo = { ...normalizza(v), interfaccia: (v && v.interfaccia) || S.profilo?.interfaccia || null };
  else if (g === "nascoste") S.nascoste = new Set(Array.isArray(v) ? v : []);
  else S[g] = Array.isArray(v) ? v : [];
}
function salvaTuttoQui() {
  mem.set("profilo", S.profilo);
  mem.set("salvate", S.salvate);
  mem.set("lette", S.lette);
  mem.set("nascoste", [...S.nascoste].slice(-1500));
  mem.set("tempi", S.tempi);
}
const unisciPerId = (a, b, max) => {
  const visti = new Set(), out = [];
  for (const x of [...a, ...b]) if (x && !visti.has(x.id)) { visti.add(x.id); out.push(x); }
  return out.slice(0, max);
};

// legge la riga dell'account, prende quello che è più nuovo là, manda quello che è più nuovo qui
function sincronizza() {
  if (!conto.utente()) return Promise.resolve();
  if (SYNC.corsa) return SYNC.corsa;
  SYNC.corsa = (async () => {
    try {
      const u = conto.utente();
      const remoto = await conto.leggiDati();
      const tr = (remoto && remoto.tempi) || {};
      let cambiatoQui = false, daMandare = !remoto;
      if (remoto && mem.get("collegato", null) !== u.id) {
        // primo accesso su questo dispositivo: si unisce, non si perde niente di quello che c'era qui
        S.salvate = unisciPerId(remoto.salvate || [], S.salvate, 500);
        S.lette = unisciPerId(remoto.lette || [], S.lette, 300);
        S.nascoste = new Set([...(remoto.nascoste || []), ...S.nascoste]);
        if (remoto.profilo && remoto.profilo.fatto) { adotta("profilo", remoto.profilo); S.tempi.profilo = tr.profilo || Date.now(); }
        const ora = Date.now();
        for (const g of ["salvate", "lette", "nascoste"]) S.tempi[g] = ora;
        cambiatoQui = daMandare = true;
      } else if (remoto) {
        for (const g of GRUPPI) {
          const r = tr[g] || 0, l = S.tempi[g] || 0;
          if (r > l) { adotta(g, remoto[g]); S.tempi[g] = r; cambiatoQui = true; }
          else if (l > r) daMandare = true;
        }
      }
      if (daMandare) {
        const ora = Date.now();
        for (const g of GRUPPI) if (!S.tempi[g]) S.tempi[g] = ora;
      }
      if (cambiatoQui || daMandare) salvaTuttoQui();
      if (daMandare) await conto.scriviDati({ profilo: S.profilo, salvate: S.salvate, lette: S.lette, nascoste: [...S.nascoste].slice(-1500), tempi: S.tempi });
      mem.set("collegato", u.id);
      SYNC.ultima = Date.now();
      mem.set("ultimaSync", SYNC.ultima);
      SYNC.errore = "";
      if (cambiatoQui && S.profilo.interfaccia && S.profilo.interfaccia !== lingua()) { impostaLingua(S.profilo.interfaccia); traduciGuscio(); }
      if (cambiatoQui && S.dati) {
        completaSalvate();
        compilaTemi();
        aggiornaPallino();
        if (!F.aperto && !$(".benvenuto")) disegna();
      }
    } catch (e) {
      SYNC.errore = e.message;
    } finally {
      SYNC.corsa = null;
      aggiornaStatoSync();
    }
  })();
  return SYNC.corsa;
}
function programmaSync() {
  if (!conto.utente()) return;
  clearTimeout(SYNC.timer);
  SYNC.timer = setTimeout(() => { SYNC.timer = 0; sincronizza(); }, 1500);
}
function testoSync() {
  if (SYNC.corsa) return L("Sincronizzo…", "Syncing…");
  if (SYNC.errore) return L(`Non sincronizzato: ${SYNC.errore}`, `Not synced: ${SYNC.errore}`);
  if (!SYNC.ultima) return L("Non ancora sincronizzato", "Not synced yet");
  return L(`Sincronizzato ${quandoFrase(SYNC.ultima)}`, `Synced ${quandoFrase(SYNC.ultima)}`);
}
function aggiornaStatoSync() {
  const el = $("#stato-sync");
  if (el) el.textContent = testoSync();
}
// se l'utente entra o esce (anche da un'altra scheda del foglio), il riquadro dell'account si ridisegna
let utenteVisto = conto.utente()?.id || null;
conto.alCambio((u) => {
  if (SYNC.box && SYNC.box.isConnected) SYNC.box.replaceChildren(pannelloConto());
  const id = u ? u.id : null;
  if (id && id !== utenteVisto) sincronizza().then(chiudiBenvenutoSeFatto);   // appena entrato (anche da un'altra scheda)
  utenteVisto = id;
});
// entrando da un secondo dispositivo la presentazione non serve più: le scelte arrivano dall'account
function chiudiBenvenutoSeFatto() {
  if (S.profilo.fatto && S.chiudiBenvenuto) { compilaTemi(); disegna({ nuova: true }); S.chiudiBenvenuto(); }
}

// la G di Google, come la vogliono le loro regole per i pulsanti di accesso
function logoGoogle() {
  const s = h("span", { "aria-hidden": "true", style: "display:contents" });
  s.innerHTML = '<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
  return s;
}

// Google, oppure email → codice → dentro. alEntrato viene chiamato dopo la prima sincronizzazione
// (con Google si esce dalla pagina e si torna già dentro: lì pensa conto.alCambio).
function formAccesso(alEntrato) {
  const box = h("div", { class: "accesso" });
  let email = mem.get("ultimaEmail", "");
  const messaggio = () => h("p", { class: "messaggio", role: "status", "aria-live": "polite" });

  const passoEmail = () => {
    const campo = h("input", { type: "email", class: "campo riquadro", placeholder: L("La tua email", "Your email"), value: email, autocomplete: "email", inputmode: "email", enterkeyhint: "send", "aria-label": L("La tua email", "Your email") });
    const msg = messaggio();
    const MANDA = L("Mandami il codice", "Send me the code");
    const b = h("button", { type: "button", class: "bottone-primario premibile" }, MANDA);
    const invia = async () => {
      email = campo.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = L("Scrivi un indirizzo email valido.", "Enter a valid email address."); return; }
      b.disabled = true; b.textContent = L("Invio…", "Sending…"); msg.textContent = "";
      try {
        await conto.inviaCodice(email);
        mem.set("ultimaEmail", email);
        passoCodice();
      } catch (e) {
        msg.textContent = e.message;
        b.disabled = false; b.textContent = MANDA;
      }
    };
    b.addEventListener("click", invia);
    campo.addEventListener("keydown", (e) => { if (e.key === "Enter") invia(); });
    const privacy = h("a", { href: L("privacy.html", "privacy-en.html"), target: "_blank" }, L("informativa sulla privacy", "privacy notice"));
    const consenso = h("p", { class: "consenso" }, L("Entrando accetti l'", "By signing in you accept the "), privacy, ".");
    box.replaceChildren(campo, b, msg, consenso);
    conto.googleDisponibile().then((si) => {
      if (!si || campo.parentNode !== box) return;   // nel frattempo si è passati al codice
      const g = h("button", { type: "button", class: "bottone-google premibile" }, logoGoogle(), L("Continua con Google", "Continue with Google"));
      // nell'app sulla Home Google può aprirsi in una finestra a parte: si aspetta che lì si confermi (vedi conto.attendiGoogle)
      const aspetta = () => {
        msg.textContent = L("Finisci l'accesso nella finestra di Google. Se ti chiede di confermare, tocca «Sì, entra nell'app» e poi chiudi la finestra: qui entri da solo.", "Finish signing in in the Google window. If it asks you to confirm, tap “Yes, sign in to the app”, then close that window: you'll be signed in here.");
        conto.attendiGoogle()
          .then((u) => {
            if (u) mostraAvviso(T.accessoFatto());
            else if (g.isConnected) { g.disabled = false; msg.textContent = ""; }   // scaduta o annullata
          })
          .catch((e) => { msg.textContent = e.message; g.disabled = false; });
      };
      g.addEventListener("click", async () => {
        g.disabled = true; msg.textContent = "";
        try {
          await conto.conGoogle();
          if (conto.nellAppHome()) aspetta();
        } catch (e) { msg.textContent = e.message; g.disabled = false; }
      });
      box.prepend(g, h("div", { class: "oppure" }, L("oppure con un codice via email", "or with a code by email")));
      if (conto.googleInAttesa()) { g.disabled = true; aspetta(); }   // il form si è ridisegnato mentre si aspettava
    });
  };

  const passoCodice = () => {
    const campo = h("input", { type: "text", class: "campo riquadro codice", placeholder: L("Codice", "Code"), inputmode: "numeric", autocomplete: "one-time-code", maxlength: "10", enterkeyhint: "go", "aria-label": L("Codice ricevuto via email", "Code received by email") });
    const msg = messaggio();
    const ENTRA = L("Entra", "Sign in");
    const b = h("button", { type: "button", class: "bottone-primario premibile" }, ENTRA);
    const entra = async () => {
      const codice = campo.value.replace(/\D/g, "");
      if (codice.length < 6) { msg.textContent = L("Il codice è di almeno 6 cifre: lo trovi nella mail.", "The code has at least 6 digits: you'll find it in the email."); return; }
      b.disabled = true; b.textContent = L("Controllo…", "Checking…"); msg.textContent = "";
      try {
        await conto.verificaCodice(email, codice);
        await sincronizza();
        alEntrato && alEntrato();
      } catch (e) {
        msg.textContent = e.message;
        b.disabled = false; b.textContent = ENTRA;
      }
    };
    b.addEventListener("click", entra);
    campo.addEventListener("keydown", (e) => { if (e.key === "Enter") entra(); });
    const cambia = h("button", { type: "button", class: "bottone-testo premibile" }, L("Cambia email", "Change email"));
    cambia.addEventListener("click", passoEmail);
    const rimanda = h("button", { type: "button", class: "bottone-testo premibile" }, L("Mandamene un altro", "Send another one"));
    rimanda.addEventListener("click", async () => {
      try { await conto.inviaCodice(email); msg.textContent = L("Ti abbiamo mandato un codice nuovo.", "We've sent you a new code."); } catch (e) { msg.textContent = e.message; }
    });
    box.replaceChildren(
      h("p", { class: "nota stretta" }, L(`Ti abbiamo scritto a ${email}. Apri la mail su questo dispositivo e tocca il link: torni qui già dentro. Se nella mail c'è un codice, puoi anche scriverlo qui sotto. Non la trovi? Guarda nello spam.`, `We've emailed ${email}. Open the email on this device and tap the link: you'll come back here signed in. If the email has a code, you can also type it below. Can't find it? Check your spam folder.`)),
      campo, b, msg, h("div", { class: "riga-bottoni" }, cambia, rimanda));
    campo.focus({ preventScroll: true });
  };

  passoEmail();
  return box;
}

function pannelloConto() {
  const u = conto.utente();
  if (!u) {
    return h("div", {},
      h("p", { class: "nota stretta" }, L("Facoltativo. Con un account ritrovi temi, mercati e salvate su tutti i tuoi dispositivi. Niente password: entri con Google o con un codice via email.", "Optional. With an account your topics, markets and saved stories are on all your devices. No password: sign in with Google or with a code by email.")),
      formAccesso(() => mostraAvviso(T.accessoFatto())));
  }
  const riga = (testo, azione, classe = "riga-link") => {
    const b = h("button", { type: "button", class: `${classe} premibile` }, testo, classe === "riga-link" ? icona("freccia", "freccia") : null);
    b.addEventListener("click", azione);
    return b;
  };
  const ETICHETTA = L("Elimina l'account", "Delete account");
  let conferma = 0;
  const elimina = h("button", { type: "button", class: "bottone-pericolo premibile" }, ETICHETTA);
  elimina.addEventListener("click", async () => {
    if (!conferma) {
      elimina.textContent = L("Tocca di nuovo: cancella l'account e i dati sul server", "Tap again: delete the account and the data on the server");
      conferma = setTimeout(() => { conferma = 0; elimina.textContent = ETICHETTA; }, 4000);
      return;
    }
    clearTimeout(conferma);
    elimina.disabled = true;
    elimina.textContent = L("Elimino…", "Deleting…");
    try {
      await conto.eliminaAccount();   // le iscrizioni sul server spariscono con l'account
      spegniNotifiche();
      mem.set("collegato", null);
      mostraAvviso(L("Account eliminato. Su questo dispositivo le scelte restano.", "Account deleted. Your choices stay on this device."));
    } catch (e) {
      elimina.disabled = false;
      elimina.textContent = ETICHETTA;
      mostraAvviso(e.message);
    }
  });
  return h("div", {},
    h("div", { class: "gruppo" },
      h("div", { class: "riga-tema" }, h("div", { class: "info" }, h("div", { class: "nome" }, u.email), h("div", { class: "parole", id: "stato-sync" }, testoSync()))),
      riga(L("Sincronizza adesso", "Sync now"), () => { const p = sincronizza(); aggiornaStatoSync(); p.then(() => mostraAvviso(SYNC.errore ? SYNC.errore : L("Tutto sincronizzato", "All synced"))); }),
      riga(L("Scarica i miei dati", "Download my data"), scaricaDati),
      riga(L("Esci", "Sign out"), async () => {
        await spegniNotifiche();   // un dispositivo senza account non riceve le notifiche di quell'account
        await conto.esci();
        mem.set("collegato", null);
        mostraAvviso(L("Sei uscito. Le scelte restano su questo dispositivo.", "Signed out. Your choices stay on this device."));
      })),
    elimina);
}

function scaricaDati() {
  const dati = { app: "Radar", esportato: new Date().toISOString(), email: conto.utente()?.email || null, profilo: S.profilo, salvate: S.salvate, lette: S.lette, nascoste: [...S.nascoste] };
  const url = URL.createObjectURL(new Blob([JSON.stringify(dati, null, 2)], { type: "application/json" }));
  const a = h("a", { href: url, download: `radar-miei-dati-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ---------------------------------------------------------------- lingua dell'app

// i testi fissi di index.html (barra delle sezioni, pulsanti in alto, foglio, avviso)
function traduciGuscio() {
  const tab = { "per-te": L("Per te", "For you"), notizie: L("Notizie", "News"), mercati: L("Mercati", "Markets"), agenda: L("Agenda", "Calendar"), salvate: L("Salvate", "Saved") };
  document.querySelectorAll(".tab").forEach((t) => { const s = t.querySelector("span"); if (s && tab[t.dataset.vista]) s.textContent = tab[t.dataset.vista]; });
  $(".tabbar").setAttribute("aria-label", L("Sezioni", "Sections"));
  const etichette = {
    "#apri-profilo": [L("Il tuo Radar: temi, mercati e impostazioni", "Your Radar: topics, markets and settings"), L("Il tuo Radar", "Your Radar")],
    "#apri-glossario": [L("Glossario", "Glossary")],
    "#aggiorna": [L("Aggiorna", "Refresh")],
    "#chiudi-foglio": [L("Chiudi", "Close"), null],
  };
  for (const [sel, [aria, titolo]] of Object.entries(etichette)) {
    const el = $(sel);
    if (!el) continue;
    el.setAttribute("aria-label", aria);
    if (titolo !== null) el.setAttribute("title", titolo ?? aria);
  }
  $("#avviso-azione").textContent = L("Annulla", "Undo");
  etichettaLaterale();
  document.querySelector('meta[name="description"]')?.setAttribute("content", L("Finanza, economia, AI, tecnologia e scienza: le notizie che contano, scelte per te.", "Finance, the economy, AI, tech and science: the news that matters, picked for you."));
}

// cambia lingua subito, senza ricaricare: guscio, temi, vista sotto e, se era aperto, il foglio del profilo
function applicaLingua(l, riapriProfilo) {
  if (l === lingua() && S.profilo.interfaccia === l) return;
  S.profilo.interfaccia = l;
  salvaProfilo();
  impostaLingua(l);
  traduciGuscio();
  if (!S.dati) return;
  compilaTemi();
  disegna();
  if (riapriProfilo && F.aperto) {
    const sc = $("#foglio-contenuto");
    const dove = sc.scrollTop;
    foglioProfilo(riapriProfilo);
    sc.scrollTop = dove;
  }
}

// ---------------------------------------------------------------- navigazione e intestazione che si compatta

const VISTE = {
  "per-te": [vistaPerTe, () => L("Per te", "For you")], notizie: [vistaNotizie, () => L("Notizie", "News")], mercati: [vistaMercati, () => L("Mercati", "Markets")],
  agenda: [vistaAgenda, () => L("Agenda", "Calendar")], salvate: [vistaSalvate, () => L("Salvate", "Saved")],
};
let osservatore = null;

function disegna({ nuova = false } = {}) {
  const main = $("#vista");
  if (!S.dati) return;
  const [fn, nomeVista] = VISTE[S.vista];
  const titolo = nomeVista();
  main.replaceChildren(...fn());
  $("#barra-titolo").textContent = titolo;
  document.title = S.vista === "per-te" ? "Radar" : `${titolo} · Radar`;
  if (nuova) {
    main.classList.remove("vista-entra");
    void main.offsetWidth;
    main.classList.add("vista-entra");
    window.scrollTo({ top: 0 });
  }
  osservatore?.disconnect();
  const h1 = $("#titolo-vista");
  if (h1) {
    osservatore = new IntersectionObserver(([v]) => $("#barra").classList.toggle("compatta", !v.isIntersecting), { rootMargin: "-48px 0px 0px 0px" });
    osservatore.observe(h1);
  } else $("#barra").classList.remove("compatta");   // Per te non ha il titolo grande
  suggerisciScorrimento();
}

function vai() {
  // arrivo da una notifica: l'indirizzo torna quello della vista, e sopra si apre la notizia
  const daNotifica = /^notizia=(.+)$/.exec(location.hash.slice(1));
  if (daNotifica) history.replaceState(null, "", `${location.pathname}${location.search}#${S.vista}`);
  const nome = location.hash.slice(1);
  const vista = VISTE[nome] ? nome : "per-te";
  const nuova = vista !== S.vista || !$("#vista").childElementCount;
  S.vista = vista;
  document.querySelectorAll(".tab").forEach((t) => (t.dataset.vista === vista ? t.setAttribute("aria-current", "page") : t.removeAttribute("aria-current")));
  disegna({ nuova });
  if (daNotifica && S.dati && S.profilo.fatto) apriDaNotifica(decodeURIComponent(daNotifica[1]));
}
addEventListener("hashchange", vai);

// ---------------------------------------------------------------- barra delle sezioni che si nasconde
// Sul PC (barra laterale): il pulsante in alto a sinistra, o Ctrl+B, la chiude e la riapre; la scelta resta.
// Sul telefono (barra in basso): si fa da parte mentre scorri giù e torna appena risali.

const LARGO = matchMedia("(min-width: 64rem)");
const radice = document.documentElement;
const bLaterale = h("button", { type: "button", class: "tondo premibile solo-largo", id: "apri-laterale", "aria-controls": "sezioni" }, icona("laterale"));
$(".barra-sx").append(bLaterale);

function etichettaLaterale() {
  const chiusa = radice.classList.contains("senza-laterale");
  const testo = chiusa ? L("Mostra le sezioni", "Show sections") : L("Nascondi le sezioni", "Hide sections");
  bLaterale.setAttribute("aria-label", testo);
  bLaterale.setAttribute("title", `${testo} (Ctrl+B)`);
  bLaterale.setAttribute("aria-expanded", String(!chiusa));
}
function statoBarra() {
  // la barra fuori schermo non deve prendere il tab della tastiera né i tocchi
  const via = LARGO.matches ? radice.classList.contains("senza-laterale") : radice.classList.contains("tabbar-via");
  $(".tabbar").inert = via;
}
function laterale(chiusa) {
  radice.classList.add("anima-laterale");   // anima solo quando la cambi tu, non all'apertura della pagina
  radice.classList.toggle("senza-laterale", chiusa);
  mem.set("lateraleChiusa", chiusa);
  etichettaLaterale();
  statoBarra();
}
bLaterale.addEventListener("click", () => laterale(!radice.classList.contains("senza-laterale")));
addEventListener("keydown", (e) => {
  if (!LARGO.matches || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "b") return;
  if (e.target.closest?.("input, textarea, [contenteditable]")) return;
  e.preventDefault();
  laterale(!radice.classList.contains("senza-laterale"));
});
LARGO.addEventListener("change", () => { radice.classList.remove("tabbar-via"); statoBarra(); });

let ultimoY = scrollY;
addEventListener("scroll", () => {
  $("#barra").classList.toggle("sopra", scrollY > 4);
  if (LARGO.matches) return;
  const y = scrollY;
  const inFondo = innerHeight + y >= document.documentElement.scrollHeight - 4;
  if (y < 60 || inFondo) radice.classList.remove("tabbar-via");
  else if (y > ultimoY + 6) radice.classList.add("tabbar-via");
  else if (y < ultimoY - 6) radice.classList.remove("tabbar-via");
  else return;   // movimenti piccoli: non cambia niente e non sposta il riferimento
  ultimoY = y;
  statoBarra();
}, { passive: true });
etichettaLaterale();
statoBarra();

// ---------------------------------------------------------------- dati

async function carica({ manuale = false } = {}) {
  const bottone = $("#aggiorna");
  bottone.classList.add("gira");
  try {
    const r = await fetch(`dati.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const dati = await r.json();
    // le serie arrivano in giorni dal 1970 (file più leggero): qui tornano millisecondi
    for (const m of dati.mercati) m.serie = m.serie.map(([t, c]) => [t < 1e7 ? t * 864e5 : t, c]);
    const nuove = S.dati ? dati.notizie.filter((n) => !S.dati.notizie.some((x) => x.id === n.id)).length : 0;
    S.dati = dati;
    S.caricato = Date.now();
    completaSalvate();
    compilaTemi();
    compilaGlossario();
    vai();
    rinfrescaNotifiche();
    if (!S.profilo.fatto) benvenuto();
    if (conto.utente() && Date.now() - SYNC.ultima > 60e3) sincronizza();
    if (manuale) mostraAvviso(nuove ? L(nuove === 1 ? "1 notizia nuova" : `${nuove} notizie nuove`, nuove === 1 ? "1 new story" : `${nuove} new stories`) : L("Già tutto aggiornato", "Already up to date"));
  } catch (err) {
    if (!S.dati) {
      $("#vista").replaceChildren(intestazione("Radar"), h("div", { class: "vuoto" }, icona("calma"), h("strong", {}, L("Non riesco a caricare le notizie", "Can't load the news")), L("Controlla la connessione e premi Aggiorna in alto.", "Check your connection and tap Refresh at the top.")));
    } else if (manuale) mostraAvviso(L("Sei offline: restano le notizie di prima", "You're offline: showing the earlier stories"));
  } finally {
    bottone.classList.remove("gira");
  }
}

$("#aggiorna").addEventListener("click", () => carica({ manuale: true }));
$("#apri-glossario").addEventListener("click", () => S.dati && foglioGlossario());
$("#apri-profilo").addEventListener("click", () => S.dati && foglioProfilo());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") {
    // l'app va in secondo piano: una modifica in attesa parte subito, prima che il telefono la sospenda
    if (SYNC.timer && conto.utente()) { clearTimeout(SYNC.timer); SYNC.timer = 0; sincronizza(); }
    return;
  }
  if (Date.now() - S.caricato > 20 * 6e4) carica();
  else if (conto.utente() && Date.now() - SYNC.ultima > 60e3) sincronizza();
});

traduciGuscio();
$("#vista").replaceChildren(intestazione(" "), h("div", { class: "lista" }, [0, 1, 2, 3].map(() => h("div", { class: "scheletro" }))));
aggiornaPallino();

// La finestra a parte che iOS apre per Google dall'app sulla Home: qui si conferma e basta, l'app vera è l'altra.
// Chiedere conferma serve contro chi manda un link di accesso già preparato: senza "Sì" il codice non passa.
function schermataPassaggio(codice) {
  document.querySelector(".tabbar")?.setAttribute("hidden", "");
  for (const id of ["#apri-profilo", "#apri-glossario", "#aggiorna", "#apri-laterale"]) $(id).hidden = true;
  const msg = h("p", { class: "messaggio", role: "status", "aria-live": "polite" });
  const si = h("button", { type: "button", class: "bottone-primario premibile" }, L("Sì, entra nell'app", "Yes, sign in to the app"));
  const box = h("div", { class: "accesso" },
    h("p", { class: "nota stretta" }, L("Hai appena toccato «Continua con Google» nel Radar sulla schermata Home di questo dispositivo? Conferma solo in quel caso.", "Did you just tap “Continue with Google” in Radar on this device's Home Screen? Confirm only if you did.")),
    si, msg);
  si.addEventListener("click", async () => {
    si.disabled = true; msg.textContent = "";
    try {
      await conto.passaGoogle(codice);
      box.replaceChildren(h("div", { class: "vuoto" }, icona("calma"), h("strong", {}, L("Fatto", "Done")),
        L("Chiudi questa finestra (Fine, in alto) e torna al Radar: entri da solo.", "Close this window (Done, at the top) and go back to Radar: you'll be signed in.")));
    } catch (e) { msg.textContent = e.message; si.disabled = false; }
  });
  $("#vista").replaceChildren(intestazione(L("Accesso con Google", "Sign in with Google")), box);
}

const passaggio = conto.passaggioInArrivo();
if (passaggio) schermataPassaggio(passaggio);
else {
  // arrivo dal link della mail di accesso: prima di tutto, così i token spariscono dall'indirizzo
  // (la sincronizzazione parte da sola appena l'utente risulta dentro: vedi conto.alCambio)
  const arrivo = conto.daLink();
  if (arrivo) {
    arrivo
      .then(() => mostraAvviso(T.accessoFatto()))
      .catch((e) => mostraAvviso(e.message));
  }
  // l'app sulla Home è stata riaperta mentre si aspettava Google: si continua ad aspettare
  if (conto.googleInAttesa()) conto.attendiGoogle().then((u) => u && mostraAvviso(T.accessoFatto())).catch((e) => mostraAvviso(e.message));
  carica();
}

if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
