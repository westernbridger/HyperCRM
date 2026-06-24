'use server'

import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import { getSignatureHtml } from '@/app/actions/email-signature'
import { resolveTemplate } from '@/lib/email/liquid'
import { revalidatePath } from 'next/cache'
import type {
  MessageChannel,
  MessageDirection,
  MessageStatus,
  ConversationStatus,
} from '@/lib/supabase/database.types'

export type Conversation = {
  id: string
  workspace_id: string
  contact_id: string
  channel: MessageChannel
  subject: string | null
  status: ConversationStatus
  last_message_at: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export type Message = {
  id: string
  conversation_id: string
  workspace_id: string
  contact_id: string | null
  channel: MessageChannel
  direction: MessageDirection
  from_addr: string | null
  to_addr: string | null
  subject: string | null
  body_html: string | null
  body_text: string | null
  provider: string | null
  provider_message_id: string | null
  status: MessageStatus
  error: string | null
  metadata: Record<string, any>
  created_by: string | null
  created_at: string
}

// Conversation enriched with contact display info for the inbox list.
export type ConversationListItem = Conversation & {
  contact_name: string
  contact_email: string
  last_message_preview: string | null
  last_direction: MessageDirection | null
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function getContext(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>
  workspaceId: string | null
  userId: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const workspaceId =
    (user?.user_metadata?.current_workspace_id as string | undefined) ?? null
  return { supabase, workspaceId, userId: user?.id ?? null }
}

// Resolve the workspace's default VERIFIED sender, formatted for Resend
// ("Name <addr@domain>"). Returns null to fall back to the shared sender.
async function resolveWorkspaceSender(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('workspace_email_domains')
    .select('from_name, from_email, status, is_default')
    .eq('workspace_id', workspaceId)
    .eq('status', 'verified')
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle<{ from_name: string | null; from_email: string; status: string }>()

  if (!data) return null
  return data.from_name ? `${data.from_name} <${data.from_email}>` : data.from_email
}

// Minimal, safe HTML wrapper for a plain-text email body.
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const withBreaks = escaped.replace(/\n/g, '<br/>')
  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;">${withBreaks}</div>`
}

// Strip HTML tags to produce a plain-text fallback.
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

// ── Send an email to a contact ───────────────────────────────────────────────

export async function sendContactEmail(input: {
  contactId: string
  subject: string
  body: string
  bodyHtml?: boolean
  conversationId?: string
}): Promise<{ messageId: string | null; error: string | null }> {
  const { supabase, workspaceId, userId } = await getContext()
  if (!workspaceId) return { messageId: null, error: 'No workspace selected' }

  const subjectRaw = input.subject.trim()
  const bodyRaw = input.body.trim()
  if (!subjectRaw) return { messageId: null, error: 'Subject is required' }
  if (!bodyRaw) return { messageId: null, error: 'Message body is required' }

  // 1. Load the contact (must belong to this workspace).
  const { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone, company, status, custom_fields')
    .eq('id', input.contactId)
    .eq('workspace_id', workspaceId)
    .single<{ id: string; first_name: string; last_name: string; email: string; phone: string | null; company: string | null; status: string; custom_fields: Record<string, any> }>()

  if (contactErr || !contact) return { messageId: null, error: 'Contact not found' }
  if (!contact.email) return { messageId: null, error: 'This contact has no email address' }

  // 1b. Load workspace name + inbound_email for liquid templating and reply-to.
  const { data: ws } = await supabase
    .from('workspaces')
    .select('name, inbound_email')
    .eq('id', workspaceId)
    .single<{ name: string; inbound_email: string | null }>()

  // 1c. Resolve liquid templates.
  const tplCtx = {
    contact: {
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      status: contact.status,
      custom_fields: contact.custom_fields ?? {},
    },
    workspace: { name: ws?.name ?? '' },
  }
  const subject = resolveTemplate(subjectRaw, tplCtx)
  const bodyContent = resolveTemplate(bodyRaw, tplCtx)

  // 2. Resolve or create the conversation thread.
  let conversationId = input.conversationId ?? null
  if (!conversationId) {
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('contact_id', contact.id)
      .eq('channel', 'email')
      .eq('status', 'open')
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>()

    if (existing) {
      conversationId = existing.id
    } else {
      const { data: created, error: convErr } = await supabase
        .from('conversations')
        .insert({
          workspace_id: workspaceId,
          contact_id: contact.id,
          channel: 'email',
          subject,
          created_by: userId,
        })
        .select('id')
        .single<{ id: string }>()

      if (convErr || !created) {
        return { messageId: null, error: convErr?.message ?? 'Failed to start conversation' }
      }
      conversationId = created.id
    }
  }

  // 3. Resolve the workspace's verified sender.
  // Falls back to the workspace's inbound_email (ws_xxx@email.hypercrm.ca)
  // so replies route correctly — noreply@ is reserved for system messages.
  const fromAddr = await resolveWorkspaceSender(supabase, workspaceId)
  const replyTo = ws?.inbound_email ?? undefined
  const finalFrom = fromAddr ?? (ws?.inbound_email ? `${ws.name} <${ws.inbound_email}>` : undefined)
  console.log('[sendContactEmail] fromAddr:', JSON.stringify(finalFrom), '| replyTo:', JSON.stringify(replyTo))

  // 4. Insert the outbound message in a "queued" state.
  const isHtml = input.bodyHtml === true
  const bodyHtmlContent = isHtml ? bodyContent : textToHtml(bodyContent)
  const bodyTextContent = isHtml ? htmlToText(bodyContent) : bodyContent
  const signatureHtml = await getSignatureHtml(supabase, workspaceId)
  const html = signatureHtml ? `${bodyHtmlContent}${signatureHtml}` : bodyHtmlContent
  const { data: message, error: msgErr } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      workspace_id: workspaceId,
      contact_id: contact.id,
      channel: 'email',
      direction: 'outbound',
      from_addr: fromAddr,
      to_addr: contact.email,
      subject,
      body_html: html,
      body_text: bodyTextContent,
      provider: 'resend',
      status: 'queued',
      created_by: userId,
    })
    .select('id')
    .single<{ id: string }>()

  if (msgErr || !message) {
    return { messageId: null, error: msgErr?.message ?? 'Failed to save message' }
  }

  // 5. Send via Resend, using the workspace sender when available.
  const { sent, error: sendError } = await sendEmail({
    to: contact.email,
    subject,
    html,
    from: finalFrom,
    replyTo,
  })

  // 6. Update message + conversation with the outcome.
  await supabase
    .from('messages')
    .update({
      status: sent ? 'sent' : 'failed',
      error: sent ? null : sendError,
    })
    .eq('id', message.id)

  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString(), subject })
    .eq('id', conversationId)

  // 6. Log to the contact's activity timeline.
  await supabase.from('activities').insert({
    contact_id: contact.id,
    workspace_id: workspaceId,
    type: 'email',
    title: sent ? `Email sent: ${subject}` : `Email failed: ${subject}`,
    content: bodyTextContent,
    metadata: { conversation_id: conversationId, message_id: message.id, sent },
    created_by: userId,
  })

  revalidatePath('/communications')
  revalidatePath(`/contacts/${contact.id}`)

  if (!sent) {
    return { messageId: message.id, error: sendError ?? 'Email could not be sent' }
  }
  return { messageId: message.id, error: null }
}

