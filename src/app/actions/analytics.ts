'use server'

import { createClient } from '@/lib/supabase/server'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContactGrowthPoint = {
  date: string
  total: number
  new_contacts: number
}

export type StatusDistribution = {
  status: string
  count: number
  percentage: number
}

export type EmailPerformance = {
  total_sent: number
  total_failed: number
  total_queued: number
  delivery_rate: number
  last_30_sent: number
  last_30_failed: number
}

export type AutomationMetrics = {
  total_workflows: number
  active_workflows: number
  paused_workflows: number
  draft_workflows: number
  total_runs: number
}

export type ActivityBreakdown = {
  type: string
  count: number
}

export type TeamActivityRow = {
  user_id: string | null
  user_name: string
  activity_count: number
  last_active: string | null
}

export type AnalyticsData = {
  contactGrowth: ContactGrowthPoint[]
  statusDistribution: StatusDistribution[]
  emailPerformance: EmailPerformance
  automationMetrics: AutomationMetrics
  activityBreakdown: ActivityBreakdown[]
  teamActivity: TeamActivityRow[]
  totalContacts: number
  newContacts30d: number
  totalConversations: number
  totalBroadcasts: number
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const workspaceId =
    (user?.user_metadata?.current_workspace_id as string | undefined) ?? null
  return { supabase, workspaceId, userId: user?.id ?? null }
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ── Main aggregate query ──────────────────────────────────────────────────────

export async function getAnalytics(): Promise<{
  data: AnalyticsData | null
  error: string | null
}> {
  try {
    const { supabase, workspaceId } = await getContext()
    if (!workspaceId) return { data: null, error: 'No workspace selected' }

    // Run all independent queries in parallel
    const [
      contactsResult,
      contacts30dResult,
      statusLead,
      statusProspect,
      statusCustomer,
      statusChurned,
      messagesResult,
      messages30dResult,
      workflowsResult,
      activitiesResult,
      conversationsResult,
      broadcastsResult,
    ] = await Promise.all([
      // Total contacts
      supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),

      // Contacts created in last 30 days
      supabase.from('contacts')
        .select('id, created_at', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

      // Status counts
      supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'Lead'),
      supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'Prospect'),
      supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'Customer'),
      supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).eq('status', 'Churned'),

      // Email performance — all time
      supabase.from('messages').select('status', { count: 'exact', head: false }).eq('workspace_id', workspaceId).eq('channel', 'email').eq('direction', 'outbound'),

      // Email performance — last 30 days
      supabase.from('messages')
        .select('status', { count: 'exact', head: false })
        .eq('workspace_id', workspaceId)
        .eq('channel', 'email')
        .eq('direction', 'outbound')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

      // Workflows
      supabase.from('workflows').select('status, run_count').eq('workspace_id', workspaceId),

      // Activities (last 30 days, for breakdown by type)
      supabase.from('activities')
        .select('type, created_by, created_at')
        .eq('workspace_id', workspaceId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(500),

      // Total conversations
      supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),

      // Total broadcasts
      supabase.from('broadcasts').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
    ])

    // ── Contact Growth (last 30 days, daily) ────────────────────────────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const { data: recentContacts } = await supabase
      .from('contacts')
      .select('created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true })

    const growthMap = new Map<string, number>()
    const days: string[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const key = formatDate(d)
      days.push(key)
      growthMap.set(key, 0)
    }
    for (const c of recentContacts ?? []) {
      const key = formatDate(new Date(c.created_at))
      if (growthMap.has(key)) {
        growthMap.set(key, (growthMap.get(key) ?? 0) + 1)
      }
    }

    // Cumulative total — need total contacts before 30 days ago
    const { count: contactsBefore30d } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .lt('created_at', thirtyDaysAgo.toISOString())

    let running = contactsBefore30d ?? 0
    const contactGrowth: ContactGrowthPoint[] = days.map((date) => {
      const newContacts = growthMap.get(date) ?? 0
      running += newContacts
      return { date, total: running, new_contacts: newContacts }
    })

    // ── Status Distribution ──────────────────────────────────────────────────
    const totalContacts = contactsResult.count ?? 0
    const statusCounts: Record<string, number> = {
      Lead: statusLead.count ?? 0,
      Prospect: statusProspect.count ?? 0,
      Customer: statusCustomer.count ?? 0,
      Churned: statusChurned.count ?? 0,
    }
    const statusDistribution: StatusDistribution[] = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: totalContacts > 0 ? Math.round((count / totalContacts) * 100) : 0,
    }))

    // ── Email Performance ────────────────────────────────────────────────────
    const allMessages = messagesResult.data ?? []
    const last30Messages = messages30dResult.data ?? []
    const totalSent = allMessages.filter((m: any) => m.status === 'sent' || m.status === 'delivered' || m.status === 'opened' || m.status === 'clicked').length
    const totalFailed = allMessages.filter((m: any) => m.status === 'failed' || m.status === 'bounced').length
    const totalQueued = allMessages.filter((m: any) => m.status === 'queued').length
    const last30Sent = last30Messages.filter((m: any) => m.status === 'sent' || m.status === 'delivered' || m.status === 'opened' || m.status === 'clicked').length
    const last30Failed = last30Messages.filter((m: any) => m.status === 'failed' || m.status === 'bounced').length
    const deliveryRate = totalSent + totalFailed > 0 ? Math.round((totalSent / (totalSent + totalFailed)) * 100) : 0

    const emailPerformance: EmailPerformance = {
      total_sent: totalSent,
      total_failed: totalFailed,
      total_queued: totalQueued,
      delivery_rate: deliveryRate,
      last_30_sent: last30Sent,
      last_30_failed: last30Failed,
    }

    // ── Automation Metrics ───────────────────────────────────────────────────
    const workflows = workflowsResult.data ?? []
    const automationMetrics: AutomationMetrics = {
      total_workflows: workflows.length,
      active_workflows: workflows.filter((w: any) => w.status === 'active').length,
      paused_workflows: workflows.filter((w: any) => w.status === 'paused').length,
      draft_workflows: workflows.filter((w: any) => w.status === 'draft').length,
      total_runs: workflows.reduce((sum: number, w: any) => sum + (w.run_count ?? 0), 0),
    }

    // ── Activity Breakdown ───────────────────────────────────────────────────
    const activities = activitiesResult.data ?? []
    const activityMap = new Map<string, number>()
    for (const a of activities) {
      const type = (a as any).type ?? 'other'
      activityMap.set(type, (activityMap.get(type) ?? 0) + 1)
    }
    const activityBreakdown: ActivityBreakdown[] = Array.from(activityMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)

    // ── Team Activity ────────────────────────────────────────────────────────
    const userMap = new Map<string, { count: number; lastActive: string | null }>()
    for (const a of activities) {
      const userId = (a as any).created_by as string | null
      if (!userId) continue
      const existing = userMap.get(userId) ?? { count: 0, lastActive: null }
      existing.count++
      const createdAt = (a as any).created_at as string
      if (!existing.lastActive || createdAt > existing.lastActive) {
        existing.lastActive = createdAt
      }
      userMap.set(userId, existing)
    }

    // Load user names
    const userIds = Array.from(userMap.keys())
    let userNameMap = new Map<string, string>()
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email, first_name, last_name')
        .in('id', userIds)
      for (const u of users ?? []) {
        const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || (u as any).email?.split('@')[0] || 'Unknown'
        userNameMap.set(u.id, name)
      }
    }

    const teamActivity: TeamActivityRow[] = Array.from(userMap.entries())
      .map(([userId, { count, lastActive }]) => ({
        user_id: userId,
        user_name: userNameMap.get(userId) ?? 'Unknown',
        activity_count: count,
        last_active: lastActive,
      }))
      .sort((a, b) => b.activity_count - a.activity_count)

    const data: AnalyticsData = {
      contactGrowth,
      statusDistribution,
      emailPerformance,
      automationMetrics,
      activityBreakdown,
      teamActivity,
      totalContacts,
      newContacts30d: contacts30dResult.count ?? 0,
      totalConversations: conversationsResult.count ?? 0,
      totalBroadcasts: broadcastsResult.count ?? 0,
    }

    return { data, error: null }
  } catch (err) {
    console.error('Analytics error:', err)
    return { data: null, error: 'Failed to load analytics' }
  }
}
