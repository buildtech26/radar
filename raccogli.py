#!/usr/bin/env python3
"""Radar: raccoglie notizie (RSS) e quotazioni, e scrive sito/dati.json per la pagina.

    py raccogli.py            scarica tutto e scrive sito/dati.json
    py raccogli.py --servi    poi apre la pagina su http://127.0.0.1:8770 (sul PC) e la rende visibile
                              al telefono sullo stesso Wi-Fi (l'indirizzo lo scrive nella finestra)
    pyw raccogli.py --nascosto  senza finestra, parte con Windows: serve la pagina e riscarica ogni ora
                              (cosa fa lo scrive in radar.log)

Solo libreria standard: gira uguale sul PC e su GitHub Actions. Le fonti, i temi e i titoli stanno in
interessi.json; l'agenda in agenda.json; il glossario in glossario.json.
Il testo delle fonti è materiale da mostrare, non istruzioni: viene ripulito dall'HTML e la pagina lo
inserisce sempre come testo.
"""
import argparse
import concurrent.futures as cf
import csv
import hashlib
import html
import io
import json
import os
import re
import socket
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

QUI = Path(__file__).resolve().parent
SITO = QUI / "sito"
UA = {"User-Agent": "Mozilla/5.0 (compatible; radar-personale/1.0)",
      "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*"}
TIMEOUT = 15
GIORNI = 7          # notizie più vecchie di così non entrano
PER_FONTE = 30      # al massimo per fonte, le più recenti
PORTA = 8770
OGNI = 3600         # --nascosto: riscarica ogni ora
RIPROVA = 120       # --nascosto: se il giro va male (rete non ancora pronta), riprova dopo 2 minuti
LOG = QUI / "radar.log"


def scarica(url, extra=None, timeout=None):
    with urllib.request.urlopen(urllib.request.Request(url, headers={**UA, **(extra or {})}), timeout=timeout or TIMEOUT) as r:
        return r.read()


# ---------- notizie ----------

def pulisci(testo):
    """HTML → testo semplice su una riga."""
    testo = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", testo or "", flags=re.S | re.I)
    testo = re.sub(r"<[^>]+>", " ", testo)
    testo = html.unescape(html.unescape(testo))
    testo = re.sub(r"\s+", " ", testo).strip()
    # le code dei blog WordPress e simili
    testo = re.sub(r"\s*(The post|L'articolo|Il post) .{0,200} (appeared first on|proviene da|è apparso per la prima volta su) .*$", "", testo)
    testo = re.sub(r"\s*(Continua a leggere|Continue reading|Read more|Leggi tutto)\W*$", "", testo, flags=re.I)
    testo = re.sub(r"\s*\[(…|\.\.\.)\]$", "…", testo)   # il "[…]" in fondo dei feed WordPress (NASA e altri)
    return testo


SOMMARIO = 280      # per le schede e per i temi: uguale per tutte le testate, così chi scrive di più non vince
ESTRATTO = 700      # per la sottopagina della notizia: quello che manda la testata, ma un estratto, non l'articolo


def taglia(testo, n=SOMMARIO):
    if len(testo) <= n:
        return testo
    return testo[:n].rsplit(" ", 1)[0].rstrip(",;:.-–—") + "…"


def quando(s):
    if not s:
        return None
    s = s.strip()
    try:
        d = parsedate_to_datetime(s)
    except (TypeError, ValueError, IndexError):
        try:
            d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return int(d.timestamp() * 1000)


def immagine_da(it, testi):
    for el in it:
        url = el.get("url") or ""
        if el.tag in ("thumbnail", "content") and url and (el.get("medium") == "image" or "image" in (el.get("type") or "") or el.tag == "thumbnail" or re.search(r"\.(jpe?g|png|webp)(\?|$)", url, re.I)):
            return url
        if el.tag == "enclosure" and url and "image" in (el.get("type") or ""):
            return url
    for t in testi:
        m = re.search(r"<img[^>]+src=[\"']([^\"']+)", t or "", re.I)
        if m:
            return html.unescape(m.group(1))
    return ""


def sicuro(url):
    url = (url or "").strip()
    if url.startswith("http://"):
        url = "https://" + url[7:]   # la pagina è in https: niente contenuti misti
    return url if url.startswith("https://") else ""


