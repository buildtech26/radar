-- Nodus · database degli utenti (Supabase)
-- Da incollare una volta sola in Supabase → SQL Editor → New query → Run.
-- Ogni utente ha UNA riga con le sue scelte; può leggere e scrivere SOLO la sua (Row Level Security).

create table if not exists public.profili (
  utente     uuid primary key references auth.users (id) on delete cascade,
  profilo    jsonb not null default '{}'::jsonb,   -- nome, temi, mercati, in evidenza, paesi e sezioni delle notizie
  salvate    jsonb not null default '[]'::jsonb,   -- notizie salvate (copia intera: le notizie spariscono dopo 7 giorni)
  lette      jsonb not null default '[]'::jsonb,
  nascoste   jsonb not null default '[]'::jsonb,   -- solo gli id
  tempi      jsonb not null default '{}'::jsonb,   -- quando è cambiato ogni pezzo (ms): vince il più recente tra i dispositivi
  aggiornato timestamptz not null default now(),
  constraint tempi_piccoli    check (pg_column_size(tempi)    < 2000),
  -- limiti contro gli abusi: un utente normale sta molto sotto
  constraint profilo_piccolo  check (pg_column_size(profilo)  < 20000),
  constraint salvate_piccole  check (pg_column_size(salvate)  < 600000),
  constraint lette_piccole    check (pg_column_size(lette)    < 300000),
  constraint nascoste_piccole check (pg_column_size(nascoste) < 100000)
);

alter table public.profili enable row level security;

drop policy if exists "legge la sua riga" on public.profili;
drop policy if exists "crea la sua riga" on public.profili;
drop policy if exists "aggiorna la sua riga" on public.profili;
drop policy if exists "cancella la sua riga" on public.profili;

create policy "legge la sua riga"    on public.profili for select to authenticated using ((select auth.uid()) = utente);
create policy "crea la sua riga"     on public.profili for insert to authenticated with check ((select auth.uid()) = utente);
create policy "aggiorna la sua riga" on public.profili for update to authenticated using ((select auth.uid()) = utente) with check ((select auth.uid()) = utente);
create policy "cancella la sua riga" on public.profili for delete to authenticated using ((select auth.uid()) = utente);

-- chi non ha fatto l'accesso non vede niente
revoke all on public.profili from anon;
grant select, insert, update, delete on public.profili to authenticated;

-- data dell'ultima modifica, messa dal database (non dal browser)
create or replace function public.profili_aggiornato()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.aggiornato := now();
  return new;
end;
$$;

drop trigger if exists profili_aggiornato on public.profili;
create trigger profili_aggiornato before update on public.profili
  for each row execute function public.profili_aggiornato();

-- "Elimina il mio account": cancella l'utente; la sua riga sparisce con lui (on delete cascade).
-- Può cancellare solo se stesso: usa auth.uid() di chi chiama, non un id passato da fuori.
create or replace function public.elimina_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'serve l''accesso';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.elimina_account() from public, anon;
grant execute on function public.elimina_account() to authenticated;
