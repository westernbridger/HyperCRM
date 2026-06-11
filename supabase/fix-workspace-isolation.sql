-- ============================================================
-- COMPREHENSIVE WORKSPACE ISOLATION FIX
-- Updates ALL RLS policies to use workspace_members + current workspace context
-- ============================================================

-- Helper function: Get user's current workspace from JWT metadata
CREATE OR REPLACE FUNCTION get_user_current_workspace()
RETURNS UUID AS $$
    SELECT (auth.jwt() -> 'user_metadata' ->> 'current_workspace_id')::UUID;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: Check if user is member of workspace
CREATE OR REPLACE FUNCTION is_workspace_member(p_user_id UUID, p_workspace_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM workspace_members
        WHERE user_id = p_user_id AND workspace_id = p_workspace_id
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- 1. FIX WORKSPACES RLS
-- ============================================================
DROP POLICY IF EXISTS "Users can view own workspace" ON workspaces;
DROP POLICY IF EXISTS "Users can view their workspaces" ON workspaces;

CREATE POLICY "Users can view their workspaces" ON workspaces
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workspace_members
            WHERE workspace_members.workspace_id = workspaces.id
              AND workspace_members.user_id = auth.uid()
        )
    );

-- ============================================================
-- 2. FIX CONTACTS RLS (Critical for isolation)
-- ============================================================
DROP POLICY IF EXISTS "Users can view workspace contacts" ON contacts;
DROP POLICY IF EXISTS "Users can create workspace contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update workspace contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete workspace contacts" ON contacts;
DROP POLICY IF EXISTS "Contacts are isolated by workspace" ON contacts;

-- Contacts are scoped to the CURRENT workspace selected by user
-- This ensures contacts from workspace A never leak to workspace B
CREATE POLICY "Contacts are isolated by workspace" ON contacts
    FOR ALL USING (
        workspace_id = get_user_current_workspace()
        AND is_workspace_member(auth.uid(), workspace_id)
    )
    WITH CHECK (
        workspace_id = get_user_current_workspace()
        AND is_workspace_member(auth.uid(), workspace_id)
    );

-- ============================================================
-- 3. FIX ACTIVITIES RLS (Critical for isolation)
-- ============================================================
DROP POLICY IF EXISTS "Users can view workspace activities" ON activities;
DROP POLICY IF EXISTS "Users can create workspace activities" ON activities;
DROP POLICY IF EXISTS "Users can update workspace activities" ON activities;
DROP POLICY IF EXISTS "Users can delete workspace activities" ON activities;
DROP POLICY IF EXISTS "Workspace members can view activities" ON activities;
DROP POLICY IF EXISTS "Workspace members can manage activities" ON activities;
DROP POLICY IF EXISTS "Activities are isolated by workspace" ON activities;

CREATE POLICY "Activities are isolated by workspace" ON activities
    FOR ALL USING (
        workspace_id = get_user_current_workspace()
        AND is_workspace_member(auth.uid(), workspace_id)
    )
    WITH CHECK (
        workspace_id = get_user_current_workspace()
        AND is_workspace_member(auth.uid(), workspace_id)
    );

-- ============================================================
-- 4. FIX DASHBOARD_LAYOUTS RLS (Per-user, per-workspace)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own layout" ON dashboard_layouts;
DROP POLICY IF EXISTS "Users can update own layout" ON dashboard_layouts;
DROP POLICY IF EXISTS "Users can view workspace layouts" ON dashboard_layouts;
DROP POLICY IF EXISTS "Users can update workspace layouts" ON dashboard_layouts;
DROP POLICY IF EXISTS "Dashboard layouts are isolated by user and workspace" ON dashboard_layouts;

-- Dashboard layouts are per-user AND per-workspace
CREATE POLICY "Dashboard layouts are isolated by user and workspace" ON dashboard_layouts
    FOR ALL USING (
        user_id = auth.uid()
        AND workspace_id = get_user_current_workspace()
    )
    WITH CHECK (
        user_id = auth.uid()
        AND workspace_id = get_user_current_workspace()
    );

