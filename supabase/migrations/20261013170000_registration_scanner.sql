-- SEAMUN I 2027 registration desk.
-- The roster itself is loaded separately and is not stored in git.

create table public.registration_people (
  placard_code text primary key,
  short_id text not null unique,
  role text not null check (role in ('delegate', 'chair')),
  full_name text,
  committee text not null,
  allocation text not null,
  sort_order integer not null unique
);

create index registration_people_short_id_upper_idx
  on public.registration_people (upper(short_id));

create table public.registration_checkins (
  placard_code text primary key references public.registration_people (placard_code) on delete cascade,
  registered_at timestamptz not null default now()
);

create table public.registration_desk (
  id integer primary key check (id = 1),
  pin_hash text not null
);

create table public.registration_pin_failures (
  id bigint generated always as identity primary key,
  attempted_at timestamptz not null default now()
);

alter table public.registration_people enable row level security;
alter table public.registration_checkins enable row level security;
alter table public.registration_desk enable row level security;
alter table public.registration_pin_failures enable row level security;

create policy registration_people_owner_only
  on public.registration_people
  for select
  to authenticated
  using (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'juleskittoastrop@gmail.com'
  );

revoke all on public.registration_people from anon, authenticated;
revoke all on public.registration_checkins from anon, authenticated;
revoke all on public.registration_desk from anon, authenticated;
revoke all on public.registration_pin_failures from anon, authenticated;

create or replace function public._registration_counts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'delegates_registered', (
      select count(*)
      from public.registration_checkins c
      join public.registration_people p using (placard_code)
      where p.role = 'delegate'
    ),
    'delegates_total', (
      select count(*)
      from public.registration_people
      where role = 'delegate' and full_name is not null
    ),
    'chairs_registered', (
      select count(*)
      from public.registration_checkins c
      join public.registration_people p using (placard_code)
      where p.role = 'chair'
    ),
    'chairs_total', (
      select count(*)
      from public.registration_people
      where role = 'chair' and full_name is not null
    )
  );
$$;

create or replace function public._desk_pin_status(p_pin text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pin text := trim(coalesce(p_pin, ''));
  v_failures integer;
begin
  delete from public.registration_pin_failures
  where attempted_at < now() - interval '15 minutes';

  select count(*) into v_failures
  from public.registration_pin_failures;

  if v_failures >= 10 then
    return 'locked';
  end if;

  if v_pin = '' or not exists (
    select 1
    from public.registration_desk
    where id = 1
      and pin_hash = extensions.crypt(v_pin, pin_hash)
  ) then
    insert into public.registration_pin_failures (attempted_at) values (now());
    return 'bad_pin';
  end if;

  delete from public.registration_pin_failures where id is not null;
  return 'ok';
end;
$$;

create or replace function public.open_registration_desk(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  v_status := public._desk_pin_status(p_pin);
  if v_status <> 'ok' then
    return jsonb_build_object('ok', false, 'status', v_status);
  end if;

  return jsonb_build_object('ok', true, 'status', 'open') || public._registration_counts();
end;
$$;

create or replace function public.register_badge(p_pin text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_raw text := upper(trim(coalesce(p_code, '')));
  v_lookup text;
  v_person public.registration_people%rowtype;
  v_at timestamptz;
  v_result jsonb;
begin
  v_status := public._desk_pin_status(p_pin);
  if v_status <> 'ok' then
    return jsonb_build_object('ok', false, 'status', v_status);
  end if;

  v_lookup := substring(v_raw from 'SEAMUN-[0-9]{4}-[A-Z]+-[0-9]+');
  if v_lookup is null then
    v_lookup := regexp_replace(v_raw, '\s', '', 'g');
  end if;

  select *
  into v_person
  from public.registration_people
  where placard_code = v_lookup
     or upper(short_id) = v_lookup
  order by (placard_code = v_lookup) desc
  limit 1;

  if not found then
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

  v_result := jsonb_build_object(
    'ok', true,
    'status', v_status,
    'name', v_person.full_name,
    'committee', v_person.committee,
    'allocation', v_person.allocation,
    'role', v_person.role,
    'registered_at', v_at
  ) || public._registration_counts();

  return v_result;
end;
$$;

create or replace function public.list_registration_badges()
returns table (
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
  select p.placard_code, p.role, p.full_name, p.committee, p.allocation, p.sort_order
  from public.registration_people p
  order by p.sort_order;
end;
$$;

revoke all on function public._registration_counts() from public, anon, authenticated;
revoke all on function public._desk_pin_status(text) from public, anon, authenticated;
revoke all on function public.open_registration_desk(text) from public, anon, authenticated;
revoke all on function public.register_badge(text, text) from public, anon, authenticated;
revoke all on function public.list_registration_badges() from public, anon, authenticated;

grant execute on function public.open_registration_desk(text) to anon, authenticated;
grant execute on function public.register_badge(text, text) to anon, authenticated;
grant execute on function public.list_registration_badges() to authenticated;
