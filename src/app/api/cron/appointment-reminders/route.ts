import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { resolveTemplate } from '@/lib/email/liquid'
import { getSignatureHtml } from '@/app/actions/email-signature'

// Cron endpoint: sends appointment reminder emails based on per-type reminder config.
// Protect with CRON_SECRET — e.g. Vercel Cron or external scheduler sending
// `Authorization: Bearer <CRON_SECRET>` every 15 minutes.
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const withBreaks = escaped.replace(/\n/g, '<br/>')
  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;">${withBreaks}</div>`
}

async function resolveSender(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string
): Promise<{ from: string | null; replyTo: string | null; workspaceName: string }> {
  const { data: ws } = await admin
    .from('workspaces')
    .select('name, inbound_email')
    .eq('id', workspaceId)
    .single<{ name: string; inbound_email: string | null }>()

  const { data: sender } = await admin
    .from('workspace_email_domains')
    .select('from_name, from_email, status, is_default')
    .eq('workspace_id', workspaceId)
    .eq('status', 'verified')
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle<{ from_name: string | null; from_email: string }>()

  const from = sender
    ? (sender.from_name ? `${sender.from_name} <${sender.from_email}>` : sender.from_email)
    : null
  return { from, replyTo: ws?.inbound_email ?? null, workspaceName: ws?.name ?? '' }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const lookAhead = new Date(now.getTime() + 72 * 60 * 60 * 1000) // 72h window

  // Fetch all confirmed appointments starting within the next 72h
  const { data: appointments, error } = await admin
    .from('appointments')
    .select(`
      id, workspace_id, appointment_type_id, start_time, end_time,
      client_name, client_email, meeting_url, location, phone_number,
      reminders_sent, status,
      appointment_types (
        id, name, meeting_type, duration_min, reminders
      )
    `)
    .eq('status', 'confirmed')
    .gte('start_time', now.toISOString())
    .lte('start_time', lookAhead.toISOString())

  if (error) {
    console.error('[cron-reminders] Query error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sentCount = 0
  let skippedCount = 0

  for (const appt of (appointments ?? []) as any[]) {
    const apptType = appt.appointment_types as any
    if (!apptType || !appt.client_email) { skippedCount++; continue }

    const reminders = (apptType.reminders ?? []) as Array<{
      enabled: boolean
      hours_before: number
      subject: string
      body: string
    }>

    const remindersSent = (appt.reminders_sent ?? {}) as Record<string, string>
    const apptStart = new Date(appt.start_time)
    let updated = false

    for (const reminder of reminders) {
      if (!reminder.enabled) continue

      const reminderKey = String(reminder.hours_before)
      if (remindersSent[reminderKey]) continue // already sent

      // Calculate when the reminder should fire
      const triggerAt = new Date(apptStart.getTime() - reminder.hours_before * 60 * 60 * 1000)
      if (now < triggerAt) continue // not yet time

      // Build template context
      const { from, replyTo, workspaceName } = await resolveSender(admin, appt.workspace_id)
      const firstName = (appt.client_name || '').split(' ')[0] || appt.client_name || ''
      const locationStr = appt.meeting_url || appt.location || appt.phone_number ||
        (apptType.meeting_type === 'video' ? 'Video call (link will be provided)' :
         apptType.meeting_type === 'phone' ? 'Phone call' : 'In person')
      const formattedTime = apptStart.toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
      })

      const ctx = {
        client: { first_name: firstName, full_name: appt.client_name, email: appt.client_email },
        appointment: {
          type_name: apptType.name,
          start_time: formattedTime,
          location: locationStr,
          duration_min: apptType.duration_min,
        },
        reminder: { hours_before: reminder.hours_before },
        workspace: { name: workspaceName },
      }

      const subject = resolveTemplate(reminder.subject, ctx as any)
      const body = resolveTemplate(reminder.body, ctx as any)

      try {
        const signatureHtml = await getSignatureHtml(admin, appt.workspace_id)
        const html = textToHtml(body) + (signatureHtml ? signatureHtml : '')

        const result = await sendEmail({
          to: appt.client_email,
          subject,
          html,
          ...(from ? { from } : {}),
          ...(replyTo ? { replyTo } : {}),
        })

        if (result.sent) {
          sentCount++
          updated = true
          remindersSent[reminderKey] = now.toISOString()
        }
      } catch (e) {
        console.error(`[cron-reminders] Error sending reminder for appt ${appt.id}:`, e)
      }
    }

    if (updated) {
      await admin
        .from('appointments')
        .update({ reminders_sent: remindersSent } as any)
        .eq('id', appt.id)
    }
  }

  return NextResponse.json({
    sent: sentCount,
    skipped: skippedCount,
    checked: appointments?.length ?? 0,
  })
}

export const dynamic = 'force-dynamic'
