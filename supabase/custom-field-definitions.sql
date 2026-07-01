-- ── Custom Field Definitions ─────────────────────────────────────────────────
-- Workspace-level definitions for custom fields on contacts.
-- Allows server-side code (booking, meta leads, hyperforms) to auto-create
-- field definitions when new attributes appear on a contact.

CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key          TEXT NOT NULL,
  label        TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'text',
  options      TEXT[] DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workspace_id, key)
);

ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view field definitions"
  ON custom_field_definitions FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can manage field definitions"
  ON custom_field_definitions FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Allow service role (admin client) full access for server-side auto-creation
GRANT ALL ON custom_field_definitions TO service_role;
GRANT SELECT ON custom_field_definitions TO authenticated;
