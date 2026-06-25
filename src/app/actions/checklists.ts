'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ── Types ───────────────────────────────────────────────────────────────────

export type Checklist = {
  id: string
  workspace_id: string
  name: string
  description: string | null
  passcode: string
  is_active: boolean
  allow_editing: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ChecklistItem = {
  id: string
  checklist_id: string
  label: string
  quantity: string | null
  sort_order: number
  created_by: string | null
  created_at: string
}

export type ChecklistParticipant = {
  id: string
  display_name: string
  avatar_color: string
}

export type ChecklistCheck = {
  id: string
  item_id: string
  participant_id: string
  checked_at: string
  participant?: ChecklistParticipant
}

export type ChecklistWithDetails = Checklist & {
  items: ChecklistItem[]
  participants: ChecklistParticipant[]
  checks: ChecklistCheck[]
}

export type CreateChecklistInput = {
  name: string
  description?: string
  passcode: string
  allow_editing?: boolean
  items?: { label: string; quantity?: string }[]
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function getWorkspaceId(): Promise<{ workspaceId: string | null; userId: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { workspaceId: null, userId: null }
  const workspaceId = user.user_metadata?.current_workspace_id as string | undefined
  return { workspaceId: workspaceId ?? null, userId: user.id }
}

const AVATAR_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ef4444', '#84cc16']

function randomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
}

// ── Authenticated CRUD (organizer side) ─────────────────────────────────────

export async function getChecklists(): Promise<{ data: Checklist[] | null; error: string | null }> {
  const supabase = await createClient()
  const { workspaceId } = await getWorkspaceId()
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  const { data, error } = await supabase
    .from('checklists')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data: data as Checklist[], error: null }
}

export async function getChecklistById(id: string): Promise<{ data: ChecklistWithDetails | null; error: string | null }> {
  const supabase = await createClient()
  const { workspaceId } = await getWorkspaceId()
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  const { data: checklist, error: clErr } = await supabase
    .from('checklists')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single()

  if (clErr || !checklist) return { data: null, error: clErr?.message ?? 'Checklist not found' }

  const { data: items } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('checklist_id', id)
    .order('sort_order', { ascending: true })

  const { data: participants } = await supabase
    .from('checklist_participants')
    .select('*')
    .eq('checklist_id', id)
    .order('created_at', { ascending: true })

  const { data: checks } = await supabase
    .from('checklist_checks')
    .select('*, participant:checklist_participants(*)')
    .in('item_id', (items ?? []).map((i: any) => i.id))

  return {
    data: {
      ...(checklist as Checklist),
      items: (items ?? []) as ChecklistItem[],
      participants: (participants ?? []) as ChecklistParticipant[],
      checks: (checks ?? []) as unknown as ChecklistCheck[],
    },
    error: null,
  }
}

export async function createChecklist(
  input: CreateChecklistInput
): Promise<{ data: Checklist | null; error: string | null }> {
  const supabase = await createClient()
  const { workspaceId, userId } = await getWorkspaceId()
  if (!workspaceId || !userId) return { data: null, error: 'Not authenticated' }

  const { data: checklist, error } = await supabase
    .from('checklists')
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      description: input.description ?? null,
      passcode: input.passcode,
      allow_editing: input.allow_editing ?? false,
      created_by: userId,
    })
    .select()
    .single()

  if (error || !checklist) return { data: null, error: error?.message ?? 'Failed to create checklist' }

  // Insert initial items
  if (input.items && input.items.length > 0) {
    const itemRows = input.items.map((item, i) => ({
      checklist_id: checklist.id,
      label: item.label,
      quantity: item.quantity ?? null,
      sort_order: i,
      created_by: userId,
    }))
    await supabase.from('checklist_items').insert(itemRows)
  }

  revalidatePath('/documents')
  return { data: checklist as Checklist, error: null }
}

export async function updateChecklist(
  id: string,
  input: Partial<Pick<Checklist, 'name' | 'description' | 'passcode' | 'is_active' | 'allow_editing'>>
): Promise<{ data: Checklist | null; error: string | null }> {
  const supabase = await createClient()
  const { workspaceId } = await getWorkspaceId()
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  const { data, error } = await supabase
    .from('checklists')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  revalidatePath('/documents')
  return { data: data as Checklist, error: null }
}

export async function deleteChecklist(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { workspaceId } = await getWorkspaceId()
  if (!workspaceId) return { error: 'No workspace selected' }

  const { error } = await supabase
    .from('checklists')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (error) return { error: error.message }
  revalidatePath('/documents')
  return { error: null }
}

// ── Item management (organizer) ─────────────────────────────────────────────

