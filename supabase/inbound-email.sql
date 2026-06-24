-- ============================================================
-- HyperCRM — Inbound email routing per workspace
-- Adds inbound_email column to workspaces for unique reply-to addresses.
-- ============================================================

set search_path to public;

-- ── Add inbound_email to workspaces ───────────────────────────
alter table workspaces add column if not exists inbound_email text unique;

-- ── Backfill existing workspaces ──────────────────────────────
-- Generates ws_{first 8 chars of uuid}@email.hypercrm.ca for each workspace.
do $$
declare
  ws record;
  short_id text;
  inbound_addr text;
begin
  for ws in select id from workspaces where inbound_email is null loop
    short_id := left(replace(ws.id::text, '-', ''), 8);
    inbound_addr := 'ws_' || short_id || '@email.hypercrm.ca';
    update workspaces set inbound_email = inbound_addr where id = ws.id;
  end loop;
end $$;

-- ── Index for fast webhook lookups ────────────────────────────
create index if not exists idx_workspaces_inbound_email on workspaces(inbound_email);
