// Radar · widget per iPhone e iPad (app Scriptable, gratis sull'App Store)
// https://buildtech26.github.io/radar/
//
// Come si mette:
//   1. In Scriptable tocca +, incolla tutto questo testo e chiama lo script "Radar".
//   2. Sulla schermata Home tieni premuto, tocca Modifica → Aggiungi widget → Scriptable, scegli la misura.
//   3. Tieni premuto il widget → Modifica widget → Script: Radar.
// Sulla schermata di blocco va uguale (Personalizza → widget → Scriptable).
//
// Il campo "Parameter" del widget, facoltativo, cambia cosa mostra. Esempi:
//   mercati: FTSE MIB, Bitcoin, Oro
//   sezioni: finanza, ai          (finanza, economia, ai, tech, scienza)
//   paesi: it, eu                 (it, eu, us, gb)
//   mostra: notizie               (per il widget piccolo e quelli della schermata di blocco)
//   traduci: no                   (titoli inglesi lasciati in inglese)
// Più cose insieme si separano col punto e virgola: "mercati: FTSE MIB, Nasdaq; sezioni: finanza".
//
// Il widget non vede i tuoi temi e le tue scelte dell'account: per quelle c'è l'app.
// Non è consulenza finanziaria. Prezzi: BCE, CoinGecko, Yahoo Finance.

const PROVA = ""   // per provarlo dentro Scriptable con un parametro, per esempio "mostra: notizie"

const RADAR = "https://buildtech26.github.io/radar/"
const FM = FileManager.local()
const CACHE = FM.joinPath(FM.documentsDirectory(), "radar-widget.json")

// ------------------------------------------------------------ scelte
const P = leggiParametro((args.widgetParameter ?? PROVA) || "")
const IT = (P.lingua || Device.language() || "it").toLowerCase().startsWith("it")
const LOC = IT ? "it-IT" : "en-GB"
const T = (it, en) => (IT ? it : en)

