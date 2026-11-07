# Radar

Finanza, economia, AI, tecnologia e scienza in una pagina, per chiunque: le notizie che contano scelte in base ai temi di ogni utente,
i mercati che segue, l'agenda di BCE, Fed e inflazione, e un glossario che spiega le parole tecniche dentro il testo.

- **Online:** https://buildtech26.github.io/radar/ ; da Safari o Chrome, "Aggiungi a Home" e si apre come un'app.
- **In locale:** doppio clic su `avvia.cmd` (http://127.0.0.1:8770). Dal telefono sullo stesso Wi-Fi: l'indirizzo
  che la finestra scrive (http://192.168.x.x:8770). `py raccogli.py --nascosto` fa lo stesso senza finestra
  (riscarica ogni ora e scrive in `radar.log`).

## Come funziona

`raccogli.py` (solo libreria standard di Python) legge le fonti RSS e i prezzi (vedi sotto) e scrive
`sito/dati.json`, uguale per tutti. La pagina in `sito/` lo legge e fa il resto nel browser: ogni utente vede
i suoi temi e i suoi mercati. Su GitHub il workflow `.github/workflows/pubblica.yml` lo rifà ogni ora dalle 6 alle 23.

Lo stesso fatto raccontato da più testate, anche una in italiano e una in inglese, `raccogli.py` lo riconosce
(`raggruppa`) e gli dà un `gruppo`. L'app ne mostra una sola, di preferenza in italiano, con sotto "Anche su";
se se ne nasconde una sparisce tutto il gruppo. Il riconoscimento non traduce: confronta numeri, nomi propri e
concetti scritti nelle due lingue (`CONCETTI`, per esempio inflazione = inflation). Le soglie sono tarate a mano su
notizie vere del 05/11/2026: se due fatti diversi finiscono insieme, la soglia da alzare è `soglia_titoli`.
Ricontrollato il 06/11/2026 su 725 notizie, con Tech e Scienza: alzare le soglie perdeva gruppi giusti, quindi si è
cambiato cosa conta come nome proprio. La prima parola del titolo, e le parole dei titoli tutti in maiuscolo, valgono
solo se nella rassegna non compaiono mai minuscole (`parole_minuscole`: Airbnb sì, Food no), e `GENERICI` (NASA,
Earth, Space…) non bastano da soli. Resta qualche caso limite, come due modelli diversi della stessa serie di telefoni. Per
provare una modifica senza riscaricare niente basta chiamare `raccogli.raggruppa()` sulle `notizie` di
`sito/dati.json` (prima va tolto il campo `gruppo`) e guardare i gruppi che escono.

Al primo avvio una presentazione chiede nome (facoltativo), temi, mercati e quello da mettere in evidenza;
chi la salta riceve le scelte proposte (`predefinito: true` nel catalogo). Tutto si cambia poi dal pulsante
in alto, **Il tuo Radar** (Temi, Mercati, Tu), dove c'è anche la pagina **Info** (non è consulenza, fonti, privacy).

## Italiano e inglese

L'app si usa in italiano o in inglese (`sito/lingua.js`). La prima volta decide il browser (italiano se è tra le
lingue preferite, altrimenti inglese); si cambia dal pulsante EN/IT della presentazione o da Il tuo Radar → Tu →
Lingua dell'app, e la scelta (`interfaccia` nel profilo) segue l'account. Le notizie non si traducono: restano nella
lingua della testata.

## Paesi delle notizie

Ogni fonte in `interessi.json` ha un `paese`: `it`, `eu`, `us` o `gb` (dove ha sede la testata). Nella presentazione
("Da dove vuoi le notizie?") e in Il tuo Radar → Tu → Notizie da si scelgono i paesi (`paesi` nel profilo, segue
l'account); almeno uno resta acceso. A chi non ha scelto si propongono Italia, Europa e Stati Uniti (app in italiano)
oppure Stati Uniti, Regno Unito ed Europa (app in inglese). Per un paese nuovo: la sigla nelle fonti e una voce in
`PAESI` in `sito/app.js`. I profili di prima avevano `lingue` ({it, en}): `normalizza()` li traduce in paesi.

- **Testi dell'app:** nel codice ogni testo ha le due versioni accanto, `L("Salvate", "Saved")`. Un testo nuovo va
  scritto così, in tutte e due le lingue. Attenzione a non passare a `L()` elementi già creati con `h()`: si
  creerebbero tutte e due le versioni (vedi `foglioInfo`).
- **Contenuti fissi:** glossario, agenda, temi e mercati portano la traduzione in un campo `en`
  (`{"en": {"termine": …, "testo": …}}`; per l'agenda anche `nota_en`). Una voce nuova senza `en` compare in italiano
  anche nell'app inglese. Nel glossario `en.alias` aggiunge parole inglesi da riconoscere nel testo.
- **Privacy:** `sito/privacy-en.html` è la traduzione di `privacy.html`: se cambia una, va cambiata l'altra.
- **Mail del codice:** `supabase/mail-codice.html` è in tutte e due le lingue (Supabase non sa la lingua dell'app).

## Cosa si cambia, e dove

| Cosa | File |
|---|---|
| catalogo dei temi (con le parole che li riconoscono), parole da nascondere, fonti, catalogo dei mercati | `interessi.json` |
| appuntamenti (BCE, Fed, inflazione, trimestrali) | `agenda.json`: da riguardare quando escono i calendari nuovi |
| sezioni delle notizie (Finanza, Economia, AI, Tech, Scienza) | la `sezione` di ogni fonte in `interessi.json`; per una sezione nuova anche `SEZIONI`, `GRUPPI_TEMI` e `COLORE_SEZIONE` in `sito/app.js` e il colore `--nome` (chiaro e scuro) in `sito/stile.css`. I temi hanno un `gruppo` con le stesse chiavi: nella presentazione e in Temi si mostrano divisi così. Ognuno sceglie le sezioni da vedere (presentazione, "Quali notizie vuoi?", e Il tuo Radar → Temi → Sezioni; `sezioni` nel profilo, null = tutte, una sezione nuova vale accesa): le spente spariscono da Notizie e Per te, e i loro temi restano scelti ma non contano. Se la stessa notizia esce in due feed vince la fonte che viene prima nell'elenco (per questo le fonti AI stanno prima di quelle Tech) |
| parole spiegate | `glossario.json` (la `categoria` è una delle sezioni) |
| loghi delle fonti (accanto al nome, sulle schede) | `sito/loghi/`: dopo aver aggiunto una fonte, `py loghi.py` scarica quelli che mancano (serve Pillow). Se il feed sta su un altro indirizzo, `"sito"` nella fonte. Senza logo l'app mostra l'iniziale |
| la notizia aperta (si apre toccando la scheda; Ctrl+clic apre l'articolo) | `apriNotizia()` in `sito/app.js`, nel foglio dal basso. Aperto solo "In breve" (testo della testata, `testo` fino a 700 caratteri); Parole da sapere, Perché la vedi e Ne parlano anche sono tendine chiuse (`tendina()`); in fondo Leggi su…, Salva, Condividi. Una pagina intera da destra è stata provata e scartata (06/11/2026) |
| widget per iPhone e iPad | `sito/widget/radar.js`, per l'app Scriptable (gratis): istruzioni e parametri in testa al file, online su `…/radar/widget/radar.js`. Solo notizie (niente mercati, orari né foto, scelto il 07/11/2026): il colore sfumato della sezione col suo simbolo, il logo della testata (`sito/loghi/`), l'etichetta della sezione e il titolo. Qualunque tocco apre il Radar, non l'articolo. I loghi restano nella cartella di Scriptable sul telefono, già rimpiccioliti. Si aggiorna quando iOS lo lascia fare (chiede ogni 30 minuti), e i dati cambiano ogni ora dalle 6 alle 23. Legge `widget.json` (~40 KB, lo scrive `per_widget()` in `raccogli.py` a ogni giro), e se manca `dati.json`. I widget veri di iOS (WidgetKit) vogliono un'app nativa e l'Apple Developer Program a pagamento |
| chiaro e scuro | `sito/stile.css`: le regole solo-scure si scrivono `:root[data-aspetto="scuro"] …` (mai `@media (prefers-color-scheme)`). La scelta Automatico/Chiaro/Scuro sta in Tu → Aspetto, vale per dispositivo (`radar.aspetto`) e la applica già lo script in testa a `index.html` (e alle due pagine privacy) |

## Da dove vengono i prezzi

Ogni mercato del catalogo ha una `fonte`, scelta per la licenza (l'app è pubblica e gratuita):

| fonte | per | note |
|---|---|---|
| `bce` (con `valuta`: `USD`, `GBP`…) | cambi | tassi di riferimento della BCE, liberi citando la fonte; uno al giorno verso le 16, niente grafico della giornata. Tutti i cambi in una sola richiesta |
| `coingecko` (con `id`: `bitcoin`…) | cripto | API pubblica, va citata ("dati di CoinGecko", con link: c'è nell'app). Con una chiave Demo gratuita in `COINGECKO_KEY` regge più richieste |
| `yahoo` (se manca) | indici, ETF, azioni, materie prime | accesso **non ufficiale**: può smettere di funzionare o essere contestato. Quando l'app avrà entrate va sostituito con un fornitore con licenza di visualizzazione pubblica |

Se una fonte non risponde, quei mercati mancano da `dati.json` per quel giro: l'app li lascia scegliere lo stesso
(`catalogo_mercati`) e mostra un avviso in Mercati. Il simbolo resta quello di Yahoo anche per le altre fonti, così le
scelte salvate degli utenti non cambiano.

Prima di aggiungere un mercato Yahoo, controlla che abbia almeno un anno di storico (il gas TTF, per esempio, non
ce l'ha). Le parole dei temi lunghe più di 3 lettere
valgono anche come inizio di parola: niente parole che siano l'inizio di parole comuni ("intel" prenderebbe
"intelligenza", "meta" prenderebbe "metallo").

## Dati degli utenti

Senza account tutto resta nel browser di ogni dispositivo, nella chiave `radar.profilo` (nome, temi, mercati,
quello in evidenza, lingue) e in `radar.salvate`, `radar.lette`, `radar.nascoste`.

L'account è facoltativo (Supabase, progetto `radar`, regione Frankfurt; indirizzo e chiave publishable in
`sito/config.js`). Si entra con Google o con un codice/link via email (`sito/conto.js`, senza librerie). Il
pulsante di Google compare da solo quando il provider Google è acceso in Supabase; con Google si usa sempre PKCE
(in http dal Wi-Fi di casa, dove il browser non ha `crypto.subtle`, lo SHA-256 è fatto a mano). Nell'app sulla
schermata Home di iPhone e iPad iOS può aprire Google in una finestra a parte con una memoria sua: lì si conferma
e il codice passa all'app tramite `supabase/google-app-home.sql` (da incollare una volta nel SQL Editor). Ogni utente ha una riga
nella tabella `profili` (`supabase/schema.sql`) e può leggere e scrivere solo la sua. Per ogni parte vince la
modifica più recente (`tempi`); al primo accesso su un dispositivo le salvate si uniscono. Il testo della mail
del codice è in `supabase/mail-codice.html`. La chiave **secret** di Supabase non va mai nel sito.

## Notifiche

Solo con l'account (scelto da Mattia il 07/11/2026). In Il tuo Radar → Notifiche: un interruttore per questo
dispositivo e, per ogni sezione accesa, al massimo un tema (`profilo.notifiche = {sezione: tema}`, viaggia col
profilo). Su iPhone e iPad arrivano solo all'app aggiunta alla Home (iOS 16.4+).

- `sito/app.js` (`pannelloNotifiche`, `attivaNotifiche`): chiede il permesso al tocco, iscrive il dispositivo con
  la chiave pubblica VAPID di `sito/config.js` e lo manda a Supabase con `iscrivi()`. Uscendo dall'account o
  spegnendo, `disiscrivi()`. L'indirizzo `#notizia=<id>` apre la notizia sopra la vista (`apriDaNotifica`).
- `sito/sw.js`: mostra la notifica (`push`) e al tocco porta il Radar in primo piano su quella notizia.
- `supabase/notifiche.sql`: tabelle `iscrizioni` (un dispositivo) e `notifiche_inviate` (registro di 3 giorni),
  che il browser non vede; solo le funzioni `iscrivi`/`disiscrivi`. Da incollare una volta nel SQL Editor.
- `notifica.py`: gira su GitHub dopo la pubblicazione. Tema nel titolo (anche tradotto), sezioni e paesi della
  persona, un fatto una volta sola, più notizie dello stesso tema nello stesso giro = una notifica, al massimo
  2 al giorno per tema e 5 in tutto, solo dalle 8 alle 22 (la notte arriva alle 8). Le iscrizioni che il
  servizio push dà per scadute (404/410) si cancellano. Nei log solo conteggi: il repo è pubblico.
  Prova senza mandare niente: `python notifica.py --prova finto.json [--ora "AAAA-MM-GG HH:MM"]` (formato in testa
  al file; serve `pip install pywebpush` solo per mandare davvero).
- Secrets di GitHub: `VAPID_PRIVATE_KEY` (la privata delle notifiche: se si perde se ne fa una coppia nuova, si
  mette la pubblica in `config.js` e i dispositivi si riscrivono da soli alla prima apertura) e
  `SUPABASE_SERVICE_KEY` (la chiave secret di Supabase: solo lì, mai nel sito).

Informativa privacy e condizioni d'uso: `sito/privacy.html` (titolare Mattia Piperissa). Se cambiano dati raccolti
o fornitori, va aggiornata insieme alla data in cima e al riassunto in Info (`foglioInfo` in `app.js`).

## Notifiche, da fare a mano una volta

1. Supabase → SQL Editor → New query: incolla `supabase/notifiche.sql` → Run.
2. Supabase → Project Settings → API Keys: copia la chiave **secret** (`sb_secret_…`) e in GitHub → Settings →
   Secrets and variables → Actions crea il secret `SUPABASE_SERVICE_KEY` con quella.
3. `VAPID_PRIVATE_KEY` c'è già (messo il 07/11/2026). Senza uno dei due, il passo "Manda le notifiche" scrive che
   mancano e non manda niente: la pubblicazione va avanti uguale.

## Pubblicazione

1. GitHub Pages (Settings → Pages → Source: GitHub Actions): il workflow pubblica `sito/` ogni ora, dati compresi.
2. Supabase → Authentication → URL Configuration: Site URL `https://buildtech26.github.io/radar/` e la stessa con
   `**` nei Redirect URLs. Prova veloce del ritorno, senza Google:
   `GET /auth/v1/verify?token=finto&type=magiclink&redirect_to=X` → il 303 dice dove rimanda.
3. Google Cloud → Google Auth Platform: app pubblicata (in "Testing" entrano solo gli utenti di prova), con home
   page e link a `privacy.html`.
4. Traduzioni: in GitHub → Settings → Secrets and variables → Actions, i secrets `AZURE_TRANSLATOR_KEY` e
   `AZURE_TRANSLATOR_REGION`.
5. Traduzioni, quota: il piano gratuito è 2 milioni di caratteri al mese per la chiave, e oggi ne servono ~1,2.
   Per questo traduce solo GitHub: una copia in locale prende le traduzioni dalla versione pubblicata (vedi sotto).

## Traduzioni

Per l'app in italiano, le notizie inglesi hanno titolo e "In breve" tradotti (solo nella notizia aperta; le schede
restano in originale), con "Mostra l'originale". Le fa `traduci()` in `raccogli.py` con Azure Translator, piano
gratuito F0, una volta sola per notizia: le traduzioni restano in `traduzioni.json` (su GitHub nella cache di
Actions), con il conto dei caratteri del mese, e ci si ferma a `RADAR_TRADUZIONI_MAX` (1.900.000). Senza chiave,
o se Azure non risponde, non si traduce e l'app mostra l'originale; l'errore finisce in `errori` e nel log.
Con l'app in inglese le notizie inglesi si aprono in originale, e "Show in Italian" mostra la stessa traduzione
(una traduzione in un'altra lingua resta a un tocco, quella nella lingua dell'app si mostra subito).
Per tradurre anche le notizie italiane in inglese (app in inglese): `TRADUCI = {"en": "it", "it": "en"}`.
Chiama Azure solo il giro su GitHub. In locale (`avvia.cmd`, `--nascosto`) `raccogli.py` copia le traduzioni da
`https://buildtech26.github.io/radar/dati.json` (`RADAR_ONLINE`) per le notizie che ci sono anche lì: quelle appena
uscite restano in originale fino al giro dopo. Per tradurre davvero in locale: `RADAR_TRADUZIONI=azure`.
Ad Azure va solo il testo pubblico delle notizie, niente degli utenti: la privacy non cambia.
