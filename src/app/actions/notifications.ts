'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type Notification = {
  id: string
  user_id: string
  workspace_id: string
  type: 'workspace_invitation' | 'role_changed' | 'workspace_created' | 'mention' | 'system' | 'inbound_email'
  title: string
  content: string
  link: string | null
  read: boolean
  created_at: string
  read_at: string | null
}

// ── GET NOTIFICATIONS ────────────────────────────────────────

export async function getNotifications(
  workspaceId: string,
  opts: { unreadOnly?: boolean; limit?: number } = {}
): Promise<{ data: Notification[]; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { data: [], error: 'Not authenticated' }

  // Show notifications for the current workspace PLUS any workspace_invitation
  // notifications regardless of workspace (invitations are about joining a
  // workspace the user isn't a member of yet, so they must be cross-workspace).
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .or(`workspace_id.eq.${workspaceId},type.eq.workspace_invitation`)
    .order('created_at', { ascending: false })

  if (opts.unreadOnly) {
    query = query.eq('read', false)
  }

  if (opts.limit) {
    query = query.limit(opts.limit)
  }

  const { data, error } = await query

  if (error) return { data: [], error: error.message }
  return { data: data as Notification[], error: null }
}

// ── GET UNREAD COUNT ─────────────────────────────────────────

export async function getUnreadNotificationCount(
  workspaceId: string
): Promise<{ count: number; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { count: 0, error: 'Not authenticated' }

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .or(`workspace_id.eq.${workspaceId},type.eq.workspace_invitation`)
    .eq('read', false)

  if (error) return { count: 0, error: error.message }
  return { count: count ?? 0, error: null }
}

// ── MARK AS READ ─────────────────────────────────────────────

export async function markNotificationAsRead(
  notificationId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('notifications')
    // @ts-ignore - Database types are correct, IDE type resolution issue
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return { error: null }
}

// ── MARK ALL AS READ ─────────────────────────────────────────

export async function markAllNotificationsAsRead(
  workspaceId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('notifications')
    // @ts-ignore - Database types are correct, IDE type resolution issue
    .update({ read: true, read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('workspace_id', workspaceId)
    .eq('read', false)

  if (error) return { error: error.message }
  return { error: null }
}

// ── DELETE NOTIFICATION ──────────────────────────────────────

export async function deleteNotification(
  notificationId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return { error: null }
}
