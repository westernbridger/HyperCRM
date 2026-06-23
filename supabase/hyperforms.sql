-- HyperForms: custom lead-capture forms that feed directly into the pipeline
-- Run this after schema.sql and multi-workspace.sql

set search_path to public;

-- ── hyperforms ──────────────────────────────────────────────────────────────
-- Stores form definitions (name, description, field schema) per workspace.

create table if not exists hyperforms (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  name          text not null,
  description   text,
  fields        jsonb not null default '[]',
  is_active     boolean not null default true,
  created_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists hyperforms_workspace_idx on hyperforms(workspace_id);

-- RLS
alter table hyperforms enable row level security;

-- Workspace members can read forms in their workspace
create policy "workspace members can read hyperforms"
  on hyperforms for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = hyperforms.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- MASTER / ADMIN can insert forms
create policy "admins can create hyperforms"
  on hyperforms for insert
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = hyperforms.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('MASTER', 'ADMIN')
    )
  );

-- MASTER / ADMIN can update forms
create policy "admins can update hyperforms"
  on hyperforms for update
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = hyperforms.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('MASTER', 'ADMIN')
    )
  );

-- MASTER / ADMIN can delete forms
create policy "admins can delete hyperforms"
  on hyperforms for delete
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = hyperforms.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('MASTER', 'ADMIN')
    )
  );

-- ── hyperform_submissions ────────────────────────────────────────────────────
-- One row per form fill; a contact is created/linked on submission.

create table if not exists hyperform_submissions (
  id            uuid primary key default gen_random_uuid(),
  form_id       uuid not null references hyperforms(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  contact_id    uuid references contacts(id) on delete set null,
  answers       jsonb not null default '{}',
  status        text not null default 'Lead'
                  check (status in ('Lead','Prospect','Customer','Churned')),
  submitted_at  timestamptz not null default now()
);

create index if not exists hyperform_submissions_form_idx      on hyperform_submissions(form_id);
create index if not exists hyperform_submissions_workspace_idx on hyperform_submissions(workspace_id);
create index if not exists hyperform_submissions_contact_idx   on hyperform_submissions(contact_id);

-- RLS
alter table hyperform_submissions enable row level security;

-- Workspace members can read submissions for their workspace
create policy "workspace members can read submissions"
  on hyperform_submissions for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = hyperform_submissions.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Anyone (anon) can insert a submission — public form fill.
-- The workspace_id is validated server-side before insert via service role.
create policy "public can submit hyperforms"
  on hyperform_submissions for insert
  with check (true);

-- MASTER / ADMIN can update submission status (pipeline drag)
create policy "admins can update submission status"
  on hyperform_submissions for update
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = hyperform_submissions.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('MASTER', 'ADMIN')
    )
  );

-- MASTER / ADMIN can delete submissions
create policy "admins can delete submissions"
  on hyperform_submissions for delete
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = hyperform_submissions.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('MASTER', 'ADMIN')
    )
  );

-- ── updated_at trigger ───────────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hyperforms_updated_at on hyperforms;
create trigger hyperforms_updated_at
  before update on hyperforms
  for each row execute function set_updated_at();
