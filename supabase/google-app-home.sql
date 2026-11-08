-- Nodus · accesso con Google dall'app sulla schermata Home di iPhone e iPad
-- Da incollare una volta sola in Supabase → SQL Editor → New query → Run (dopo schema.sql).
--
-- Lì iOS può aprire Google in una finestra a parte, con una memoria sua: il ritorno da Google (?code=…) arriva in
-- quella finestra e non nell'app. La finestra, dopo che l'utente conferma, "passa" il codice (passa_google): qui
-- viene tenuto da parte sotto la sfida PKCE dell'accesso, presa da auth.flow_state. L'app sulla Home, che conosce
-- la sfida, lo ritira (ritira_google) e lo scambia col suo verificatore. Il codice da solo non apre l'account:
-- serve il verificatore, che sta solo nell'app. Tutto scade dopo 10 minuti.

create table if not exists public.passaggi_google (
  sfida  text primary key,
  codice text not null,
  creato timestamptz not null default now()
);
alter table public.passaggi_google enable row level security;
-- nessuno la legge o la scrive direttamente: solo le due funzioni qui sotto
revoke all on public.passaggi_google from anon, authenticated;

create or replace function public.passa_google(codice text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  s text;
begin
  delete from public.passaggi_google where creato < now() - interval '10 minutes';
  if length(passa_google.codice) > 100 then
    return false;
  end if;
  select f.code_challenge into s
    from auth.flow_state f
   where f.auth_code = passa_google.codice
     and f.created_at > now() - interval '10 minutes';
  if s is null then
    return false;   -- codice inventato, scaduto o già scambiato
  end if;
  insert into public.passaggi_google (sfida, codice) values (s, passa_google.codice)
    on conflict (sfida) do update set codice = excluded.codice, creato = now();
  return true;
end;
$$;

create or replace function public.ritira_google(sfida text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  c text;
begin
  delete from public.passaggi_google p
   where p.sfida = ritira_google.sfida
     and p.creato > now() - interval '10 minutes'
  returning p.codice into c;
  return c;   -- null finché la finestra di Google non ha confermato
end;
$$;

revoke all on function public.passa_google(text) from public;
revoke all on function public.ritira_google(text) from public;
grant execute on function public.passa_google(text) to anon, authenticated;
grant execute on function public.ritira_google(text) to anon, authenticated;

-- controllo: se questa riga dà errore di permessi, le funzioni qui sopra non potrebbero leggere auth.flow_state
select count(*) as accessi_in_corso from auth.flow_state;
