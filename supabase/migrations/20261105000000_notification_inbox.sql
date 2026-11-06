-- Mensajes y correos bancarios -> bandeja de movimientos por confirmar.
-- Reutiliza la llave secreta del atajo de Apple Pay; la llave nunca se guarda en texto plano.

alter table public.inbox
  add column if not exists raw_text text not null default '';

create or replace function public.capture_notification(
  token text,
  message text,
  source text default 'notification'
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  clean_message text := trim(coalesce(message, ''));
  clean_source text := lower(trim(coalesce(source, 'notification')));
begin
  if length(coalesce(token, '')) < 32 or length(clean_message) < 3 or length(clean_message) > 2000 then
    return false;
  end if;

  if clean_source not in ('messages', 'mail', 'notification') then
    clean_source := 'notification';
  end if;

  select user_id into owner_id
  from public.capture_tokens
  where token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex');

  if owner_id is null then return false; end if;

  -- Evita bucles del mismo atajo y limita el abuso si una llave se filtra.
  if exists (
    select 1 from public.inbox
    where user_id = owner_id and raw_text = clean_message
      and created_at > now() - interval '2 minutes'
  ) then return true; end if;

  if (select count(*) from public.inbox where user_id = owner_id and created_at > now() - interval '1 day') >= 300 then
    return false;
  end if;

  insert into public.inbox(user_id, amount_raw, merchant, currency, card, source, raw_text)
  values (owner_id, '', '', 'USD', '', clean_source, clean_message);
  return true;
end;
$$;

revoke all on function public.capture_notification(text, text, text) from public;
grant execute on function public.capture_notification(text, text, text) to anon, authenticated;

-- Los proyectos nuevos ya no exponen tablas nuevas automáticamente.
grant usage on schema public to authenticated;
grant select, delete on table public.inbox to authenticated;

