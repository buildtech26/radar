// Radar · widget per iPhone e iPad (app Scriptable, gratis sull'App Store)
// https://buildtech26.github.io/radar/
//
// Come si mette:
//   1. In Scriptable tocca +, incolla tutto questo testo e chiama lo script "Radar".
//   2. Sulla schermata Home tieni premuto, tocca Modifica → Aggiungi widget → Scriptable, scegli la misura.
//   3. Tieni premuto il widget → Modifica widget → Script: Radar.
// Sulla schermata di blocco va uguale (Personalizza → widget → Scriptable).
//
// Mostra le notizie principali: per ognuna la testata e il titolo. Toccandola si apre l'articolo.
// Il campo "Parameter" del widget, facoltativo, cambia quali notizie. Esempi:
//   sezioni: finanza, ai          (finanza, economia, ai, tech, scienza; senza, finanza, economia e ai)
//   paesi: it, eu                 (it, eu, us, gb)
//   traduci: no                   (titoli inglesi lasciati in inglese)
// Più cose insieme si separano col punto e virgola: "sezioni: finanza; paesi: it".
//
// Il widget non vede i tuoi temi e le tue scelte dell'account: per quelle c'è l'app.

const PROVA = ""   // per provarlo dentro Scriptable con un parametro, per esempio "sezioni: tech"

const RADAR = "https://buildtech26.github.io/radar/"
const FM = FileManager.local()
const CACHE = FM.joinPath(FM.documentsDirectory(), "radar-widget.json")

// ------------------------------------------------------------ scelte
const P = leggiParametro((args.widgetParameter ?? PROVA) || "")
const IT = (P.lingua || Device.language() || "it").toLowerCase().startsWith("it")
const T = (it, en) => (IT ? it : en)

function leggiParametro(testo) {
  const p = {}
  for (const pezzo of testo.split(/[;\n]/)) {
    const m = pezzo.match(/^\s*([a-zà-ù]+)\s*[:=]\s*(.*)$/i)
    if (m) p[m[1].toLowerCase()] = m[2].trim()
  }
  return p
}
const lista = (s) => (s || "").split(",").map((x) => x.trim()).filter(Boolean)
const piano = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "")

const SEZIONI = { finanza: "finanza", finance: "finanza", economia: "economia", economy: "economia", economics: "economia",
  ai: "ai", ia: "ai", tech: "tech", tecnologia: "tech", technology: "tech", scienza: "scienza", science: "scienza" }
const PAESI = { italia: "it", italy: "it", europa: "eu", europe: "eu", ue: "eu", usa: "us", statiuniti: "us",
  uk: "gb", regnounito: "gb", inghilterra: "gb", britain: "gb" }
const sezioni = lista(P.sezioni).map((s) => SEZIONI[piano(s)]).filter(Boolean)
const paesi = lista(P.paesi).map((s) => PAESI[piano(s)] || piano(s))
const traduci = IT && !/^(no|off|0)$/i.test(P.traduci || "")

// ------------------------------------------------------------ colori dell'app (chiaro, scuro)
const C = (chiaro, scuro) => Color.dynamic(new Color(chiaro), new Color(scuro))
const COL = { sfondo: C("#ffffff", "#1c1c1e"), testo: C("#1d1d1f", "#f5f5f7"), testo2: C("#66666b", "#a1a1a6") }

// ------------------------------------------------------------ dati
async function scarica(url) {
  const r = new Request(url + "?v=" + Math.floor(Date.now() / 300000))   // aggira le copie vecchie
  r.timeoutInterval = 20
  const testo = await r.loadString()
  if (r.response.statusCode !== 200) throw new Error("HTTP " + r.response.statusCode)
  return JSON.parse(testo)
}

// dati.json (quello completo dell'app) ridotto come widget.json: serve solo se widget.json non risponde
function riduci(d) {
  const gruppi = {}
  for (const v of d.notizie) if (v.data) (gruppi[v.gruppo || v.id] ||= []).push(v)
  const notizie = Object.values(gruppi).map((g) => {
    const v = g.find((x) => x.lingua === "it") || g.reduce((a, b) => (b.data > a.data ? b : a))
    const tr = v.traduzione || {}
    return { ...v, titolo_it: tr.lingua === "it" ? tr.titolo : undefined, testate: g.length }
  })
  return { aggiornato: d.aggiornato, notizie }
}

async function dati() {
  try {
    let d
    try { d = await scarica(RADAR + "widget.json") }
    catch (e) { d = riduci(await scarica(RADAR + "dati.json")) }
    FM.writeString(CACHE, JSON.stringify(d))
    return d
  } catch (e) {
    return FM.fileExists(CACHE) ? JSON.parse(FM.readString(CACHE)) : null   // senza rete: gli ultimi dati
  }
}

function scegliNotizie(d, quante) {
  const adesso = Date.now()
  const valide = d.notizie.filter((n) =>
    (sezioni.length ? sezioni.includes(n.sezione) : ["finanza", "economia", "ai"].includes(n.sezione)) &&
    (!paesi.length || paesi.includes(n.paese)) && adesso - n.data < 48 * 3600e3)
  // le più recenti, ma un fatto ripreso da più testate sale di un paio d'ore per testata
  const punti = (n) => n.data + Math.min((n.testate || 1) - 1, 4) * 2 * 3600e3
  return valide.sort((a, b) => punti(b) - punti(a)).slice(0, quante)
}

