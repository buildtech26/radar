#!/usr/bin/env python3
"""Radar: manda le notifiche. Gira su GitHub Actions dopo raccogli.py e la pubblicazione (vedi pubblica.yml).

    python notifica.py                       manda davvero (servono le chiavi qui sotto)
    python notifica.py --prova FILE.json     non manda niente: legge iscrizioni, profili e registro da FILE.json
                                             ({"iscrizioni": [...], "profili": [...], "inviate": [...]}) e stampa
                                             cosa partirebbe. Con --ora "2026-11-07 15:10" finge un'altra ora italiana.

Chi riceve cosa (scelto da Mattia il 07/11/2026):
- solo chi ha l'account e ha acceso l'interruttore su almeno un dispositivo (tabella iscrizioni);
- per ogni sezione al massimo un tema, scelto in Il tuo Radar → Notifiche (profilo.notifiche = {sezione: tema});
- una notizia vale se ha il tema nel titolo (anche in quello tradotto), è di una sezione e di un paese che la
  persona vede, ed è uscita dall'ultimo giro (3 ore di margine; al primo giro del mattino, dalle 21 della sera prima);
- un fatto ripreso da più testate conta una volta; più notizie sullo stesso tema nello stesso giro = una notifica;
- al massimo 2 notifiche al giorno per tema e 5 in tutto (giorno italiano), e solo dalle 8 alle 22;
- niente due volte: il registro (notifiche_inviate) tiene gli id per 3 giorni.

Chiavi, dai Secret di GitHub: SUPABASE_SERVICE_KEY (la chiave di servizio, salta le regole del database: solo qui,
mai nella pagina) e VAPID_PRIVATE_KEY (la privata delle notifiche; la pubblica è in sito/config.js). Senza, esce
senza fare niente. Il repo è pubblico e i log di GitHub li vede chiunque: si stampano solo conteggi, mai
indirizzi, utenti o scelte.
"""
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

QUI = Path(__file__).resolve().parent
SITO = QUI / "sito"
RADAR = "https://buildtech26.github.io/radar/"
# il "chi sono" delle notifiche per i servizi push: un sito invece di una mail, ma solo l'indirizzo, senza percorso
# (con "/radar/" py_vapid lo rifiuta)
SOGGETTO = "https://buildtech26.github.io"

PER_TEMA, IN_TUTTO = 2, 5
DALLE, ALLE = 8, 22
MARGINE = timedelta(hours=3)
RICORDA = timedelta(days=3)
SEZIONI = ["finanza", "economia", "ai", "tech", "scienza"]
PAESI = ["it", "eu", "us", "gb"]


# ---------- l'ora italiana, senza dipendere dal fuso del computer ----------

def ultima_domenica(anno, mese):
    d = datetime(anno, mese + 1, 1, tzinfo=timezone.utc) - timedelta(days=1) if mese < 12 else datetime(anno, 12, 31, tzinfo=timezone.utc)
    return d - timedelta(days=(d.weekday() + 1) % 7)


def in_italia(t):
    """t in UTC → ora italiana (CET/CEST: l'ora legale va dall'ultima domenica di marzo a quella di ottobre, all'1 UTC)."""
    inizio = ultima_domenica(t.year, 3).replace(hour=1)
    fine = ultima_domenica(t.year, 10).replace(hour=1)
    scarto = 2 if inizio <= t < fine else 1
    return (t + timedelta(hours=scarto)).replace(tzinfo=timezone(timedelta(hours=scarto)))


# ---------- Supabase (REST, con la chiave di servizio) ----------

class Supabase:
    def __init__(self, url, chiave):
        self.url, self.chiave = url.rstrip("/"), chiave

    def chiama(self, metodo, percorso, corpo=None, prefer=None):
        intest = {"apikey": self.chiave}
        if self.chiave.startswith("eyJ"):   # chiave vecchia (JWT): va anche in Authorization
            intest["Authorization"] = "Bearer " + self.chiave
        if corpo is not None:
            intest["Content-Type"] = "application/json"
        if prefer:
            intest["Prefer"] = prefer
        dati = json.dumps(corpo).encode() if corpo is not None else None
        req = urllib.request.Request(self.url + percorso, data=dati, headers=intest, method=metodo)
        with urllib.request.urlopen(req, timeout=30) as r:
            testo = r.read().decode()
        return json.loads(testo) if testo else None

    def tutte(self, percorso):
        """Una tabella intera, a pagine da 1000."""
        righe, da = [], 0
        while True:
            sep = "&" if "?" in percorso else "?"
            pagina = self.chiama("GET", f"{percorso}{sep}limit=1000&offset={da}")
            righe += pagina
            if len(pagina) < 1000:
                return righe
            da += 1000


