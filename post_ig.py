#!/usr/bin/env python3
"""Nodus · il post di ogni giorno su Instagram (@nodus.it): un carosello 1080×1350 alle 18:00.

    py post_ig.py               il post di oggi in post/AAAA-MM-GG/ (PNG + didascalia.txt)
    py post_ig.py --prova       non segna niente come usato (per provare)
    python post_ig.py --auto --dati https://…/dati.json
                                su GitHub (.github/workflows/post.yml): il post di oggi, se non è già fatto e
                                sono passate le 18; poi pubblica_ig.py post lo pubblica

Deciso da Mattia il 09/11/2026: "La giornata in 3 notizie" + "la parola del giorno", alle 18:00.
  1 copertina: data, le 3 notizie in elenco, l'annuncio della parola
  2–4 le 3 notizie più importanti delle ultime 24 ore, al massimo una per sezione (come le storie)
  5 la parola del giorno: una voce del glossario dell'app, scelta fra quelle che compaiono nelle notizie del
    giorno; prima quelle mai uscite, poi quella uscita da più tempo
  6 chiusura col link nella bio
Come per le storie: niente AI, testi della testata (tradotti se in inglese) con la fonte, niente foto dei
giornali, niente prezzi dei mercati. Il testo delle notizie è esterno: nell'HTML sempre con html.escape.
"""
import argparse
import json
import re
from datetime import datetime, timedelta
from pathlib import Path

from storie_ig import (GIORNI, MESI, MARCHIO, PROFILO, QUI, ROMA, SEZIONI, candidati, e, esito, fotografa, icona,
                       leggi_dati, testo_it, DATI)

USCITA = QUI / "post"
USATE = USCITA / "usate.json"
ORA = 18                       # il post esce alle 18:00
FINESTRA = timedelta(hours=4)  # con --auto parte se sono passate meno di 4 ore (GitHub ritarda)
HASHTAG = "#notizie #finanza #economia #intelligenzaartificiale #tecnologia #educazionefinanziaria #nodus"

STILE = """
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=block');
*{box-sizing:border-box}
html,body{margin:0;width:1080px;height:1350px;background:#000;overflow:hidden}
body{color:#F5F5F7;font-family:Inter,"Segoe UI",system-ui,sans-serif}
.pagina{width:1080px;height:1350px;padding:96px 80px 84px;display:flex;flex-direction:column}
.anello{flex:none;border-radius:50%;border:4px solid var(--c);padding:6px}
.anello>div{width:100%;height:100%;border-radius:50%;background:var(--c);display:grid;place-items:center}
.testa{display:flex;align-items:center;gap:22px}
.testa .sez{font-size:36px;font-weight:700}
.data{margin-left:auto;font-size:30px;font-weight:500;color:#A1A1A6}
.marchio{display:flex;align-items:center;gap:12px;font-size:32px;font-weight:800;letter-spacing:-.02em;flex:none}
h1{margin:64px 0 0;font-size:112px;line-height:.98;font-weight:800;letter-spacing:-.045em}
h2{margin:0;font-weight:800;letter-spacing:-.035em;line-height:1.08;text-wrap:pretty}
.elenco{margin-top:56px;display:flex;flex-direction:column;gap:28px}
.riga{display:flex;align-items:center;gap:28px}
.riga .t{display:flex;flex-direction:column;gap:4px;min-width:0}
.riga .s{font-size:28px;font-weight:700}
.riga .h{font-size:32px;font-weight:600;line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.annuncio{margin-top:auto;display:flex;justify-content:space-between;align-items:center;border-top:2px solid #2C2C2E;padding-top:32px;font-size:32px;font-weight:600;color:#A1A1A6}
.annuncio b{color:#F5F5F7}
.cifra{margin-top:64px;font-size:150px;line-height:.95;font-weight:800;letter-spacing:-.05em;white-space:nowrap}
.testo{margin:30px 0 0;font-size:36px;line-height:1.4;color:#C7C7CC;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.piede{margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:32px;border-top:2px solid #2C2C2E;padding-top:32px}
.fonte{display:flex;align-items:center;gap:16px;font-size:30px;color:#A1A1A6;min-width:0}
.fonte img{width:44px;height:44px;border-radius:10px;background:#fff;object-fit:contain;flex:none}
.fonte span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.etichetta{font-size:34px;font-weight:700;color:#A1A1A6}
.parola{margin:56px 0 0;font-weight:800;letter-spacing:-.045em;line-height:1}
.esempio{margin-top:40px;border-left:6px solid var(--c);padding:6px 0 6px 32px;font-size:34px;line-height:1.4;color:#F5F5F7}
.esempio b{display:block;font-size:26px;letter-spacing:.06em;text-transform:uppercase;color:#A1A1A6;margin-bottom:8px}
.link{margin-top:96px;display:flex;flex-direction:column;align-items:center;gap:26px}
.bio{padding:32px 60px;border-radius:999px;background:#F5F5F7;color:#000;font-size:44px;font-weight:800;letter-spacing:-.02em;display:flex;flex-direction:column;align-items:center;gap:4px}
.bio span{font-size:30px;font-weight:600;color:#6E6E73;letter-spacing:0}
"""