const titolo = (n) => (traduci && n.lingua !== "it" && n.titolo_it ? n.titolo_it : n.titolo)

// ------------------------------------------------------------ pezzi del widget
function testo(dove, s, font, colore, righe = 1) {
  const t = dove.addText(s)
  t.font = font
  t.textColor = colore
  t.lineLimit = righe
  return t
}

// una notizia: la testata sopra, piccola, e il titolo sotto
function notizia(dove, n, { titoloFont, fonteFont, righe, colori = COL }) {
  const s = dove.addStack()
  s.layoutVertically()
  s.url = n.link
  testo(s, n.fonte, fonteFont, colori.testo2).minimumScaleFactor = 0.8
  s.addSpacer(2)
  testo(s, titolo(n), titoloFont, colori.testo, righe)
  return s
}

function colonna(dove, nn, quante, stile, spazio) {
  nn.slice(0, quante).forEach((n, i) => {
    if (i) dove.addSpacer(spazio)
    notizia(dove, n, stile)
  })
}

function vuoto(w, messaggio, colore = COL.testo2) {
  w.addSpacer()
  testo(w, messaggio, Font.mediumSystemFont(12), colore, 3)
  w.addSpacer()
}

// ------------------------------------------------------------ le misure
const MEDIO = { titoloFont: Font.semiboldSystemFont(14), fonteFont: Font.mediumSystemFont(11), righe: 3 }
const GRANDE = { titoloFont: Font.semiboldSystemFont(15), fonteFont: Font.mediumSystemFont(11.5), righe: 2 }

function piccolo(w, nn) {
  w.setPadding(14, 14, 14, 14)
  w.url = nn[0].link
  notizia(w, nn[0], { titoloFont: Font.semiboldSystemFont(15), fonteFont: Font.mediumSystemFont(11), righe: 6 })
  w.addSpacer()
}

function medio(w, nn) {
  w.setPadding(14, 16, 14, 16)
  colonna(w, nn, 2, MEDIO, 10)
  w.addSpacer()
}

function grande(w, nn) {
  w.setPadding(16, 16, 16, 16)
  colonna(w, nn, 5, GRANDE, 12)
  w.addSpacer()
}

function grandeIpad(w, nn) {   // la misura più grande dell'iPad: due colonne da cinque
  w.setPadding(16, 18, 16, 18)
  const righe = w.addStack()
  righe.topAlignContent()
  for (const k of [0, 1]) {
    if (k) righe.addSpacer(20)
    const c = righe.addStack()
    c.layoutVertically()
    colonna(c, nn.slice(k * 5), 5, GRANDE, 12)
    c.addSpacer()
  }
  w.addSpacer()
}

const BIANCO = { testo: Color.white(), testo2: new Color("#ffffff", 0.7) }

function bloccoRiga(w, nn) {   // schermata di blocco, rettangolo
  w.url = nn[0].link
  notizia(w, nn[0], { titoloFont: Font.semiboldSystemFont(13), fonteFont: Font.mediumSystemFont(11), righe: 2, colori: BIANCO })
}

function bloccoTondo(w) {
  w.addAccessoryWidgetBackground = true
  w.url = RADAR
  const s = w.addStack()
  s.addSpacer()
  const img = s.addImage(SFSymbol.named("newspaper").image)
  img.imageSize = new Size(22, 22)
  img.tintColor = Color.white()
  s.addSpacer()
}

function bloccoLinea(w, nn) {
  w.url = nn[0].link
  testo(w, titolo(nn[0]), Font.mediumSystemFont(12), Color.white())
}

// ------------------------------------------------------------ via
async function costruisci(famiglia) {
  const d = await dati()
  const w = new ListWidget()
  const blocco = famiglia?.startsWith("accessory")
  if (!blocco) w.backgroundColor = COL.sfondo
  w.refreshAfterDate = new Date(Date.now() + 30 * 60e3)
  w.url = RADAR
  const nn = d ? scegliNotizie(d, 10) : []
  if (famiglia === "accessoryCircular") bloccoTondo(w)
  else if (!nn.length) vuoto(w, d ? T("Nessuna notizia recente", "No recent news") : T("Radar non raggiungibile: riprovo fra poco.", "Radar unreachable: retrying soon."),
    blocco ? Color.white() : COL.testo2)
  else if (famiglia === "accessoryRectangular") bloccoRiga(w, nn)
  else if (famiglia === "accessoryInline") bloccoLinea(w, nn)
  else if (famiglia === "medium") medio(w, nn)
  else if (famiglia === "large") grande(w, nn)
  else if (famiglia === "extraLarge") grandeIpad(w, nn)
  else piccolo(w, nn)
  return w
}

if (config.runsInWidget) {
  Script.setWidget(await costruisci(config.widgetFamily))
} else {
  // aperto dentro Scriptable: si sceglie quale misura vedere
  const a = new Alert()
  a.title = "Radar"
  a.message = T("Quale widget vuoi vedere?", "Which widget do you want to preview?")
  const misure = [["small", T("Piccolo", "Small")], ["medium", T("Medio", "Medium")], ["large", T("Grande", "Large")]]
  misure.forEach(([, nome]) => a.addAction(nome))
  a.addCancelAction(T("Annulla", "Cancel"))
  const i = await a.presentSheet()
  if (i >= 0) {
    const fam = misure[i][0]
    const w = await costruisci(fam)
    await (fam === "small" ? w.presentSmall() : fam === "medium" ? w.presentMedium() : w.presentLarge())
  }
}
Script.complete()
