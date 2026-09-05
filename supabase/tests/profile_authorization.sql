-- Run as postgres through psql -v ON_ERROR_STOP=1 or the SQL integration.
-- Synthetic fixtures only; no passwords, emails, sessions or existing user edits.
-- Everything rolls back, including fixtures, on success. Errors abort transaction.
begin;
set local statement_timeout = '10s';
select set_config('aether.test_user', gen_random_uuid()::text, true);
select set_config('aether.other_user', gen_random_uuid()::text, true);
select set_config('aether.test_org', gen_random_uuid()::text, true);
select set_config('aether.other_org', gen_random_uuid()::text, true);
insert into auth.users(id) values
  (current_setting('aether.test_user')::uuid),
  (current_setting('aether.other_user')::uuid);
insert into public.organizations(id, name, slug, type) values
  (current_setting('aether.test_org')::uuid, 'Authorization test', current_setting('aether.test_org'), 'consulting_firm'),
  (current_setting('aether.other_org')::uuid, 'Authorization test', current_setting('aether.other_org'), 'consulting_firm');
insert into public.profiles(id, organization_id, role) values
  (current_setting('aether.test_user')::uuid, current_setting('aether.test_org')::uuid, 'viewer'),
  (current_setting('aether.other_user')::uuid, current_setting('aether.other_org')::uuid, 'owner');
select set_config('request.jwt.claim.sub', current_setting('aether.test_user'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('aether.test_user'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare affected integer;
begin
  if public.current_user_role() <> 'viewer' then raise exception 'Wrong test identity'; end if;
  begin
    update public.profiles set role = 'owner' where id = auth.uid();
    raise exception 'Self-promotion succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set organization_id = current_setting('aether.other_org')::uuid where id = auth.uid();
    raise exception 'Tenant reassignment succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set email = 'untrusted@example.invalid' where id = auth.uid();
    raise exception 'Identity email mutation succeeded';
  exception when insufficient_privilege then null;
  end;
  update public.profiles set full_name = 'Self-service test' where id = auth.uid();
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Name edit failed'; end if;
  if exists(select 1 from public.profiles where id = current_setting('aether.other_user')::uuid) then
    raise exception 'Cross-tenant profile read succeeded';
  end if;
  update public.profiles set full_name = 'Forbidden' where id = current_setting('aether.other_user')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-tenant profile edit succeeded'; end if;
  update public.organizations set name = 'Forbidden' where id = current_setting('aether.test_org')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Viewer changed organization settings'; end if;
end $$;
reset role;
set local role service_role;
update public.profiles set role = 'admin' where id = current_setting('aether.test_user')::uuid;
reset role;
set local role authenticated;
do $$
begin
  if public.current_user_role() <> 'admin' then raise exception 'Service provisioning failed'; end if;
  begin
    update public.profiles set role = 'owner' where id = auth.uid();
    raise exception 'Admin self-promotion succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role anon;
do $$
begin
  if exists(select 1 from public.profiles) then raise exception 'Anonymous profile read succeeded'; end if;
  begin
    update public.profiles set full_name = 'Forbidden';
    raise exception 'Anonymous profile update succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'PASS: profile authorization, tenant isolation, name edits and service provisioning' as result;
rollback;
