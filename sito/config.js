// Radar · dove sta il database degli account (Supabase, regione Frankfurt).
// La chiave "publishable" è fatta per stare nella pagina: da sola non apre niente, a decidere chi legge cosa
// sono le regole del database (Row Level Security in supabase/schema.sql).
// La chiave "secret" (service_role) NON va mai messa qui né in nessun file del sito.
export const SUPABASE = {
  url: "https://rgezrqpkaqxdggfqnuvo.supabase.co",
  chiave: "sb_publishable_t19uZV39czDWSICT7kI_SA_E0gwrE50",
};

// Notifiche: la chiave pubblica VAPID, fatta per stare nella pagina (il browser la usa per sapere chi può
// mandargli notifiche). La privata sta solo nel Secret VAPID_PRIVATE_KEY di GitHub, per notifica.py.
// Cambiandole, i dispositivi già iscritti si riscrivono da soli alla prima apertura (vedi app.js).
export const NOTIFICHE = {
  chiave: "BM5sVtC-TD1pZVPaB5lMv3bjFiycYAxfdbFIB5elOQEyHJUmUiGuFHShs7TxuVk2dv218tm3nmbNGiUS1DUAErA",
};
