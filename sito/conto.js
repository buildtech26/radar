// Nodus · account (Supabase) senza librerie esterne: accesso con codice o link via email, o con Google;
// sessione; la propria riga. Il codice da scrivere nell'app c'è perché sull'iPhone il link della mail si aprirebbe
// in Safari e non nell'app messa nella schermata Home.

import { SUPABASE } from "./config.js";
import { L } from "./lingua.js";

const CHIAVE = "radar.sessione";
let sessione = leggi();
let rinnovo = null;              // un solo rinnovo alla volta, anche se partono più richieste insieme
const ascoltatori = new Set();

function leggi() {
  try { return JSON.parse(localStorage.getItem(CHIAVE)) || null; } catch { return null; }
}
function imposta(s) {
  sessione = s;
  try { s ? localStorage.setItem(CHIAVE, JSON.stringify(s)) : localStorage.removeItem(CHIAVE); } catch { /* pazienza */ }
  for (const f of ascoltatori) f(utente());
}
function daRisposta(d) {
  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
    user: { id: d.user.id, email: d.user.email },
  };
}

// messaggi comprensibili al posto dei codici di Supabase
function errore(stato, d) {
  const codice = (d && (d.error_code || d.code || d.error)) || "";
  const msg = (d && (d.msg || d.message || d.error_description)) || "";
  let testo = L("Qualcosa non è andato. Riprova tra poco.", "Something went wrong. Please try again shortly.");
  const secondi = /after (\d+) seconds?/i.exec(msg);
  if (secondi) testo = L(`Hai appena chiesto una mail: puoi chiederne un'altra tra ${secondi[1]} secondi.`, `You just asked for an email: you can ask for another in ${secondi[1]} seconds.`);
  else if (/over_email_send_rate_limit|email rate limit/i.test(codice + msg)) testo = L("Sono già partite troppe mail di accesso nell'ultima ora: riprova più tardi. Se hai già ricevuto una mail, usa quella.", "Too many sign-in emails have gone out in the last hour: try again later. If you already got an email, use that one.");
  else if (stato === 429 || /rate.?limit/i.test(codice + msg)) testo = L("Troppi tentativi ravvicinati: aspetta qualche minuto e riprova.", "Too many attempts in a row: wait a few minutes and try again.");
  else if (/otp_expired|token.*(expired|invalid)|invalid.*token/i.test(codice + msg)) testo = L("Il codice è sbagliato o scaduto. Controlla la mail o fatti mandare un codice nuovo.", "The code is wrong or has expired. Check the email or ask for a new code.");
  else if (/email_address_invalid|invalid.*email|email.*invalid/i.test(codice + msg)) testo = L("Questo indirizzo email non sembra valido.", "This email address doesn't look valid.");
  else if (/not.?authori[sz]ed|email_address_not_authorized/i.test(codice + msg)) testo = L("Per ora l'accesso è aperto solo agli indirizzi di prova.", "For now, sign-in is open only to test addresses.");
  else if (/signup.*disabled/i.test(codice + msg)) testo = L("Le iscrizioni sono chiuse in questo momento.", "Sign-ups are closed right now.");
  else if (stato === 0) testo = L("Sei offline: serve la connessione.", "You're offline: a connection is needed.");
  const e = new Error(testo);
  e.stato = stato;
  e.codice = codice;
  return e;
}

