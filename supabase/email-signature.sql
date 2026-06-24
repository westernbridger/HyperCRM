-- ============================================================
-- HyperCRM — Per-workspace email signature
-- Run after schema.sql / multi-workspace.sql.
--
-- Stores a structured signature (name, title, company, phone, etc.)
-- as jsonb on the workspaces table. Appended to outbound emails.
-- ============================================================

set search_path to public;

alter table workspaces
  add column if not exists email_signature jsonb not null default '{}'::jsonb;