// ── Inbox: list conversations for the workspace ──────────────────────────────

export async function getConversations(): Promise<{
  data: ConversationListItem[] | null
  error: string | null
}> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  const { data: convos, error } = await supabase
    .from('conversations')
    .select('*, contacts ( first_name, last_name, email )')
    .eq('workspace_id', workspaceId)
    .order('last_message_at', { ascending: false })
    .limit(100)

  if (error) return { data: null, error: error.message }
  if (!convos) return { data: [], error: null }

  // Fetch the latest message per conversation for the preview line.
  const ids = convos.map((c: any) => c.id)
  const previews = new Map<string, { text: string | null; direction: MessageDirection }>()
  if (ids.length > 0) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('conversation_id, body_text, direction, created_at')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false })

    for (const m of (msgs ?? []) as any[]) {
      if (!previews.has(m.conversation_id)) {
        previews.set(m.conversation_id, { text: m.body_text, direction: m.direction })
      }
    }
  }

  const items: ConversationListItem[] = convos.map((c: any) => {
    const contact = c.contacts ?? {}
    const preview = previews.get(c.id)
    return {
      id: c.id,
      workspace_id: c.workspace_id,
      contact_id: c.contact_id,
      channel: c.channel,
      subject: c.subject,
      status: c.status,
      last_message_at: c.last_message_at,
      created_by: c.created_by,
      created_at: c.created_at,
      updated_at: c.updated_at,
      contact_name: `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || 'Unknown',
      contact_email: contact.email ?? '',
      last_message_preview: preview?.text ?? null,
      last_direction: preview?.direction ?? null,
    }
  })

  return { data: items, error: null }
}

// ── Messages within a single conversation ────────────────────────────────────

export async function getConversationMessages(
  conversationId: string
): Promise<{ data: Message[] | null; error: string | null }> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  if (error) return { data: null, error: error.message }
  return { data: (data as Message[]) ?? [], error: null }
}

// ── Stats for the Communications header tiles ────────────────────────────────

export async function getCommunicationStats(): Promise<{
  emailsSent: number
  delivered: number
  opened: number
  openRate: number
}> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { emailsSent: 0, delivered: 0, opened: 0, openRate: 0 }

  const { data } = await supabase
    .from('messages')
    .select('status, direction')
    .eq('workspace_id', workspaceId)
    .eq('channel', 'email')
    .eq('direction', 'outbound')

  const rows = (data ?? []) as { status: MessageStatus }[]
  const emailsSent = rows.filter((r) => r.status !== 'failed' && r.status !== 'queued').length
  const delivered = rows.filter((r) =>
    ['delivered', 'opened', 'clicked'].includes(r.status)
  ).length
  const opened = rows.filter((r) => ['opened', 'clicked'].includes(r.status)).length
  const openRate = delivered > 0 ? Math.round((opened / delivered) * 1000) / 10 : 0

  return { emailsSent, delivered, opened, openRate }
}

// ── Broadcast types ───────────────────────────────────────────────────────────

export type BroadcastListItem = {
  id: string
  subject: string
  recipient_count: number
  sent_count: number
  failed_count: number
  status: string
  created_at: string
}

export type BroadcastRecipientItem = {
  id: string
  contact_id: string
  contact_name: string
  contact_email: string
  status: string
  error: string | null
  sent_at: string | null
}

// ── Send a broadcast email to multiple contacts ──────────────────────────────

export async function sendBroadcastEmail(input: {
  subject: string
  bodyHtml: string
  contactIds: string[]
}): Promise<{
  broadcastId: string | null
  sentCount: number
  failedCount: number
  error: string | null
}> {
  const { supabase, workspaceId, userId } = await getContext()
  if (!workspaceId) return { broadcastId: null, sentCount: 0, failedCount: 0, error: 'No workspace selected' }

  const subjectRaw = input.subject.trim()
  const bodyRaw = input.bodyHtml.trim()
  if (!subjectRaw) return { broadcastId: null, sentCount: 0, failedCount: 0, error: 'Subject is required' }
  if (!bodyRaw) return { broadcastId: null, sentCount: 0, failedCount: 0, error: 'Message body is required' }
  if (input.contactIds.length === 0) return { broadcastId: null, sentCount: 0, failedCount: 0, error: 'At least one recipient is required' }

  // 1. Load workspace name + inbound_email for liquid templating and reply-to.
  const { data: ws } = await supabase
    .from('workspaces')
    .select('name, inbound_email')
    .eq('id', workspaceId)
    .single<{ name: string; inbound_email: string | null }>()

  // 2. Load all contacts in one query.
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone, company, status, custom_fields')
    .in('id', input.contactIds)
    .eq('workspace_id', workspaceId)

  const validContacts = (contacts ?? []).filter((c: any) => c.email)
  if (validContacts.length === 0) {
    return { broadcastId: null, sentCount: 0, failedCount: 0, error: 'No contacts with valid email addresses' }
  }

  // 3. Create the broadcast record.
  const bodyTextContent = htmlToText(bodyRaw)
  const { data: broadcast, error: broadcastErr } = await supabase
    .from('broadcasts')
    .insert({
      workspace_id: workspaceId,
      subject: subjectRaw,
      body_html: bodyRaw,
      body_text: bodyTextContent,
      recipient_count: validContacts.length,
      status: 'sending',
      created_by: userId,
    })
    .select('id')
    .single<{ id: string }>()

  if (broadcastErr || !broadcast) {
    return { broadcastId: null, sentCount: 0, failedCount: 0, error: broadcastErr?.message ?? 'Failed to create broadcast' }
  }

  // 4. Insert all recipient rows.
  const recipientRows = validContacts.map((c: any) => ({
    broadcast_id: broadcast.id,
    workspace_id: workspaceId,
    contact_id: c.id,
    status: 'pending' as const,
  }))

  await supabase.from('broadcast_recipients').insert(recipientRows)

  // 5. Resolve sender + signature.
  const fromAddr = await resolveWorkspaceSender(supabase, workspaceId)
  const replyTo = ws?.inbound_email ?? undefined
  const finalFrom = fromAddr ?? (ws?.inbound_email ? `${ws.name} <${ws.inbound_email}>` : undefined)
  const signatureHtml = await getSignatureHtml(supabase, workspaceId)
  const htmlWithSig = signatureHtml ? `${bodyRaw}${signatureHtml}` : bodyRaw

  // 6. Send to each recipient (batched).
  let sentCount = 0
  let failedCount = 0
  const BATCH_SIZE = 50

  for (let i = 0; i < validContacts.length; i++) {
    const contact = validContacts[i] as any

    // Resolve liquid templates per-recipient.
    const tplCtx = {
      contact: {
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        status: contact.status,
        custom_fields: contact.custom_fields ?? {},
      },
      workspace: { name: ws?.name ?? '' },
    }
    const subject = resolveTemplate(subjectRaw, tplCtx)
    const personalizedHtml = resolveTemplate(htmlWithSig, tplCtx)
    const personalizedText = resolveTemplate(bodyTextContent, tplCtx)

    // Find or create conversation.
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('contact_id', contact.id)
      .eq('channel', 'email')
      .eq('status', 'open')
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>()

    let conversationId = existingConv?.id ?? null
    if (!conversationId) {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          workspace_id: workspaceId,
          contact_id: contact.id,
          channel: 'email',
          subject,
          created_by: userId,
        })
        .select('id')
        .single<{ id: string }>()
      conversationId = newConv?.id ?? null
    }

    if (!conversationId) {
      failedCount++
      continue
    }

    // Insert message.
    const { data: msg } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        workspace_id: workspaceId,
        contact_id: contact.id,
        channel: 'email',
        direction: 'outbound',
        from_addr: fromAddr,
        to_addr: contact.email,
        subject,
        body_html: personalizedHtml,
        body_text: personalizedText,
        provider: 'resend',
        status: 'queued',
        created_by: userId,
      })
      .select('id')
      .single<{ id: string }>()

    // Send via Resend.
    const { sent, error: sendError } = await sendEmail({
      to: contact.email,
      subject,
      html: personalizedHtml,
      from: finalFrom,
      replyTo,
    })

    // Update message status.
    if (msg) {
      await supabase
        .from('messages')
        .update({
          status: sent ? 'sent' : 'failed',
          error: sent ? null : sendError,
        })
        .eq('id', msg.id)
    }

    // Update conversation timestamp.
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString(), subject })
      .eq('id', conversationId)

    // Update recipient status.
    await supabase
      .from('broadcast_recipients')
      .update({
        status: sent ? 'sent' : 'failed',
        error: sent ? null : sendError,
        sent_at: sent ? new Date().toISOString() : null,
        message_id: msg?.id ?? null,
      })
      .eq('broadcast_id', broadcast.id)
      .eq('contact_id', contact.id)

    // Log activity.
    await supabase.from('activities').insert({
      contact_id: contact.id,
      workspace_id: workspaceId,
      type: 'email',
      title: sent ? `Broadcast sent: ${subject}` : `Broadcast failed: ${subject}`,
      content: personalizedText,
      metadata: { broadcast_id: broadcast.id, message_id: msg?.id, sent },
      created_by: userId,
    })

    if (sent) sentCount++
    else failedCount++

    // Small delay between batches to respect rate limits.
    if ((i + 1) % BATCH_SIZE === 0 && i + 1 < validContacts.length) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  // 7. Update broadcast aggregate.
  await supabase
    .from('broadcasts')
    .update({
      sent_count: sentCount,
      failed_count: failedCount,
      status: failedCount === 0 ? 'sent' : sentCount === 0 ? 'partial_failure' : 'partial_failure',
    })
    .eq('id', broadcast.id)

  revalidatePath('/communications')

  return { broadcastId: broadcast.id, sentCount, failedCount, error: null }
}

// ── List broadcasts for the workspace ─────────────────────────────────────────

export async function getBroadcasts(): Promise<{
  data: BroadcastListItem[] | null
  error: string | null
}> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  const { data, error } = await supabase
    .from('broadcasts')
    .select('id, subject, recipient_count, sent_count, failed_count, status, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return { data: null, error: error.message }
  return { data: (data as BroadcastListItem[]) ?? [], error: null }
}

// ── Get recipients for a specific broadcast ───────────────────────────────────

export async function getBroadcastRecipients(
  broadcastId: string
): Promise<{
  data: BroadcastRecipientItem[] | null
  error: string | null
}> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  const { data, error } = await supabase
    .from('broadcast_recipients')
    .select('id, contact_id, status, error, sent_at, contacts ( first_name, last_name, email )')
    .eq('broadcast_id', broadcastId)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  if (error) return { data: null, error: error.message }

  const items: BroadcastRecipientItem[] = (data ?? []).map((r: any) => ({
    id: r.id,
    contact_id: r.contact_id,
    contact_name: `${r.contacts?.first_name ?? ''} ${r.contacts?.last_name ?? ''}`.trim() || 'Unknown',
    contact_email: r.contacts?.email ?? '',
    status: r.status,
    error: r.error,
    sent_at: r.sent_at,
  }))

  return { data: items, error: null }
}
