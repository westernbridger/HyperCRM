-- ============================================================
-- HyperCRM — Per-workspace email signature
-- Run after schema.sql / multi-workspace.sql / fix-workspace-isolation.sql.
--
-- Stores a structured signature (name, title, company, phone, etc.)
-- as jsonb on the workspaces table. Appended to outbound emails.
-- ============================================================

set search_path to public;

alter table workspaces
  add column if not exists email_signature jsonb not null default '{}'::jsonb;

-- The workspaces table has RLS enabled but only had a SELECT policy.
-- Without an UPDATE policy, updates silently affect 0 rows (no error).
drop policy if exists "Members can update their workspace" on workspaces;
create policy "Members can update their workspace"
  on workspaces for update
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
    )
  );