class Prova:
    """Al posto di Supabase: legge da un file e stampa quello che scriverebbe."""
    def __init__(self, file):
        self.d = json.loads(Path(file).read_text(encoding="utf-8"))

    def iscrizioni(self): return self.d.get("iscrizioni", [])
    def profili(self, utenti): return [p for p in self.d.get("profili", []) if p["utente"] in utenti]
    def inviate(self, dal): return [r for r in self.d.get("inviate", []) if r["quando"] >= dal]
    def registra(self, righe):
        self.d.setdefault("inviate", []).extend(righe)   # così un secondo giro nella stessa prova se ne ricorda
        print(f"  [prova] registro +{len(righe)} righe")
    def togli_iscrizione(self, endpoint): print("  [prova] iscrizione scaduta tolta")
    def pulisci(self, prima): pass


class Vero:
    def __init__(self, sb):
        self.sb = sb

    def iscrizioni(self):
        return self.sb.tutte("/rest/v1/iscrizioni?select=endpoint,utente,p256dh,auth,lingua")

    def profili(self, utenti):
        out, utenti = [], sorted(utenti)
        for i in range(0, len(utenti), 100):
            lista = ",".join(utenti[i:i + 100])
            out += self.sb.chiama("GET", f"/rest/v1/profili?select=utente,profilo&utente=in.({lista})")
        return out

    def inviate(self, dal):
        return self.sb.tutte("/rest/v1/notifiche_inviate?select=utente,tema,notizie,quando&quando=gte." + urllib.parse.quote(dal))

    def registra(self, righe):
        if righe:
            self.sb.chiama("POST", "/rest/v1/notifiche_inviate", righe, prefer="return=minimal")

    def togli_iscrizione(self, endpoint):
        self.sb.chiama("DELETE", "/rest/v1/iscrizioni?endpoint=eq." + urllib.parse.quote(endpoint, safe=""), prefer="return=minimal")

    def pulisci(self, prima):
        self.sb.chiama("DELETE", "/rest/v1/notifiche_inviate?quando=lt." + urllib.parse.quote(prima), prefer="return=minimal")


# ---------- i temi, come li riconosce l'app (compilaTemi in app.js) ----------

PRIMA, DOPO = r"(?<![^\W_])", r"(?![^\W_])"   # come BORDO_PRIMA/BORDO_DOPO: niente lettere o cifre attaccate


def espressione(parole):
    parti = [re.escape(p.lower()) + (DOPO if len(p) <= 3 else "") for p in parole if p]
    return re.compile(PRIMA + "(?:" + "|".join(parti) + ")", re.I) if parti else None


def nome_tema(t, lingua):
    return (t.get("en") or {}).get("nome") or t["nome"] if lingua == "en" else t["nome"]


def titoli(n):
    tr = n.get("traduzione") or {}
    return [n.get("titolo") or ""] + ([tr["titolo"]] if tr.get("titolo") else [])


def titolo_per(n, lingua):
    tr = n.get("traduzione") or {}
    if n.get("lingua") != lingua and tr.get("lingua") == lingua and tr.get("titolo"):
        return tr["titolo"]
    return n.get("titolo") or ""


# ---------- le scelte di una persona (come paesiScelti/sezioniScelte in app.js) ----------

def sezioni_di(profilo):
    p = profilo.get("sezioni") or {}
    s = {k for k in SEZIONI if p.get(k) is not False}
    return s or set(SEZIONI)


def paesi_di(profilo, lingua):
    proposti = {"it": True, "eu": True, "us": True, "gb": False} if lingua == "it" else {"it": False, "eu": True, "us": True, "gb": True}
    p = profilo.get("paesi") or proposti
    s = {k for k in PAESI if p.get(k)}
    return s or {k for k, v in proposti.items() if v}


# ---------- il giro ----------

