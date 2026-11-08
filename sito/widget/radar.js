// Nodus · widget per iPhone e iPad (app Scriptable, gratis sull'App Store)
// https://buildtech26.github.io/radar/
//
// Come si mette:
//   1. In Scriptable tocca +, incolla tutto questo testo e chiama lo script "Nodus".
//   2. Sulla schermata Home tieni premuto, tocca Modifica → Aggiungi widget → Scriptable, scegli la misura.
//   3. Tieni premuto il widget → Modifica widget → Script: Nodus.
// Sulla schermata di blocco va uguale (Personalizza → widget → Scriptable).
//
// Mostra le notizie principali sul colore della loro sezione, con il logo della testata e il titolo.
// Toccandolo si apre Nodus.
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
const FOTO = FM.joinPath(FM.documentsDirectory(), "radar-widget-foto")   // i loghi (il nome è rimasto da quando c'erano le foto)

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
// per ogni sezione: il nome, il colore del testo (chiaro, scuro), il pieno delle etichette, il fondo sfumato
// quando la notizia non ha una foto, e il simbolo che la rappresenta
const SEZ = {
  finanza: { nome: ["Finanza", "Finance"], testo: C("#248a3d", "#30d158"), pieno: "#248a3d", fondo: ["#34c759", "#145a27"], simbolo: "chart.line.uptrend.xyaxis" },
  economia: { nome: ["Economia", "Economy"], testo: C("#c93400", "#ff9f0a"), pieno: "#e05a00", fondo: ["#ff9f0a", "#a33a00"], simbolo: "building.columns.fill" },
  ai: { nome: ["AI", "AI"], testo: C("#5e5ce6", "#7d7aff"), pieno: "#5e5ce6", fondo: ["#8e8cff", "#3a2fb0"], simbolo: "sparkles" },
  tech: { nome: ["Tech", "Tech"], testo: C("#0071a4", "#64d2ff"), pieno: "#0077b6", fondo: ["#38b6ff", "#004e7a"], simbolo: "cpu" },
  scienza: { nome: ["Scienza", "Science"], testo: C("#d30f45", "#ff6482"), pieno: "#d30f45", fondo: ["#ff5b84", "#8a0a2e"], simbolo: "atom" },
}
const sez = (n) => SEZ[n.sezione] || SEZ.finanza
const BIANCO = Color.white()
const BIANCO2 = new Color("#ffffff", 0.85)

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
  const loghi = Object.fromEntries((d.fonti || []).filter((f) => f.logo).map((f) => [f.nome, f.logo]))
  const gruppi = {}
  for (const v of d.notizie) if (v.data) (gruppi[v.gruppo || v.id] ||= []).push(v)
  const notizie = Object.values(gruppi).map((g) => {
    const v = g.find((x) => x.lingua === "it") || g.reduce((a, b) => (b.data > a.data ? b : a))
    const tr = v.traduzione || {}
    return { ...v, titolo_it: tr.lingua === "it" ? tr.titolo : undefined, testate: g.length,
      immagine: v.immagine || g.find((x) => x.immagine)?.immagine, logo: loghi[v.fonte] }
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

// ------------------------------------------------------------ loghi
// Si scaricano una volta sola e restano sul telefono due settimane, già rimpiccioliti: un widget ha poca memoria
// e poco tempo. Le foto non ci sono più (Mattia, 07/11/2026): quelle rimaste dalle versioni vecchie si cancellano
// da sole dopo tre giorni.
function codice(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(16) + s.length.toString(16)
}

function rimpicciolisci(img, lato) {
  const { width: w, height: h } = img.size
  if (Math.max(w, h) <= lato) return img
  const k = lato / Math.max(w, h)
  const dc = new DrawContext()
  dc.size = new Size(Math.round(w * k), Math.round(h * k))
  dc.respectScreenScale = false
  dc.drawImageInRect(img, new Rect(0, 0, dc.size.width, dc.size.height))
  return dc.getImage()
}

async function logo(url) {
  if (!url) return null
  const file = FM.joinPath(FOTO, "logo-" + codice(url) + ".png")
  if (FM.fileExists(file)) {
    try { return Image.fromFile(file) } catch (e) {}
  }
  try {
    const r = new Request(url)
    r.timeoutInterval = 8
    const img = rimpicciolisci(await r.loadImage(), 96)
    FM.write(file, Data.fromPNG(img))
    return img
  } catch (e) {
    return null
  }
}

function pulisciFoto() {
  if (!FM.fileExists(FOTO)) return FM.createDirectory(FOTO, true)
  for (const f of FM.listContents(FOTO)) {
    const p = FM.joinPath(FOTO, f)
    const giorni = f.startsWith("logo-") ? 14 : 3
    try { if (Date.now() - FM.modificationDate(p).getTime() > giorni * 86400e3) FM.remove(p) } catch (e) {}
  }
}

async function prepara(nn) {   // il logo di ogni notizia, tutti insieme
  await Promise.all(nn.map(async (n) => { n._logo = await logo(n.logo && RADAR + n.logo) }))
}

function sfumatura(n) {
  const g = new LinearGradient()
  g.colors = sez(n).fondo.map((c) => new Color(c))
  g.locations = [0, 1]
  g.startPoint = new Point(0, 0)
  g.endPoint = new Point(1, 1)
  return g
}

// ------------------------------------------------------------ pezzi del widget
function testo(dove, s, font, colore, righe = 1) {
  const t = dove.addText(s)
  t.font = font
  t.textColor = colore
  t.lineLimit = righe
  return t
}
function ombra(t) {
  t.shadowColor = new Color("#000000", 0.45)
  t.shadowRadius = 3
  t.shadowOffset = new Point(0, 1)
  return t
}

// il logo della testata, o la sua iniziale su un quadratino del colore della sezione
function marchio(dove, n, lato) {
  if (n._logo) {
    const i = dove.addImage(n._logo)
    i.imageSize = new Size(lato, lato)
    i.cornerRadius = lato * 0.26
    return
  }
  const s = dove.addStack()
  s.size = new Size(lato, lato)
  s.cornerRadius = lato * 0.26
  s.backgroundColor = new Color(sez(n).pieno)
  s.centerAlignContent()
  testo(s, (n.fonte || "?").trim()[0].toUpperCase(), Font.boldRoundedSystemFont(lato * 0.58), BIANCO)
}

// la riga della testata: logo e nome
function testata(dove, n, { lato, font, colore, conOmbra }) {
  const r = dove.addStack()
  r.centerAlignContent()
  marchio(r, n, lato)
  r.addSpacer(5)
  const t = testo(r, n.fonte, font, colore)
  t.minimumScaleFactor = 0.75
  if (conOmbra) ombra(t)
  r.addSpacer()
  return r
}

// l'etichetta della sezione, chiara sul fondo già colorato
function etichetta(dove, n) {
  const s = dove.addStack()
  s.backgroundColor = new Color("#ffffff", 0.24)
  s.cornerRadius = 5
  s.setPadding(2, 6, 2, 6)
  testo(s, sez(n).nome[IT ? 0 : 1].toUpperCase(), Font.heavySystemFont(9), BIANCO)
  return s
}

// la notizia grande, sul colore della sezione: testata in alto, etichetta e titolo in basso
function copertinaNotizia(dove, n, { righe, font }) {
  dove.backgroundGradient = sfumatura(n)
  testata(dove, n, { lato: 20, font: Font.semiboldSystemFont(11.5), colore: BIANCO2, conOmbra: true })
  dove.addSpacer()
  etichetta(dove, n)
  dove.addSpacer(5)
  const r = dove.addStack()
  const t = ombra(testo(r, titolo(n), font, BIANCO, righe))
  t.minimumScaleFactor = 0.85
  r.addSpacer()
}

// il quadratino a sinistra delle righe: il simbolo della sezione sul suo colore
function miniatura(dove, n, lato) {
  const s = dove.addStack()
  s.size = new Size(lato, lato)
  s.cornerRadius = lato * 0.22
  s.backgroundGradient = sfumatura(n)
  s.centerAlignContent()
  const simbolo = SFSymbol.named(sez(n).simbolo) || SFSymbol.named("newspaper")
  if (simbolo) {
    const i = s.addImage(simbolo.image)
    i.imageSize = new Size(lato * 0.46, lato * 0.46)
    i.tintColor = BIANCO
  }
}

// una riga: miniatura, poi testata (col colore della sezione) e titolo
function riga(dove, n, { lato, font, righe }) {
  const r = dove.addStack()
  r.centerAlignContent()
  miniatura(r, n, lato)
  r.addSpacer(11)
  const c = r.addStack()
  c.layoutVertically()
  testata(c, n, { lato: 14, font: Font.semiboldSystemFont(10.5), colore: sez(n).testo })
  c.addSpacer(3)
  const t = testo(c, titolo(n), font, COL.testo, righe)
  t.minimumScaleFactor = 0.85
  r.addSpacer()
}

function vuoto(w, messaggio, colore = COL.testo2) {
  w.addSpacer()
  testo(w, messaggio, Font.mediumSystemFont(12), colore, 3)
  w.addSpacer()
}

// ------------------------------------------------------------ le misure
// Ogni tocco, in qualunque punto, apre Nodus: è il w.url messo in costruisci().
function piccolo(w, nn) {
  w.setPadding(13, 13, 13, 13)
  copertinaNotizia(w, nn[0], { righe: 4, font: Font.boldSystemFont(15) })
}

function medio(w, nn) {
  w.setPadding(13, 14, 13, 14)
  w.backgroundColor = COL.sfondo
  nn.slice(0, 2).forEach((n, i) => {
    if (i) w.addSpacer(12)
    riga(w, n, { lato: 60, font: Font.semiboldSystemFont(13.5), righe: 3 })
  })
  w.addSpacer()
}

function grande(w, nn) {
  w.setPadding(14, 14, 14, 14)
  w.backgroundColor = COL.sfondo
  const n = nn[0]
  const c = w.addStack()
  c.layoutVertically()
  c.size = new Size(0, 152)
  c.cornerRadius = 16
  c.setPadding(11, 12, 11, 12)
  copertinaNotizia(c, n, { righe: 2, font: Font.boldSystemFont(16) })
  for (const altra of nn.filter((x) => x !== n).slice(0, 3)) {
    w.addSpacer(11)
    riga(w, altra, { lato: 50, font: Font.semiboldSystemFont(13), righe: 2 })
  }
  w.addSpacer()
}

function grandeIpad(w, nn) {   // la misura più grande dell'iPad: copertina a sinistra, quattro righe a destra
  w.setPadding(16, 16, 16, 18)
  w.backgroundColor = COL.sfondo
  const n = nn[0]
  const fila = w.addStack()
  const c = fila.addStack()
  c.layoutVertically()
  c.size = new Size(330, 0)
  c.cornerRadius = 18
  c.setPadding(14, 14, 14, 14)
  copertinaNotizia(c, n, { righe: 4, font: Font.boldSystemFont(19) })
  fila.addSpacer(18)
  const dx = fila.addStack()
  dx.layoutVertically()
  nn.filter((x) => x !== n).slice(0, 4).forEach((altra, i) => {
    if (i) dx.addSpacer(12)
    riga(dx, altra, { lato: 60, font: Font.semiboldSystemFont(14), righe: 2 })
  })
  dx.addSpacer()
}

// schermata di blocco: lì iOS toglie i colori, quindi solo testo
function bloccoRiga(w, nn) {
  const n = nn[0]
  testo(w, n.fonte, Font.mediumSystemFont(11), new Color("#ffffff", 0.7)).minimumScaleFactor = 0.8
  w.addSpacer(2)
  testo(w, titolo(n), Font.semiboldSystemFont(13), BIANCO, 2)
}

function bloccoTondo(w) {
  w.addAccessoryWidgetBackground = true
  const s = w.addStack()
  s.addSpacer()
  const img = s.addImage(SFSymbol.named("newspaper").image)
  img.imageSize = new Size(22, 22)
  img.tintColor = BIANCO
  s.addSpacer()
}

function bloccoLinea(w, nn) {
  testo(w, titolo(nn[0]), Font.mediumSystemFont(12), BIANCO)
}

// ------------------------------------------------------------ via
const QUANTE = { small: 4, medium: 2, large: 5, extraLarge: 6 }

async function costruisci(famiglia) {
  const d = await dati()
  const w = new ListWidget()
  const blocco = famiglia?.startsWith("accessory")
  w.refreshAfterDate = new Date(Date.now() + 30 * 60e3)
  w.url = RADAR
  const nn = d ? scegliNotizie(d, QUANTE[famiglia] || 4) : []
  if (famiglia === "accessoryCircular") return bloccoTondo(w), w
  if (!nn.length) {
    if (!blocco) w.backgroundColor = COL.sfondo
    vuoto(w, d ? T("Nessuna notizia recente", "No recent news") : T("Nodus non raggiungibile: riprovo fra poco.", "Nodus unreachable: retrying soon."),
      blocco ? BIANCO : COL.testo2)
    return w
  }
  if (famiglia === "accessoryRectangular") bloccoRiga(w, nn)
  else if (famiglia === "accessoryInline") bloccoLinea(w, nn)
  else {
    pulisciFoto()
    await prepara(nn)
    if (famiglia === "medium") medio(w, nn)
    else if (famiglia === "large") grande(w, nn)
    else if (famiglia === "extraLarge") grandeIpad(w, nn)
    else piccolo(w, nn)
  }
  return w
}

if (config.runsInWidget) {
  Script.setWidget(await costruisci(config.widgetFamily))
} else {
  // aperto dentro Scriptable: si sceglie quale misura vedere
  const a = new Alert()
  a.title = "Nodus"
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
