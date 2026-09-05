-- Emergency rollback only; restores the direct-API review bypass.
begin;
drop trigger evidence_enforce_review on public.evidence;
drop function private.enforce_evidence_review();
commit;