def pagina(corpo):
    return f'<!doctype html><html lang="it"><head><meta charset="utf-8"><style>{STILE}</style></head><body><div class="pagina">{corpo}</div></body></html>'


def colore(sezione):
    return SEZIONI[sezione][1] if sezione in SEZIONI else "#F5F5F7"


# ---------------------------------------------------------------- cosa va nel post

# parole con la maiuscola che non sono nomi di un fatto: testate, rubriche, inizi di frase comuni
NON_NOMI = {"Guardian", "Reuters", "Bloomberg", "Editoriale", "Business", "Live", "Punto", "Quanto", "Come",
            "Perché", "Dopo", "Ecco", "Cosa", "Anche", "Oltre", "Questo", "Questa", "Nuovo", "Nuova", "Nuovi",
            "Prima", "Ultime", "Tutti", "Tutto", "Sono", "Nella", "Nelle", "Dalla", "Dalle", "Sulla", "Sulle"}


def nomi(c):
    """I nomi propri del titolo (Nvidia, Jensen, Huang): servono a capire se due notizie parlano dello stesso fatto
    anche quando le testate non sono finite nello stesso gruppo."""
    return {p for p in re.findall(r"\b[A-ZÀ-Ý][\wÀ-ÿ'-]{3,}", c["titolo"]) if p not in NON_NOMI}


def notizie_del_giorno(dati, oggi):
    """Le 3 notizie più importanti delle ultime 24 ore: al massimo una per sezione e mai due sullo stesso fatto."""
    dopo = (oggi - timedelta(hours=24)).timestamp() * 1000
    scelte, sezioni, visti = [], set(), set()
    for c in candidati(dati, dopo, set()):
        if c["n"]["sezione"] in sezioni or nomi(c) & visti:
            continue
        scelte.append(c)
        sezioni.add(c["n"]["sezione"])
        visti |= nomi(c)
        if len(scelte) == 3:
            break
    return scelte


def cerca(voce):
    """L'espressione che trova la voce del glossario in un testo: le sigle (BCE, ETF) solo in maiuscolo."""
    nomi = {voce["termine"], *voce.get("alias", [])}
    pezzi = []
    for nome in sorted(nomi, key=len, reverse=True):
        nome = re.sub(r"\s*\(.*?\)", "", nome).strip()   # "Plusvalenza (capital gain)" → "Plusvalenza"
        if len(nome) < 2:
            continue
        sigla = nome.isupper() and len(nome) <= 6
        pezzi.append(("" if sigla else "(?i:") + re.escape(nome) + ("" if sigla else ")"))
    return re.compile(r"(?<!\w)(?:" + "|".join(pezzi) + r")(?!\w)") if pezzi else None


