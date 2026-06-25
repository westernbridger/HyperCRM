-- ============================================================
-- HyperCRM — Communications (channel-agnostic messaging)
-- Run after schema.sql, multi-workspace.sql, and contacts.
--
-- Phase 1 ships EMAIL, but the schema is channel-agnostic so SMS and
-- WhatsApp slot in later by adding new `channel` values + provider adapters.
-- ============================================================

set search_path to public;

-- ── conversations ───────────────────────────────────────────────────────────
-- A thread between the workspace and a single contact on one channel.

create table if not exists conversations (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  contact_id      uuid not null references contacts(id) on delete cascade,
  channel         text not null default 'email'
                    check (channel in ('email', 'sms', 'whatsapp')),
  subject         text,
  status          text not null default 'open'
                    check (status in ('open', 'closed')),
  last_message_at timestamptz not null default now(),
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists conversations_workspace_idx on conversations(workspace_id);
create index if not exists conversations_contact_idx   on conversations(contact_id);
create index if not exists conversations_recent_idx
  on conversations(workspace_id, last_message_at desc);

-- ── messages ─────────────────────────────────────────────────────────────────
-- One row per message in a conversation, inbound or outbound.

create table if not exists messages (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references conversations(id) on delete cascade,
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  contact_id          uuid references contacts(id) on delete set null,
  channel             text not null default 'email'
                        check (channel in ('email', 'sms', 'whatsapp')),
  direction           text not null
                        check (direction in ('outbound', 'inbound')),
  from_addr           text,
  to_addr             text,
  subject             text,
  body_html           text,
  body_text           text,
  provider            text,            -- e.g. 'resend', 'twilio'
  provider_message_id text,            -- id returned by the provider
  status              text not null default 'queued'
                        check (status in ('queued','sent','delivered','opened','clicked','bounced','failed','received')),
  error               text,
  metadata            jsonb not null default '{}',
  attachments         jsonb not null default '[]',  -- [{filename, url, content_type, size}]
  created_by          uuid references users(id) on delete set null,
  created_at          timestamptz not null default now()
);

-- Add attachments column if it doesn't exist (for existing installations)
do $$
begin
  if not exists (select 1 from information_schema.columns
    where table_name = 'messages' and column_name = 'attachments') then
    alter table messages add column attachments jsonb not null default '[]';
  end if;
end $$;

create index if not exists messages_conversation_idx on messages(conversation_id, created_at);
create index if not exists messages_workspace_idx    on messages(workspace_id);
create index if not exists messages_contact_idx      on messages(contact_id);
create index if not exists messages_provider_idx     on messages(provider_message_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table conversations enable row level security;
alter table messages      enable row level security;

-- Workspace members can read conversations in their workspace
create policy "members read conversations"
  on conversations for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = conversations.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Workspace members can create conversations
create policy "members create conversations"
  on conversations for insert
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = conversations.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Workspace members can update conversations (e.g. close a thread)
create policy "members update conversations"
  on conversations for update
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = conversations.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Workspace members can read messages in their workspace
create policy "members read messages"
  on messages for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = messages.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Workspace members can insert messages.
-- Outbound sends + inbound webhooks are written server-side via the
-- service role (which bypasses RLS), so this policy covers in-app inserts.
create policy "members create messages"
  on messages for insert
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = messages.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- ── updated_at trigger (reuses set_updated_at from hyperforms.sql) ────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists conversations_updated_at on conversations;
create trigger conversations_updated_at
  before update on conversations
  for each row execute function set_updated_at();
