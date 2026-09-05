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

select set_config('aether.reviewer',gen_random_uuid()::text,true);
select set_config('aether.evidence',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('aether.reviewer')::uuid);
insert into public.profiles(id,organization_id,role) values(current_setting('aether.reviewer')::uuid,current_setting('aether.test_org')::uuid,'admin');
set local role authenticated;
do $$ begin
  begin
    insert into public.evidence(organization_id,name,source,review_status) values(current_setting('aether.test_org')::uuid,'Forbidden','note','accepted');
    raise exception 'Viewer submitted pre-approved evidence';
  exception when insufficient_privilege then null; end;
  insert into public.evidence(id,organization_id,name,source) values(current_setting('aether.evidence')::uuid,current_setting('aether.test_org')::uuid,'Pending evidence','note');
  begin
    update public.evidence set review_status='accepted',reviewed_by=auth.uid(),reviewed_at=now() where id=current_setting('aether.evidence')::uuid;
    raise exception 'Viewer reviewed evidence';
  exception when insufficient_privilege then null; end;
  begin
    update public.evidence set uploaded_by=current_setting('aether.other_user')::uuid where id=current_setting('aether.evidence')::uuid;
    raise exception 'Uploader attribution changed';
  exception when insufficient_privilege then null; end;
end $$;
-- The owner in the other tenant still cannot review this record.
select set_config('request.jwt.claim.sub',current_setting('aether.other_user'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('aether.other_user'),'role','authenticated')::text,true);
do $$ declare n integer; begin
  update public.evidence set review_status='accepted' where id=current_setting('aether.evidence')::uuid;
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Foreign owner reviewed evidence'; end if;
end $$;
-- An authorized reviewer can approve; the DB supplies actual reviewer/time.
select set_config('request.jwt.claim.sub',current_setting('aether.reviewer'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('aether.reviewer'),'role','authenticated')::text,true);
update public.evidence set review_status='accepted',reviewed_by=current_setting('aether.other_user')::uuid,reviewed_at='2000-01-01' where id=current_setting('aether.evidence')::uuid;
do $$ begin
  if not exists(select 1 from public.evidence where id=current_setting('aether.evidence')::uuid and review_status='accepted' and reviewed_by=auth.uid() and reviewed_at>=transaction_timestamp()) then raise exception 'Reviewer identity/timestamp is not authoritative'; end if;
end $$;
-- Editing approved content invalidates that approval, including reviewer fields.
select set_config('request.jwt.claim.sub',current_setting('aether.test_user'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('aether.test_user'),'role','authenticated')::text,true);
update public.evidence set description='Changed content' where id=current_setting('aether.evidence')::uuid;
do $$ begin
  if not exists(select 1 from public.evidence where id=current_setting('aether.evidence')::uuid and review_status='pending' and reviewed_by is null and reviewed_at is null) then raise exception 'Changed content retained approval'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('aether.reviewer'),true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('aether.reviewer'),'role','authenticated')::text,true);
do $$ begin
  begin
    update public.evidence set description='Changed and approved',review_status='accepted' where id=current_setting('aether.evidence')::uuid;
    raise exception 'Combined content edit and approval succeeded';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: evidence review authority, tenant isolation, attribution and approval invalidation' as result;
rollback;

