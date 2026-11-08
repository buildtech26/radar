#!/usr/bin/env python3
"""Nodus · storie Instagram: sceglie le notizie da sito/dati.json e disegna le schermate (PNG 1080×1920).

    py storie_ig.py                 il giro dell'ora: mattina (prima delle 11), pranzo (prima delle 17), sera
    py storie_ig.py --giro pranzo   un giro preciso
    py storie_ig.py --prova         non segna le notizie come usate (per provare)

Tre giri al giorno, decisi da Mattia l'08/11/2026:
  mattina 7:30  copertina + la notizia migliore di ogni sezione + schermata col link a Nodus
  pranzo 13:00  2–3 notizie uscite dopo le 7:00, mai già usate oggi (niente link)
  sera   19:30  2–3 notizie uscite dopo le 12:30, mai già usate oggi + schermata col link
Se a pranzo o la sera ci sono meno di 2 notizie buone, il giro salta.

Niente AI (scelta di Mattia): titolo e sommario sono quelli della testata (tradotti se in inglese, dalle
traduzioni di raccogli.py), con la fonte. La cifra grande c'è solo se nel testo c'è una cifra chiara (soldi o %).
Niente foto dei giornali (diritti) e niente prezzi dei mercati (Yahoo non è una fonte ufficiale).
Le schermate escono in storie/AAAA-MM-GG-giro/ con notizie.txt (titoli e link, per controllare prima di pubblicare).
Il testo delle notizie arriva da siti esterni: nell'HTML va sempre con html.escape, mai come markup.
"""
import argparse
import html
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timedelta
from pathlib import Path

QUI = Path(__file__).resolve().parent
DATI = QUI / "sito" / "dati.json"
USCITA = QUI / "storie"
USATE = USCITA / "usate.json"

SEZIONI = {
    "finanza": ("Finanza", "#30D158", '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'),
    "economia": ("Economia", "#FF9F0A", '<path d="M3 21h18"/><path d="M5 17v-6"/><path d="M9.5 17v-6"/><path d="M14.5 17v-6"/><path d="M19 17v-6"/><path d="M12 3l9 5H3z"/>'),
    "ai": ("AI", "#7D7AFF", '<path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
    "tech": ("Tech", "#64D2FF", '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>'),
    "scienza": ("Scienza", "#FF6482", '<circle cx="12" cy="12" r="1.5"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(45 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-45 12 12)"/>'),
}
GIRI = {"mattina": "7:30", "pranzo": "13:00", "sera": "19:30"}
GIORNI = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"]
MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre",
        "novembre", "dicembre"]

# fonti e titoli che non sono notizie da storia: rilasci di software, offerte, rubriche di consigli personali
FONTI_ESCLUSE = {"Simon Willison", "Hacker News · AI"}
TITOLI_ESCLUSI = re.compile(r"\bin offerta\b|\bofferte? (del giorno|amazon)\b|\bcoupon\b|\bblack friday\b|\bprime day\b"
                            r"|\bcodice sconto\b|\bminimo storico\b|\bweekly beasts\b|prezzo più basso|\bin sconto\b"
                            r"|\blowest price\b|\bdeals?\b|\bbest buy\b", re.I)


# ---------------------------------------------------------------- le notizie

def testo_it(n):
    """Titolo e testo in italiano: l'originale, o la traduzione di raccogli.py. None se non c'è."""
    if n["lingua"] == "it":
        return n["titolo"], n.get("testo") or n["sommario"]
    tr = n.get("traduzione") or {}
    if tr.get("lingua") == "it" and tr.get("titolo"):
        return tr["titolo"], tr.get("testo") or ""
    return None