def prepara_fatti(dati):
    paese_fonte = {f["nome"]: f.get("paese") for f in dati.get("fonti", [])}
    nasc = [re.escape(x) for x in dati.get("nascondi", []) if x]
    via = re.compile(PRIMA + "(?:" + "|".join(nasc) + ")", re.I) if nasc else None
    gruppi = defaultdict(list)
    for n in dati["notizie"]:
        if not n.get("data") or (via and via.search(n.get("titolo") or "")):
            continue
        n["_paese"] = n.get("paese") or paese_fonte.get(n["fonte"]) or ("it" if n.get("lingua") == "it" else "us")
        gruppi[n.get("gruppo") or n["id"]].append(n)
    return list(gruppi.values())


def scegli(utente, profilo, lingua, fatti, temi, gia, oggi, inizio_ms):
    """Le notifiche per una persona: [(tema, notizia principale, quante altre, tutti gli id)], già nei tetti."""
    sezioni, paesi = sezioni_di(profilo), paesi_di(profilo, lingua)
    scelte = profilo.get("notifiche") or {}
    per_tema = Counter(r["tema"] for r in oggi)
    restano = IN_TUTTO - len(oggi)
    proposte = []
    for sezione, tid in scelte.items():
        t = temi.get(tid)
        if not t or t["gruppo"] != sezione or sezione not in sezioni or per_tema[tid] >= PER_TEMA:
            continue
        candidati = []
        for g in fatti:
            if any(n["id"] in gia for n in g):
                continue
            visti = [n for n in g if n["sezione"] in sezioni and n["_paese"] in paesi]
            if not visti or max(n["data"] for n in visti) < inizio_ms:
                continue
            if not any(t["re"].search(x) for n in visti for x in titoli(n)):
                continue
            # la notizia da mostrare: nella lingua della persona, o tradotta nella sua lingua, o la più recente
            prima = sorted(visti, key=lambda n: (n.get("lingua") == lingua, (n.get("traduzione") or {}).get("lingua") == lingua, n["data"]), reverse=True)[0]
            candidati.append((len(g), max(n["data"] for n in visti), prima, [n["id"] for n in g]))
        if candidati:
            candidati.sort(key=lambda c: (c[0], c[1]), reverse=True)
            ids = [i for c in candidati for i in c[3]]
            proposte.append((candidati[0][0], candidati[0][1], tid, candidati[0][2], len(candidati) - 1, ids))
    proposte.sort(key=lambda p: (p[0], p[1]), reverse=True)   # oltre il tetto passano i fatti ripresi da più testate
    return [(tid, prima, altre, ids) for _, _, tid, prima, altre, ids in proposte[:max(restano, 0)]]


def messaggio(tema, n, altre, lingua):
    fonte = n["fonte"]
    if altre:
        fonte += f" · and {altre} more" if lingua == "en" else f" · e altre {altre}"
    return {
        "titolo": nome_tema(tema, lingua),
        "testo": f"{titolo_per(n, lingua)}\n{fonte}",
        "url": RADAR + "#notizia=" + urllib.parse.quote(n["id"]),
        "tag": f"radar-{tema['id']}-{n['id']}",
        "lingua": lingua,
    }


def manda(iscrizione, carico, chiave_vapid):
    """True se è arrivata al servizio push, False se no, None se l'iscrizione non esiste più (da togliere)."""
    from pywebpush import WebPushException, webpush
    try:
        webpush(
            subscription_info={"endpoint": iscrizione["endpoint"], "keys": {"p256dh": iscrizione["p256dh"], "auth": iscrizione["auth"]}},
            data=json.dumps(carico, ensure_ascii=False),
            vapid_private_key=chiave_vapid,
            vapid_claims={"sub": SOGGETTO},
            ttl=6 * 3600,   # se il telefono resta spento più di 6 ore, quella notizia non serve più
            timeout=15,
        )
        return True
    except WebPushException as e:
        stato = getattr(e.response, "status_code", None)
        return None if stato in (404, 410) else False
    except Exception:
        return False


