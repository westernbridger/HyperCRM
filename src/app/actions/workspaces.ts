'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { env } from '@/lib/env'

// Helper type for inserts
// @ts-ignore - IDE type resolution issue, runtime is correct
type InsertType = any

export type UserRole = 'MASTER' | 'ADMIN' | 'ASSOCIATE'

export type Workspace = {
  id: string
  name: string
  slug: string
  role: UserRole
  joined_at: string
}

// Generate a unique inbound email address for a workspace.
// Format: ws_{short_uuid}@{RESEND_INBOUND_DOMAIN}
function generateInboundEmail(): string {
  const domain = env.resendInboundDomain || 'email.hypercrm.ca'
  const shortId = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  return `ws_${shortId}@${domain}`
}

// ── GET USER'S WORKSPACES ────────────────────────────────────

export async function getUserWorkspaces(): Promise<{ data: Workspace[]; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { data: [], error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('workspace_members')
    .select('role, joined_at, workspaces!inner(id, name, slug)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  if (error) return { data: [], error: error.message }

  const workspaces = (data ?? []).map((m: any) => ({
    id: m.workspaces.id,
    name: m.workspaces.name,
    slug: m.workspaces.slug,
    role: m.role as UserRole,
    joined_at: m.joined_at,
  }))

  return { data: workspaces, error: null }
}

// ── CREATE NEW WORKSPACE ───────────────────────────────────

export async function createWorkspace(
  name: string
): Promise<{ workspace: Workspace | null; error: string | null }> {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { workspace: null, error: 'Not authenticated' }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  // Check if slug is unique
  const { data: existing } = await supabase
    .from('workspaces')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existing) {
    return { workspace: null, error: 'A workspace with this name already exists' }
  }

  // Create workspace
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    // @ts-ignore - Database types are correct, IDE type resolution issue
    .insert({ name, slug, inbound_email: generateInboundEmail() })
    .select('id, name, slug')
    .single<{ id: string; name: string; slug: string }>()

  if (wsError || !workspace) {
    return { workspace: null, error: wsError?.message ?? 'Failed to create workspace' }
  }

  // Add creator as MASTER using admin client (bypasses RLS - user has no role yet)
  const { error: memberError } = await adminClient
    .from('workspace_members')
    // @ts-ignore - Database types are correct, IDE type resolution issue
    .insert({
      // @ts-ignore
      user_id: user.id,
      workspace_id: workspace.id,
      role: 'MASTER',
      created_by: user.id,
    })

  if (memberError) {
    // Rollback workspace creation
    await adminClient.from('workspaces').delete().eq('id', workspace.id)
    return { workspace: null, error: memberError.message }
  }

  // Set as current workspace
  await supabase.auth.updateUser({
    data: { current_workspace_id: workspace.id }
  })

  revalidatePath('/')
  revalidatePath('/team')
  
  return { 
    workspace: { 
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role: 'MASTER' as UserRole, 
      joined_at: new Date().toISOString() 
    }, 
    error: null 
  }
}

// ── SWITCH WORKSPACE ───────────────────────────────────────

export async function switchWorkspace(workspaceId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }

  // Verify user is a member of this workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('workspace_id', workspaceId)
    .single()

  if (!membership) {
    return { error: 'You are not a member of this workspace' }
  }

  // Update current workspace in user metadata
  const { error } = await supabase.auth.updateUser({
    data: { current_workspace_id: workspaceId }
  })

  if (error) return { error: error.message }

  revalidatePath('/')
  revalidatePath('/team')
  
  return { error: null }
}

// ── GET CURRENT WORKSPACE ──────────────────────────────────

export async function getCurrentWorkspace(): Promise<{ 
  workspace: Workspace | null; 
  error: string | null 
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { workspace: null, error: 'Not authenticated' }

  const currentWorkspaceId = user.user_metadata?.current_workspace_id as string | undefined

  if (!currentWorkspaceId) {
    // Get first workspace
    const { data: firstMembership } = await supabase
      .from('workspace_members')
      .select('role, joined_at, workspaces!inner(id, name, slug)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true })
      .limit(1)
      .single()

    if (!firstMembership) {
      return { workspace: null, error: 'No workspaces found' }
    }

    // Set as current
    await supabase.auth.updateUser({
      data: { current_workspace_id: firstMembership.workspaces.id }
    })

    return {
      workspace: {
        id: firstMembership.workspaces.id,
        name: firstMembership.workspaces.name,
        slug: firstMembership.workspaces.slug,
        role: firstMembership.role as UserRole,
        joined_at: firstMembership.joined_at,
      },
      error: null,
    }
  }

  // Get current workspace details
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role, joined_at, workspaces!inner(id, name, slug)')
    .eq('user_id', user.id)
    .eq('workspace_id', currentWorkspaceId)
    .single()

  if (!membership) {
    return { workspace: null, error: 'Workspace not found' }
  }

  return {
    workspace: {
      id: membership.workspaces.id,
      name: membership.workspaces.name,
      slug: membership.workspaces.slug,
      role: membership.role as UserRole,
      joined_at: membership.joined_at,
    },
    error: null,
  }
}