export async function addChecklistItem(
  checklistId: string,
  label: string,
  quantity?: string
): Promise<{ data: ChecklistItem | null; error: string | null }> {
  const supabase = await createClient()
  const { workspaceId, userId } = await getWorkspaceId()
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  // Get current max sort_order
  const { data: existing } = await supabase
    .from('checklist_items')
    .select('sort_order')
    .eq('checklist_id', checklistId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('checklist_items')
    .insert({
      checklist_id: checklistId,
      label,
      quantity: quantity ?? null,
      sort_order: nextOrder,
      created_by: userId,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  revalidatePath('/documents')
  return { data: data as ChecklistItem, error: null }
}

export async function updateChecklistItem(
  itemId: string,
  input: Partial<Pick<ChecklistItem, 'label' | 'quantity' | 'sort_order'>>
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { workspaceId } = await getWorkspaceId()
  if (!workspaceId) return { error: 'No workspace selected' }

  const { error } = await supabase
    .from('checklist_items')
    .update(input)
    .eq('id', itemId)

  if (error) return { error: error.message }
  revalidatePath('/documents')
  return { error: null }
}

export async function deleteChecklistItem(itemId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { workspaceId } = await getWorkspaceId()
  if (!workspaceId) return { error: 'No workspace selected' }

  const { error } = await supabase
    .from('checklist_items')
    .delete()
    .eq('id', itemId)

  if (error) return { error: error.message }
  revalidatePath('/documents')
  return { error: null }
}

// ── Public access (participant side — uses admin client) ────────────────────

export async function getChecklistPublic(
  id: string,
  passcode: string
): Promise<{ data: ChecklistWithDetails | null; error: string | null }> {
  const admin = createAdminClient()

  const { data: checklist, error } = await admin
    .from('checklists')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error || !checklist) return { data: null, error: 'Checklist not found' }

  if (checklist.passcode !== passcode) {
    return { data: null, error: 'Incorrect passcode' }
  }

  const { data: items } = await admin
    .from('checklist_items')
    .select('*')
    .eq('checklist_id', id)
    .order('sort_order', { ascending: true })

  const { data: participants } = await admin
    .from('checklist_participants')
    .select('*')
    .eq('checklist_id', id)
    .order('created_at', { ascending: true })

  const { data: checks } = await admin
    .from('checklist_checks')
    .select('*, participant:checklist_participants(*)')
    .in('item_id', (items ?? []).map((i: any) => i.id))

  return {
    data: {
      ...(checklist as Checklist),
      items: (items ?? []) as ChecklistItem[],
      participants: (participants ?? []) as ChecklistParticipant[],
      checks: (checks ?? []) as unknown as ChecklistCheck[],
    },
    error: null,
  }
}

export async function joinChecklist(
  checklistId: string,
  displayName: string
): Promise<{ data: { participantId: string } | null; error: string | null }> {
  const admin = createAdminClient()

  // Try to find existing participant with same name
  const { data: existing } = await admin
    .from('checklist_participants')
    .select('id')
    .eq('checklist_id', checklistId)
    .eq('display_name', displayName)
    .maybeSingle<{ id: string }>()

  if (existing) {
    return { data: { participantId: existing.id }, error: null }
  }

  const { data, error } = await admin
    .from('checklist_participants')
    .insert({
      checklist_id: checklistId,
      display_name: displayName,
      avatar_color: randomAvatarColor(),
    })
    .select('id')
    .single<{ id: string }>()

  if (error) return { data: null, error: error.message }
  return { data: { participantId: data.id }, error: null }
}

export async function toggleCheck(
  itemId: string,
  participantId: string
): Promise<{ checked: boolean; error: string | null }> {
  const admin = createAdminClient()

  // Check if already checked
  const { data: existing } = await admin
    .from('checklist_checks')
    .select('id')
    .eq('item_id', itemId)
    .eq('participant_id', participantId)
    .maybeSingle<{ id: string }>()

  if (existing) {
    // Uncheck
    const { error } = await admin
      .from('checklist_checks')
      .delete()
      .eq('id', existing.id)
    if (error) return { checked: true, error: error.message }
    return { checked: false, error: null }
  }

  // Check
  const { error } = await admin
    .from('checklist_checks')
    .insert({ item_id: itemId, participant_id: participantId })
  if (error) return { checked: false, error: error.message }
  return { checked: true, error: null }
}

export async function addChecklistItemPublic(
  checklistId: string,
  label: string,
  quantity: string | null,
  participantId: string
): Promise<{ data: ChecklistItem | null; error: string | null }> {
  const admin = createAdminClient()

  // Verify the checklist allows editing
  const { data: checklist } = await admin
    .from('checklists')
    .select('allow_editing')
    .eq('id', checklistId)
    .single<{ allow_editing: boolean }>()

  if (!checklist?.allow_editing) {
    return { data: null, error: 'This checklist does not allow participant editing' }
  }

  // Get current max sort_order
  const { data: existing } = await admin
    .from('checklist_items')
    .select('sort_order')
    .eq('checklist_id', checklistId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

  const { data, error } = await admin
    .from('checklist_items')
    .insert({
      checklist_id: checklistId,
      label,
      quantity,
      sort_order: nextOrder,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as ChecklistItem, error: null }
}
