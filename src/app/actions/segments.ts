'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ── Types ────────────────────────────────────────────────────────────────────

export type Segment = {
  id: string
  workspace_id: string
  name: string
  description: string | null
  color: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  contact_count?: number
}

export type SegmentContact = {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  company: string | null
  status: string
  added_at: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── List all segments for the workspace ──────────────────────────────────────

export async function getSegments(): Promise<{
  data: Segment[] | null
  error: string | null
}> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  const { data, error } = await supabase
    .from('segments')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }
  if (!data) return { data: [], error: null }

  // Get contact counts per segment
  const segmentIds = data.map((s) => s.id)
  let counts = new Map<string, number>()
  if (segmentIds.length > 0) {
    const { data: countData } = await supabase
      .from('segment_contacts')
      .select('segment_id')
      .in('segment_id', segmentIds)

    for (const row of (countData ?? []) as any[]) {
      counts.set(row.segment_id, (counts.get(row.segment_id) ?? 0) + 1)
    }
  }

  const segments: Segment[] = data.map((s: any) => ({
    ...s,
    contact_count: counts.get(s.id) ?? 0,
  }))

  return { data: segments, error: null }
}

// ── Get contact IDs for a segment (for broadcast selection) ──────────────────

export async function getSegmentContactIds(
  segmentId: string
): Promise<{ data: string[] | null; error: string | null }> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  const { data, error } = await supabase
    .from('segment_contacts')
    .select('contact_id')
    .eq('segment_id', segmentId)

  if (error) return { data: null, error: error.message }

  const ids = ((data ?? []) as any[]).map((r) => r.contact_id as string)
  return { data: ids, error: null }
}

// ── Get a single segment with its contacts ───────────────────────────────────

export async function getSegmentContacts(
  segmentId: string
): Promise<{ data: SegmentContact[] | null; error: string | null }> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  const { data, error } = await supabase
    .from('segment_contacts')
    .select(`
      added_at,
      contacts (
        id,
        first_name,
        last_name,
        email,
        phone,
        company,
        status
      )
    `)
    .eq('segment_id', segmentId)
    .order('added_at', { ascending: false })

  if (error) return { data: null, error: error.message }

  const contacts: SegmentContact[] = ((data ?? []) as any[]).map((row) => {
    const c = row.contacts ?? {}
    return {
      id: c.id,
      first_name: c.first_name ?? '',
      last_name: c.last_name ?? '',
      email: c.email ?? '',
      phone: c.phone,
      company: c.company,
      status: c.status ?? 'Lead',
      added_at: row.added_at,
    }
  })

  return { data: contacts, error: null }
}

// ── Create a segment ─────────────────────────────────────────────────────────

export async function createSegment(input: {
  name: string
  description?: string
  color?: string
}): Promise<{ segmentId: string | null; error: string | null }> {
  const { supabase, workspaceId, userId } = await getContext()
  if (!workspaceId) return { segmentId: null, error: 'No workspace selected' }

  const name = input.name.trim()
  if (!name) return { segmentId: null, error: 'Segment name is required' }

  const { data, error } = await supabase
    .from('segments')
    .insert({
      workspace_id: workspaceId,
      name,
      description: input.description?.trim() || null,
      color: input.color || '#6366f1',
      created_by: userId,
    })
    .select('id')
    .single<{ id: string }>()

  if (error || !data) {
    return { segmentId: null, error: error?.message ?? 'Failed to create segment' }
  }

  revalidatePath('/contacts')
  return { segmentId: data.id, error: null }
}

// ── Update a segment ─────────────────────────────────────────────────────────

export async function updateSegment(
  segmentId: string,
  input: { name?: string; description?: string; color?: string }
): Promise<{ error: string | null }> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { error: 'No workspace selected' }

  const { error } = await supabase
    .from('segments')
    .update({
      updated_at: new Date().toISOString(),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    })
    .eq('id', segmentId)
    .eq('workspace_id', workspaceId)

  if (error) return { error: error.message }

  revalidatePath('/contacts')
  return { error: null }
}

// ── Delete a segment ─────────────────────────────────────────────────────────

export async function deleteSegment(
  segmentId: string
): Promise<{ error: string | null }> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { error: 'No workspace selected' }

  const { error } = await supabase
    .from('segments')
    .delete()
    .eq('id', segmentId)
    .eq('workspace_id', workspaceId)

  if (error) return { error: error.message }

  revalidatePath('/contacts')
  return { error: null }
}

// ── Add existing contacts to a segment ───────────────────────────────────────

