#!/usr/bin/env python3
"""Nodus · pubblica su Instagram (@nodus.it) le schermate di un giro di storie_ig.py, una storia per schermata.

    python pubblica_ig.py jpg storie/2026-11-09-mattina
        dai PNG fa i JPG in storie/2026-11-09-mattina/jpg/ (Instagram vuole JPEG)
    python pubblica_ig.py pubblica storie/2026-11-09-mattina https://…/2026-11-09-mattina
        pubblica i JPG in ordine; l'indirizzo è dove sono già online (Instagram li scarica da lì)

Gira su GitHub Actions (.github/workflows/storie.yml), scelta di Mattia del 09/11/2026: API di Instagram
diretta, gratis, senza passo di approvazione. Il token sta nel segreto INSTAGRAM_TOKEN del repo (mai nel
codice né nei log): token dell'utente di sistema del login unificato, non scade (vedi README, "Storie Instagram").
    python pubblica_ig.py verifica      controlla il token e l'account senza pubblicare niente
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

class ErroreApi(Exception):
    pass


# Due strade per il token, stesse chiamate: col login di Instagram ("login unificato" nel pannello di Meta) si
# parla con graph.instagram.com, col login di Facebook con graph.facebook.com. account() prova la prima e, se il
# token non è di quel tipo, la seconda.
HOST = {"api": "https://graph.instagram.com"}


def api():
    return HOST["api"]


def chiama(metodo, percorso, esci=True, **parametri):
    API = api()
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
        testo = (f"Instagram ha risposto {e.code} su {percorso}: {errore.get('message', '?')} "
                 f"(tipo {errore.get('type', '?')}, codice {errore.get('code', '?')})")
        if not esci:
            raise ErroreApi(testo)
        sys.exit(testo)


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


def account():
    """L'id dell'account Instagram che pubblica e il suo nome."""
    # con il token dell'utente di sistema (login unificato) l'id dell'account si dà a mano: variabile
    # INSTAGRAM_ID del repo (non è un segreto, è il numero dell'account)
    ig = os.environ.get("INSTAGRAM_ID", "").strip()
    if ig:
        for host in ("https://graph.facebook.com", "https://graph.instagram.com"):
            HOST["api"] = host
            try:
                return ig, chiama("GET", ig, esci=False, fields="username").get("username")
            except ErroreApi as e:
                print(f"{host}: {e}")
        sys.exit(f"l'account {ig} non risponde con questo token né su Facebook né su Instagram")
    try:
        io = chiama("GET", "me", esci=False, fields="user_id,username")
        return io["user_id"], io.get("username")
    except ErroreApi as e:
        print(f"col login di Instagram no ({e}), provo col login di Facebook")
    HOST["api"] = "https://graph.facebook.com"
    # login unificato (token dell'utente di sistema, quello che usiamo dal 09/11/2026): gli account assegnati
    assegnati = chiama("GET", "me/assigned_instagram_accounts", fields="id,username").get("data", [])
    scelto = next((a for a in assegnati if a.get("username") == "nodus.it"), assegnati[0] if assegnati else None)
    if scelto:
        return scelto["id"], scelto.get("username")
    # login di Facebook: l'account Instagram è quello collegato a una delle pagine Facebook del token
    pagine = chiama("GET", "me/accounts", fields="instagram_business_account{id,username}").get("data", [])
    collegati = [p["instagram_business_account"] for p in pagine if p.get("instagram_business_account")]
    scelto = next((a for a in collegati if a.get("username") == "nodus.it"), collegati[0] if collegati else None)
    if not scelto:
        sys.exit("nessun account Instagram collegato alle pagine Facebook di questo token")
    return scelto["id"], scelto.get("username")


def pubblica(cartella, base, solo_prima=False):
    ig, nome = account()
    io = {"user_id": ig}
    print(f"pubblico come @{nome}")
    immagini = sorted((cartella / "jpg").glob("*.jpg"))[:1 if solo_prima else None]
    if not immagini:
        sys.exit(f"nessun JPG in {cartella / 'jpg'}: prima `jpg`")
    for f in immagini:   # in ordine: le storie si vedono nell'ordine in cui escono
        contenitore = chiama("POST", f"{io['user_id']}/media", image_url=f"{base.rstrip('/')}/{f.name}",
                             media_type="STORIES")["id"]
        aspetta_pronto(contenitore)
        storia = chiama("POST", f"{io['user_id']}/media_publish", creation_id=contenitore)
        print(f"  {f.name} → storia {storia.get('id')}")
    print(f"{len(immagini)} storie pubblicate")


def verifica():
    """Controlla il token senza pubblicare niente: dice con quale strada funziona e su quale account."""
    ig, nome = account()
    print(f"OK: si pubblicherebbe su @{nome} (id {ig}) via {api()}")


def main():
    if len(sys.argv) >= 2 and sys.argv[1] == "verifica":
        return verifica()
    if len(sys.argv) < 3 or sys.argv[1] not in ("jpg", "pubblica"):
        sys.exit(__doc__)
    cartella = Path(sys.argv[2])
    if sys.argv[1] == "jpg":
        jpg(cartella)
    else:
        if not os.environ.get("INSTAGRAM_TOKEN"):
            sys.exit("manca INSTAGRAM_TOKEN (segreto del repo su GitHub)")
        pubblica(cartella, sys.argv[3], solo_prima="--solo-prima" in sys.argv)


if __name__ == "__main__":
    main()