def parola_del_giorno(dati, scelte, oggi, uscite):
    """La voce del glossario per oggi: prima quelle mai uscite, poi quella uscita da più tempo; a parità, quella
    che compare di più nelle 3 notizie del post (vale triplo) e nelle altre notizie del giorno."""
    dopo = (oggi - timedelta(hours=24)).timestamp() * 1000
    del_post = [" ".join(testo_it(c["n"]) or ("", "")) for c in scelte]
    altre = [" ".join(testo_it(n) or ("", "")) for n in dati["notizie"] if (n.get("data") or 0) >= dopo]
    migliore = None
    for i, voce in enumerate(dati.get("glossario", [])):
        r = cerca(voce)
        if not r:
            continue
        punti = 3 * sum(1 for t in del_post if r.search(t)) + sum(1 for t in altre if r.search(t))
        chiave = (uscite.get(voce["termine"], ""), -punti, i)   # "" (mai uscita) viene prima di ogni data
        if migliore is None or chiave < migliore[0]:
            migliore = (chiave, voce, punti)
    return (migliore[1], migliore[2]) if migliore else (None, 0)


# ---------------------------------------------------------------- le schermate

def copertina(scelte, voce, oggi):
    righe = "".join(
        f'<div class="riga">{icona(c["n"]["sezione"], 100)}<div class="t"><span class="s" style="color:{colore(c["n"]["sezione"])}">'
        f'{SEZIONI[c["n"]["sezione"]][0]}</span><span class="h">{e(c["titolo"])}</span></div></div>' for c in scelte)
    data = f'{GIORNI[oggi.weekday()].capitalize()} {oggi.day} {MESI[oggi.month - 1]}'
    annuncio = (f'<div class="annuncio"><span>E la parola del giorno: <b>{e(voce["termine"])}</b></span><span>→</span></div>'
                if voce else '<div class="annuncio"><span>Scorri</span><span>→</span></div>')
    return pagina(f'<div class="testa">{MARCHIO}<span class="data">{data}</span></div>'
                  f'<h1>La giornata in {len(scelte)} notizie</h1><div class="elenco">{righe}</div>{annuncio}')


def schermata(c, loghi):
    n = c["n"]
    lung = len(c["titolo"])
    grande = 68 if lung <= 70 else 58 if lung <= 100 else 52
    righe = 5 if not c["cifra"] else 3 if lung > 70 else 4
    logo = loghi.get(n["fonte"])
    altre = f' e altre {c["testate"] - 1}' if c["testate"] > 1 else ""
    fonte = (f'<span class="fonte">{f"<img src={chr(34)}{logo}{chr(34)}>" if logo else ""}'
             f'<span>Fonte: {e(n["fonte"])}{altre}</span></span>')
    cifra_html = f'<div class="cifra" style="color:{colore(n["sezione"])}">{e(c["cifra"])}</div>' if c["cifra"] else ""
    return pagina(
        f'<div class="testa">{icona(n["sezione"], 88)}<span class="sez" style="color:{colore(n["sezione"])}">'
        f'{SEZIONI[n["sezione"]][0]}</span></div>{cifra_html}'
        f'<h2 style="margin-top:{64 if c["cifra"] else 96}px;font-size:{grande}px">{e(c["titolo"])}</h2>'
        f'<p class="testo" style="-webkit-line-clamp:{righe}">{e(c["testo"])}</p>'
        f'<div class="piede">{fonte}{MARCHIO}</div>')


def schermata_parola(voce):
    c = colore(voce.get("categoria"))
    lung = len(voce["termine"])
    grande = 132 if lung <= 10 else 104 if lung <= 18 else 80
    esempio = (f'<div class="esempio" style="--c:{c}"><b>Esempio</b>{e(voce["esempio"])}</div>'
               if voce.get("esempio") else "")
    return pagina(f'<div class="testa"><span class="etichetta">La parola del giorno</span></div>'
                  f'<h2 class="parola" style="color:{c};font-size:{grande}px">{e(voce["termine"])}</h2>'
                  f'<p class="testo" style="font-size:38px;color:#E5E5EA">{e(voce["testo"])}</p>{esempio}'
                  f'<div class="piede"><span class="fonte"><span>Dal glossario di Nodus</span></span>{MARCHIO}</div>')


