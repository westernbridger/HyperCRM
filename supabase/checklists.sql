-- ============================================================
-- HyperCRM — Checklists: shareable, passcode-protected checklists
-- with per-item check tracking and participant attribution.
-- Run after schema.sql and multi-workspace.sql
-- ============================================================

set search_path to public;

-- ── checklists ─────────────────────────────────────────────────
-- Stores checklist definitions per workspace.
create table if not exists checklists (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  name            text not null,
  description     text,
  passcode        text not null,
  is_active       boolean not null default true,
  allow_editing   boolean not null default false,
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists checklists_workspace_idx on checklists(workspace_id);

-- RLS
alter table checklists enable row level security;

create policy "workspace members can read checklists"
  on checklists for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = checklists.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "admins can create checklists"
  on checklists for insert
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = checklists.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('MASTER', 'ADMIN')
    )
  );

create policy "admins can update checklists"
  on checklists for update
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = checklists.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('MASTER', 'ADMIN')
    )
  );

create policy "admins can delete checklists"
  on checklists for delete
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = checklists.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('MASTER', 'ADMIN')
    )
  );

-- ── checklist_items ─────────────────────────────────────────────
-- Stores the line items of a checklist (name, quantity, order).
create table if not exists checklist_items (
  id              uuid primary key default gen_random_uuid(),
  checklist_id    uuid not null references checklists(id) on delete cascade,
  label           text not null,
  quantity        text,
  sort_order      integer not null default 0,
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists checklist_items_checklist_idx on checklist_items(checklist_id);

-- RLS: workspace members can read; admins can write.
alter table checklist_items enable row level security;

create policy "workspace members can read checklist items"
  on checklist_items for select
  using (
    exists (
      select 1 from checklists c
      join workspace_members wm on wm.workspace_id = c.workspace_id
      where c.id = checklist_items.checklist_id
        and wm.user_id = auth.uid()
    )
  );

create policy "admins can manage checklist items"
  on checklist_items for all
  using (
    exists (
      select 1 from checklists c
      join workspace_members wm on wm.workspace_id = c.workspace_id
      where c.id = checklist_items.checklist_id
        and wm.user_id = auth.uid()
        and wm.role in ('MASTER', 'ADMIN')
    )
  );

-- ── checklist_participants ──────────────────────────────────────
-- Tracks who has accessed a checklist via passcode.
-- Each participant has a display name and optional avatar (initials-based).
create table if not exists checklist_participants (
  id              uuid primary key default gen_random_uuid(),
  checklist_id    uuid not null references checklists(id) on delete cascade,
  display_name    text not null,
  avatar_color    text not null default '#6366f1',
  created_at      timestamptz not null default now(),
  unique(checklist_id, display_name)
);

create index if not exists checklist_participants_checklist_idx on checklist_participants(checklist_id);

-- RLS: public read (needed for public view via service role).
alter table checklist_participants enable row level security;

create policy "workspace members can read participants"
  on checklist_participants for select
  using (
    exists (
      select 1 from checklists c
      join workspace_members wm on wm.workspace_id = c.workspace_id
      where c.id = checklist_participants.checklist_id
        and wm.user_id = auth.uid()
    )
  );

-- ── checklist_checks ────────────────────────────────────────────
-- Tracks which participant has checked which item.
-- One row per (item, participant) — inserting = checking, deleting = unchecking.
create table if not exists checklist_checks (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references checklist_items(id) on delete cascade,
  participant_id  uuid not null references checklist_participants(id) on delete cascade,
  checked_at      timestamptz not null default now(),
  unique(item_id, participant_id)
);

create index if not exists checklist_checks_item_idx on checklist_checks(item_id);
create index if not exists checklist_checks_participant_idx on checklist_checks(participant_id);

-- RLS
alter table checklist_checks enable row level security;

create policy "workspace members can read checks"
  on checklist_checks for select
  using (
    exists (
      select 1 from checklist_items ci
      join checklists c on c.id = ci.checklist_id
      join workspace_members wm on wm.workspace_id = c.workspace_id
      where ci.id = checklist_checks.item_id
        and wm.user_id = auth.uid()
    )
  );

-- ── updated_at trigger for checklists ───────────────────────────
create or replace function set_checklist_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists update_checklists_updated_at on checklists;
create trigger update_checklists_updated_at before update on checklists
  for each row execute function set_checklist_updated_at();
