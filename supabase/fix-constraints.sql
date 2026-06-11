-- Fix dashboard_layouts table constraints
-- Run in Supabase Dashboard -> SQL Editor

-- Check if constraint exists and drop it if it does
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'dashboard_layouts_user_id_key' 
        AND conrelid = 'dashboard_layouts'::regclass
    ) THEN
        ALTER TABLE dashboard_layouts 
        DROP CONSTRAINT dashboard_layouts_user_id_key;
    END IF;
END $$;

-- Add unique constraint on user_id for upsert to work
ALTER TABLE dashboard_layouts 
ADD CONSTRAINT dashboard_layouts_user_id_key 
UNIQUE (user_id);

-- Also fix users table RLS policies
-- Drop existing policies that might cause issues
DROP POLICY IF EXISTS "Users can insert own record" ON users;
DROP POLICY IF EXISTS "Allow all inserts" ON users;
DROP POLICY IF EXISTS "Users can create workspaces" ON workspaces;

-- Add policy to allow users to insert their own record
CREATE POLICY "Users can insert own record" ON users
    FOR INSERT 
    WITH CHECK (id = auth.uid());

-- Add policy to allow authenticated users to create workspaces
CREATE POLICY "Authenticated can create workspaces" ON workspaces
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

-- Verify the constraint was added
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'dashboard_layouts'::regclass;