function leggiParametro(testo) {
  const p = {}
  for (const pezzo of testo.split(/[;\n]/)) {
    const m = pezzo.match(/^\s*([a-zà-ù]+)\s*[:=]\s*(.*)$/i)
    if (m) p[m[1].toLowerCase()] = m[2].trim()
    else if (pezzo.trim()) p.mostra = pezzo.trim().toLowerCase()   // "notizie" da solo
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
const COL = {
  sfondo: C("#ffffff", "#1c1c1e"), testo: C("#1d1d1f", "#f5f5f7"), testo2: C("#66666b", "#a1a1a6"),
  testo3: C("#8a8a8f", "#7c7c80"), sep: C("#e3e3e8", "#38383a"), accento: C("#007aff", "#0a84ff"),
  su: C("#1f8a3c", "#30d158"), giu: C("#d70015", "#ff453a"),
  finanza: C("#248a3d", "#30d158"), economia: C("#c93400", "#ff9f0a"), ai: C("#5e5ce6", "#7d7aff"),
  tech: C("#0071a4", "#64d2ff"), scienza: C("#d30f45", "#ff6482"),
}
// le linee si disegnano come immagini, che non cambiano col tema: tinte che si leggono su tutti e due
const LINEA = { su: new Color("#34c759"), giu: new Color("#ff3b30"), base: new Color("#8e8e93", 0.45) }

// ------------------------------------------------------------ dati
async function scarica(url) {
  const r = new Request(url + "?v=" + Math.floor(Date.now() / 300000))   // aggira le copie vecchie
  r.timeoutInterval = 20
  const testo = await r.loadString()
  if (r.response.statusCode !== 200) throw new Error("HTTP " + r.response.statusCode)
  return JSON.parse(testo)
}

// dati.json (quello completo dell'app) ridotto come widget.json: serve solo se widget.json non c'è ancora
function riduci(d) {
  const gruppi = {}
  for (const v of d.notizie) if (v.data) (gruppi[v.gruppo || v.id] ||= []).push(v)
  const notizie = Object.values(gruppi).map((g) => {
    const v = g.find((x) => x.lingua === "it") || g.reduce((a, b) => (b.data > a.data ? b : a))
    const tr = v.traduzione || {}
    return { ...v, titolo_it: tr.lingua === "it" ? tr.titolo : undefined, testate: g.length }
  })
  const mercati = d.mercati.map((m) => ({ ...m, punti: m.oggi?.punti, riferimento: m.oggi?.riferimento }))
  return { aggiornato: d.aggiornato, notizie, mercati }
}

async function dati() {
  try {
    let d
    try { d = await scarica(RADAR + "widget.json") }
    catch (e) { d = riduci(await scarica(RADAR + "dati.json")) }
    FM.writeString(CACHE, JSON.stringify(d))
    return { d, vecchi: false }
  } catch (e) {
    if (FM.fileExists(CACHE)) return { d: JSON.parse(FM.readString(CACHE)), vecchi: true }
    return { d: null, vecchi: true }
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

function scegliMercati(d, quanti) {
  const voluti = lista(P.mercati)
  if (!voluti.length) return d.mercati.filter((m) => m.predefinito).slice(0, quanti)
  const trovati = []
  for (const v of voluti) {
    const k = piano(v)
    const nomi = (m) => [m.simbolo, m.breve, m.nome, m.en?.nome, m.en?.breve].map(piano)
    const m = d.mercati.find((m) => nomi(m).includes(k)) ||
      (k.length >= 3 && d.mercati.find((m) => nomi(m).some((n) => n && n.startsWith(k))))
    if (m && !trovati.includes(m)) trovati.push(m)
  }
  return trovati.slice(0, quanti)
}

// ------------------------------------------------------------ come si scrivono numeri e ore
// a mano e non con toLocaleString: in italiano quello scrive 6170 senza punto e cambia da un iOS all'altro
function num(x, dec) {
  const [intera, decimali] = Math.abs(x).toFixed(dec).split(".")
  const migliaia = intera.replace(/\B(?=(\d{3})+(?!\d))/g, IT ? "." : ",")
  return (x < 0 ? "−" : "") + migliaia + (decimali ? (IT ? "," : ".") + decimali : "")
}
const SIMBOLI = { EUR: "€", USD: "$", GBP: "£", JPY: "¥", CHF: "CHF" }
function prezzo(m) {
  const p = m.prezzo
  const dec = m.categoria === "Valute" ? 4 : p >= 1000 ? 0 : p >= 1 ? 2 : 4
  const s = num(p, dec)
  if (m.categoria === "Indici" || m.categoria === "Valute") return s
  const sim = SIMBOLI[m.valuta] || m.valuta || ""
  return IT ? `${s} ${sim}` : `${sim}${s}`
}
function variazione(m) {
  const v = m.var_giorno ?? 0
  return (v > 0 ? "+" : v < 0 ? "−" : "") + num(Math.abs(v), 2) + "%"
}
const coloreVar = (m) => ((m.var_giorno ?? 0) > 0 ? COL.su : (m.var_giorno ?? 0) < 0 ? COL.giu : COL.testo2)
const nomeMercato = (m) => (IT ? m.breve : m.en?.breve || m.en?.nome || m.breve)
const titolo = (n) => (traduci && n.lingua !== "it" && n.titolo_it ? n.titolo_it : n.titolo)
function fa(ms) {
  const min = Math.max(1, Math.round((Date.now() - ms) / 60000))
  if (min < 60) return `${min} min`
  const ore = Math.round(min / 60)
  return ore < 24 ? T(`${ore} h`, `${ore}h`) : T(`${Math.round(ore / 24)} g`, `${Math.round(ore / 24)}d`)
}
function ora(ms) {
  const d = new Date(ms), oggi = new Date()
  if (d.toDateString() === oggi.toDateString()) return d.toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" })
  return d.toLocaleDateString(LOC, { day: "numeric", month: "short" })
}

// ------------------------------------------------------------ pezzi del widget
function testo(dove, s, font, colore = COL.testo, righe = 1) {
  const t = dove.addText(s)
  t.font = font
  t.textColor = colore
  t.lineLimit = righe
  return t
}

function intestazione(w, d, vecchi) {
  const r = w.addStack()
  r.centerAlignContent()
  const icona = r.addImage(SFSymbol.named("dot.radiowaves.left.and.right").image)
  icona.imageSize = new Size(13, 13)
  icona.tintColor = COL.accento
  r.addSpacer(4)
  testo(r, "Radar", Font.boldRoundedSystemFont(13), COL.testo)
  r.addSpacer()
  const t = testo(r, (vecchi ? "⚠︎ " : "") + ora(d.aggiornato), Font.mediumSystemFont(11), vecchi ? COL.giu : COL.testo3)
  t.minimumScaleFactor = 0.8
}

function linea(m, larga, alta) {
  const p = m.punti
  if (!p || p.length < 2) return null
  const dc = new DrawContext()
  dc.size = new Size(larga, alta)
  dc.opaque = false
  dc.respectScreenScale = true
  const tutti = m.riferimento ? [...p, m.riferimento] : p
  const min = Math.min(...tutti), max = Math.max(...tutti), campo = max - min || 1
  const y = (v) => alta - 1 - ((v - min) / campo) * (alta - 2)
  if (m.riferimento) {   // la chiusura di ieri, per vedere se si sta sopra o sotto
    const base = new Path()
    base.move(new Point(0, y(m.riferimento)))
    base.addLine(new Point(larga, y(m.riferimento)))
    dc.addPath(base)
    dc.setStrokeColor(LINEA.base)
    dc.setLineWidth(1)
    dc.strokePath()
  }
  const path = new Path()
  p.forEach((v, i) => {
    const pt = new Point((i / (p.length - 1)) * larga, y(v))
    i ? path.addLine(pt) : path.move(pt)
  })
  dc.addPath(path)
  dc.setStrokeColor((m.var_giorno ?? 0) < 0 ? LINEA.giu : LINEA.su)
  dc.setLineWidth(1.6)
  dc.strokePath()
  return dc.getImage()
}

function rigaNotizia(dove, n, grande) {
  const s = dove.addStack()
  s.layoutVertically()
  s.url = n.link
  testo(s, titolo(n), Font.semiboldSystemFont(grande ? 14 : 12.5), COL.testo, 2)
  s.addSpacer(2)
  const meta = s.addStack()
  meta.centerAlignContent()
  testo(meta, "● ", Font.systemFont(8), COL[n.sezione] || COL.testo3)
  const altre = n.testate > 1 ? ` +${n.testate - 1}` : ""   // altre testate con la stessa notizia
  const t = testo(meta, `${n.fonte}${altre} · ${fa(n.data)}`, Font.mediumSystemFont(grande ? 11 : 10), COL.testo2)
  t.minimumScaleFactor = 0.8
}

function rigaMercato(dove, m, conPrezzo, conLinea) {
  const s = dove.addStack()
  s.layoutVertically()
  const su = s.addStack()
  su.centerAlignContent()
  const n = testo(su, nomeMercato(m), Font.semiboldSystemFont(12), COL.testo)
  n.minimumScaleFactor = 0.7
  su.addSpacer()
  testo(su, variazione(m), Font.semiboldMonospacedSystemFont(11.5), coloreVar(m))
  if (conPrezzo) {
    const giu = s.addStack()
    giu.centerAlignContent()
    const p = testo(giu, prezzo(m), Font.mediumMonospacedSystemFont(10.5), COL.testo2)
    p.minimumScaleFactor = 0.7
    giu.addSpacer()
    const img = conLinea && linea(m, 38, 12)
    if (img) giu.addImage(img).imageSize = new Size(38, 12)
  }
}

function separatore(w) {
  const s = w.addStack()
  s.backgroundColor = COL.sep
  s.size = new Size(0, 0.5)
  s.addSpacer()
}

// ------------------------------------------------------------ le misure
function piccolo(w, d, vecchi) {
  w.setPadding(13, 14, 13, 14)
  intestazione(w, d, vecchi)
  w.addSpacer(8)
  if (P.mostra?.startsWith("notiz") || P.mostra?.startsWith("news")) {
    const n = scegliNotizie(d, 1)[0]
    if (!n) return vuoto(w, T("Nessuna notizia recente", "No recent news"))
    w.url = n.link
    testo(w, titolo(n), Font.semiboldSystemFont(14), COL.testo, 5).minimumScaleFactor = 0.85
    w.addSpacer()
    const t = testo(w, `${n.fonte} · ${fa(n.data)}`, Font.mediumSystemFont(10), COL.testo2)
    t.minimumScaleFactor = 0.8
    return
  }
  w.url = RADAR + "#mercati"
  const mm = scegliMercati(d, 3)
  if (!mm.length) return vuoto(w, T("Mercati non disponibili", "Markets unavailable"))
  mm.forEach((m, i) => {
    if (i) w.addSpacer(7)
    rigaMercato(w, m, true, true)
  })
  w.addSpacer()
}

function medio(w, d, vecchi) {
  w.setPadding(13, 15, 13, 15)
  w.url = RADAR
  intestazione(w, d, vecchi)
  w.addSpacer(8)
  const corpo = w.addStack()
  corpo.topAlignContent()
  const sx = corpo.addStack()
  sx.layoutVertically()
  const nn = scegliNotizie(d, 2)
  if (!nn.length) testo(sx, T("Nessuna notizia recente", "No recent news"), Font.mediumSystemFont(12), COL.testo2)
  nn.forEach((n, i) => {
    if (i) sx.addSpacer(8)
    rigaNotizia(sx, n, false)
  })
  sx.addSpacer()
  corpo.addSpacer(12)
  const dx = corpo.addStack()
  dx.layoutVertically()
  dx.size = new Size(104, 0)
  dx.url = RADAR + "#mercati"
  scegliMercati(d, 4).forEach((m, i) => {
    if (i) dx.addSpacer(6)
    rigaMercato(dx, m, false, false)
  })
  dx.addSpacer()
}

function grande(w, d, vecchi, extra) {
  w.setPadding(15, 16, 15, 16)
  w.url = RADAR
  intestazione(w, d, vecchi)
  w.addSpacer(10)
  const nn = scegliNotizie(d, extra ? 6 : 4)
  if (!nn.length) testo(w, T("Nessuna notizia recente", "No recent news"), Font.mediumSystemFont(13), COL.testo2)
  nn.forEach((n, i) => {
    if (i) w.addSpacer(9)
    rigaNotizia(w, n, true)
  })
  w.addSpacer()
  separatore(w)
  w.addSpacer(9)
  const mm = scegliMercati(d, extra ? 8 : 6)
  const griglia = w.addStack()
  griglia.url = RADAR + "#mercati"
  const colonne = []
  for (const k of [0, 1]) {   // due colonne affiancate, larghe uguali
    if (k) griglia.addSpacer(18)
    const c = griglia.addStack()
    c.layoutVertically()
    c.size = new Size(extra ? 300 : 144, 0)
    colonne.push(c)
  }
  mm.forEach((m, i) => {
    const col = colonne[i % 2]
    if (i > 1) col.addSpacer(7)
    rigaMercato(col, m, true, true)
  })
}

function bloccoRiga(w, d) {   // schermata di blocco, rettangolo
  w.url = RADAR
  if (P.mostra?.startsWith("notiz") || P.mostra?.startsWith("news")) {
    const n = scegliNotizie(d, 1)[0]
    if (n) {
      w.url = n.link
      testo(w, titolo(n), Font.semiboldSystemFont(13), Color.white(), 3).minimumScaleFactor = 0.8
    }
    return
  }
  for (const m of scegliMercati(d, 3)) {
    const r = w.addStack()
    testo(r, nomeMercato(m), Font.semiboldSystemFont(12), Color.white()).minimumScaleFactor = 0.7
    r.addSpacer()
    testo(r, variazione(m), Font.semiboldMonospacedSystemFont(12), Color.white())
  }
}

function bloccoTondo(w, d) {
  w.addAccessoryWidgetBackground = true
  w.url = RADAR + "#mercati"
  const m = scegliMercati(d, 1)[0]
  if (!m) return
  const t1 = testo(w, nomeMercato(m), Font.semiboldSystemFont(9), Color.white())
  t1.minimumScaleFactor = 0.6
  t1.centerAlignText()
  const t2 = testo(w, variazione(m).replace("%", ""), Font.boldRoundedSystemFont(13), Color.white())
  t2.minimumScaleFactor = 0.6
  t2.centerAlignText()
}

function bloccoLinea(w, d) {
  w.url = RADAR
  const s = scegliMercati(d, 2).map((m) => `${nomeMercato(m)} ${variazione(m)}`).join(" · ")
  testo(w, s || "Radar", Font.mediumSystemFont(12), Color.white())
}

function vuoto(w, messaggio) {
  w.addSpacer()
  testo(w, messaggio, Font.mediumSystemFont(12), COL.testo2, 3)
  w.addSpacer()
}

// ------------------------------------------------------------ via
async function costruisci(famiglia) {
  const { d, vecchi } = await dati()
  const w = new ListWidget()
  const blocco = famiglia?.startsWith("accessory")
  if (!blocco) w.backgroundColor = COL.sfondo
  w.refreshAfterDate = new Date(Date.now() + 30 * 60e3)
  if (!d) {
    w.url = RADAR
    if (!blocco) intestazione(w, { aggiornato: Date.now() }, true)
    vuoto(w, T("Radar non raggiungibile: riprovo fra poco.", "Radar unreachable: retrying soon."))
    return w
  }
  if (famiglia === "accessoryRectangular") bloccoRiga(w, d)
  else if (famiglia === "accessoryCircular") bloccoTondo(w, d)
  else if (famiglia === "accessoryInline") bloccoLinea(w, d)
  else if (famiglia === "medium") medio(w, d, vecchi)
  else if (famiglia === "large") grande(w, d, vecchi, false)
  else if (famiglia === "extraLarge") grande(w, d, vecchi, true)
  else piccolo(w, d, vecchi)
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
