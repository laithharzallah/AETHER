-- =============================================================================
-- AETHER GRC Assistant — conversation persistence
--   conversations — tenant-owned chat threads
--   messages      — user / assistant turns with tool activity and citations
-- =============================================================================

create table if not exists public.conversations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  created_by       uuid references public.profiles(id) on delete set null,
  title            text not null default 'New conversation',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists conversations_org_idx
  on public.conversations (organization_id, updated_at desc);

create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  role             text not null,
  content          text not null,
  tool_activity    jsonb not null default '[]'::jsonb,   -- [{name, input, summary}]
  citations        jsonb not null default '[]'::jsonb,   -- [{controlId, frameworkCode, frameworkName, ref, title}]
  model            text,
  input_tokens     integer,
  output_tokens    integer,
  created_at       timestamptz not null default now(),
  constraint messages_role_check check (role in ('user', 'assistant'))
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- Touch the parent conversation whenever a message lands.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "conversations_select_tenant" on public.conversations;
create policy "conversations_select_tenant"
  on public.conversations for select to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "conversations_insert_tenant" on public.conversations;
create policy "conversations_insert_tenant"
  on public.conversations for insert to authenticated
  with check (
    organization_id = public.current_user_org_id()
    and (created_by is null or created_by = (select auth.uid()))
  );

drop policy if exists "conversations_update_tenant" on public.conversations;
create policy "conversations_update_tenant"
  on public.conversations for update to authenticated
  using (organization_id = public.current_user_org_id())
  with check (organization_id = public.current_user_org_id());

drop policy if exists "conversations_delete_tenant" on public.conversations;
create policy "conversations_delete_tenant"
  on public.conversations for delete to authenticated
  using (organization_id = public.current_user_org_id());

drop policy if exists "messages_select_tenant" on public.messages;
create policy "messages_select_tenant"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.organization_id = public.current_user_org_id()
    )
  );

drop policy if exists "messages_insert_tenant" on public.messages;
create policy "messages_insert_tenant"
  on public.messages for insert to authenticated
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.organization_id = public.current_user_org_id()
    )
  );

drop policy if exists "messages_delete_tenant" on public.messages;
create policy "messages_delete_tenant"
  on public.messages for delete to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.organization_id = public.current_user_org_id()
    )
  );
