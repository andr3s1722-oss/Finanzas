-- Bandeja de pagos capturados desde el atajo de Apple Pay.
-- Pégalo completo en Supabase → SQL Editor → Run. Es seguro volver a ejecutarlo.

-- 1) Llave del atajo: solo se guarda su huella (hash), nunca la llave.
create table if not exists public.capture_tokens (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  token_hash text        not null,
  created_at timestamptz not null default now()
);
alter table public.capture_tokens enable row level security;   -- sin políticas: solo las funciones de abajo la tocan

-- 2) Bandeja: pagos pendientes de confirmar en la app.
create table if not exists public.inbox (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  amount_raw text        not null,
  merchant   text        not null default '',
  currency   text        not null default 'USD',
  card       text        not null default '',
  source     text        not null default 'apple-pay'
);
create index if not exists inbox_user_created_idx on public.inbox (user_id, created_at);
alter table public.inbox enable row level security;

drop policy if exists inbox_select_own on public.inbox;
create policy inbox_select_own on public.inbox for select to authenticated using (auth.uid() = user_id);
drop policy if exists inbox_delete_own on public.inbox;
create policy inbox_delete_own on public.inbox for delete to authenticated using (auth.uid() = user_id);

grant select, delete on public.inbox to authenticated;

-- 3) Crear (o reemplazar) la llave. Devuelve la llave UNA vez; guarda solo su hash.
create or replace function public.create_capture_token() returns text
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  tok text;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.capture_tokens (user_id, token_hash)
  values (uid, encode(sha256(convert_to(tok, 'UTF8')), 'hex'))
  on conflict (user_id) do update set token_hash = excluded.token_hash, created_at = now();
  return tok;
end;
$$;

create or replace function public.revoke_capture_token() returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  delete from public.capture_tokens where user_id = auth.uid();
end;
$$;

-- 4) Recibir un pago desde el atajo. Se llama sin sesión: la llave secreta identifica al usuario.
--    Devuelve true si guardó (o ya lo tenía), false si algo no es válido.
create or replace function public.capture_expense(
  token    text,
  amount   text,
  merchant text default '',
  currency text default 'USD',
  card     text default ''
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid;
  h   text;
  a   text := left(btrim(coalesce(capture_expense.amount, '')), 40);
  m   text := left(btrim(coalesce(capture_expense.merchant, '')), 80);
  c   text := case when upper(btrim(coalesce(capture_expense.currency, ''))) = 'COP' then 'COP' else 'USD' end;
  k   text := left(btrim(coalesce(capture_expense.card, '')), 40);
begin
  if capture_expense.token is null or length(capture_expense.token) < 32 or length(capture_expense.token) > 100 or a = '' then
    return false;
  end if;
  h := encode(sha256(convert_to(capture_expense.token, 'UTF8')), 'hex');
  select ct.user_id into uid from public.capture_tokens ct where ct.token_hash = h;
  if uid is null then return false; end if;

  -- el mismo pago repetido en 2 minutos (el atajo a veces se dispara dos veces) cuenta una vez
  if exists (select 1 from public.inbox i
              where i.user_id = uid and i.amount_raw = a and i.merchant = m
                and i.created_at > now() - interval '2 minutes') then
    return true;
  end if;
  -- tope diario para que una llave filtrada no llene la tabla
  if (select count(*) from public.inbox i where i.user_id = uid and i.created_at > now() - interval '1 day') >= 300 then
    return false;
  end if;

  insert into public.inbox (user_id, amount_raw, merchant, currency, card) values (uid, a, m, c, k);
  return true;
end;
$$;

revoke all on function public.create_capture_token()  from public, anon;
revoke all on function public.revoke_capture_token()  from public, anon;
revoke all on function public.capture_expense(text, text, text, text, text) from public;
grant execute on function public.create_capture_token()  to authenticated;
grant execute on function public.revoke_capture_token()  to authenticated;
grant execute on function public.capture_expense(text, text, text, text, text) to anon, authenticated;