def cifra(*testi):
    """La cifra da mettere in grande: soldi (377 mld $, 2,23 €) o percentuali (4%). "" se non ce n'è una chiara."""
    unita = {"miliardi": "mld", "miliardo": "mld", "mld": "mld", "milioni": "mln", "milione": "mln", "mln": "mln", "mila": "mila"}
    valute = {"dollari": "$", "dollaro": "$", "$": "$", "euro": "€", "€": "€", "sterline": "£", "£": "£"}
    for t in testi:
        m = re.search(r"(?<![\w.,])(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)\s*(miliardi|miliardo|milioni|milione|mila|mld|mln)?\s*(?:di\s+)?(dollari|dollaro|euro|sterline|\$|€|£)(?!\w)", t or "", re.I)
        if m:
            s = " ".join(x for x in (m.group(1), unita.get((m.group(2) or "").lower(), ""), valute[m.group(3).lower()]) if x)
            if len(s) <= 10:
                return s
        m = re.search(r"(?<![\w.,])(\d+(?:,\d+)?)\s*(%|per cento)", t or "", re.I)
        if m:
            return m.group(1) + "%"
    return ""


def candidati(dati, dopo, usate):
    """Le notizie buone per una storia, uscite dopo `dopo` (ms), una per fatto, col loro punteggio."""
    temi = [p.lower() for t in dati["temi"] if t.get("predefinito") for p in t.get("parole", [])]
    gruppi = {}
    for n in dati["notizie"]:
        gruppi.setdefault(n.get("gruppo") or n["id"], []).append(n)
    adesso = time.time() * 1000
    scelte = []
    for g in gruppi.values():
        if any(n["id"] in usate for n in g):
            continue
        g = sorted(g, key=lambda n: (n["lingua"] != "it", -(n["data"] or 0)))   # l'italiana prima, come nell'app
        for n in g:
            it = testo_it(n)
            if not it or not n["data"] or n["data"] < dopo or n["sezione"] not in SEZIONI or n["fonte"] in FONTI_ESCLUSE:
                continue
            titolo, testo = it
            if len(titolo) < 25 or len(testo) < 40 or TITOLI_ESCLUSI.search(titolo):
                continue
            if n["fonte"] == "MarketWatch" and "?" in titolo:   # le rubriche "cosa devo fare con i miei soldi?"
                continue
            tutto = (titolo + " " + testo).lower()
            punti = (3 * (len(g) - 1)                                   # più testate ne parlano, più conta
                     + 2 * min(2, sum(1 for p in temi if p in tutto))   # tocca i temi predefiniti dell'app
                     + (1 if n["lingua"] == "it" else 0)
                     + (1 if cifra(titolo, testo) else 0)
                     + max(0.0, 1 - (adesso - n["data"]) / (24 * 3600e3)))  # le più fresche, a parità
            scelte.append({"n": n, "titolo": titolo, "testo": testo, "testate": len(g), "punti": punti,
                           "cifra": cifra(titolo, testo)})
            break
    return sorted(scelte, key=lambda c: -c["punti"])


def scegli(dati, giro, oggi, usate):
    if giro == "mattina":
        dopo = (oggi - timedelta(hours=20)).timestamp() * 1000
        tutte = candidati(dati, dopo, usate)
        scelte = []
        for s in SEZIONI:   # la migliore di ogni sezione, nell'ordine dell'app
            c = next((c for c in tutte if c["n"]["sezione"] == s), None)
            if c:
                scelte.append(c)
        return scelte
    inizio = oggi.replace(hour=7, minute=0) if giro == "pranzo" else oggi.replace(hour=12, minute=30)
    scelte, per_sezione = [], {}
    for c in candidati(dati, inizio.timestamp() * 1000, usate):
        s = c["n"]["sezione"]
        if per_sezione.get(s, 0) < 2:
            scelte.append(c)
            per_sezione[s] = per_sezione.get(s, 0) + 1
        if len(scelte) == 3:
            break
    return scelte if len(scelte) >= 2 else []


# ---------------------------------------------------------------- le schermate

def e(s):
    return html.escape(s or "", quote=True)


