-- Owner badge list includes check-in time so /codes tiles can show Registered.

drop function if exists public.list_registration_badges();

create function public.list_registration_badges()
returns table (
  short_id text,
  placard_code text,
  role text,
  full_name text,
  committee text,
  allocation text,
  sort_order integer,
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
    p.sort_order,
    c.registered_at
  from public.registration_people p
  left join public.registration_checkins c using (placard_code)
  order by p.sort_order;
end;
$$;

revoke all on function public.list_registration_badges() from public, anon, authenticated;
grant execute on function public.list_registration_badges() to authenticated;
