'use server'

import { createClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/email/resend'
import { revalidatePath } from 'next/cache'
import { env } from '@/lib/env'
import type { EmailDomainStatus } from '@/lib/supabase/database.types'

export type DnsRecord = {
  record?: string
  name: string
  type: string
  ttl?: string
  status?: string
  value: string
  priority?: number
}

export type EmailDomain = {
  id: string
  workspace_id: string
  domain: string
  resend_domain_id: string
  region: string
  from_name: string | null
  from_email: string
  status: EmailDomainStatus
  dns_records: DnsRecord[]
  is_default: boolean
  created_at: string
  updated_at: string
}

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const workspaceId =
    (user?.user_metadata?.current_workspace_id as string | undefined) ?? null
  return { supabase, workspaceId, userId: user?.id ?? null }
}

function normalizeStatus(s: string | undefined | null): EmailDomainStatus {
  switch (s) {
    case 'verified':
      return 'verified'
    case 'failed':
      return 'failed'
    case 'temporary_failure':
      return 'temporary_failure'
    default:
      return 'pending'
  }
}

const DOMAIN_RE = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i

// ── List ─────────────────────────────────────────────────────────────────────

export async function getEmailDomains(): Promise<{
  data: EmailDomain[] | null
  error: string | null
}> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  const { data, error } = await supabase
    .from('workspace_email_domains')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data: (data as EmailDomain[]) ?? [], error: null }
}

// ── Add a domain (registers it with Resend) ──────────────────────────────────

export async function addEmailDomain(input: {
  domain: string
  fromName?: string
  fromEmail: string
}): Promise<{ data: EmailDomain | null; error: string | null }> {
  const { supabase, workspaceId, userId } = await getContext()
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  const domain = input.domain.trim().toLowerCase()
  const fromEmail = input.fromEmail.trim().toLowerCase()
  const fromName = input.fromName?.trim() || null

  if (!DOMAIN_RE.test(domain)) {
    return { data: null, error: 'Enter a valid domain, e.g. acme.com' }
  }
  if (!fromEmail.includes('@') || !fromEmail.endsWith(`@${domain}`)) {
    return { data: null, error: `From address must end with @${domain}` }
  }

  const resend = getResend()
  if (!resend) {
    return { data: null, error: 'Email service is not configured (RESEND_API_KEY missing).' }
  }

  // 1. Register the domain with Resend.
  const { data: created, error: resendError } = await resend.domains.create({
    name: domain,
  })

  if (resendError || !created) {
    return { data: null, error: resendError?.message ?? 'Failed to register domain with Resend' }
  }

  // 2. Persist the record + DNS records for the user to configure.
  const { data: row, error: dbError } = await supabase
    .from('workspace_email_domains')
    .insert({
      workspace_id: workspaceId,
      domain,
      resend_domain_id: created.id,
      region: (created as any).region ?? 'us-east-1',
      from_name: fromName,
      from_email: fromEmail,
      status: normalizeStatus((created as any).status),
      dns_records: ((created as any).records ?? []) as any[],
      created_by: userId,
    })
    .select('*')
    .single()

  if (dbError || !row) {
    // Roll back the Resend domain so we don't orphan it.
    await resend.domains.remove(created.id).catch(() => {})
    return { data: null, error: dbError?.message ?? 'Failed to save domain' }
  }

  revalidatePath('/settings')
  return { data: row as EmailDomain, error: null }
}

// ── Trigger verification ──────────────────────────────────────────────────────

export async function verifyEmailDomain(
  id: string
): Promise<{ data: EmailDomain | null; error: string | null }> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  const { data: domain } = await supabase
    .from('workspace_email_domains')
    .select('resend_domain_id')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single<{ resend_domain_id: string }>()

  if (!domain) return { data: null, error: 'Domain not found' }

  const resend = getResend()
  if (!resend) return { data: null, error: 'Email service is not configured.' }

  // Ask Resend to (re)check the DNS records, then read back the status.
  await resend.domains.verify(domain.resend_domain_id).catch(() => {})
  return refreshEmailDomain(id)
}

// ── Refresh status from Resend ────────────────────────────────────────────────

