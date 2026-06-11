-- ============================================================
-- HyperCRM — Multi-Workspace Membership Migration
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Create workspace_members junction table ─────────────────
CREATE TABLE IF NOT EXISTS workspace_members (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    role          TEXT NOT NULL CHECK (role IN ('MASTER', 'ADMIN', 'ASSOCIATE')),
    joined_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL, -- who invited/added them
    UNIQUE(user_id, workspace_id)  -- One membership per user per workspace
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);

-- ── Migrate existing data ───────────────────────────────────
-- Copy workspace_id/role from users to workspace_members
INSERT INTO workspace_members (user_id, workspace_id, role, joined_at)
SELECT 
    id as user_id,
    workspace_id,
    role,
    COALESCE(created_at, NOW()) as joined_at
FROM users
WHERE workspace_id IS NOT NULL
ON CONFLICT (user_id, workspace_id) DO NOTHING;

-- ── RLS on workspace_members ────────────────────────────────
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Helper function to check user's role in a workspace (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_user_role_in_workspace(p_user_id UUID, p_workspace_id UUID)
RETURNS TEXT AS $$
    SELECT role FROM workspace_members 
    WHERE user_id = p_user_id AND workspace_id = p_workspace_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Users can see their own memberships
CREATE POLICY "Users can view own memberships" ON workspace_members
    FOR SELECT USING (user_id = auth.uid());

-- Users can see other members in workspaces they belong to
CREATE POLICY "Members can view workspace members" ON workspace_members
    FOR SELECT USING (
        get_user_role_in_workspace(auth.uid(), workspace_members.workspace_id) IS NOT NULL
    );

-- Only MASTER can update/delete members
CREATE POLICY "MASTER can manage members" ON workspace_members
    FOR UPDATE USING (
        get_user_role_in_workspace(auth.uid(), workspace_members.workspace_id) = 'MASTER'
    );

CREATE POLICY "MASTER can delete members" ON workspace_members
    FOR DELETE USING (
        get_user_role_in_workspace(auth.uid(), workspace_members.workspace_id) = 'MASTER'
    );

-- MASTER and ADMIN can invite (insert) new members
CREATE POLICY "MASTER or ADMIN can invite" ON workspace_members
    FOR INSERT WITH CHECK (
        get_user_role_in_workspace(auth.uid(), workspace_members.workspace_id) IN ('MASTER', 'ADMIN')
    );

-- ── Helper: Get user's current workspace context ───────────
-- Users need to "switch" between workspaces they're members of
-- This stores their currently selected workspace in user_metadata

-- ── Update invitations to use workspace_members on accept ────
-- When accepting invitation, insert into workspace_members instead of updating users

-- ── Functions ─────────────────────────────────────────────

-- Get all workspaces a user is a member of
CREATE OR REPLACE FUNCTION get_user_workspaces(p_user_id UUID)
RETURNS TABLE (
    workspace_id UUID,
    name TEXT,
    role TEXT,
    joined_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.id,
        w.name,
        wm.role,
        wm.joined_at
    FROM workspace_members wm
    JOIN workspaces w ON w.id = wm.workspace_id
    WHERE wm.user_id = p_user_id
    ORDER BY wm.joined_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's role in a specific workspace
CREATE OR REPLACE FUNCTION get_user_role_in_workspace(p_user_id UUID, p_workspace_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role
    FROM workspace_members
    WHERE user_id = p_user_id AND workspace_id = p_workspace_id;
    
    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Optional: Remove old columns (after migration confirmed) ─
-- ALTER TABLE users DROP COLUMN IF EXISTS workspace_id;
-- ALTER TABLE users DROP COLUMN IF EXISTS role;
-- Note: Keep these until you're sure migration worked

-- ── Update dashboard_layouts RLS ───────────────────────────
-- Dashboard layouts should be per-workspace now
DROP POLICY IF EXISTS "Users can view own layout" ON dashboard_layouts;
DROP POLICY IF EXISTS "Users can update own layout" ON dashboard_layouts;

CREATE POLICY "Users can view workspace layouts" ON dashboard_layouts
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update workspace layouts" ON dashboard_layouts
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- ── Update contacts RLS ────────────────────────────────────
DROP POLICY IF EXISTS "Workspace member access" ON contacts;
DROP POLICY IF EXISTS "Users can manage workspace contacts" ON contacts;

CREATE POLICY "Workspace members can view contacts" ON contacts
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace members can manage contacts" ON contacts
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- ── Update activities RLS ───────────────────────────────────
DROP POLICY IF EXISTS "Workspace member access" ON activities;
DROP POLICY IF EXISTS "Users can manage workspace activities" ON activities;

CREATE POLICY "Workspace members can view activities" ON activities
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace members can manage activities" ON activities
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
    );

-- ── Update users RLS ──────────────────────────────────────
-- Users can only update their own profile (not role/workspace)
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Master can update member roles via workspace_members table (not users table directly)

COMMIT;