export async function addContactsToSegment(
  segmentId: string,
  contactIds: string[]
): Promise<{ added: number; error: string | null }> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { added: 0, error: 'No workspace selected' }
  if (contactIds.length === 0) return { added: 0, error: null }

  // Insert, ignoring duplicates (on conflict do nothing)
  const rows = contactIds.map((contactId) => ({
    segment_id: segmentId,
    contact_id: contactId,
  }))

  const { error } = await supabase
    .from('segment_contacts')
    .insert(rows)
    .select()

  // Ignore unique constraint violations (already in segment)
  if (error && error.code !== '23505') {
    return { added: 0, error: error.message }
  }

  revalidatePath('/contacts')
  return { added: contactIds.length, error: null }
}

// ── Remove a contact from a segment ──────────────────────────────────────────

export async function removeContactFromSegment(
  segmentId: string,
  contactId: string
): Promise<{ error: string | null }> {
  const { supabase } = await getContext()

  const { error } = await supabase
    .from('segment_contacts')
    .delete()
    .eq('segment_id', segmentId)
    .eq('contact_id', contactId)

  if (error) return { error: error.message }

  revalidatePath('/contacts')
  return { error: null }
}

// ── Add contacts by email (create if they don't exist) ───────────────────────

export async function addContactsByEmail(
  segmentId: string,
  emails: { email: string; first_name?: string; last_name?: string; company?: string }[]
): Promise<{ created: number; added: number; error: string | null }> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { created: 0, added: 0, error: 'No workspace selected' }
  if (emails.length === 0) return { created: 0, added: 0, error: null }

  let createdCount = 0
  const contactIds: string[] = []

  for (const entry of emails) {
    const email = entry.email.trim().toLowerCase()
    if (!email) continue

    // Check if contact already exists in this workspace
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('email', email)
      .maybeSingle<{ id: string }>()

    if (existing) {
      contactIds.push(existing.id)
    } else {
      // Create the contact first
      const { data: created, error: createErr } = await supabase
        .from('contacts')
        .insert({
          workspace_id: workspaceId,
          email,
          first_name: entry.first_name?.trim() || '',
          last_name: entry.last_name?.trim() || '',
          company: entry.company?.trim() || null,
          status: 'Lead',
        })
        .select('id')
        .single<{ id: string }>()

      if (createErr || !created) {
        console.error('[Segments] Failed to create contact for', email, createErr?.message)
        continue
      }
      contactIds.push(created.id)
      createdCount++
    }
  }

  // Add all contacts to the segment
  if (contactIds.length > 0) {
    const rows = contactIds.map((contactId) => ({
      segment_id: segmentId,
      contact_id: contactId,
    }))

    const { error: addErr } = await supabase
      .from('segment_contacts')
      .insert(rows)

    // Ignore unique constraint violations
    if (addErr && addErr.code !== '23505') {
      return { created: createdCount, added: 0, error: addErr.message }
    }
  }

  revalidatePath('/contacts')
  return { created: createdCount, added: contactIds.length, error: null }
}

// ── Import contacts from CSV into a segment ──────────────────────────────────

export async function importCsvToSegment(
  segmentId: string,
  csvText: string
): Promise<{
  created: number
  added: number
  errors: string[]
  error: string | null
}> {
  const { supabase, workspaceId } = await getContext()
  if (!workspaceId) return { created: 0, added: 0, errors: [], error: 'No workspace selected' }

  // Parse CSV: expects headers email, first_name, last_name, company (case-insensitive)
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) {
    return { created: 0, added: 0, errors: ['CSV must have a header row and at least one data row'], error: null }
  }

  // Parse header
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase())
  const emailIdx = headers.findIndex((h) => h === 'email' || h === 'e-mail')
  if (emailIdx === -1) {
    return { created: 0, added: 0, errors: ['CSV must have an "email" column'], error: null }
  }

  const firstNameIdx = headers.findIndex((h) => h === 'first_name' || h === 'firstname' || h === 'name')
  const lastNameIdx = headers.findIndex((h) => h === 'last_name' || h === 'lastname')
  const companyIdx = headers.findIndex((h) => h === 'company' || h === 'organization')

  const entries: { email: string; first_name?: string; last_name?: string; company?: string }[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const email = (cols[emailIdx] ?? '').trim().toLowerCase()
    if (!email) {
      errors.push(`Row ${i + 1}: missing email, skipped`)
      continue
    }
    entries.push({
      email,
      first_name: firstNameIdx >= 0 ? cols[firstNameIdx]?.trim() : undefined,
      last_name: lastNameIdx >= 0 ? cols[lastNameIdx]?.trim() : undefined,
      company: companyIdx >= 0 ? cols[companyIdx]?.trim() : undefined,
    })
  }

  if (entries.length === 0) {
    return { created: 0, added: 0, errors: ['No valid rows found in CSV'], error: null }
  }

  const result = await addContactsByEmail(segmentId, entries)
  return {
    created: result.created,
    added: result.added,
    errors,
    error: result.error,
  }
}

// ── CSV parsing helper ───────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }
  result.push(current)
  return result
}
