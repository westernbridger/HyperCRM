-- Clean fix for users table RLS - run this in Supabase SQL Editor

-- First, drop ALL existing policies on users table
DROP POLICY IF EXISTS "Users can view own record" ON users;
DROP POLICY IF EXISTS "Users can view workspace members" ON users;
DROP POLICY IF EXISTS "Allow user creation via trigger" ON users;

-- Drop the function if it exists
DROP FUNCTION IF EXISTS get_user_workspace_id();

-- Disable and re-enable RLS to clear any cached policies
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create security definer function to get workspace ID
-- This runs with the privileges of the function creator, not the querying user
CREATE OR REPLACE FUNCTION get_user_workspace_id()
RETURNS UUID AS $$
DECLARE
    ws_id UUID;
BEGIN
    SELECT workspace_id INTO ws_id FROM users WHERE id = auth.uid();
    RETURN ws_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION get_user_workspace_id() TO authenticated;

-- Create policy: Users can always view their own record
CREATE POLICY "Users can view own record" ON users
    FOR SELECT 
    USING (id = auth.uid());

-- Create policy: Users can view others in same workspace (using the function)
CREATE POLICY "Users can view workspace members" ON users
    FOR SELECT 
    USING (
        workspace_id = get_user_workspace_id()
    );

-- Allow inserts (for the trigger)
CREATE POLICY "Allow user inserts" ON users
    FOR INSERT 
    WITH CHECK (true);

-- Allow users to update their own record
CREATE POLICY "Users can update own record" ON users
    FOR UPDATE
    USING (id = auth.uid());

-- Verify the policies
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'users';
