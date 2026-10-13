-- PostgREST rejects DELETE without a WHERE clause, so clearing PIN failures needs one.

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

revoke all on function public._desk_pin_status(text) from public, anon, authenticated;
