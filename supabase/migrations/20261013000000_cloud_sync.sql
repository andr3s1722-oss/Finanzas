-- Sincronización en la nube de Finanzas: un documento JSON por usuario, con control de versión.
-- Pégalo completo en Supabase → SQL Editor → Run. Es seguro volver a ejecutarlo.

create table if not exists public.user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb       not null,
  version    bigint      not null default 1,
  updated_at timestamptz not null default now(),
  device     text
);

alter table public.user_data enable row level security;

-- Los proyectos nuevos de Supabase no dan permisos automáticos: la lectura se concede aquí
-- (las filas que se ven siguen limitadas por la política de abajo).
grant usage on schema public to authenticated;
grant select on public.user_data to authenticated;

-- Cada persona solo puede LEER su propia fila. Nadie escribe directo en la tabla:
-- todas las escrituras pasan por save_user_data(), que valida la versión.
drop policy if exists user_data_select_own on public.user_data;
create policy user_data_select_own on public.user_data
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.save_user_data(
  expected_version bigint,
  new_data         jsonb,
  device_name      text default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  current bigint;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if octet_length(new_data::text) > 8 * 1024 * 1024 then
    raise exception 'data_too_large' using errcode = '54000';
  end if;

  select version into current from public.user_data where user_id = uid for update;

  if current is null then
    if expected_version <> 0 then
      raise exception 'version_conflict' using errcode = '40001';
    end if;
    insert into public.user_data (user_id, data, version, device) values (uid, new_data, 1, device_name);
    return 1;
  end if;

  if current <> expected_version then
    raise exception 'version_conflict' using errcode = '40001';
  end if;

  update public.user_data
     set data = new_data, version = current + 1, updated_at = now(), device = device_name
   where user_id = uid;
  return current + 1;
end;
$$;

revoke all on function public.save_user_data(bigint, jsonb, text) from public, anon;
grant execute on function public.save_user_data(bigint, jsonb, text) to authenticated;
