'use server'

import { createClient } from '@/lib/supabase/server'
import type { EmailSignature } from '@/lib/supabase/database.types'
import { DEFAULT_EMAIL_SIGNATURE } from '@/lib/supabase/database.types'
import { resolveSignature, renderSignatureHtml } from '@/lib/email/signature'

// ── Get the workspace's email signature ──────────────────────────────────────

export async function getEmailSignature(): Promise<{
  data: EmailSignature | null
  error: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const workspaceId =
    (user?.user_metadata?.current_workspace_id as string | undefined) ?? null
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  const { data, error } = await supabase
    .from('workspaces')
    .select('email_signature')
    .eq('id', workspaceId)
    .single<{ email_signature: Record<string, any> | null }>()

  if (error) return { data: null, error: error.message }

  const sig = resolveSignature(data?.email_signature)
  return { data: sig, error: null }
}

// ── Update the workspace's email signature ───────────────────────────────────

export async function updateEmailSignature(
  input: Partial<EmailSignature>
): Promise<{ data: EmailSignature | null; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const workspaceId =
    (user?.user_metadata?.current_workspace_id as string | undefined) ?? null
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  // Merge with defaults so we always store a complete object.
  const { data: existing } = await supabase
    .from('workspaces')
    .select('email_signature')
    .eq('id', workspaceId)
    .single<{ email_signature: Record<string, any> | null }>()

  const merged: EmailSignature = {
    ...DEFAULT_EMAIL_SIGNATURE,
    ...(existing?.email_signature ?? {}),
    ...input,
  }

  const { error } = await supabase
    .from('workspaces')
    .update({ email_signature: merged as unknown as Record<string, any> })
    .eq('id', workspaceId)

  if (error) return { data: null, error: error.message }

  return { data: merged, error: null }
}

// ── Internal: fetch signature for appending in sendContactEmail ──────────────

export async function getSignatureHtml(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string
): Promise<string> {
  const { data } = await supabase
    .from('workspaces')
    .select('email_signature')
    .eq('id', workspaceId)
    .single<{ email_signature: Record<string, any> | null }>()

  const sig = resolveSignature(data?.email_signature)
  return renderSignatureHtml(sig)
}
