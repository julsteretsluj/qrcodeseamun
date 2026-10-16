-- Badges now carry the allocation ID from the matrix (for example abc123).
-- Placard codes are still accepted at the desk for badges printed earlier.

create unique index if not exists registration_people_short_id_ci_key
  on public.registration_people (lower(btrim(short_id)));

create or replace function public.register_badge(p_pin text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_input text := regexp_replace(coalesce(p_code, ''), '\s', '', 'g');
  v_placard text;
  v_person public.registration_people%rowtype;
  v_at timestamptz;
begin
  v_status := public._desk_pin_status(p_pin);
  if v_status <> 'ok' then
    return jsonb_build_object('ok', false, 'status', v_status);
  end if;

  select *
  into v_person
  from public.registration_people
  where lower(btrim(short_id)) = lower(v_input)
  limit 1;

  if not found then
    v_placard := substring(upper(v_input) from 'SEAMUN-[0-9]{4}-[A-Z]+-[0-9]+');
    if v_placard is not null then
      select *
      into v_person
      from public.registration_people
      where placard_code = v_placard;
    end if;
  end if;

  if v_person.placard_code is null then
    return jsonb_build_object('ok', false, 'status', 'not_found') || public._registration_counts();
  end if;

  if v_person.full_name is null then
    return jsonb_build_object(
      'ok', true,
      'status', 'unassigned',
      'name', null,
      'committee', v_person.committee,
      'allocation', v_person.allocation,
      'role', v_person.role,
      'registered_at', null
    ) || public._registration_counts();
  end if;

  v_at := null;
  insert into public.registration_checkins (placard_code)
  values (v_person.placard_code)
  on conflict (placard_code) do nothing
  returning registered_at into v_at;

  if v_at is null then
    v_status := 'already_registered';
    select registered_at into v_at
    from public.registration_checkins
    where placard_code = v_person.placard_code;
  else
    v_status := 'registered';
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', v_status,
    'name', v_person.full_name,
    'committee', v_person.committee,
    'allocation', v_person.allocation,
    'role', v_person.role,
    'registered_at', v_at
  ) || public._registration_counts();
end;
$$;

drop function if exists public.list_registration_badges();

create function public.list_registration_badges()
returns table (
  short_id text,
  placard_code text,
  role text,
  full_name text,
  committee text,
  allocation text,
  sort_order integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and lower(u.email) = 'juleskittoastrop@gmail.com'
  ) then
    return;
  end if;

  return query
  select lower(btrim(p.short_id)), p.placard_code, p.role, p.full_name, p.committee, p.allocation, p.sort_order
  from public.registration_people p
  order by p.sort_order;
end;
$$;

revoke all on function public.register_badge(text, text) from public, anon, authenticated;
revoke all on function public.list_registration_badges() from public, anon, authenticated;
grant execute on function public.register_badge(text, text) to anon, authenticated;
grant execute on function public.list_registration_badges() to authenticated;
