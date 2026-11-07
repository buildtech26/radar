-- Radar · notifiche (Supabase). Da incollare una volta sola in Supabase → SQL Editor → New query → Run,
-- dopo schema.sql. Si può rilanciare senza danni.
--
-- Due tabelle che il browser non vede mai direttamente:
--   iscrizioni         un dispositivo che riceve le notifiche (l'indirizzo che dà il browser e le sue due chiavi)
--   notifiche_inviate  cosa è già partito, per i tetti (2 al giorno per tema, 5 in tutto) e per non ripetersi
-- Il browser passa solo dalle funzioni iscrivi() e disiscrivi(), che agiscono sull'utente che chiama.
-- Le legge e le scrive il giro orario su GitHub (notifica.py) con la chiave di servizio, che salta le regole.
-- Eliminando l'account spariscono anche queste righe (on delete cascade).

create table if not exists public.iscrizioni (
  endpoint text primary key check (endpoint like 'https://%' and length(endpoint) between 20 and 1000),
  utente   uuid not null references auth.users (id) on delete cascade,
  p256dh   text not null check (length(p256dh) between 20 and 200),
  auth     text not null check (length(auth) between 8 and 100),
  lingua   text not null default 'it' check (lingua in ('it', 'en')),   -- la lingua dell'app su quel dispositivo
  creata   timestamptz not null default now()
);
alter table public.iscrizioni add column if not exists lingua text not null default 'it' check (lingua in ('it', 'en'));
create index if not exists iscrizioni_utente on public.iscrizioni (utente);

create table if not exists public.notifiche_inviate (
  id      bigint generated always as identity primary key,
  utente  uuid not null references auth.users (id) on delete cascade,
  tema    text not null,
  notizie text[] not null default '{}',   -- gli id di tutte le notizie del fatto (e di quelle raggruppate)
  quando  timestamptz not null default now()
);
create index if not exists notifiche_inviate_utente on public.notifiche_inviate (utente, quando);

-- niente accesso diretto per chi usa l'app, nemmeno alle proprie righe
alter table public.iscrizioni enable row level security;
alter table public.notifiche_inviate enable row level security;
revoke all on public.iscrizioni from anon, authenticated;
revoke all on public.notifiche_inviate from anon, authenticated;

-- questo dispositivo riceve le notifiche dell'utente che chiama. Lo stesso indirizzo passa all'ultimo account
-- che lo iscrive (il dispositivo è uno solo); al massimo 10 dispositivi per utente: oltre, salta il più vecchio.
create or replace function public.iscrivi(p_endpoint text, p_p256dh text, p_auth text, p_lingua text default 'it')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'serve l''accesso';
  end if;
  delete from public.iscrizioni where endpoint = p_endpoint;
  delete from public.iscrizioni where endpoint in (
    select endpoint from public.iscrizioni where utente = auth.uid() order by creata desc offset 9);
  insert into public.iscrizioni (endpoint, utente, p256dh, auth, lingua)
    values (p_endpoint, auth.uid(), p_p256dh, p_auth, case when p_lingua = 'en' then 'en' else 'it' end);
end;
$$;

-- questo dispositivo non riceve più niente (solo se è dell'utente che chiama)
create or replace function public.disiscrivi(p_endpoint text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'serve l''accesso';
  end if;
  delete from public.iscrizioni where endpoint = p_endpoint and utente = auth.uid();
end;
$$;

revoke all on function public.iscrivi(text, text, text, text) from public, anon;
revoke all on function public.disiscrivi(text) from public, anon;
grant execute on function public.iscrivi(text, text, text, text) to authenticated;
grant execute on function public.disiscrivi(text) to authenticated;