def leggi_feed(dati, fonte):
    # le entità HTML (&nbsp; …) non sono XML valido: le rendo &amp;… e le scioglie pulisci()
    dati = dati.lstrip(b"\xef\xbb\xbf \t\r\n")   # BOM o righe vuote prima di <?xml (Il Post)
    dati = re.sub(rb"&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)", b"&amp;", dati)
    radice = ET.fromstring(dati)
    for el in radice.iter():
        if isinstance(el.tag, str) and "}" in el.tag:
            el.tag = el.tag.split("}", 1)[1]
    voci = []
    for it in list(radice.iter("item")) + list(radice.iter("entry")):
        titolo = pulisci("".join(it.find("title").itertext()) if it.find("title") is not None else "")
        if not titolo:
            continue
        link = ""
        for l in it.findall("link"):
            if (l.text or "").strip():
                link = l.text.strip()
                break
            if l.get("href") and l.get("rel", "alternate") == "alternate":
                link = l.get("href")
                break
        if not link and it.find("guid") is not None and (it.find("guid").text or "").startswith("http"):
            link = it.find("guid").text.strip()
        link = sicuro(link)
        if not link:
            continue
        data = None
        for tag in ("pubDate", "published", "updated", "date"):
            if it.find(tag) is not None:
                data = quando(it.find(tag).text)
                if data:
                    break
        testi = []
        for tag in ("description", "summary", "encoded", "content"):
            el = it.find(tag)
            if el is not None and not el.get("url"):
                testi.append("".join(el.itertext()) if len(el) else (el.text or ""))
        sommario = ""
        for t in testi:
            sommario = pulisci(t)
            if sommario:
                break
        if sommario.startswith("Article URL:") or sommario.lower() == titolo.lower():
            sommario = ""
        voci.append({
            "id": hashlib.sha1(link.encode()).hexdigest()[:12],
            "titolo": taglia(titolo, 200),
            "sommario": taglia(sommario),
            # il testo più lungo, solo quando la testata ne manda più del sommario
            **({"testo": taglia(sommario, ESTRATTO)} if len(sommario) > SOMMARIO else {}),
            "link": link,
            "data": data,
            "immagine": sicuro(immagine_da(it, testi)),
            "fonte": fonte["nome"],
            "sezione": fonte["sezione"],
            "lingua": fonte.get("lingua", "it"),
            "paese": fonte.get("paese", "it" if fonte.get("lingua", "it") == "it" else "us"),
        })
    return voci


def notizie(fonti):
    adesso = time.time() * 1000
    limite = adesso - GIORNI * 86400 * 1000
    tutte, errori = [], []

    def una(fonte):
        try:
            voci = leggi_feed(scarica(fonte["url"]), fonte)
        except Exception as e:  # una fonte giù non deve fermare le altre
            return fonte, [], f"{type(e).__name__}: {str(e)[:120]}"
        con_data = sorted([v for v in voci if v["data"] and limite < v["data"] <= adesso + 3600e3], key=lambda v: -v["data"])
        senza = [v for v in voci if not v["data"]][:10]
        return fonte, (con_data + senza)[:PER_FONTE], None

    with cf.ThreadPoolExecutor(12) as ex:
        for fonte, voci, err in ex.map(una, [f for f in fonti if f.get("attiva", True)]):
            if err:
                errori.append({"fonte": fonte["nome"], "errore": err})
            tutte += voci
    # doppioni: stesso link o stesso titolo (la stessa notizia su più feed)
    visti, uniche = set(), []
    for v in sorted(tutte, key=lambda v: -(v["data"] or 0)):
        chiave = re.sub(r"[^a-z0-9]", "", v["titolo"].lower())[:70]
        if v["link"] in visti or chiave in visti:
            continue
        visti.update((v["link"], chiave))
        uniche.append(v)
    raggruppa(uniche)
    return uniche, errori


# ---------- lo stesso fatto raccontato da più testate (anche in lingue diverse) ----------
# Senza traduzioni: due notizie parlano della stessa cosa se, a poche ore di distanza, condividono abbastanza
# "segni" rari: numeri (4%, 5,6%), nomi (Lagarde, Nvidia) e concetti scritti in italiano o in inglese
# (inflazione = inflation). Ogni segno pesa tanto quanto è raro tra le notizie del giro (idf): "AI" o "mercati"
# quasi niente, "Pierre Computer" molto. L'app mostra una notizia per gruppo e le altre come "Anche su".

