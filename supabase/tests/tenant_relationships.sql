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

select set_config('aether.test_process',gen_random_uuid()::text,true);
select set_config('aether.other_process',gen_random_uuid()::text,true);
select set_config('aether.test_control',gen_random_uuid()::text,true);
insert into public.icfr_processes(id,organization_id,code,name) values
(current_setting('aether.test_process')::uuid,current_setting('aether.test_org')::uuid,'TEST','Tenant test'),
(current_setting('aether.other_process')::uuid,current_setting('aether.other_org')::uuid,'TEST','Foreign tenant test');
set local role authenticated;
do $$
declare affected integer;
begin
  insert into public.icfr_controls(id,organization_id,process_id,ref,title,control_type,nature,frequency,owner_id)
  values(current_setting('aether.test_control')::uuid,current_setting('aether.test_org')::uuid,current_setting('aether.test_process')::uuid,'TEST','Valid control','preventive','manual','monthly',auth.uid());
  begin
    insert into public.icfr_controls(organization_id,process_id,ref,title,control_type,nature,frequency)
    values(current_setting('aether.test_org')::uuid,current_setting('aether.other_process')::uuid,'ATTACK','Invalid control','preventive','manual','monthly');
    raise exception 'Cross-tenant process attachment succeeded';
  exception when foreign_key_violation then null;
  end;
  begin
    update public.icfr_controls set process_id=current_setting('aether.other_process')::uuid where id=current_setting('aether.test_control')::uuid;
    raise exception 'Cross-tenant process reassignment succeeded';
  exception when foreign_key_violation then null;
  end;
  begin
    update public.icfr_controls set owner_id=current_setting('aether.other_user')::uuid where id=current_setting('aether.test_control')::uuid;
    raise exception 'Cross-tenant owner assignment succeeded';
  exception when foreign_key_violation then null;
  end;
  if exists(select 1 from public.icfr_processes where id=current_setting('aether.other_process')::uuid) then raise exception 'Cross-tenant process read succeeded'; end if;
  update public.icfr_processes set name='Forbidden' where id=current_setting('aether.other_process')::uuid;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Cross-tenant process edit succeeded'; end if;
end $$;
reset role;
set local role service_role;
-- Even privileged operations cannot create cross-tenant references.
do $$ begin
  begin
    update public.icfr_controls set owner_id=current_setting('aether.other_user')::uuid where id=current_setting('aether.test_control')::uuid;
    raise exception 'Service-role cross-tenant owner assignment succeeded';
  exception when foreign_key_violation then null;
  end;
end $$;
-- Preserve original SET NULL: deleting the synthetic profile clears owner only.
delete from public.profiles where id=current_setting('aether.test_user')::uuid;
do $$ begin
  if not exists(select 1 from public.icfr_controls where id=current_setting('aether.test_control')::uuid and owner_id is null and organization_id=current_setting('aether.test_org')::uuid) then raise exception 'Original SET NULL behavior changed'; end if;
end $$;
-- Preserve original CASCADE: deleting the synthetic process removes its control.
delete from public.icfr_processes where id=current_setting('aether.test_process')::uuid;
do $$ begin
  if exists(select 1 from public.icfr_controls where id=current_setting('aether.test_control')::uuid) then raise exception 'Original CASCADE behavior changed'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from pg_constraint c where c.connamespace='public'::regnamespace and c.contype='f' and cardinality(c.conkey)=2 and c.convalidated and exists(select 1 from pg_attribute a where a.attrelid=c.conrelid and a.attnum=c.conkey[2] and a.attname='organization_id')) <> 60 then raise exception 'Expected 60 validated tenant foreign keys'; end if;
end $$;
select 'PASS: tenant references, direct RLS, privileged integrity, SET NULL and CASCADE' as result;
rollback;
