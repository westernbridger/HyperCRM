-- HyperCRM Automation Schema
-- Workflows, triggers, and actions for CRM automation

-- ── Types ─────────────────────────────────────────────────────────────────────

CREATE TYPE workflow_trigger_type AS ENUM (
  'contact_created',
  'contact_status_changed',
  'contact_added_to_segment',
  'contact_updated'
);

CREATE TYPE workflow_action_type AS ENUM (
  'send_email',
  'add_to_segment',
  'update_status',
  'add_tag',
  'create_activity'
);

CREATE TYPE workflow_status AS ENUM ('active', 'paused', 'draft');

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status workflow_status NOT NULL DEFAULT 'draft',
  trigger_type workflow_trigger_type NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  -- e.g. {"segment_id": "..."} for contact_added_to_segment
  -- e.g. {"from_status": "Lead", "to_status": "Prospect"} for contact_status_changed
  action_type workflow_action_type NOT NULL,
  action_config JSONB NOT NULL DEFAULT '{}',
  -- e.g. {"subject": "...", "body": "..."} for send_email
  -- e.g. {"segment_id": "..."} for add_to_segment
  -- e.g. {"status": "Customer"} for update_status
  -- e.g. {"tag": "vip"} for add_tag
  -- e.g. {"type": "note", "title": "...", "content": "..."} for create_activity
  run_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflows_workspace ON workflows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(workspace_id, status);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read workflows" ON workflows;
CREATE POLICY "members read workflows"
  ON workflows FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workflows.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "members create workflows" ON workflows;
CREATE POLICY "members create workflows"
  ON workflows FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workflows.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "members update workflows" ON workflows;
CREATE POLICY "members update workflows"
  ON workflows FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workflows.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "members delete workflows" ON workflows;
CREATE POLICY "members delete workflows"
  ON workflows FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workflows.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- ── Migration for existing databases ──────────────────────────────────────────
-- If the tables already exist without these columns, add them:

DO $$
BEGIN
  -- Check if workflows table exists but is missing the run_count column
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflows')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workflows' AND column_name = 'run_count')
  THEN
    ALTER TABLE workflows ADD COLUMN run_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE workflows ADD COLUMN last_run_at TIMESTAMPTZ;
  END IF;
END $$;
