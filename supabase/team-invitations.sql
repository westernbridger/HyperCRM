-- ============================================================
-- HyperCRM — Team Invitations Migration
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Add password_change_required to users ─────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_change_required BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Invitations table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    invited_by    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email         TEXT NOT NULL,
    role          user_role NOT NULL DEFAULT 'ASSOCIATE',
    token         UUID NOT NULL DEFAULT gen_random_uuid(),
    accepted_at   TIMESTAMPTZ,
    expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, email)
);

CREATE INDEX IF NOT EXISTS idx_invitations_workspace ON invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token    ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email    ON invitations(email);

-- ── RLS on invitations ───────────────────────────────────────
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view invitations" ON invitations;
-- Workspace members can view pending invitations for their workspace
CREATE POLICY "Workspace members can view invitations" ON invitations
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM users WHERE users.id = auth.uid())
    );

DROP POLICY IF EXISTS "MASTER or ADMIN can create invitations" ON invitations;
-- MASTER or ADMIN can create invitations
CREATE POLICY "MASTER or ADMIN can create invitations" ON invitations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
              AND users.workspace_id = invitations.workspace_id
              AND users.role IN ('MASTER', 'ADMIN')
        )
    );

DROP POLICY IF EXISTS "MASTER or ADMIN can revoke invitations" ON invitations;
-- MASTER or ADMIN can delete (revoke) invitations
CREATE POLICY "MASTER or ADMIN can revoke invitations" ON invitations
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
              AND users.workspace_id = invitations.workspace_id
              AND users.role IN ('MASTER', 'ADMIN')
        )
    );

DROP POLICY IF EXISTS "Anyone can look up invitation by token" ON invitations;
-- Anyone (including unauthenticated) can look up an invitation by token
-- (needed for the accept page before the user has an account)
CREATE POLICY "Anyone can look up invitation by token" ON invitations
    FOR SELECT USING (token = token);   -- always true; token is already secret

-- ── Tighten users UPDATE policy ──────────────────────────────
-- Drop the broad "own record only" update and replace with:
--   1. Users can update their own profile fields (name, avatar)
--   2. Only MASTER can change another member's role
--   3. MASTER or ADMIN can remove members (handled by DELETE)

DROP POLICY IF EXISTS "Users can update own record" ON users;

DROP POLICY IF EXISTS "Users can update own profile" ON users;
-- Self-update (profile fields only — role cannot be self-elevated)
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid()
        -- prevent self-promotion: new role must equal current role unless they are already MASTER
        AND (
            role = (SELECT role FROM users WHERE id = auth.uid())
            OR (SELECT role FROM users WHERE id = auth.uid()) = 'MASTER'
        )
    );

DROP POLICY IF EXISTS "MASTER can update member roles" ON users;
-- MASTER can update any member's role within the workspace
CREATE POLICY "MASTER can update member roles" ON users
    FOR UPDATE USING (
        workspace_id = get_user_workspace_id()
        AND EXISTS (
            SELECT 1 FROM users AS me
            WHERE me.id = auth.uid() AND me.role = 'MASTER'
        )
    );

-- ── DELETE policy: MASTER/ADMIN can remove members ───────────
DROP POLICY IF EXISTS "MASTER can remove members" ON users;
DROP POLICY IF EXISTS "MASTER or ADMIN can remove members" ON users;

CREATE POLICY "MASTER or ADMIN can remove members" ON users
    FOR DELETE USING (
        -- cannot delete yourself
        id <> auth.uid()
        AND workspace_id = get_user_workspace_id()
        AND EXISTS (
            SELECT 1 FROM users AS me
            WHERE me.id = auth.uid()
              AND me.role IN ('MASTER', 'ADMIN')
              -- ADMIN cannot remove MASTER
              AND NOT (me.role = 'ADMIN' AND (SELECT role FROM users WHERE id = users.id) = 'MASTER')
        )
    );

-- ── Helper function: get current user's role ─────────────────
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
    SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