def icona(sezione, lato):
    _, colore, tracce = SEZIONI[sezione]
    return (f'<div class="anello" style="--c:{colore};width:{lato}px;height:{lato}px"><div><svg width="{lato * 0.4:.0f}" '
            f'height="{lato * 0.4:.0f}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" '
            f'stroke-linecap="round" stroke-linejoin="round">{tracce}</svg></div></div>')


def nodo(lato, fondo="#000"):
    """Il logo di Nodus (scelto da Mattia il 09/11/2026): un nodo a trifoglio a tre colori (finanza, economia, AI)
    con gli incroci sopra/sotto alternati. Il pezzo che passa sopra è ridisegnato con un bordo del colore del
    fondo, che fa da stacco; i cambi di colore cadono sotto un incrocio, così non si vedono. È lo stesso di
    sito/icona.svg."""
    N, k = 720, 26
    sopra, sotto = (31, 271, 511), (208, 448, 688)   # indici dei punti dove il filo passa sopra / sotto
    colori = ("#30D158", "#FF9F0A", "#7D7AFF")
    pts = []
    for i in range(N):
        t = 2 * math.pi * i / N
        pts.append((50 + 12.4 * (math.sin(t) + 2 * math.sin(2 * t)), 52 - 12.4 * (math.cos(t) - 2 * math.cos(2 * t))))

    def tratto(da, a):
        return "M" + " L".join(f"{pts[i % N][0]:.1f} {pts[i % N][1]:.1f}" for i in range(da, a + 1))

    def colore_di(s):
        return next(colori[c] for c in range(3)
                    if (sotto[c] <= s < sotto[(c + 1) % 3]) or (c == 2 and (s >= sotto[2] or s < sotto[0])))

    parti = [f'<path d="{tratto(sotto[c], sotto[(c + 1) % 3] + (N if c == 2 else 0))}" stroke="{colori[c]}"/>' for c in range(3)]
    for i in sopra:
        parti.append(f'<path d="{tratto(i - k, i + k)}" stroke="{fondo}" stroke-width="14.9" stroke-linecap="butt"/>')
        parti.append(f'<path d="{tratto(i - k - 1, i + k + 1)}" stroke="{colore_di(i)}"/>')
    return (f'<svg width="{lato}" height="{lato}" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" '
            f'stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round">{"".join(parti)}</g></svg>')


MARCHIO = f'<span class="marchio">{nodo(44)}Nodus</span>'

STILE = """
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=block');
*{box-sizing:border-box}
html,body{margin:0;width:1080px;height:1920px;background:#000;overflow:hidden}
body{color:#F5F5F7;font-family:Inter,"Segoe UI",system-ui,sans-serif}
.pagina{width:1080px;height:1920px;padding:260px 80px 300px;display:flex;flex-direction:column}
.anello{flex:none;border-radius:50%;border:4px solid var(--c);padding:6px}
.anello>div{width:100%;height:100%;border-radius:50%;background:var(--c);display:grid;place-items:center}
.testa{display:flex;align-items:center;gap:24px}
.testa .sez{font-size:38px;font-weight:700}
.testa .conta{margin-left:auto;font-size:30px;font-weight:600;color:#A1A1A6}
.cifra{margin-top:110px;font-size:180px;line-height:.95;font-weight:800;letter-spacing:-.05em;white-space:nowrap}
h2{margin:0;font-weight:800;letter-spacing:-.035em;line-height:1.08;text-wrap:pretty}
.testo{margin:36px 0 0;font-size:40px;line-height:1.42;color:#C7C7CC;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.piede{margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:32px;border-top:2px solid #2C2C2E;padding-top:36px}
.fonte{display:flex;align-items:center;gap:16px;font-size:30px;color:#A1A1A6;min-width:0}
.fonte img{width:44px;height:44px;border-radius:10px;background:#fff;object-fit:contain;flex:none}
.fonte span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.marchio{display:flex;align-items:center;gap:12px;font-size:32px;font-weight:800;letter-spacing:-.02em;flex:none}
.data{font-size:30px;font-weight:500;color:#A1A1A6}
h1{margin:88px 0 0;font-size:136px;line-height:.98;font-weight:800;letter-spacing:-.045em}
.elenco{margin-top:80px;display:flex;flex-direction:column;gap:34px}
.riga{display:flex;align-items:center;gap:32px}
.riga .t{display:flex;flex-direction:column;gap:4px;min-width:0}
.riga .s{font-size:30px;font-weight:700}
.riga .h{font-size:34px;font-weight:600;line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.avanti{margin-top:auto;font-size:32px;font-weight:600;color:#A1A1A6}
.link{margin-top:120px;display:flex;flex-direction:column;align-items:center;gap:28px}
.posto{width:640px;height:150px;border:4px dashed #48484A;border-radius:36px;display:grid;place-items:center;font-size:30px;color:#8E8E93}
.nota{margin:auto 0 0;border-top:2px solid #2C2C2E;padding-top:36px;font-size:28px;color:#8E8E93}
"""


