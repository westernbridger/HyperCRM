-- ── meta_integrations ────────────────────────────────────────────────────────
-- Stores a Facebook Page access token per workspace so the webhook can fetch
-- lead data from the Meta Graph API on behalf of the correct Page.
--
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meta_integrations (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  page_id            text        NOT NULL,
  page_access_token  text        NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workspace_id, page_id)
);

-- Row-Level Security
ALTER TABLE meta_integrations ENABLE ROW LEVEL SECURITY;

-- Any workspace member can read the integration config (needed to show connected status)
DROP POLICY IF EXISTS "members_read_meta_integrations" ON meta_integrations;
CREATE POLICY "members_read_meta_integrations"
  ON meta_integrations FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Only MASTER / ADMIN can insert, update, or delete integration records
DROP POLICY IF EXISTS "admins_manage_meta_integrations" ON meta_integrations;
CREATE POLICY "admins_manage_meta_integrations"
  ON meta_integrations FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('MASTER', 'ADMIN')
    )
  );

-- ── contacts: Meta fields live in custom_fields JSONB ─────────────────────────
-- No ALTER TABLE required.  Store campaign metadata like this when creating/
-- updating a contact via the webhook:
--
--   custom_fields = {
--     "campaign_name": "Summer 2025 Leads",
--     "meta_form_id":  "1234567890",
--     "ad_name":       "Creative A",
--     "adset_name":    "Lookalike 18-35"
--   }
--
-- Recommended GIN index for fast JSONB queries (optional but useful at scale):
-- CREATE INDEX IF NOT EXISTS idx_contacts_custom_fields
--   ON contacts USING GIN (custom_fields);