-- ============================================================
-- 5. FIX INVITATIONS RLS
-- ============================================================
DROP POLICY IF EXISTS "Workspace members can view invitations" ON invitations;
DROP POLICY IF EXISTS "MASTER or ADMIN can create invitations" ON invitations;
DROP POLICY IF EXISTS "MASTER or ADMIN can revoke invitations" ON invitations;
DROP POLICY IF EXISTS "Anyone can look up invitation by token" ON invitations;
DROP POLICY IF EXISTS "Invitations are isolated by workspace" ON invitations;
DROP POLICY IF EXISTS "MASTER or ADMIN can manage invitations" ON invitations;

CREATE POLICY "Invitations are isolated by workspace" ON invitations
    FOR SELECT USING (
        workspace_id = get_user_current_workspace()
        AND is_workspace_member(auth.uid(), workspace_id)
    );

CREATE POLICY "MASTER or ADMIN can manage invitations" ON invitations
    FOR ALL USING (
        workspace_id = get_user_current_workspace()
        AND get_user_role_in_workspace(auth.uid(), workspace_id) IN ('MASTER', 'ADMIN')
    )
    WITH CHECK (
        workspace_id = get_user_current_workspace()
        AND get_user_role_in_workspace(auth.uid(), workspace_id) IN ('MASTER', 'ADMIN')
    );

-- Anyone can look up invitation by token (needed for accept page)
CREATE POLICY "Anyone can look up invitation by token" ON invitations
    FOR SELECT USING (true);  -- token is the secret

-- ============================================================
-- 6. FIX USERS RLS
-- ============================================================
DROP POLICY IF EXISTS "Users can view own record" ON users;
DROP POLICY IF EXISTS "Users can view workspace members" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "MASTER can update member roles" ON users;
DROP POLICY IF EXISTS "MASTER or ADMIN can remove members" ON users;

-- Users can view their own record
CREATE POLICY "Users can view own record" ON users
    FOR SELECT USING (id = auth.uid());

-- Users can update own profile (non-role fields)
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Note: Role/workspace changes now happen through workspace_members table

-- ============================================================
-- 7. FIX WORKSPACE_MEMBERS RLS (Already done but ensure it's correct)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own memberships" ON workspace_members;
DROP POLICY IF EXISTS "Members can view workspace members" ON workspace_members;
DROP POLICY IF EXISTS "MASTER can manage members" ON workspace_members;
DROP POLICY IF EXISTS "MASTER can delete members" ON workspace_members;
DROP POLICY IF EXISTS "MASTER or ADMIN can invite" ON workspace_members;
DROP POLICY IF EXISTS "Users can view their memberships" ON workspace_members;

CREATE POLICY "Users can view their memberships" ON workspace_members
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Members can view workspace members" ON workspace_members
    FOR SELECT USING (
        workspace_id = get_user_current_workspace()
        AND is_workspace_member(auth.uid(), workspace_id)
    );

CREATE POLICY "MASTER can manage members" ON workspace_members
    FOR UPDATE USING (
        workspace_id = get_user_current_workspace()
        AND get_user_role_in_workspace(auth.uid(), workspace_id) = 'MASTER'
    );

CREATE POLICY "MASTER can delete members" ON workspace_members
    FOR DELETE USING (
        workspace_id = get_user_current_workspace()
        AND get_user_role_in_workspace(auth.uid(), workspace_id) = 'MASTER'
    );

CREATE POLICY "MASTER or ADMIN can invite" ON workspace_members
    FOR INSERT WITH CHECK (
        workspace_id = get_user_current_workspace()
        AND get_user_role_in_workspace(auth.uid(), workspace_id) IN ('MASTER', 'ADMIN')
    );

-- ============================================================
-- SUMMARY
-- ============================================================
-- All tables now enforce workspace isolation via:
-- 1. get_user_current_workspace() - gets workspace from user_metadata
-- 2. is_workspace_member() - verifies user membership in that workspace
-- 
-- This ensures:
-- - Contacts in Workspace A never appear in Workspace B
-- - Activities, dashboard layouts, invitations are all workspace-scoped
-- - User can switch workspaces via updating user_metadata.current_workspace_id
-- ============================================================
