-- Fix infinite recursion in users table RLS policy
-- Run this in Supabase Dashboard -> SQL Editor

-- First, drop the problematic policy
DROP POLICY IF EXISTS "Users can view workspace members" ON users;

-- Add policy to view own record (always works)
CREATE POLICY "Users can view own record" ON users
    FOR SELECT USING (
        id = auth.uid()
    );

-- Create security definer function to get workspace ID without triggering RLS recursion
CREATE OR REPLACE FUNCTION get_user_workspace_id()
RETURNS UUID AS $$
DECLARE
    ws_id UUID;
BEGIN
    SELECT workspace_id INTO ws_id FROM users WHERE id = auth.uid();
    RETURN ws_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new policy using the function (avoids recursion)
CREATE POLICY "Users can view workspace members" ON users
    FOR SELECT USING (
        workspace_id = get_user_workspace_id()
        OR id = auth.uid()  -- Always allow viewing own record
    );

-- Also ensure users can be created by the trigger
CREATE POLICY "Allow user creation via trigger" ON users
    FOR INSERT WITH CHECK (true);
