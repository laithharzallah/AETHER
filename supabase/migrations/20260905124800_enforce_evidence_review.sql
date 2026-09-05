-- Enforce the same owner/admin review boundary as lib/actions/evidence.ts
-- on direct Data API writes too. No existing evidence is modified.
create or replace function private.enforce_evidence_review()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  review_changed boolean;
  content_changed boolean;
begin
  -- Trusted provisioning/maintenance retains its existing capabilities.
  if current_user in ('postgres', 'service_role', 'supabase_admin') then return new; end if;
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;

  if tg_op = 'INSERT' then
    if new.review_status <> 'pending' or new.reviewed_by is not null or new.reviewed_at is not null then
      raise exception 'New evidence must await review' using errcode='42501';
    end if;
    new.uploaded_by := auth.uid();
    new.created_at := statement_timestamp();
    return new;
  end if;

  if row(new.id,new.organization_id,new.uploaded_by,new.created_at)
    is distinct from row(old.id,old.organization_id,old.uploaded_by,old.created_at) then
    raise exception 'Evidence identity and attribution cannot be changed' using errcode='42501';
  end if;
  review_changed := row(new.review_status,new.reviewed_by,new.reviewed_at)
    is distinct from row(old.review_status,old.reviewed_by,old.reviewed_at);
  content_changed := (to_jsonb(new) - array['review_status','reviewed_by','reviewed_at','updated_at'])
    is distinct from (to_jsonb(old) - array['review_status','reviewed_by','reviewed_at','updated_at']);

  if content_changed then
    if review_changed then
      raise exception 'Update evidence content separately before reviewing' using errcode='42501';
    end if;
    -- A previous decision does not apply to a materially changed record.
    new.review_status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
  elsif review_changed then
    if coalesce(private.current_user_role(), '') not in ('owner','admin') then
      raise exception 'Only owners and admins can review evidence' using errcode='42501';
    end if;
    if new.review_status = 'pending' then
      new.reviewed_by := null;
      new.reviewed_at := null;
    else
      new.reviewed_by := auth.uid();
      new.reviewed_at := statement_timestamp();
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_evidence_review() from public, anon, authenticated;
create trigger evidence_enforce_review
before insert or update on public.evidence
for each row execute function private.enforce_evidence_review();