# concetto: forme in italiano e in inglese. Fino a 4 lettere valgono intere, le altre anche come inizio di parola.
CONCETTI = {
    "inflazione": ["inflazion", "inflation", "cpi"], "prezzi": ["prezzi", "prices", "price"],
    "tassi": ["tassi", "tasso", "rates", "rate"], "rialzo": ["rialz", "hike", "hikes", "aument", "raise", "rais"],
    "taglio": ["tagli", "taglio", "cut", "cuts"], "bce": ["bce", "ecb"], "fed": ["fed", "federal reserve"],
    "eurozona": ["eurozon", "euro zone", "euro area", "area euro", "eurozone"], "ue": ["ue", "eu", "european union", "unione europea"],
    "pil": ["pil", "gdp"], "disoccupazione": ["disoccupazion", "unemployment", "jobless"], "lavoro": ["lavoro", "jobs", "payroll"],
    "dazi": ["dazi", "dazio", "tariff"], "petrolio": ["petrolio", "oil", "crude", "greggio"], "oro": ["oro", "gold"],
    "gas": ["gas"], "energia": ["energ"], "borsa": ["borsa", "borse", "stock", "stocks"], "utili": ["utili", "profit", "earnings", "trimestral", "quarterly"],
    "ricavi": ["ricavi", "revenue"], "acquisizione": ["acquisi", "acquire", "acquir", "compra", "buy", "takeover"],
    "licenziamenti": ["licenziament", "layoff", "taglia posti"], "salari": ["salari", "stipendi", "wage", "wages"],
    "debito": ["debito", "debt"], "bond": ["bond", "obbligazion", "btp", "treasur", "rendiment", "yield"],
    "cina": ["cina", "cines", "china", "chines"], "usa": ["usa", "stati uniti", "us", "u.s", "america", "american", "americani"],
    "germania": ["germani", "german", "tedesc"], "francia": ["francia", "france", "french", "frances"],
    "giappone": ["giappon", "japan"], "italia": ["itali", "italy"], "spagna": ["spagn", "spain", "spanish"],
    "regno unito": ["regno unito", "uk", "britain", "british", "britannic"], "australia": ["australi"], "russia": ["russi"],
    "ucraina": ["ucrain", "ukrain"], "india": ["india", "indian"], "banca": ["banca", "banche", "bank", "banks"],
    "governo": ["governo", "government"], "elezioni": ["elezion", "election"], "accordo": ["accordo", "deal", "agreement", "intesa"],
    "record": ["record", "massim", "high"], "calo": ["calo", "cala", "fall", "falls", "drop", "decline", "scend"],
    "dollaro": ["dollar", "dollari", "dollaro"], "sotto": ["sotto", "below", "under"], "sopra": ["sopra", "above"],
    "crescita": ["crescit", "growth", "grow"], "chip": ["chip", "semicondutt", "semiconductor"],
    "gennaio": ["gennaio", "january"], "febbraio": ["febbraio", "february"], "marzo": ["marzo", "march"],
    "aprile": ["aprile", "april"], "maggio": ["maggio"], "giugno": ["giugno", "june"], "luglio": ["luglio", "july"],
    "agosto": ["agosto", "august"], "settembre": ["settembre", "september"], "ottobre": ["ottobre", "october"],
    "novembre": ["novembre", "november"], "dicembre": ["dicembre", "december"],
}
PAROLE_VUOTE = set("""
il lo la i gli le un uno una di del dello della dei degli delle a al allo alla ai agli alle da dal dalla dai dalle in nel
nella nei nelle con su sul sulla sui per tra fra e ed o ma che chi cui non si come più meno anche ancora è sono era sia
questo questa questi quello quella dopo prima oggi ieri ora sempre già molto tutto tutti ogni suo sua suoi sue loro nostro
the a an of to in on at for from by with and or but not is are was were be been has have had it its this that these those
as than then into over after before about up down out new says said will would can could may more most just also how what
why who when where which their there they them we you your our he she his her i do does did so if no all any some
""".split())


# nomi propri che compaiono in tante notizie diverse di scienza e spazio: contano come segni, non come appigli
# (Hubble e Swift che "cadono sulla Terra", due notizie qualsiasi sugli astronauti della Stazione spaziale)
GENERICI = {"nasa", "earth", "space", "internat", "station", "moon", "mars", "sun", "terra", "spazio", "luna"}


def _senza_accenti(s):
    return s.translate(str.maketrans("àáèéìíòóùú’", "aaeeiioouu'"))


_FORME_INTERE, _FORME_INIZIO, _FORME_FRASE = {}, [], []
for _c, _forme in CONCETTI.items():
    for _f in _forme:
        if " " in _f:
            _FORME_FRASE.append((_f, _c))
        elif len(_f) <= 4:
            _FORME_INTERE[_f] = _c
        else:
            _FORME_INIZIO.append((_f, _c))


def parole_minuscole(voci):
    """Le parole che nella rassegna compaiono anche scritte minuscole: parole comuni, non nomi propri."""
    viste = set()
    for v in voci:
        testo = re.sub(r"\S*[/@]\S*", " ", _senza_accenti(f"{v['titolo']} {v.get('sommario') or ''}"))   # niente link
        viste.update(re.findall(r"(?<![\w.'-])([a-z][a-z'-]{2,})", testo))
    return {p[:-2] if p.endswith("'s") else p for p in viste}


