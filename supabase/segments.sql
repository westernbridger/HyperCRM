-- Segments: named groups of contacts within a workspace.
-- Contacts can be manually added or imported via CSV.
-- If a contact doesn't exist in the workspace, it is created first.

-- ── Tables ───────────────────────────────────────────────────────────────────

create table if not exists segments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  color text default '#6366f1',
  -- Condition rules for auto-matching: { "logic": "and"|"or", "items": [{ "id": "uuid", "field": "first_name", "operator": "contains", "value": "..." }] }
  -- null = manual segment (contacts added by hand); non-null = dynamic segment
  conditions jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists segment_contacts (
  segment_id uuid not null references segments(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (segment_id, contact_id)
);

-- Indexes
create index if not exists idx_segments_workspace on segments(workspace_id);
create index if not exists idx_segment_contacts_segment on segment_contacts(segment_id);
create index if not exists idx_segment_contacts_contact on segment_contacts(contact_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table segments enable row level security;
alter table segment_contacts enable row level security;

-- Segments: members can CRUD in their workspace
drop policy if exists "members read segments" on segments;
create policy "members read segments"
  on segments for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = segments.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "members create segments" on segments;
create policy "members create segments"
  on segments for insert
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = segments.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "members update segments" on segments;
create policy "members update segments"
  on segments for update
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = segments.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "members delete segments" on segments;
create policy "members delete segments"
  on segments for delete
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = segments.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Segment contacts: members can manage in their workspace
drop policy if exists "members read segment_contacts" on segment_contacts;
create policy "members read segment_contacts"
  on segment_contacts for select
  using (
    exists (
      select 1 from workspace_members wm
      join segments s on s.workspace_id = wm.workspace_id
      where s.id = segment_contacts.segment_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "members create segment_contacts" on segment_contacts;
create policy "members create segment_contacts"
  on segment_contacts for insert
  with check (
    exists (
      select 1 from workspace_members wm
      join segments s on s.workspace_id = wm.workspace_id
      where s.id = segment_contacts.segment_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists "members delete segment_contacts" on segment_contacts;
create policy "members delete segment_contacts"
  on segment_contacts for delete
  using (
    exists (
      select 1 from workspace_members wm
      join segments s on s.workspace_id = wm.workspace_id
      where s.id = segment_contacts.segment_id
        and wm.user_id = auth.uid()
    )
  );

-- ── Migrations for existing tables ──────────────────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'segments' and column_name = 'conditions') then
    alter table segments add column conditions jsonb;
  end if;
end $$;
