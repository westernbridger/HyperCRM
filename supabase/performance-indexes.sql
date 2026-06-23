-- ============================================================
-- HyperCRM — Performance Indexes
set search_path to public;
-- Run in Supabase Dashboard -> SQL Editor.
--
-- These target the hot query paths the app actually issues. The base
-- schema.sql already creates single-column indexes on contacts(workspace_id),
-- contacts(email) and contacts(status); the composite indexes below cover the
-- combined filters used by the pipeline, dashboard and webhook code, which a
-- single-column index cannot serve as efficiently.
--
-- ============================================================
-- ============================================================

-- Pipeline board + dashboard counts: filter by workspace AND status.
--   SELECT ... FROM contacts WHERE workspace_id = $1 AND status = $2
CREATE INDEX IF NOT EXISTS idx_contacts_workspace_status
  ON contacts (workspace_id, status);

-- "Leads by day" + recent contacts: filter by workspace, order by created_at.
--   SELECT ... WHERE workspace_id = $1 AND created_at >= $2 ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_contacts_workspace_created
  ON contacts (workspace_id, created_at DESC);

-- Meta webhook deduplication lookup: WHERE workspace_id = $1 AND email = $2
CREATE INDEX IF NOT EXISTS idx_contacts_workspace_email
  ON contacts (workspace_id, email);

-- Recent activity feed: WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 10
CREATE INDEX IF NOT EXISTS idx_activities_workspace_created
  ON activities (workspace_id, created_at DESC);

-- Meta webhook integration lookup is by page_id alone (the UNIQUE constraint is
-- on (workspace_id, page_id), which cannot serve a page_id-only lookup).
--   SELECT ... FROM meta_integrations WHERE page_id = $1
CREATE INDEX IF NOT EXISTS idx_meta_integrations_page_id
  ON meta_integrations (page_id);

-- Campaign grouping / Meta lead filtering reads custom_fields JSONB keys.
-- GIN supports containment queries like custom_fields @> '{"meta_form_id": ...}'.
CREATE INDEX IF NOT EXISTS idx_contacts_custom_fields
  ON contacts USING GIN (custom_fields);