def chiusura():
    return pagina(f'<div class="testa">{MARCHIO}</div>'
                  '<h2 style="margin-top:110px;font-size:112px;line-height:.98;letter-spacing:-.045em">Le altre le trovi su Nodus</h2>'
                  '<p class="testo" style="font-size:38px">Ogni ora le notizie di finanza, economia, AI, tecnologia e scienza. '
                  'In cima quelle sui temi che scegli tu, e le parole difficili spiegate semplici.</p>'
                  f'<div class="link"><div class="bio">Link nella bio<span>{PROFILO}</span></div>'
                  '<span style="font-size:32px;font-weight:600">È gratis</span></div>')


def didascalia(scelte, voce, oggi):
    data = f'{GIORNI[oggi.weekday()]} {oggi.day} {MESI[oggi.month - 1]}'
    righe = [f"La giornata in {len(scelte)} notizie · {data}", ""]
    righe += [f"{i}. {c['titolo']} ({c['n']['fonte']})" for i, c in enumerate(scelte, 1)]
    if voce:
        righe += ["", f"📖 La parola del giorno: {voce['termine']}", voce["testo"]]
    righe += ["", "Tutte le notizie, ogni ora, su Nodus: link nella bio.", "", HASHTAG]
    return "\n".join(righe)[:2200]   # il limite di Instagram


# ---------------------------------------------------------------- tutto insieme

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--auto", action="store_true", help="il post di oggi, se sono passate le 18 e non è già fatto")
    ap.add_argument("--dati", default=str(DATI), help="file o indirizzo https di dati.json")
    ap.add_argument("--prova", action="store_true", help="non segna niente come usato")
    a = ap.parse_args()
    oggi = datetime.now(ROMA)
    giorno = oggi.strftime("%Y-%m-%d")
    try:
        registro = json.loads(USATE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        registro = {}
    registro.setdefault("giorni", [])
    registro.setdefault("parole", {})
    if a.auto:
        inizio = oggi.replace(hour=ORA, minute=0, second=0, microsecond=0)
        if not (inizio <= oggi < inizio + FINESTRA) or giorno in registro["giorni"]:
            print(f"{oggi:%H:%M}: niente post da fare adesso")
            return

    dati = leggi_dati(a.dati)
    scelte = notizie_del_giorno(dati, oggi)
    if len(scelte) < 2:
        print("meno di 2 notizie buone nelle ultime 24 ore: il post salta")
        return
    voce, punti = parola_del_giorno(dati, scelte, oggi, registro["parole"])

    loghi = {f["nome"]: (QUI / "sito" / f["logo"]).as_uri() for f in dati["fonti"] if f.get("logo")}
    pagine = [copertina(scelte, voce, oggi)] + [schermata(c, loghi) for c in scelte]
    pagine += ([schermata_parola(voce)] if voce else []) + [chiusura()]

    cartella = USCITA / giorno
    if cartella.exists():
        for vecchio in cartella.glob("*.png"):
            vecchio.unlink()
    cartella.mkdir(parents=True, exist_ok=True)
    fotografa(pagine, cartella, alto=1350)
    (cartella / "didascalia.txt").write_text(didascalia(scelte, voce, oggi), encoding="utf-8")
    elenco = [f"Post del {giorno} ({len(pagine)} schermate)", ""]
    elenco += [f"- [{SEZIONI[c['n']['sezione']][0]}] {c['titolo']} ({c['n']['fonte']})\n  {c['n']['link']}" for c in scelte]
    if voce:
        elenco += ["", f"Parola del giorno: {voce['termine']} (trovata {punti} volte nelle notizie)"]
    (cartella / "notizie.txt").write_text("\n".join(elenco) + "\n", encoding="utf-8")

    if not a.prova:
        registro["giorni"] = sorted(set(registro["giorni"]) | {giorno})[-30:]
        if voce:
            registro["parole"][voce["termine"]] = giorno
        USATE.write_text(json.dumps(registro, ensure_ascii=False), encoding="utf-8")
    esito(cartella=cartella.as_posix(), nome=cartella.name)
    print(f"post: {len(pagine)} schermate in {cartella}")
    for c in scelte:
        print(f"  [{c['n']['sezione']}] {c['titolo'][:80]} ({c['n']['fonte']}, punti {c['punti']:.1f})")
    if voce:
        print(f"  parola del giorno: {voce['termine']} ({punti})")


if __name__ == "__main__":
    main()
