-- ============================================================
-- NOTIFICATIONS SYSTEM
-- Per-user, per-workspace notifications with RLS
-- ============================================================

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('workspace_invitation', 'role_changed', 'workspace_created', 'mention', 'system')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    link TEXT,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace_id ON notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Users can view their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications"
ON notifications FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Admin insert (for server actions)
DROP POLICY IF EXISTS "Admin can insert notifications" ON notifications;
CREATE POLICY "Admin can insert notifications"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (true); -- Admin client bypasses RLS anyway

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to mark all notifications as read for a user in a workspace
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID, p_workspace_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE notifications 
    SET read = TRUE, read_at = NOW()
    WHERE user_id = p_user_id 
    AND workspace_id = p_workspace_id 
    AND read = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID, p_workspace_id UUID)
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER 
    FROM notifications 
    WHERE user_id = p_user_id 
    AND workspace_id = p_workspace_id 
    AND read = FALSE;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