def pagina(corpo):
    return f'<!doctype html><html lang="it"><head><meta charset="utf-8"><style>{STILE}</style></head><body><div class="pagina">{corpo}</div></body></html>'


def copertina(scelte, oggi):
    righe = "".join(
        f'<div class="riga">{icona(c["n"]["sezione"], 112)}<div class="t"><span class="s" style="color:{SEZIONI[c["n"]["sezione"]][1]}">'
        f'{SEZIONI[c["n"]["sezione"]][0]}</span><span class="h">{e(c["titolo"])}</span></div></div>' for c in scelte)
    data = f'{GIORNI[oggi.weekday()].capitalize()} {oggi.day} {MESI[oggi.month - 1]}'
    return pagina(f'<div class="testa">{MARCHIO}<span class="data" style="margin-left:auto">{data}</span></div>'
                  f'<h1>Le {len(scelte)} notizie di oggi</h1><div class="elenco">{righe}</div>'
                  f'<div class="avanti">Tocca per andare avanti →</div>')


def schermata(c, i, quante, etichetta, loghi):
    n = c["n"]
    nome, colore, _ = SEZIONI[n["sezione"]]
    lung = len(c["titolo"])
    grande = 76 if lung <= 70 else 66 if lung <= 100 else 58
    righe = 6 if not c["cifra"] else 4 if lung > 70 else 5
    logo = loghi.get(n["fonte"])
    altre = f' e altre {c["testate"] - 1}' if c["testate"] > 1 else ""
    fonte = (f'<span class="fonte">{f"<img src={chr(34)}{logo}{chr(34)}>" if logo else ""}'
             f'<span>Fonte: {e(n["fonte"])}{altre}</span></span>')
    cifra_html = f'<div class="cifra" style="color:{colore}">{e(c["cifra"])}</div>' if c["cifra"] else ""
    return pagina(
        f'<div class="testa">{icona(n["sezione"], 96)}<span class="sez" style="color:{colore}">{nome}</span>'
        f'<span class="conta">{e(etichetta)}{i} di {quante}</span></div>{cifra_html}'
        f'<h2 style="margin-top:{96 if c["cifra"] else 140}px;font-size:{grande}px">{e(c["titolo"])}</h2>'
        f'<p class="testo" style="-webkit-line-clamp:{righe}">{e(c["testo"])}</p>'
        f'<div class="piede">{fonte}{MARCHIO}</div>')


def chiusura():
    return pagina(f'<div class="testa">{MARCHIO}</div>'
                  '<h2 style="margin-top:140px;font-size:132px;line-height:.98;letter-spacing:-.045em">Le altre le trovi su Nodus</h2>'
                  '<p class="testo" style="font-size:42px">Ogni ora le notizie di finanza, economia, AI, tecnologia e scienza. '
                  'In cima quelle sui temi che scegli tu, e le parole difficili spiegate semplici.</p>'
                  '<div class="link"><div class="posto">[qui l\'adesivo link a Nodus]</div>'
                  '<span style="font-size:34px;font-weight:600">È gratis</span></div>'
                  '<p class="nota">Nodus serve a informarti: non è consulenza finanziaria.</p>')


