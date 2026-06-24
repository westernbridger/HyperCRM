-- ============================================================
-- HyperCRM — Per-workspace custom sending domains (Resend)
-- Run after communications.sql.
--
-- Each workspace can register its own sending domain. Domains are created
-- under the single Resend account via the Domains API; this table tracks
-- the Resend domain id, verification status, the DNS records to display to
-- the user, and the default "from" identity used when sending.
-- ============================================================

set search_path to public;

create table if not exists workspace_email_domains (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  domain           text not null,                 -- e.g. "acme.com"
  resend_domain_id text not null,                 -- id returned by Resend
  region           text not null default 'us-east-1',
  from_name        text,                          -- "Acme Sales"
  from_email       text not null,                 -- "sales@acme.com"
  status           text not null default 'pending'
                     check (status in ('pending','verified','failed','temporary_failure')),
  dns_records      jsonb not null default '[]',   -- records the user must add
  is_default       boolean not null default true, -- default sender for the workspace
  created_by       uuid references users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (workspace_id, domain)
);

create index if not exists workspace_email_domains_workspace_idx
  on workspace_email_domains(workspace_id);

-- Only one default sender per workspace.
create unique index if not exists workspace_email_domains_one_default
  on workspace_email_domains(workspace_id)
  where is_default = true;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table workspace_email_domains enable row level security;

-- Workspace members can read their workspace's domains.
create policy "members read email domains"
  on workspace_email_domains for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_email_domains.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- MASTER / ADMIN can add domains.
create policy "admins create email domains"
  on workspace_email_domains for insert
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_email_domains.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('MASTER', 'ADMIN')
    )
  );

-- MASTER / ADMIN can update domains (status refresh, set default).
create policy "admins update email domains"
  on workspace_email_domains for update
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_email_domains.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('MASTER', 'ADMIN')
    )
  );

-- MASTER / ADMIN can delete domains.
create policy "admins delete email domains"
  on workspace_email_domains for delete
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_email_domains.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('MASTER', 'ADMIN')
    )
  );

-- ── updated_at trigger (reuses set_updated_at) ───────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspace_email_domains_updated_at on workspace_email_domains;
create trigger workspace_email_domains_updated_at
  before update on workspace_email_domains
  for each row execute function set_updated_at();
