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
  (current_setting('aether.test_user')::uuid, current_setting('aether.test_org')::uuid, 'owner'),
  (current_setting('aether.other_user')::uuid, current_setting('aether.other_org')::uuid, 'owner');
select set_config('request.jwt.claim.sub', current_setting('aether.test_user'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('aether.test_user'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare org uuid := public.current_user_org_id(); fw uuid; program uuid; impl uuid; expected int; rid uuid; kri uuid; uid uuid; pid uuid; eid uuid; obs uuid; tpl text; n int;
begin
 select id into fw from public.frameworks where code='NCA-ECC';
 if fw is null then raise exception 'NCA framework missing'; end if;
 program := public.create_program(p_framework_id=>fw,p_name=>'QA rollback program');
 select count(*) into expected from public.controls where framework_id=fw;
 if expected <> 108 then raise exception 'Unexpected NCA control count %',expected; end if;
 if (select count(*) from public.control_implementations where program_id=program) <> expected then raise exception 'Program controls not seeded'; end if;
 select id into impl from public.control_implementations where program_id=program limit 1;
 update public.control_implementations set status='implemented',owner_id=auth.uid() where id=impl;
 if (select implemented from public.program_summary where id=program)<>1 then raise exception 'Readiness count incorrect'; end if;
 if (select readiness_pct from public.program_summary where id=program)<=0 then raise exception 'Readiness not updated'; end if;
 perform public.import_erm_taxonomy();
 if (select count(*) from public.erm_categories where organization_id=org)<>49 then raise exception 'GCC taxonomy count mismatch'; end if;
 insert into public.erm_risks(organization_id,title,owner_id) values(org,'QA rollback risk',auth.uid()) returning id into rid;
 perform public.erm_assess_risk(p_risk_id=>rid,p_inherent_l=>5,p_inherent_i=>4,p_residual_l=>3,p_residual_i=>2,p_rationale=>'QA assessment');
 if not exists(select 1 from public.erm_risks where id=rid and inherent_score=20 and residual_score=6 and code like 'RSK-%') then raise exception 'Risk scores/code incorrect'; end if;
 if not exists(select 1 from public.erm_assessments where risk_id=rid and assessed_by=auth.uid()) then raise exception 'Assessment history missing'; end if;
 insert into public.erm_kris(organization_id,risk_id,name,amber_threshold,red_threshold) values(org,rid,'QA rollback KRI',5,10) returning id into kri;
 insert into public.erm_kri_readings(organization_id,kri_id,period_date,value,recorded_by) values(org,kri,current_date,11,auth.uid());
 if (select status from public.erm_kri_status where id=kri)<>'red' then raise exception 'KRI threshold classification incorrect'; end if;
 insert into public.audit_universe(organization_id,code,name) values(org,'QA-ROLLBACK','QA rollback process') returning id into uid;
 pid:=public.create_audit_plan_from_universe('QA-ROLLBACK',100);
 if not exists(select 1 from public.audit_plan_items where plan_id=pid and universe_id=uid) then raise exception 'Universe not included in plan'; end if;
 insert into public.audit_engagements(organization_id,code,title,universe_id) values(org,'QA-ROLLBACK','QA rollback engagement',uid) returning id into eid;
 select code into tpl from public.audit_program_templates order by code limit 1;
 n:=public.create_engagement_from_template(eid,tpl);
 if n<=0 or (select procedures_total from public.audit_engagement_summary where id=eid)<>n then raise exception 'Work program import/summary mismatch'; end if;
 insert into public.audit_observations(organization_id,engagement_id,ref,title,rating) values(org,eid,'QA-01','QA rollback finding','high') returning id into obs;
 insert into public.audit_actions(organization_id,observation_id,description,owner_id,due_date) values(org,obs,'QA rollback remediation',auth.uid(),current_date+30);
 if not exists(select 1 from public.audit_engagement_summary where id=eid and observations_high=1 and open_actions=1) then raise exception 'Finding/action summaries incorrect'; end if;
end $$;
reset role;
select 'PASS: compliance seeding/readiness, risk taxonomy/scoring/history/KRI, audit planning/templates/findings/actions; rollback-only database tests' result;
rollback;
