// Nodus · la lingua dell'app: italiano o inglese. Le notizie restano nella lingua della testata.
// Nel codice ogni testo ha le due versioni una accanto all'altra: L("Salvate", "Saved").
// La prima volta decide il browser (italiano se tra le lingue preferite c'è l'italiano, altrimenti inglese);
// poi vale la scelta salvata nel profilo (campo "interfaccia"), che con l'account segue l'utente.

function iniziale() {
  try {
    const p = JSON.parse(localStorage.getItem("radar.profilo"));
    if (p && (p.interfaccia === "it" || p.interfaccia === "en")) return p.interfaccia;
  } catch { /* niente profilo: decide il browser */ }
  const preferite = navigator.languages?.length ? navigator.languages : [navigator.language || "it"];
  return preferite.some((l) => /^it\b/i.test(l)) ? "it" : "en";
}

let attuale = iniziale();
document.documentElement.lang = attuale;

export const lingua = () => attuale;
export function impostaLingua(l) {
  attuale = l === "en" ? "en" : "it";
  document.documentElement.lang = attuale;
}
export const L = (it, en) => (attuale === "en" ? en : it);
// numeri e date: in inglese col punto per i decimali (1,234.56) e il giorno prima del mese (5 November)
export const LOCALE = () => (attuale === "en" ? "en-GB" : "it-IT");
// i contenuti fissi (glossario, agenda, temi, mercati) portano la traduzione in un campo "en"
export const loc = (o) => (attuale === "en" && o && o.en ? { ...o, ...o.en } : o);