async function chiama(percorso, { metodo = "GET", corpo, autenticato = true, prefer } = {}) {
  const intestazioni = { apikey: SUPABASE.chiave };
  if (corpo !== undefined) intestazioni["Content-Type"] = "application/json";
  if (prefer) intestazioni.Prefer = prefer;
  if (autenticato) {
    const t = await tokenValido();
    if (!t) throw errore(401, { message: "serve l'accesso" });
    intestazioni.Authorization = `Bearer ${t}`;
  }
  let r;
  try {
    r = await fetch(SUPABASE.url + percorso, { method: metodo, headers: intestazioni, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  } catch {
    throw errore(0, null);
  }
  const testo = await r.text();
  let dati = null;
  try { dati = testo ? JSON.parse(testo) : null; } catch { dati = { message: testo }; }
  if (!r.ok) {
    if (r.status === 401 && autenticato) imposta(null);   // sessione revocata o account eliminato altrove
    throw errore(r.status, dati);
  }
  return dati;
}

async function tokenValido() {
  if (!sessione) return null;
  if (sessione.expires_at - Date.now() / 1000 > 60) return sessione.access_token;
  if (!rinnovo) {
    rinnovo = (async () => {
      try {
        const d = await chiama("/auth/v1/token?grant_type=refresh_token", { metodo: "POST", corpo: { refresh_token: sessione.refresh_token }, autenticato: false });
        imposta(daRisposta(d));
      } catch (e) {
        if (e.stato && e.stato !== 0 && e.stato < 500) imposta(null);   // rinnovo rifiutato: si rifà l'accesso
        else throw e;                                                    // offline: si riprova la prossima volta
      } finally {
        rinnovo = null;
      }
    })();
  }
  await rinnovo;
  return sessione ? sessione.access_token : null;
}

// ---------------------------------------------------------------- quello che usa l'app

// il link della mail può aprirsi in un'altra scheda: questa se ne accorge
addEventListener("storage", (e) => {
  if (e.key !== CHIAVE) return;
  sessione = leggi();
  for (const f of ascoltatori) f(utente());
});

export const utente = () => (sessione ? sessione.user : null);
export const alCambio = (f) => { ascoltatori.add(f); return () => ascoltatori.delete(f); };

// La mail contiene un link (mail standard di Supabase) e, quando avremo il nostro invio mail, anche un codice.
// Il link riporta a questa stessa pagina, con l'accesso già fatto (vedi daLink).
export async function inviaCodice(email) {
  const ritorno = encodeURIComponent(location.origin + location.pathname);
  await chiama(`/auth/v1/otp?redirect_to=${ritorno}`, { metodo: "POST", corpo: { email, create_user: true }, autenticato: false });
}

// Accesso con Google: si va da Google passando da Supabase, e si torna qui (vedi daLink).
// Con PKCE il ritorno porta solo un codice monouso (?code=…), che vale soltanto insieme al verificatore
// rimasto in questo browser.
//
// Nell'app sulla schermata Home di iPhone e iPad, iOS può aprire Google in una finestra a parte, che ha una memoria
// sua: il ritorno arriva lì, dove il verificatore non c'è. Allora quella finestra chiede conferma e "passa" il codice
// (passaGoogle: Supabase lo tiene da parte sotto la sfida PKCE), e l'app sulla Home, che conosce sfida e verificatore,
// lo ritira e lo scambia (attendiGoogle). Il codice da solo non serve a niente: senza il verificatore non apre l'account.
const VERIFICATORE = "radar.pkce";
const ATTESA = "radar.attesaGoogle";      // { sfida, da }: l'app sulla Home aspetta il ritorno da Google
const ATTESA_MAX = 10 * 6e4;
const base64url = (b) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const nellAppHome = () => Boolean(navigator.standalone);

export async function conGoogle() {
  const ritorno = encodeURIComponent(location.origin + location.pathname);
  const verificatore = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const sfida = base64url(await sha256(new TextEncoder().encode(verificatore)));
  localStorage.setItem(VERIFICATORE, verificatore);
  if (nellAppHome()) localStorage.setItem(ATTESA, JSON.stringify({ sfida, da: Date.now() }));
  else localStorage.removeItem(ATTESA);
  location.assign(`${SUPABASE.url}/auth/v1/authorize?provider=google&redirect_to=${ritorno}&code_challenge=${sfida}&code_challenge_method=s256`);
}

function inAttesa() {
  let a = null;
  try { a = JSON.parse(localStorage.getItem(ATTESA)); } catch { /* niente */ }
  if (a && Date.now() - a.da < ATTESA_MAX && !sessione) return a;
  localStorage.removeItem(ATTESA);
  return null;
}
export const googleInAttesa = () => Boolean(inAttesa());
export const annullaGoogle = () => localStorage.removeItem(ATTESA);

// L'app sulla Home aspetta che la finestra di Google passi il codice: controlla ogni 2,5 secondi e quando torna
// in primo piano. Si risolve con l'utente (o null se l'attesa scade o viene annullata), o un errore leggibile.
let attesa = null;
export function attendiGoogle() {
  attesa ??= new Promise((ok, ko) => {
    let occupato = false;
    const fine = (f, v) => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", giro);
      attesa = null;
      f(v);
    };
    const giro = async () => {
      if (occupato || document.visibilityState !== "visible") return;
      const a = inAttesa();
      if (!a) return fine(ok, utente());
      occupato = true;
      try {
        let codice = null;
        try {
          codice = await chiama("/rest/v1/rpc/ritira_google", { metodo: "POST", corpo: { sfida: a.sfida }, autenticato: false });
        } catch { return; }   // offline o Supabase lento: si riprova al giro dopo
        if (!codice) return;
        localStorage.removeItem(ATTESA);
        try { fine(ok, await daCodiceGoogle(codice)); } catch (e) { fine(ko, e); }
      } finally {
        occupato = false;
      }
    };
    const timer = setInterval(giro, 2500);
    document.addEventListener("visibilitychange", giro);
    giro();
  });
  return attesa;
}

// Nella finestra di Google: il ritorno porta ?code=… ma qui il verificatore non c'è, quindi l'accesso è partito
// altrove (l'app sulla Home). Va chiamata prima di daLink; toglie il codice dall'indirizzo e lo restituisce.
export function passaggioInArrivo() {
  const query = new URLSearchParams(location.search);
  const codice = query.get("code");
  if (!codice || localStorage.getItem(VERIFICATORE)) return null;
  history.replaceState(null, "", location.pathname);
  return codice;
}
export async function passaGoogle(codice) {
  const fatto = await chiama("/rest/v1/rpc/passa_google", { metodo: "POST", corpo: { codice }, autenticato: false });
  if (!fatto) throw new Error(L("Questo accesso è scaduto o è già stato usato: dall'app tocca di nuovo \"Continua con Google\".", "This sign-in has expired or was already used: in the app, tap \"Continue with Google\" again."));
}

// SHA-256 per la sfida PKCE. crypto.subtle c'è solo in https o su 127.0.0.1; dal Wi-Fi di casa (http://192.168…)
// si fa a mano, così anche lì si usa PKCE.
async function sha256(dati) {
  if (globalThis.crypto?.subtle) return new Uint8Array(await crypto.subtle.digest("SHA-256", dati));
  const primi = [];
  for (let n = 2; primi.length < 64; n++) if (primi.every((p) => n % p)) primi.push(n);
  const frazione = (x) => ((x - Math.floor(x)) * 2 ** 32) >>> 0;
  const K = primi.map((p) => frazione(Math.cbrt(p)));
  let H = primi.slice(0, 8).map((p) => frazione(Math.sqrt(p)));
  const lung = dati.length;
  const tot = ((lung + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(tot);
  m.set(dati);
  m[lung] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(tot - 4, lung * 8);
  const w = new Uint32Array(64);
  const rotr = (x, r) => (x >>> r) | (x << (32 - r));
  for (let o = 0; o < tot; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      w[i] = w[i - 16] + (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) + w[i - 7] + (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10));
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H = [a, b, c, d, e, f, g, h].map((x, i) => (x + H[i]) >>> 0);
  }
  const out = new Uint8Array(32);
  H.forEach((x, i) => new DataView(out.buffer).setUint32(i * 4, x));
  return out;
}

// Il pulsante c'è solo se Google è acceso in Supabase (altrimenti porterebbe a una pagina d'errore).
let google = null;
export function googleDisponibile() {
  google ??= fetch(SUPABASE.url + "/auth/v1/settings", { headers: { apikey: SUPABASE.chiave } })
    .then((r) => (r.ok ? r.json() : {}))
    .then((d) => Boolean(d.external?.google))
    .catch(() => { google = null; return false; });
  return google;
}

async function daCodiceGoogle(codice) {
  const verificatore = localStorage.getItem(VERIFICATORE);
  localStorage.removeItem(VERIFICATORE);
  localStorage.removeItem(ATTESA);
  const fallito = (e, motivo) => {
    console.warn("Nodus, accesso con Google:", motivo || e.codice, e);
    if (e.stato !== 0) e.message = L(`L'accesso con Google non è riuscito: riprova da questa pagina. (${motivo || e.codice || e.stato})`, `Signing in with Google didn't work: try again from this page. (${motivo || e.codice || e.stato})`);
    return e;
  };
  if (!verificatore) throw fallito(errore(400, null), "manca il verificatore");
  let d;
  try {
    d = await chiama("/auth/v1/token?grant_type=pkce", { metodo: "POST", corpo: { auth_code: codice, code_verifier: verificatore }, autenticato: false });
  } catch (e) {
    throw fallito(e);
  }
  imposta(daRisposta(d));
  return utente();
}

// Arrivo dal link della mail o da Google: l'indirizzo porta #access_token=…&refresh_token=…, oppure ?code=…
// (Google con PKCE), oppure un errore (#error=… o ?error=…).
// Va chiamata PRIMA che l'app legga l'indirizzo per scegliere la scheda: toglie subito token e codici dall'indirizzo.
// Restituisce null se non si arriva da un link, altrimenti una promessa: l'utente, o un errore leggibile.
export function daLink() {
  const frammento = location.hash.slice(1);
  const query = new URLSearchParams(location.search);
  const daFrammento = /(^|&)(access_token|error|error_code)=/.test(frammento);
  const daQuery = query.has("code") || query.has("error") || query.has("error_code");
  if (!daFrammento && !daQuery) return null;
  const p = daFrammento ? new URLSearchParams(frammento) : query;
  history.replaceState(null, "", location.pathname);   // token e codici non restano nella cronologia
  if (daQuery && query.get("code")) return daCodiceGoogle(query.get("code"));
  if (!p.get("access_token")) {
    const codice = p.get("error_code") || p.get("error") || "";
    const e = errore(400, { error_code: codice, message: p.get("error_description") || "" });
    if (/otp_expired/.test(codice)) e.message = L("Il link è scaduto o è già stato usato: fatti mandare una mail nuova.", "The link has expired or was already used: ask for a new email.");
    else if (/access_denied/.test(codice)) e.message = L("Accesso annullato.", "Sign-in cancelled.");
    else if (/provider.*not.*enabled|unsupported provider/i.test(p.get("error_description") || "")) e.message = L("L'accesso con Google non è ancora attivo.", "Google sign-in isn't available yet.");
    else if (p.get("error_description")) {   // il motivo vero, per capire cosa sistemare (a volte arriva codificato due volte)
      let motivo = p.get("error_description");
      try { motivo = decodeURIComponent(motivo); } catch { /* resta com'è */ }
      e.message += ` (${motivo.split(":")[0].slice(0, 140)})`;
    }
    console.warn("Nodus, ritorno con errore:", Object.fromEntries(p));
    return Promise.reject(e);
  }
  return (async () => {
    const token = p.get("access_token");
    let r;
    try {
      r = await fetch(SUPABASE.url + "/auth/v1/user", { headers: { apikey: SUPABASE.chiave, Authorization: `Bearer ${token}` } });
    } catch {
      throw errore(0, null);
    }
    if (!r.ok) {
      const e = errore(r.status, null);
      e.message = L("Il link non è valido o è scaduto: fatti mandare una mail nuova.", "The link is invalid or has expired: ask for a new email.");
      throw e;
    }
    const u = await r.json();
    imposta({
      access_token: token,
      refresh_token: p.get("refresh_token"),
      expires_at: Number(p.get("expires_at")) || Math.floor(Date.now() / 1000) + (Number(p.get("expires_in")) || 3600),
      user: { id: u.id, email: u.email },
    });
    return utente();
  })();
}

export async function verificaCodice(email, codice) {
  const d = await chiama("/auth/v1/verify", { metodo: "POST", corpo: { type: "email", email, token: codice }, autenticato: false });
  imposta(daRisposta(d));
  return utente();
}

export async function esci() {
  try { await chiama("/auth/v1/logout?scope=local", { metodo: "POST" }); } catch { /* esco comunque da qui */ }
  imposta(null);
}

// la riga dell'utente: { profilo, salvate, lette, nascoste, tempi, aggiornato } oppure null se non c'è ancora
export async function leggiDati() {
  const u = utente();
  if (!u) return null;
  const righe = await chiama(`/rest/v1/profili?select=profilo,salvate,lette,nascoste,tempi,aggiornato&utente=eq.${encodeURIComponent(u.id)}`);
  return righe && righe[0] ? righe[0] : null;
}

export async function scriviDati(dati) {
  const u = utente();
  if (!u) return;
  await chiama("/rest/v1/profili?on_conflict=utente", {
    metodo: "POST",
    corpo: { utente: u.id, ...dati },
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

// notifiche: questo dispositivo (l'iscrizione che dà il browser) riceve, o non riceve più, quelle dell'utente.
// Passano dalle funzioni del database (supabase/notifiche.sql): le tabelle il browser non le vede.
export async function iscrivi(s, lingua) {
  const k = s.keys || {};
  await chiama("/rest/v1/rpc/iscrivi", { metodo: "POST", corpo: { p_endpoint: s.endpoint, p_p256dh: k.p256dh, p_auth: k.auth, p_lingua: lingua }, prefer: "return=minimal" });
}
export async function disiscrivi(endpoint) {
  if (!utente()) return;
  await chiama("/rest/v1/rpc/disiscrivi", { metodo: "POST", corpo: { p_endpoint: endpoint }, prefer: "return=minimal" });
}

export async function eliminaAccount() {
  await chiama("/rest/v1/rpc/elimina_account", { metodo: "POST", corpo: {} });
  imposta(null);
}