def chrome():
    for p in (os.environ.get("RADAR_CHROME"),
              r"C:\Program Files\Google\Chrome\Application\chrome.exe",
              r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
              shutil.which("google-chrome"), shutil.which("chromium"), shutil.which("chromium-browser")):
        if p and Path(p).exists():
            return p
    sys.exit("Chrome non trovato: indica il percorso in RADAR_CHROME")


def fotografa(pagine, cartella):
    """Ogni pagina HTML → PNG 1080×1920 con Chrome senza finestra (profilo a parte: non tocca il Chrome aperto)."""
    exe = chrome()
    with tempfile.TemporaryDirectory() as tmp:
        for i, codice in enumerate(pagine, 1):
            f = Path(tmp) / f"{i:02}.html"
            f.write_text(codice, encoding="utf-8")
            png = cartella / f"{i:02}.png"
            subprocess.run([exe, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
                            f"--user-data-dir={Path(tmp) / 'profilo'}", "--force-device-scale-factor=1",
                            "--window-size=1080,1920", "--virtual-time-budget=6000", "--allow-file-access-from-files",
                            f"--screenshot={png}", f.as_uri()], check=True, capture_output=True, timeout=90)


# ---------------------------------------------------------------- tutto insieme

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--giro", choices=GIRI)
    ap.add_argument("--prova", action="store_true", help="non segna le notizie come usate")
    a = ap.parse_args()
    oggi = datetime.now().astimezone()
    giro = a.giro or ("mattina" if oggi.hour < 11 else "pranzo" if oggi.hour < 17 else "sera")
    giorno = oggi.strftime("%Y-%m-%d")

    dati = json.loads(DATI.read_text(encoding="utf-8"))
    try:
        registro = json.loads(USATE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        registro = {}
    usate = set(registro.get(giorno, []))
    scelte = scegli(dati, giro, oggi, usate)
    if not scelte:
        print(f"{giro}: meno di 2 notizie buone uscite dopo l'ultimo giro, la storia salta")
        return

    loghi = {f["nome"]: (QUI / "sito" / f["logo"]).as_uri() for f in dati["fonti"] if f.get("logo")}
    etichetta = "" if giro == "mattina" else f"Novità delle {GIRI[giro]} · "
    pagine = [copertina(scelte, oggi)] if giro == "mattina" else []
    pagine += [schermata(c, i, len(scelte), etichetta, loghi) for i, c in enumerate(scelte, 1)]
    if giro != "pranzo":
        pagine.append(chiusura())

    cartella = USCITA / f"{giorno}-{giro}"
    if cartella.exists():
        for vecchio in cartella.glob("*.png"):
            vecchio.unlink()
    cartella.mkdir(parents=True, exist_ok=True)
    fotografa(pagine, cartella)
    elenco = [f"Storia {giro} del {giorno} ({len(pagine)} schermate)", ""]
    elenco += [f"- [{SEZIONI[c['n']['sezione']][0]}] {c['titolo']} ({c['n']['fonte']})\n  {c['n']['link']}" for c in scelte]
    (cartella / "notizie.txt").write_text("\n".join(elenco) + "\n", encoding="utf-8")

    if not a.prova:
        registro[giorno] = sorted(usate | {c["n"]["id"] for c in scelte})
        registro = {k: v for k, v in registro.items() if k >= (oggi - timedelta(days=3)).strftime("%Y-%m-%d")}
        USATE.write_text(json.dumps(registro), encoding="utf-8")
    print(f"{giro}: {len(pagine)} schermate in {cartella}")
    for c in scelte:
        print(f"  [{c['n']['sezione']}] {c['titolo'][:80]} ({c['n']['fonte']}, punti {c['punti']:.1f}, cifra {c['cifra'] or '-'})")


if __name__ == "__main__":
    main()
