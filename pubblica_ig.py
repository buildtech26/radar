#!/usr/bin/env python3
"""Nodus · pubblica su Instagram (@nodus.it) le schermate di un giro di storie_ig.py, una storia per schermata.

    python pubblica_ig.py jpg storie/2026-11-09-mattina
        dai PNG fa i JPG in storie/2026-11-09-mattina/jpg/ (Instagram vuole JPEG)
    python pubblica_ig.py pubblica storie/2026-11-09-mattina https://…/2026-11-09-mattina
        pubblica i JPG in ordine; l'indirizzo è dove sono già online (Instagram li scarica da lì)

Gira su GitHub Actions (.github/workflows/storie.yml), scelta di Mattia del 09/11/2026: API di Instagram
diretta, gratis, senza passo di approvazione. Il token sta nel segreto INSTAGRAM_TOKEN del repo (mai nel
codice né nei log). È un token lungo: dura 60 giorni, poi va rifatto (vedi README, "Storie Instagram").
Usa solo la libreria standard, più Pillow per i JPG.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://graph.instagram.com"


def chiama(metodo, percorso, **parametri):
    parametri["access_token"] = os.environ["INSTAGRAM_TOKEN"]
    dati = urllib.parse.urlencode(parametri)
    if metodo == "GET":
        richiesta = urllib.request.Request(f"{API}/{percorso}?{dati}")
    else:
        richiesta = urllib.request.Request(f"{API}/{percorso}", data=dati.encode(), method="POST")
    try:
        with urllib.request.urlopen(richiesta, timeout=60) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        # l'errore di Instagram dice cosa non va (token scaduto, immagine non valida…); il token non c'è
        try:
            errore = json.loads(e.read().decode("utf-8")).get("error", {})
        except ValueError:
            errore = {}
        sys.exit(f"Instagram ha risposto {e.code} su {percorso}: {errore.get('message', '?')} "
                 f"(tipo {errore.get('type', '?')}, codice {errore.get('code', '?')})")


def jpg(cartella):
    from PIL import Image
    uscita = cartella / "jpg"
    uscita.mkdir(exist_ok=True)
    for png in sorted(cartella.glob("*.png")):
        Image.open(png).convert("RGB").save(uscita / f"{png.stem}.jpg", quality=92, optimize=True)
    print(f"{len(list(uscita.glob('*.jpg')))} JPG in {uscita}")


def aspetta_pronto(contenitore):
    """Instagram scarica e controlla l'immagine: si pubblica solo quando è FINISHED."""
    for _ in range(30):
        stato = chiama("GET", contenitore, fields="status_code").get("status_code")
        if stato == "FINISHED":
            return
        if stato in ("ERROR", "EXPIRED"):
            sys.exit(f"Instagram non ha accettato l'immagine (stato {stato})")
        time.sleep(4)
    sys.exit("Instagram non ha finito di caricare l'immagine in 2 minuti")


def pubblica(cartella, base):
    io = chiama("GET", "me", fields="user_id,username")
    print(f"pubblico come @{io.get('username')}")
    immagini = sorted((cartella / "jpg").glob("*.jpg"))
    if not immagini:
        sys.exit(f"nessun JPG in {cartella / 'jpg'}: prima `jpg`")
    for f in immagini:   # in ordine: le storie si vedono nell'ordine in cui escono
        contenitore = chiama("POST", f"{io['user_id']}/media", image_url=f"{base.rstrip('/')}/{f.name}",
                             media_type="STORIES")["id"]
        aspetta_pronto(contenitore)
        storia = chiama("POST", f"{io['user_id']}/media_publish", creation_id=contenitore)
        print(f"  {f.name} → storia {storia.get('id')}")
    print(f"{len(immagini)} storie pubblicate")


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ("jpg", "pubblica"):
        sys.exit(__doc__)
    cartella = Path(sys.argv[2])
    if sys.argv[1] == "jpg":
        jpg(cartella)
    else:
        if not os.environ.get("INSTAGRAM_TOKEN"):
            sys.exit("manca INSTAGRAM_TOKEN (segreto del repo su GitHub)")
        pubblica(cartella, sys.argv[3])


if __name__ == "__main__":
    main()