export async function refreshEmailDomain(
  id: string
): Promise<{ data: EmailDomain | null; error: string | null }> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  const { data: domain } = await supabase
    .from('workspace_email_domains')
    .select('resend_domain_id')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single<{ resend_domain_id: string }>()

  if (!domain) return { data: null, error: 'Domain not found' }

  const resend = getResend()
  if (!resend) return { data: null, error: 'Email service is not configured.' }

  const { data: fresh, error: resendError } = await resend.domains.get(
    domain.resend_domain_id
  )
  if (resendError || !fresh) {
    return { data: null, error: resendError?.message ?? 'Failed to fetch domain status' }
  }

  const { data: row, error: dbError } = await supabase
    .from('workspace_email_domains')
    .update({
      status: normalizeStatus((fresh as any).status),
      dns_records: ((fresh as any).records ?? []) as any[],
    })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select('*')
    .single()

  if (dbError || !row) return { data: null, error: dbError?.message ?? 'Failed to update domain' }

  revalidatePath('/settings')
  return { data: row as EmailDomain, error: null }
}

// ── Remove ────────────────────────────────────────────────────────────────────

export async function removeEmailDomain(
  id: string
): Promise<{ error: string | null }> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { error: 'No workspace selected' }

  const { data: domain } = await supabase
    .from('workspace_email_domains')
    .select('resend_domain_id')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single<{ resend_domain_id: string }>()

  if (!domain) return { error: 'Domain not found' }

  const resend = getResend()
  if (resend) {
    await resend.domains.remove(domain.resend_domain_id).catch(() => {})
  }

  const { error } = await supabase
    .from('workspace_email_domains')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (error) return { error: error.message }

  revalidatePath('/settings')
  return { error: null }
}

// ── Set default sender ────────────────────────────────────────────────────────

export async function setDefaultEmailDomain(
  id: string
): Promise<{ error: string | null }> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { error: 'No workspace selected' }

  // Clear existing default, then set the chosen one.
  await supabase
    .from('workspace_email_domains')
    .update({ is_default: false })
    .eq('workspace_id', workspaceId)

  const { error } = await supabase
    .from('workspace_email_domains')
    .update({ is_default: true })
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (error) return { error: error.message }

  revalidatePath('/settings')
  return { error: null }
}

// ── Get the active sender for this workspace ──────────────────────────────────

export type ActiveSender = {
  fromAddress: string
  fromName: string | null
  fromEmail: string
  domain: string
  isCustom: boolean
  inboundEmail: string | null
}

export async function getActiveSender(): Promise<{
  data: ActiveSender | null
  error: string | null
}> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  // Check for a verified default domain.
  const { data: domainRow } = await supabase
    .from('workspace_email_domains')
    .select('from_name, from_email, domain, status, is_default')
    .eq('workspace_id', workspaceId)
    .eq('status', 'verified')
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle<{ from_name: string | null; from_email: string; domain: string; status: string; is_default: boolean }>()

  // Get workspace inbound_email.
  const { data: ws } = await supabase
    .from('workspaces')
    .select('inbound_email')
    .eq('id', workspaceId)
    .single<{ inbound_email: string | null }>()

  if (domainRow) {
    const fromAddress = domainRow.from_name
      ? `${domainRow.from_name} <${domainRow.from_email}>`
      : domainRow.from_email
    return {
      data: {
        fromAddress,
        fromName: domainRow.from_name,
        fromEmail: domainRow.from_email,
        domain: domainRow.domain,
        isCustom: true,
        inboundEmail: ws?.inbound_email ?? null,
      },
      error: null,
    }
  }

  // Fall back to the platform default.
  const defaultFrom = env.resendDefaultFrom || 'HyperCRM <noreply@email.hypercrm.ca>'
  const defaultDomain = env.resendInboundDomain || 'email.hypercrm.ca'
  const match = defaultFrom.match(/^(.*?)\s*<(.+)>$/)
  const fromName = match ? match[1].trim() : null
  const fromEmail = match ? match[2] : defaultFrom

  return {
    data: {
      fromAddress: defaultFrom,
      fromName,
      fromEmail,
      domain: defaultDomain,
      isCustom: false,
      inboundEmail: ws?.inbound_email ?? null,
    },
    error: null,
  }
}