def giro(db, adesso, chiave_vapid=None, prova=False):
    qui = in_italia(adesso)
    if not (DALLE <= qui.hour < ALLE):
        print(f"Notifiche: silenzio ({qui:%H:%M} in Italia, si manda dalle {DALLE} alle {ALLE}).")
        return
    dati = json.loads((SITO / "dati.json").read_text(encoding="utf-8"))
    temi = {}
    for t in dati.get("temi", []):
        r = espressione(t.get("parole", []))
        if r:
            temi[t["id"]] = {**t, "re": r}
    fatti = prepara_fatti(dati)

    iscrizioni = db.iscrizioni()
    per_utente = defaultdict(list)
    for s in iscrizioni:
        per_utente[s["utente"]].append(s)
    if not per_utente:
        print("Notifiche: nessun dispositivo iscritto.")
        return
    profili = {p["utente"]: p.get("profilo") or {} for p in db.profili(set(per_utente))}

    mezzanotte = qui.replace(hour=0, minute=0, second=0, microsecond=0)
    registro = db.inviate((adesso - RICORDA).isoformat())
    inizio = adesso - MARGINE
    if qui.hour < DALLE + 2:   # il primo giro del mattino recupera la notte, dalle 21
        inizio = min(inizio, mezzanotte - timedelta(hours=3))
    inizio_ms = inizio.timestamp() * 1000

    conti = Counter()
    nuove = []
    for utente, sue in per_utente.items():
        profilo = profili.get(utente)
        if not profilo or not profilo.get("notifiche"):
            conti["senza temi"] += 1
            continue
        lingua = profilo.get("interfaccia") or Counter(s.get("lingua") or "it" for s in sue).most_common(1)[0][0]
        suoi = [r for r in registro if r["utente"] == utente]
        gia = {i for r in suoi for i in r.get("notizie") or []}
        oggi = [r for r in suoi if datetime.fromisoformat(r["quando"]) >= mezzanotte]
        for tid, n, altre, ids in scegli(utente, profilo, lingua, fatti, temi, gia, oggi, inizio_ms):
            arrivata = False
            for s in list(sue):
                carico = messaggio(temi[tid], n, altre, s.get("lingua") or lingua)
                if prova:
                    print(f"  → [{carico['lingua']}] {carico['titolo']}: {carico['testo'].replace(chr(10), ' | ')}  ({carico['url'][len(RADAR):]})")
                    esito = True
                else:
                    esito = manda(s, carico, chiave_vapid)
                if esito is None:
                    db.togli_iscrizione(s["endpoint"])
                    sue.remove(s)
                    conti["iscrizioni scadute"] += 1
                elif esito:
                    arrivata = True
                    conti["consegnate"] += 1
                else:
                    conti["non consegnate"] += 1
            if arrivata:
                conti["notifiche"] += 1
                nuove.append({"utente": utente, "tema": tid, "notizie": ids, "quando": adesso.isoformat()})
    db.registra(nuove)
    db.pulisci((adesso - RICORDA).isoformat())
    riassunto = ", ".join(f"{k} {v}" for k, v in sorted(conti.items())) or "niente di nuovo"
    print(f"Notifiche ({qui:%H:%M} in Italia): {len(per_utente)} persone iscritte; {riassunto}.")


def url_supabase():
    m = re.search(r'url:\s*"([^"]+)"', (SITO / "config.js").read_text(encoding="utf-8"))
    return os.environ.get("SUPABASE_URL") or (m and m.group(1))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--prova", metavar="FILE", help="non manda niente: dati finti da FILE, stampa cosa partirebbe")
    ap.add_argument("--ora", help='ora italiana finta per la prova, "AAAA-MM-GG HH:MM"')
    a = ap.parse_args()
    adesso = datetime.now(timezone.utc)
    if a.ora:
        finta = datetime.strptime(a.ora, "%Y-%m-%d %H:%M")
        adesso = (finta - (in_italia(finta.replace(tzinfo=timezone.utc)).utcoffset())).replace(tzinfo=timezone.utc)
    if a.prova:
        return giro(Prova(a.prova), adesso, prova=True)
    chiave_sb, chiave_vapid = os.environ.get("SUPABASE_SERVICE_KEY", "").strip(), os.environ.get("VAPID_PRIVATE_KEY", "").strip()
    if not chiave_sb or not chiave_vapid:
        print("Notifiche: mancano SUPABASE_SERVICE_KEY o VAPID_PRIVATE_KEY nei Secret, non mando niente.")
        return
    try:
        giro(Vero(Supabase(url_supabase(), chiave_sb)), adesso, chiave_vapid)
    except urllib.error.HTTPError as e:
        # solo il codice: il corpo della risposta potrebbe contenere dati delle persone
        sys.exit(f"Notifiche: Supabase ha risposto {e.code}.")


if __name__ == "__main__":
    main()