def segni(v, minuscole=frozenset()):
    """I segni che distinguono una notizia: numeri, nomi e concetti, uguali in italiano e in inglese.
    Torna (segni, appigli): gli appigli sono i segni precisi, numeri veri e nomi propri, e almeno uno deve
    essere in comune. Senza, "fatturato" e "terzo trimestre" legherebbero i conti di Sanofi a quelli di Lufthansa."""
    originale = _senza_accenti(f"{v['titolo']} . {v['sommario'][:220]}")
    testo = originale.lower()
    trovati, appigli = set(), set()
    for frase, c in _FORME_FRASE:
        if frase in testo:
            trovati.add("c:" + c)
    if "$" in testo:
        trovati.add("c:dollaro")
    # numeri: 4%, 5,6% e 5.6% sono lo stesso numero. Appigli quelli precisi: con la percentuale, coi decimali
    # o di almeno due cifre, ma non gli anni (2026 è in mezza rassegna)
    for m in re.finditer(r"(\d+(?:[.,]\d+)?)\s*(%|per cento|percent)?", testo):
        n = m.group(1).replace(",", ".")
        if "." in n:
            n = n.rstrip("0").rstrip(".")
        t = "n:" + n + ("%" if m.group(2) else "")
        trovati.add(t)
        if (m.group(2) or "." in n or len(n) >= 2) and not re.fullmatch(r"(19|20)\d\d", n):
            appigli.add(t)
    # nomi propri: maiuscola non dopo un punto (Lagarde, Brent, Uber); i concetti noti e le parole vuote non contano.
    # Nel titolo la maiuscola a volte non dice niente: sulla prima parola c'è per forza ("Food bank to close"), e
    # certi titoli inglesi le hanno tutte ("NASA Astronauts to Answer Questions"). Lì una parola vale come nome
    # solo se nella rassegna non compare mai minuscola (minuscole, lo calcola raggruppa): Airbnb sì, Food no.
    lung_titolo = len(_senza_accenti(v["titolo"]))
    lunghe = [p for p in re.findall(r"[A-Za-z][A-Za-z'-]*", originale[:lung_titolo]) if len(p) >= 4]
    tutte_maiuscole = len(lunghe) >= 4 and sum(p[0].isupper() for p in lunghe) >= 0.7 * len(lunghe)
    for m in re.finditer(r"(?<![.:!?]\s)\b([A-Z][A-Za-z0-9&-]{2,})", originale):
        p = m.group(1).lower()
        if p.endswith("'s"):
            p = p[:-2]
        if m.start() < lung_titolo and (tutte_maiuscole or not re.search(r"[A-Za-z0-9]", originale[:m.start()])):
            particolare = re.search(r"[A-Z0-9]", m.group(1)[1:])   # OpenAI, NASA, X10: nomi comunque
            if not particolare and p in minuscole:
                continue
        if p not in PAROLE_VUOTE and p not in _FORME_INTERE and p[:8] not in GENERICI \
                and not any(p.startswith(f) for f, _ in _FORME_INIZIO):
            appigli.add("p:" + p[:8])
    for p in re.findall(r"[a-z][a-z0-9'.&-]*[a-z0-9]|[a-z]", testo):
        p = p[:-2] if p.endswith("'s") else p.split("'")[-1]   # Lagarde's → lagarde, l'inflazione → inflazione
        if p in PAROLE_VUOTE or len(p) < 2:
            continue
        if p in _FORME_INTERE:
            trovati.add("c:" + _FORME_INTERE[p])
            continue
        for forma, c in _FORME_INIZIO:
            if p.startswith(forma):
                trovati.add("c:" + c)
                break
        else:
            if len(p) >= 3:
                trovati.add("p:" + p[:8])   # nomi e parole uguali nelle due lingue (lagarde, nvidia, openai)
    return trovati, appigli & trovati


def raggruppa(voci, ore=36, soglia=11.0, quota=0.18, soglia_titoli=8.0):
    """Aggiunge "gruppo" (l'id della prima notizia del gruppo) alle notizie che raccontano lo stesso fatto.
    Tre prove insieme: un appiglio raro in comune, abbastanza segni in comune nel testo, e abbastanza nei soli
    titoli. L'ultima tiene separati i resoconti di Borsa, che nel testo si somigliano tutti (Hong Kong, Tokyo,
    Seul…) ma nel titolo no. Le soglie sono tarate a mano su notizie vere del 05/11/2026: meglio una notizia
    doppia in più che due fatti diversi fusi in uno."""
    import math
    minuscole = parole_minuscole(voci)
    s, ap = zip(*[segni(v, minuscole) for v in voci]) if voci else ((), ())
    st, apt = zip(*[segni({"titolo": v["titolo"], "sommario": ""}, minuscole) for v in voci]) if voci else ((), ())
    df = {}
    for insieme in s:
        for t in insieme:
            df[t] = df.get(t, 0) + 1
    n = len(voci) or 1
    idf = {t: math.log(n / c) for t, c in df.items()}
    # un appiglio che compare in mezza rassegna (Trump, Euro, OpenAI) non basta a dire "stesso fatto"
    raro = max(3, 0.04 * n)
    ap = [{t for t in a if df[t] <= raro} for a in ap]
    peso = [sum(idf[t] for t in insieme) or 1 for insieme in s]
    gruppi = []   # [[indici]]
    for i in sorted(range(len(voci)), key=lambda i: -(voci[i]["data"] or 0)):
        if not voci[i]["data"]:
            continue
        meglio, punti_meglio = None, 0
        for g in gruppi:
            for j in g:
                if abs(voci[i]["data"] - voci[j]["data"]) > ore * 3600e3 or voci[i]["fonte"] == voci[j]["fonte"]:
                    continue
                if not (ap[i] & ap[j]):
                    continue
                comuni = s[i] & s[j]
                punti = sum(idf[t] for t in comuni)
                if len(comuni) < 3 or punti < soglia or punti / min(peso[i], peso[j]) < quota or punti <= punti_meglio:
                    continue
                # nei titoli: abbastanza segni, oppure due appigli rari ("Lagarde" e "President")
                if sum(idf.get(t, 0) for t in st[i] & st[j]) >= soglia_titoli or len(apt[i] & apt[j] & ap[i]) >= 2:
                    meglio, punti_meglio = g, punti
        if meglio is not None:
            meglio.append(i)
        else:
            gruppi.append([i])
    for g in gruppi:
        if len(g) > 1:
            for i in g:
                voci[i]["gruppo"] = voci[g[0]]["id"]
    return voci


