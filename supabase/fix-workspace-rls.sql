-- Consolidated RLS fix so users can self-provision a workspace and create contacts
-- Run in Supabase Dashboard -> SQL Editor

-- ========== WORKSPACES ==========
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can create workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can view own workspace" ON workspaces;
DROP POLICY IF EXISTS "Users can view workspaces during setup" ON workspaces;

-- Any authenticated user can create a workspace
CREATE POLICY "Authenticated can create workspaces" ON workspaces
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Users can view workspaces (needed to read back the inserted row and for joins)
CREATE POLICY "Authenticated can view workspaces" ON workspaces
    FOR SELECT USING (auth.role() = 'authenticated');

-- ========== USERS ==========
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own record" ON users;
DROP POLICY IF EXISTS "Users can update own record" ON users;

CREATE POLICY "Users can insert own record" ON users
    FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own record" ON users
    FOR UPDATE USING (id = auth.uid());

-- ========== CONTACTS ==========
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view workspace contacts" ON contacts;
DROP POLICY IF EXISTS "Users can create workspace contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update workspace contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete workspace contacts" ON contacts;

CREATE POLICY "Users can view workspace contacts" ON contacts
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM users WHERE users.id = auth.uid())
    );

CREATE POLICY "Users can create workspace contacts" ON contacts
    FOR INSERT WITH CHECK (
        workspace_id IN (SELECT workspace_id FROM users WHERE users.id = auth.uid())
    );

CREATE POLICY "Users can update workspace contacts" ON contacts
    FOR UPDATE USING (
        workspace_id IN (SELECT workspace_id FROM users WHERE users.id = auth.uid())
    );

CREATE POLICY "Users can delete workspace contacts" ON contacts
    FOR DELETE USING (
        workspace_id IN (SELECT workspace_id FROM users WHERE users.id = auth.uid())
    );

-- ========== ACTIVITIES ==========
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view workspace activities" ON activities;
DROP POLICY IF EXISTS "Users can create workspace activities" ON activities;

CREATE POLICY "Users can view workspace activities" ON activities
    FOR SELECT USING (
        workspace_id IN (SELECT workspace_id FROM users WHERE users.id = auth.uid())
    );

CREATE POLICY "Users can create workspace activities" ON activities
    FOR INSERT WITH CHECK (
        workspace_id IN (SELECT workspace_id FROM users WHERE users.id = auth.uid())
    );

-- ========== BACKFILL: give existing users without a workspace one ==========
DO $$
DECLARE
    u RECORD;
    new_ws_id UUID;
BEGIN
    FOR u IN SELECT id, email FROM users WHERE workspace_id IS NULL LOOP
        INSERT INTO workspaces (name, slug)
        VALUES (
            COALESCE(split_part(u.email, '@', 1), 'My') || ' Workspace',
            COALESCE(split_part(u.email, '@', 1), 'workspace') || '-' || substr(u.id::text, 1, 8)
        )
        RETURNING id INTO new_ws_id;

        UPDATE users SET workspace_id = new_ws_id WHERE id = u.id;
    END LOOP;
END $$;
