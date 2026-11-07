"""Scarica i loghi delle fonti del Radar in sito/loghi/ (64x64 PNG), una volta sola.

    py loghi.py            scarica solo i loghi che mancano
    py loghi.py --tutti    li riscarica tutti
    py loghi.py --solo "ANSA Economia"   solo quella fonte (anche più volte --solo)

Da lanciare a mano quando si aggiunge una fonte in interessi.json: i loghi poi sono file del sito, li usa
raccogli.py (campo "logo" in dati.json) e vanno nel repo con il resto. Serve Pillow (solo qui, non sul server).
Per ogni fonte prova, in ordine: l'icona più grande dichiarata nella home del sito (apple-touch-icon e simili),
/apple-touch-icon.png, /favicon.ico e infine il servizio favicon di Google. Se un logo non ti piace, mettine uno
a mano con lo stesso nome: questo script non lo tocca finché non usi --tutti.
"""
import argparse
import io
import re
import sys
import urllib.parse
from html import unescape

from PIL import Image

import raccogli as r

LATO = 64
HTML_UA = {"Accept": "text/html,application/xhtml+xml,*/*"}


def icone_dichiarate(sito):
    """Le icone che la home del sito dichiara, dalla più grande."""
    base = f"https://{sito}/"
    try:
        pagina = r.scarica(base, HTML_UA).decode("utf-8", "replace")
    except Exception:
        return []
    trovate = []
    for tag in re.findall(r"<link\b[^>]*>", pagina, re.I):
        rel = re.search(r'rel=["\']([^"\']+)', tag, re.I)
        href = re.search(r'href=["\']([^"\']+)', tag, re.I)
        if not rel or not href or "icon" not in rel.group(1).lower():
            continue
        url = urllib.parse.urljoin(base, unescape(href.group(1)))
        if url.lower().split("?")[0].endswith(".svg"):
            continue  # Pillow non legge gli SVG
        misura = re.search(r'sizes=["\'](\d+)x\d+', tag, re.I)
        lato = int(misura.group(1)) if misura else (180 if "apple" in rel.group(1).lower() else 32)
        trovate.append((lato, url))
    return [u for _, u in sorted(trovate, reverse=True)]


def immagine(url):
    dati = r.scarica(url, {"Accept": "image/*,*/*"})
    img = Image.open(io.BytesIO(dati))
    if getattr(img, "n_frames", 1) > 1 or img.format == "ICO":
        # negli .ico ci sono più misure: si prende la più grande
        if img.format == "ICO":
            img.size = max(img.ico.sizes())
    img = img.convert("RGBA")
    if min(img.size) < 32:
        raise ValueError(f"troppo piccola ({img.size[0]}px)")
    return img


def quadrato(img):
    lato = max(img.size)
    tela = Image.new("RGBA", (lato, lato), (0, 0, 0, 0))
    tela.paste(img, ((lato - img.width) // 2, (lato - img.height) // 2))
    return tela.resize((LATO, LATO), Image.LANCZOS)


def scarica_logo(f):
    sito = r.sito_fonte(f)
    candidati = icone_dichiarate(sito) + [
        f"https://{sito}/apple-touch-icon.png",
        f"https://{sito}/favicon.ico",
        f"https://www.google.com/s2/favicons?domain={sito}&sz=128",
    ]
    ultimo = None
    for url in candidati:
        try:
            return quadrato(immagine(url)), url
        except Exception as e:
            ultimo = e
    raise RuntimeError(f"nessun logo per {sito}: {ultimo}")


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--tutti", action="store_true", help="riscarica anche quelli che ci sono già")
    p.add_argument("--solo", action="append", help="solo queste fonti (nome come in interessi.json)")
    a = p.parse_args()
    r.LOGHI.mkdir(parents=True, exist_ok=True)
    fatti = set()
    errori = 0
    for f in r.leggi_json("interessi.json")["fonti"]:
        if a.solo and f["nome"] not in a.solo:
            continue
        nome = r.nome_logo(f)
        dest = r.LOGHI / nome
        if nome in fatti or (dest.exists() and not a.tutti):
            print(f"  = {f['nome']}: {nome} c'è già")
            continue
        try:
            img, da = scarica_logo(f)
            img.save(dest, optimize=True)
            fatti.add(nome)
            print(f"  + {f['nome']}: {nome}  (da {da})")
        except Exception as e:
            errori += 1
            print(f"  ! {f['nome']}: {e}")
    sys.exit(1 if errori else 0)


if __name__ == "__main__":
    main()