# ---------- mercati ----------

# Tre fonti, scelte per licenza (il campo "fonte" nel catalogo):
#   bce       cambi: tassi di riferimento ufficiali BCE, liberi citando la fonte; uno al giorno verso le 16
#   coingecko cripto: API pubblica di CoinGecko, da citare ("Dati di CoinGecko"); chiave Demo facoltativa
#             nella variabile d'ambiente COINGECKO_KEY
#   yahoo     tutto il resto (indici, ETF, azioni, materie prime): accesso NON ufficiale, può smettere di funzionare.
#             Se succede, quei mercati spariscono dai dati e l'app lo dice; il resto continua.

def cifre(x):
    return float(f"{x:.6g}")


def riduci(valori, quanti=72):
    passo = max(1, len(valori) // quanti)
    ridotti = valori[::passo]
    if ridotti[-1] != valori[-1]:
        ridotti.append(valori[-1])
    return [cifre(v) for v in ridotti]


def riassunto(titolo, punti, prezzo, rif_giorno, oggi, valuta, ora):
    """punti: [(ms, chiusura)] di un anno circa. rif_giorno: il valore da cui si misura la giornata."""
    if len(punti) < 2:
        raise ValueError("pochi dati")
    ultimo_t = punti[-1][0]

    def var_da(giorni):
        soglia = ultimo_t - giorni * 86400e3
        prima = [c for t, c in punti if t <= soglia]
        return round((prezzo / prima[-1] - 1) * 100, 2) if prima else None

    return {
        "simbolo": titolo["simbolo"],
        "nome": titolo["nome"],
        "breve": titolo.get("breve") or titolo["nome"],
        "categoria": titolo.get("categoria", ""),
        "predefinito": bool(titolo.get("predefinito")),
        "fonte": titolo.get("fonte", "yahoo"),
        **({"en": titolo["en"]} if titolo.get("en") else {}),   # nome e breve in inglese, per l'app in inglese
        "valuta": valuta,
        "prezzo": prezzo,
        "var_giorno": round((prezzo / rif_giorno - 1) * 100, 2),
        "oggi": oggi,
        "var_mese": var_da(30),
        "var_anno": var_da(364),
        "ora": ora,
        # giorno (giorni dal 1970) e chiusura a 6 cifre: con decine di mercati il file resta leggero
        "serie": [[int(t // 86400000), cifre(c)] for t, c in punti],
    }


def quota_yahoo(titolo):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.request.quote(titolo['simbolo'])}?range=1y&interval=1d"
    r = json.loads(scarica(url))["chart"]["result"][0]
    meta = r["meta"]
    punti = [(t * 1000, c) for t, c in zip(r["timestamp"], r["indicators"]["quote"][0]["close"]) if c is not None]
    if len(punti) < 2:
        raise ValueError("pochi dati")
    prezzo = meta.get("regularMarketPrice") or punti[-1][1]
    # la giornata, ogni 5 minuti, con la chiusura di ieri come riferimento (come l'app Borsa)
    oggi, ieri = None, punti[-2][1]
    try:
        g = json.loads(scarica(url.replace("range=1y&interval=1d", "range=1d&interval=5m")))["chart"]["result"][0]
        valori = [c for c in g["indicators"]["quote"][0]["close"] if c is not None]
        rif = g["meta"].get("chartPreviousClose") or g["meta"].get("previousClose")
        if len(valori) >= 2 and rif:
            prezzo = g["meta"].get("regularMarketPrice") or valori[-1]
            ieri = rif
            oggi = {"riferimento": rif, "punti": riduci(valori)}
    except Exception:
        pass
    return riassunto(titolo, punti, prezzo, ieri, oggi, meta.get("currency", ""), (meta.get("regularMarketTime") or 0) * 1000)


VALUTE_BCE = []                 # le riempie mercati() dal catalogo: tutti i cambi in una richiesta sola
_bce = {"tassi": None}
_bce_lucchetto = threading.Lock()


def tassi_bce():
    """{valuta: [(ms, tasso)]}, scaricati una volta per giro. Il server della BCE a volte è lento: un secondo tentativo."""
    with _bce_lucchetto:
        if _bce["tassi"] is None:
            inizio = datetime.fromtimestamp(time.time() - 400 * 86400, timezone.utc).strftime("%Y-%m-%d")
            url = (f"https://data-api.ecb.europa.eu/service/data/EXR/D.{'+'.join(VALUTE_BCE)}.EUR.SP00.A"
                   f"?startPeriod={inizio}&format=csvdata")
            try:
                testo = scarica(url, timeout=40)
            except Exception:
                time.sleep(2)
                testo = scarica(url, timeout=40)
            tassi = {}
            for r in csv.DictReader(io.StringIO(testo.decode("utf-8"))):
                if r.get("OBS_VALUE"):
                    a, m, g = map(int, r["TIME_PERIOD"].split("-"))
                    quando = datetime(a, m, g, 15, tzinfo=timezone.utc).timestamp() * 1000   # verso le 16 italiane
                    tassi.setdefault(r["CURRENCY"], []).append((quando, float(r["OBS_VALUE"])))
            _bce["tassi"] = {v: sorted(p) for v, p in tassi.items()}
        return _bce["tassi"]


def quota_bce(titolo):
    valuta = titolo["valuta"]   # per esempio "USD": quanti dollari per un euro
    punti = tassi_bce().get(valuta, [])
    if len(punti) < 2:
        raise ValueError("pochi dati")
    return riassunto(titolo, punti, punti[-1][1], punti[-2][1], None, valuta, punti[-1][0])


def quota_coingecko(titolo):
    base = f"https://api.coingecko.com/api/v3/coins/{titolo['id']}/market_chart?vs_currency=eur&days="
    extra = {"x-cg-demo-api-key": os.environ["COINGECKO_KEY"]} if os.environ.get("COINGECKO_KEY") else {}
    anno = json.loads(scarica(base + "365", extra))["prices"]
    # le cripto non chiudono mai: la "giornata" sono le ultime 24 ore
    giorno = json.loads(scarica(base + "1", extra))["prices"]
    if len(giorno) < 2:
        raise ValueError("pochi dati")
    prezzo = giorno[-1][1]
    oggi = {"riferimento": giorno[0][1], "punti": riduci([p for _, p in giorno])}
    punti = [(t, p) for t, p in anno[:-1]] + [(giorno[-1][0], prezzo)]
    return riassunto(titolo, punti, prezzo, giorno[0][1], oggi, "EUR", giorno[-1][0])


FONTI_PREZZI = {"yahoo": quota_yahoo, "bce": quota_bce, "coingecko": quota_coingecko}


def quotazione(titolo):
    return FONTI_PREZZI[titolo.get("fonte", "yahoo")](titolo)


def mercati(titoli):
    risultati, errori = [], []
    VALUTE_BCE[:] = sorted({t["valuta"] for t in titoli if t.get("fonte") == "bce"})
    _bce["tassi"] = None

    def uno(t):
        try:
            return quotazione(t), None
        except Exception as e:
            return None, {"fonte": t["simbolo"], "errore": f"{type(e).__name__}: {str(e)[:120]}"}

    with cf.ThreadPoolExecutor(8) as ex:
        for q, err in ex.map(uno, titoli):
            if q:
                risultati.append(q)
            if err:
                errori.append(err)
    ordine = {t["simbolo"]: i for i, t in enumerate(titoli)}
    return sorted(risultati, key=lambda q: ordine[q["simbolo"]]), errori


# ---------- traduzioni (Azure Translator, piano gratuito F0) ----------
# Le notizie inglesi si traducono in italiano una volta sola, quando arrivano: titolo e testo della sottopagina
# (le schede restano in originale). Le traduzioni restano in traduzioni.json, su GitHub nella cache di Actions:
# ogni giro traduce solo le notizie nuove. Senza chiave non si traduce niente e l'app mostra l'originale.
# La chiave: variabili d'ambiente AZURE_TRANSLATOR_KEY e AZURE_TRANSLATOR_REGION (su GitHub, i secrets), oppure il
# file 00-SYSTEM/credenziali/radar-azure.env del SecondBrain. Si legge e basta: non finisce mai nei log né nei dati.
# Il piano gratuito dà 2 milioni di caratteri al mese: ci si ferma prima, a TRADUZIONI_MAX (il conto è nel file).
# Attenzione: se traducono sia il PC sia GitHub, il conto è doppio (vedi README, "Pubblicazione").

TRADUZIONI = QUI / "traduzioni.json"
CREDENZIALI_AZURE = QUI.parent.parent / "00-SYSTEM" / "credenziali" / "radar-azure.env"
TRADUZIONI_MAX = int(os.environ.get("RADAR_TRADUZIONI_MAX", "1900000"))
TRADUCI = {"en": "it"}   # lingua della notizia → lingua in cui tradurla (con "it": "en" anche per l'app in inglese)
PER_RICHIESTA = 25       # notizie per richiesta (Azure accetta fino a 1000 testi e 50.000 caratteri)


def chiave_azure():
    chiave, regione = os.environ.get("AZURE_TRANSLATOR_KEY"), os.environ.get("AZURE_TRANSLATOR_REGION")
    if not chiave and CREDENZIALI_AZURE.exists():
        for riga in CREDENZIALI_AZURE.read_text(encoding="utf-8-sig").splitlines():
            k, _, v = riga.partition("=")
            k, v = k.strip(), v.strip().strip("\"'")
            if k == "AZURE_TRANSLATOR_KEY":
                chiave = v
            elif k == "AZURE_TRANSLATOR_REGION":
                regione = v
    # i secrets incollati a mano su GitHub possono portarsi dietro spazi, a capo o virgolette
    pulisci = lambda s: (s or "").strip().strip("\"'").strip() or None
    return pulisci(chiave), pulisci(regione)


def chiedi_traduzione(testi, da, a, chiave, regione):
    url = f"https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from={da}&to={a}&textType=plain"
    testa = {"Ocp-Apim-Subscription-Key": chiave, "Content-Type": "application/json; charset=UTF-8"}
    if regione:
        testa["Ocp-Apim-Subscription-Region"] = regione
    corpo = json.dumps([{"Text": t} for t in testi]).encode("utf-8")
    for tentativo in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=corpo, headers=testa, method="POST"), timeout=30) as r:
                return [x["translations"][0]["text"] for x in json.loads(r.read())]
        except urllib.error.HTTPError as e:   # il messaggio di Azure dice cosa non va (chiave, regione, quota)
            # 429: il piano gratuito ha anche un limite di caratteri al minuto. Si aspetta e si riprova.
            if e.code == 429 and tentativo < 3:
                try:
                    attesa = int(e.headers.get("Retry-After") or 60)
                except ValueError:
                    attesa = 60
                time.sleep(min(max(attesa, 5), 90))
                continue
            try:
                msg = json.loads(e.read()).get("error", {}).get("message", "")
            except Exception:
                msg = ""
            raise RuntimeError(f"HTTP {e.code} {msg}".strip()) from None


def traduci(voci):
    chiave, regione = chiave_azure()
    if not chiave:
        return []
    try:
        cache = json.loads(TRADUZIONI.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        cache = {}
    mese = time.strftime("%Y-%m")
    conto = cache.get("conto") if (cache.get("conto") or {}).get("mese") == mese else {"mese": mese, "caratteri": 0}
    fatte = cache.get("voci", {})
    errori = []
    nuove = [v for v in voci if v["lingua"] in TRADUCI and v["id"] not in fatte]
    for i in range(0, len(nuove), PER_RICHIESTA):
        pezzo = nuove[i:i + PER_RICHIESTA]
        ferma = False
        for da in sorted({v["lingua"] for v in pezzo}):
            gruppo = [v for v in pezzo if v["lingua"] == da]
            # titolo e testo di ogni notizia (il testo solo se c'è)
            campi = [(v, k, v["titolo"] if k == "titolo" else (v.get("testo") or v["sommario"]))
                     for v in gruppo for k in ("titolo", "testo")]
            campi = [c for c in campi if c[2]]
            n = sum(len(c[2]) for c in campi)
            if conto["caratteri"] + n > TRADUZIONI_MAX:
                errori.append({"fonte": "Traduzioni", "errore": f"quota del mese quasi finita ({conto['caratteri']:,} caratteri): le altre restano in originale"})
                ferma = True
                break
            try:
                tradotti = chiedi_traduzione([c[2] for c in campi], da, TRADUCI[da], chiave, regione)
            except Exception as e:
                errori.append({"fonte": "Traduzioni", "errore": f"{type(e).__name__}: {str(e)[:160]}"})
                ferma = True
                break
            conto["caratteri"] += n
            ora = int(time.time())
            for v in gruppo:
                fatte[v["id"]] = {"lingua": TRADUCI[da], "quando": ora}
            for (v, k, _), t in zip(campi, tradotti):
                fatte[v["id"]][k] = t
        if ferma:
            break
    # le notizie restano 7 giorni: le traduzioni più vecchie di 10 non servono più
    limite = time.time() - 10 * 86400
    fatte = {k: t for k, t in fatte.items() if t.get("quando", 0) > limite}
    TRADUZIONI.write_text(json.dumps({"conto": conto, "voci": fatte}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for v in voci:
        t = fatte.get(v["id"])
        if t and t.get("titolo"):
            v["traduzione"] = {k: t[k] for k in ("lingua", "titolo", "testo") if t.get(k)}
    return errori


# ---------- loghi delle fonti ----------
# I loghi stanno in sito/loghi/ (li scarica una volta loghi.py) e l'app li mostra accanto al nome della fonte.
# Sono file del sito: chi apre il Radar non chiede niente a Google o ai giornali.

LOGHI = SITO / "loghi"
# Il sito di una fonte, quando il feed sta su un indirizzo diverso da quello del giornale
SITI = {"MarketWatch": "www.marketwatch.com", "Hacker News · AI": "news.ycombinator.com"}


def sito_fonte(f):
    if f.get("sito"):
        return f["sito"]
    if f["nome"] in SITI:
        return SITI[f["nome"]]
    return urllib.parse.urlsplit(f["url"]).hostname


def nome_logo(f):
    host = re.sub(r"^(www|feeds|rss|blog)\.", "", sito_fonte(f) or "")
    return re.sub(r"[^a-z0-9]+", "-", host.lower()).strip("-") + ".png"


def logo_fonte(f):
    nome = nome_logo(f)
    return f"loghi/{nome}" if (LOGHI / nome).exists() else None


# ---------- tutto insieme ----------

def leggi_json(nome):
    return json.loads((QUI / nome).read_text(encoding="utf-8"))


def raccogli():
    interessi = leggi_json("interessi.json")
    inizio = time.time()
    voci, err_notizie = notizie(interessi["fonti"])
    err_notizie += traduci(voci)
    quote, err_mercati = mercati(interessi["titoli"])
    dati = {
        "aggiornato": int(time.time() * 1000),
        "temi": interessi["temi"],
        "nascondi": interessi.get("nascondi", []),
        "fonti": [{**{k: f[k] for k in ("nome", "sezione", "lingua", "paese") if k in f}, **({"logo": l} if (l := logo_fonte(f)) else {})}
                  for f in interessi["fonti"] if f.get("attiva", True)],
        "notizie": voci,
        "mercati": quote,
        # tutto il catalogo, anche i mercati che in questo giro non hanno risposto: l'app li fa scegliere lo stesso
        "catalogo_mercati": [{k: t[k] for k in ("simbolo", "nome", "breve", "categoria", "predefinito", "fonte", "en") if k in t}
                             for t in interessi["titoli"]],
        "agenda": leggi_json("agenda.json"),
        "glossario": leggi_json("glossario.json"),
        "errori": err_notizie + err_mercati,
    }
    SITO.mkdir(exist_ok=True)
    if voci:  # senza notizie (rete giù) si tiene il dati.json di prima invece di svuotare la pagina
        (SITO / "dati.json").write_text(json.dumps(dati, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(voci)} notizie, {len(quote)} quotazioni, {len(dati['errori'])} errori in {time.time() - inizio:.1f}s")
    for e in dati["errori"]:
        print(f"  ! {e['fonte']}: {e['errore']}")
    return dati


def indirizzi_casa():
    """Gli indirizzi del PC nella rete di casa (192.168.x.x), quelli che il telefono sul Wi-Fi può raggiungere."""
    try:
        tutti = socket.gethostbyname_ex(socket.gethostname())[2]
    except OSError:
        return []
    return sorted(i for i in tutti if i.startswith("192.168."))


def gia_acceso():
    """Vero se qualcuno risponde già sulla porta del Radar (per esempio la copia nascosta partita con Windows)."""
    try:
        with socket.create_connection(("127.0.0.1", PORTA), timeout=1):
            return True
    except OSError:
        return False


class Gestore(SimpleHTTPRequestHandler):
    # Senza questo Safari (soprattutto l'app sulla schermata Home) tiene per ore i file vecchi e non vede le modifiche.
    # Con no-cache li tiene lo stesso, ma prima di usarli chiede se sono cambiati (risposta 304 se no: costa poco).
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


class GestoreLog(Gestore):
    def log_message(self, formato, *args):  # una riga corta per richiesta, in radar.log
        print(f"{datetime.now().strftime('%d/%m %H:%M:%S')}  {self.client_address[0]}  {formato % args}")


def servi(apri=True, gestore=Gestore):
    # Ascolta anche sulla rete di casa, così il telefono sullo stesso Wi-Fi lo apre. Serve solo la cartella sito/.
    server = ThreadingHTTPServer(("0.0.0.0", PORTA), partial(gestore, directory=str(SITO)))
    url = f"http://127.0.0.1:{PORTA}/"
    print(f"Radar su {url} (chiudi la finestra per fermarlo)")
    for ip in indirizzi_casa():
        print(f"Dal telefono, sullo stesso Wi-Fi: http://{ip}:{PORTA}/")
    if apri:
        webbrowser.open(url)
    server.serve_forever()


def nascosto():
    """Parte con Windows, senza finestra: serve subito la pagina (coi dati dell'ultimo giro) e riscarica ogni ora."""
    if LOG.exists() and LOG.stat().st_size > 1_000_000:
        LOG.write_text("", encoding="utf-8")
    sys.stdout = sys.stderr = open(LOG, "a", encoding="utf-8", buffering=1)

    def giri():
        while True:
            print(datetime.now().strftime("%d/%m/%Y %H:%M"), end="  ")
            try:
                ok = bool(raccogli()["notizie"])
            except Exception as e:  # un giro andato male non deve spegnere la pagina
                print(f"giro fallito: {e}")
                ok = False
            time.sleep(OGNI if ok else RIPROVA)

    threading.Thread(target=giri, daemon=True).start()
    servi(apri=False, gestore=GestoreLog)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--servi", action="store_true", help="dopo la raccolta apre la pagina in locale")
    p.add_argument("--nascosto", action="store_true", help="senza finestra: serve la pagina e riscarica ogni ora")
    a = p.parse_args()
    if gia_acceso():
        # Il Radar gira già (di solito quello nascosto): basta aprire la pagina, non serve un secondo server.
        if a.servi:
            webbrowser.open(f"http://127.0.0.1:{PORTA}/")
        if a.servi or a.nascosto:
            sys.exit(0)
    if a.nascosto:
        nascosto()
    dati = raccogli()
    if not dati["notizie"]:
        sys.exit("nessuna notizia: controlla la connessione")
    if a.servi:
        servi()
