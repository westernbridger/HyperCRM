-- ============================================================
-- HyperCRM — Email broadcasts (multi-recipient sends)
-- Run after communications.sql.
-- ============================================================

set search_path to public;

-- ── Broadcasts table ──────────────────────────────────────────
create table if not exists broadcasts (
  id          uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  subject     text not null,
  body_html   text not null,
  body_text   text not null default '',
  recipient_count int not null default 0,
  sent_count  int not null default 0,
  failed_count int not null default 0,
  status      text not null default 'draft' check (status in ('draft','sending','sent','partial_failure')),
  created_by  uuid references users(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table broadcasts enable row level security;

drop policy if exists "Broadcasts are isolated by workspace" on broadcasts;
create policy "Broadcasts are isolated by workspace"
  on broadcasts for all
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  )
  with check (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

-- ── Broadcast recipients table ────────────────────────────────
create table if not exists broadcast_recipients (
  id           uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references broadcasts(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  contact_id   uuid not null references contacts(id) on delete cascade,
  message_id   uuid references messages(id) on delete set null,
  status       text not null default 'pending' check (status in ('pending','sent','failed')),
  error        text,
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);

alter table broadcast_recipients enable row level security;

drop policy if exists "Broadcast recipients isolated by workspace" on broadcast_recipients;
create policy "Broadcast recipients isolated by workspace"
  on broadcast_recipients for all
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  )
  with check (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create index if not exists idx_broadcast_recipients_broadcast on broadcast_recipients(broadcast_id);
create index if not exists idx_broadcasts_workspace on broadcasts(workspace_id);
