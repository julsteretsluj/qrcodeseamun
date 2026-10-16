-- Owner-only unregister: Jules can clear a mistaken check-in.

create or replace function public.list_registration_checkins()
returns table (
  short_id text,
  placard_code text,
  role text,
  full_name text,
  committee text,
  allocation text,
  registered_at timestamptz
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
  select
    lower(btrim(p.short_id)),
    p.placard_code,
    p.role,
    p.full_name,
    p.committee,
    p.allocation,
    c.registered_at
  from public.registration_checkins c
  join public.registration_people p using (placard_code)
  order by c.registered_at desc, p.sort_order;
end;
$$;

create or replace function public.unregister_registration_badge(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_input text := regexp_replace(coalesce(p_code, ''), '\s', '', 'g');
  v_placard text;
  v_person public.registration_people%rowtype;
  v_at timestamptz;
begin
  if not exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and lower(u.email) = 'juleskittoastrop@gmail.com'
  ) then
    return jsonb_build_object('ok', false, 'status', 'forbidden');
  end if;

  if v_input = '' then
    return jsonb_build_object('ok', false, 'status', 'not_found') || public._registration_counts();
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

  delete from public.registration_checkins
  where placard_code = v_person.placard_code
  returning registered_at into v_at;

  if v_at is null then
    return jsonb_build_object(
      'ok', true,
      'status', 'not_registered',
      'name', v_person.full_name,
      'committee', v_person.committee,
      'allocation', v_person.allocation,
      'role', v_person.role,
      'short_id', lower(btrim(v_person.short_id)),
      'placard_code', v_person.placard_code,
      'registered_at', null
    ) || public._registration_counts();
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', 'unregistered',
    'name', v_person.full_name,
    'committee', v_person.committee,
    'allocation', v_person.allocation,
    'role', v_person.role,
    'short_id', lower(btrim(v_person.short_id)),
    'placard_code', v_person.placard_code,
    'registered_at', v_at
  ) || public._registration_counts();
end;
$$;

revoke all on function public.list_registration_checkins() from public, anon, authenticated;
revoke all on function public.unregister_registration_badge(text) from public, anon, authenticated;
grant execute on function public.list_registration_checkins() to authenticated;
grant execute on function public.unregister_registration_badge(text) to authenticated;
