'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'

export type UserRole = 'MASTER' | 'ADMIN' | 'ASSOCIATE'

export type TeamMember = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: UserRole
  created_at: string
}

export type Invitation = {
  id: string
  email: string
  role: UserRole
  token: string
  invited_by_name: string | null
  expires_at: string
  created_at: string
}

// ── helpers ──────────────────────────────────────────────────

async function getCallerContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Get current workspace from user metadata (set when switching workspaces)
  const currentWorkspaceId = user.user_metadata?.current_workspace_id as string | undefined

  if (!currentWorkspaceId) {
    // No workspace selected — get their first membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true })
      .limit(1)
      .single<{ workspace_id: string; role: UserRole }>()

    if (!membership) return null

    // Set as current workspace
    await supabase.auth.updateUser({
      data: { current_workspace_id: membership.workspace_id }
    })

    return { supabase, user, workspaceId: membership.workspace_id, role: membership.role }
  }

  // Get role in current workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('workspace_id', currentWorkspaceId)
    .single<{ role: UserRole }>()

  if (!membership) {
    // User no longer has access to this workspace
    return null
  }

  return { supabase, user, workspaceId: currentWorkspaceId, role: membership.role }
}

// ── GET TEAM MEMBERS ─────────────────────────────────────────

export async function getTeamMembers(): Promise<{ data: TeamMember[]; error: string | null }> {
  const ctx = await getCallerContext()
  if (!ctx) return { data: [], error: 'Not authenticated' }

  const { workspaceId } = ctx
  // Use adminClient so RLS (which limits rows to the caller's own membership)
  // does not hide other workspace members from invited users.
  const adminClient = createAdminClient()

  type MemberRow = {
    role: UserRole
    joined_at: string
    users: {
      id: string
      email: string
      first_name: string | null
      last_name: string | null
      created_at: string
    }
  }

  const { data, error } = await adminClient
    .from('workspace_members')
    .select('role, joined_at, users!user_id(id, email, first_name, last_name, created_at)')
    .eq('workspace_id', workspaceId)
    .order('joined_at', { ascending: true })
    .returns<MemberRow[]>()

  if (error) return { data: [], error: error.message }

  const members: TeamMember[] = (data ?? []).map((m) => ({
    id: m.users.id,
    email: m.users.email,
    first_name: m.users.first_name,
    last_name: m.users.last_name,
    role: m.role,
    created_at: m.users.created_at,
  }))

  return { data: members, error: null }
}

// ── GET PENDING INVITATIONS ──────────────────────────────────

export async function getInvitations(): Promise<{ data: Invitation[]; error: string | null }> {
  const ctx = await getCallerContext()
  if (!ctx) return { data: [], error: 'Not authenticated' }

  const { supabase, workspaceId } = ctx
  const { data, error } = await supabase
    .from('invitations')
    .select('id, email, role, token, expires_at, created_at, invited_by')
    .eq('workspace_id', workspaceId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .returns<{ id: string; email: string; role: UserRole; token: string; expires_at: string; created_at: string; invited_by: string }[]>()

  if (error) return { data: [], error: error.message }

  // Resolve inviter names (invited_by stored in invitations table)
  type Inviter = { id: string; first_name: string | null; last_name: string | null; email: string }
  const inviterIds = [...new Set((data ?? []).map((i) => i.invited_by))]
  const { data: inviters } = await supabase
    .from('users')
    .select('id, first_name, last_name, email')
    .in('id', inviterIds)
    .returns<Inviter[]>()

  const inviterMap = new Map(
    (inviters ?? []).map((u) => [
      u.id,
      [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
    ])
  )

  return {
    data: (data ?? []).map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role as UserRole,
      token: inv.token,
      invited_by_name: inviterMap.get(inv.invited_by) ?? null,
      expires_at: inv.expires_at,
      created_at: inv.created_at,
    })),
    error: null,
  }
}

// ── GET PENDING INVITATIONS FOR CURRENT USER ─────────────────

export async function getPendingInvitationsForUser(): Promise<{
  data: Invitation[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user?.email) return { data: [], error: null }

  // Look up invitations by email (for any workspace)
  type InvitationRow = {
    id: string
    email: string
    role: string
    token: string
    expires_at: string
    created_at: string
    invited_by: string
    workspace_id: string
  }
  const { data, error } = await supabase
    .from('invitations')
    .select('id, email, role, token, expires_at, created_at, invited_by, workspace_id')
    .eq('email', user.email.toLowerCase())
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .returns<InvitationRow[]>()

  if (error) return { data: [], error: error.message }

  // Resolve inviter names
  type Inviter = { id: string; first_name: string | null; last_name: string | null; email: string }
  const inviterIds = [...new Set((data ?? []).map((i) => i.invited_by))]
  const { data: inviters } = await supabase
    .from('users')
    .select('id, first_name, last_name, email')
    .in('id', inviterIds)
    .returns<Inviter[]>()

  const inviterMap = new Map(
    (inviters ?? []).map((u) => [
      u.id,
      [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
    ])
  )

  return {
    data: (data ?? []).map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role as UserRole,
      token: inv.token,
      invited_by_name: inviterMap.get(inv.invited_by) ?? null,
      expires_at: inv.expires_at,
      created_at: inv.created_at,
    })),
    error: null,
  }
}

// ── INVITE TEAM MEMBER ───────────────────────────────────────

export async function inviteTeamMember(
  email: string,
  newRole: UserRole,
  targetWorkspaceId: string
): Promise<{ tempPassword: string | null; emailSent: boolean; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { tempPassword: null, emailSent: false, error: 'Not authenticated' }

  if (!targetWorkspaceId) {
    return { tempPassword: null, emailSent: false, error: 'Please select a workspace to invite into' }
  }
  if (newRole === 'MASTER') {
    return { tempPassword: null, emailSent: false, error: 'Cannot invite another MASTER account' }
  }

  // Verify the caller is MASTER or ADMIN of the SELECTED workspace
  const { data: callerMembership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('workspace_id', targetWorkspaceId)
    .maybeSingle<{ role: UserRole }>()

  const role = callerMembership?.role
  if (role !== 'MASTER' && role !== 'ADMIN') {
    return { tempPassword: null, emailSent: false, error: 'You must be a MASTER or ADMIN of the selected workspace to invite members' }
  }

  const workspaceId = targetWorkspaceId

  const adminClient = createAdminClient()
  const cleanEmail = email.toLowerCase().trim()

  // Check 1: Is this email already a member of this workspace?
  const { data: existingUserInWorkspace } = await supabase
    .from('workspace_members')
    .select('user_id, users!inner(email)')
    .eq('workspace_id', workspaceId)
    .eq('users.email', cleanEmail)
    .maybeSingle<{ user_id: string }>()

  if (existingUserInWorkspace) {
    return { tempPassword: null, emailSent: false, error: 'This person is already a member of your workspace' }
  }

  // Check 2: Does this email exist in auth.users?
  const { data: existingAuthUsers } = await adminClient.auth.admin.listUsers()
  const existingAuthUser = existingAuthUsers?.users?.find(u => u.email?.toLowerCase() === cleanEmail)

  // Create/Update invitation record using adminClient (bypasses RLS)
  // We've already verified the caller is MASTER/ADMIN in this workspace
  type InvitationInsert = {
    workspace_id: string;
    invited_by: string;
    email: string;
    role: UserRole;
    token: string;
    accepted_at: null;
    expires_at: string;
  }
  const { data: inv, error: invError } = await adminClient
    .from('invitations')
    // @ts-ignore - Database types are correct, IDE type resolution issue
    .upsert(
      // @ts-ignore
      {
        workspace_id: workspaceId,
        invited_by: user.id,
        email: cleanEmail,
        role: newRole,
        token: crypto.randomUUID(),
        accepted_at: null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      } as InvitationInsert,
      { onConflict: 'workspace_id,email' }
    )
    .select('token, id')
    .single<{ token: string; id: string }>()

  if (invError || !inv) return { tempPassword: null, emailSent: false, error: invError?.message ?? 'Failed to create invitation' }

  // Get workspace name for email
  const { data: workspaceData } = await adminClient
    .from('workspaces')
    .select('name')
    .eq('id', workspaceId)
    .single<{ name: string }>()
  const workspaceName = workspaceData?.name ?? 'a workspace'

  // Get inviter name
  const { data: inviterData } = await adminClient
    .from('users')
    .select('first_name, last_name')
    .eq('id', user.id)
    .single<{ first_name: string | null; last_name: string | null }>()
  const inviterName = inviterData 
    ? [inviterData.first_name, inviterData.last_name].filter(Boolean).join(' ') || user.email 
    : user.email

  let authUserId: string | null = null
  const tempPassword: string | null = null
  let emailSent = false

  if (existingAuthUser) {
    // === EXISTING USER ===
    // Check if already member of this workspace
    const { data: existingMembership } = await adminClient
      .from('workspace_members')
      .select('user_id')
      .eq('user_id', existingAuthUser.id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (existingMembership) {
      await adminClient.from('invitations').delete().eq('id', inv.id)
      return { tempPassword: null, emailSent: false, error: 'This person is already a member of your workspace' }
    }

    authUserId = existingAuthUser.id
    
    // Update metadata with invitation details
    await adminClient.auth.admin.updateUserById(authUserId, {
      user_metadata: {
        invitation_id: inv.id,
        invitation_workspace_id: workspaceId,
        invitation_role: newRole,
      },
    })

    // Send invitation email to existing user
    const emailResult = await sendInvitationEmail(cleanEmail, inv.token, workspaceName, inviterName, true)
    emailSent = emailResult.sent

    // Create in-app notification
    await createNotification(authUserId, workspaceId, {
      type: 'workspace_invitation',
      title: `You've been invited to ${workspaceName}`,
      content: `${inviterName} invited you to join as ${newRole}`,
      link: `/invite/${inv.token}`,
    })

  } else {
    // === NEW USER ===
    // Create the account with a random, unguessable password that is NEVER
    // surfaced. The user sets their real password via the invite link
    // (setPasswordAndAccept). The password_change_required flag keeps the
    // account locked until they do.
    const throwawayPassword =
      crypto.randomUUID() + crypto.randomUUID().toUpperCase()

    // Create new auth user
    const { data: newAuthUser, error: createError } = await adminClient.auth.admin.createUser({
      email: cleanEmail,
      password: throwawayPassword,
      email_confirm: true,
      user_metadata: {
        invitation_id: inv.id,
        workspace_id: workspaceId,
        role: newRole,
      },
    })

    if (createError || !newAuthUser) {
      await adminClient.from('invitations').delete().eq('id', inv.id)
      return { tempPassword: null, emailSent: false, error: createError?.message ?? 'Failed to create user' }
    }

    authUserId = newAuthUser.user.id

    // Create users row for new user
    type UserInsert = {
      id: string;
      email: string;
      password_change_required: boolean;
    }
    const { error: userRowError } = await adminClient
      .from('users')
      // @ts-ignore - Database types are correct, IDE type resolution issue
      .insert({
        // @ts-ignore
        id: authUserId,
        email: cleanEmail,
        password_change_required: true,
      } as UserInsert)

    if (userRowError) {
      await adminClient.auth.admin.deleteUser(authUserId)
      await adminClient.from('invitations').delete().eq('id', inv.id)
      return { tempPassword: null, emailSent: false, error: userRowError.message }
    }

    // Send invitation email to new user (set-password link)
    const emailResult = await sendInvitationEmail(cleanEmail, inv.token, workspaceName, inviterName, false)
    emailSent = emailResult.sent

    // Create in-app notification (visible once they log in)
    await createNotification(authUserId, workspaceId, {
      type: 'workspace_invitation',
      title: `You've been invited to ${workspaceName}`,
      content: `${inviterName} invited you to join as ${newRole}`,
      link: `/invite/${inv.token}`,
    })
  }

  revalidatePath('/team')
  return { tempPassword, emailSent, error: null }
}

// ── EMAIL NOTIFICATION ──────────────────────────────────────

async function sendInvitationEmail(
  email: string,
  token: string,
  workspaceName: string,
  inviterName: string | null | undefined,
  isExistingUser: boolean
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const inviteUrl = `${baseUrl}/invite/${token}`
  
  const subject = isExistingUser 
    ? `You've been invited to join ${workspaceName} on HyperCRM`
    : `You're invited to join ${workspaceName} on HyperCRM`
  
  const html = isExistingUser
    ? `<p>Hi there,</p>
       <p><strong>${inviterName || 'Someone'}</strong> invited you to join <strong>${workspaceName}</strong> on HyperCRM.</p>
       <p><a href="${inviteUrl}" style="padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px;">Accept Invitation</a></p>
       <p>Or copy this link: ${inviteUrl}</p>
       <p>This invitation expires in 7 days.</p>`
    : `<p>Hi there,</p>
       <p><strong>${inviterName || 'Someone'}</strong> invited you to join <strong>${workspaceName}</strong> on HyperCRM.</p>
       <p>Click below to set your password and activate your account:</p>
       <p><a href="${inviteUrl}" style="padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px;">Set Up Your Account</a></p>
       <p>Or copy this link: ${inviteUrl}</p>
       <p>This invitation expires in 7 days.</p>`

  const { sent, error } = await sendEmail({ to: email, subject, html })
  if (!sent) {
    console.warn(`[invite] Invitation email to ${email} was not sent: ${error}`)
  }
  return { sent, error }
}

// ── IN-APP NOTIFICATIONS ────────────────────────────────────

type NotificationType = 'workspace_invitation' | 'role_changed' | 'workspace_created'

interface NotificationData {
  type: NotificationType
  title: string
  content: string
  link?: string
}

async function createNotification(
  userId: string,
  workspaceId: string,
  data: NotificationData
) {
  const adminClient = createAdminClient()
  
  type NotificationInsert = {
    user_id: string
    workspace_id: string
    type: NotificationType
    title: string
    content: string
    link: string | null
    read: boolean
  }
  
  await adminClient
    .from('notifications')
    // @ts-ignore - Database types are correct, IDE type resolution issue
    .insert({
      // @ts-ignore
      user_id: userId,
      workspace_id: workspaceId,
      type: data.type,
      title: data.title,
      content: data.content,
      link: data.link ?? null,
      read: false,
    } as NotificationInsert)
}

// ── UPDATE MEMBER ROLE ───────────────────────────────────────

export async function updateMemberRole(
  memberId: string,
  newRole: UserRole
): Promise<{ error: string | null }> {
  const ctx = await getCallerContext()
  if (!ctx) return { error: 'Not authenticated' }

  const { supabase, user, workspaceId, role } = ctx

  if (role !== 'MASTER') return { error: 'Only MASTER can change member roles' }
  if (memberId === user.id) return { error: 'You cannot change your own role' }

  // Update role in workspace_members table
  const { error } = await supabase
    .from('workspace_members')
    // @ts-ignore - Database types are correct, IDE type resolution issue
    .update({ role: newRole })
    .eq('user_id', memberId)
    .eq('workspace_id', workspaceId)

  if (error) return { error: error.message }
  revalidatePath('/team')
  return { error: null }
}

// ── REMOVE MEMBER ────────────────────────────────────────────

export async function removeMember(memberId: string): Promise<{ error: string | null }> {
  const ctx = await getCallerContext()
  if (!ctx) return { error: 'Not authenticated' }

  const { supabase, user, workspaceId, role } = ctx

  if (role !== 'MASTER' && role !== 'ADMIN') {
    return { error: 'Only MASTER or ADMIN can remove members' }
  }
  if (memberId === user.id) return { error: 'You cannot remove yourself' }

  // Prevent ADMIN from removing MASTER
  const { data: target } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('user_id', memberId)
    .eq('workspace_id', workspaceId)
    .single<{ role: UserRole }>()

  if (target?.role === 'MASTER') return { error: 'MASTER account cannot be removed' }

  // Delete their workspace_members row (removes from this workspace only)
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('user_id', memberId)
    .eq('workspace_id', workspaceId)

  if (error) return { error: error.message }
  revalidatePath('/team')
  return { error: null }
}

// ── REVOKE INVITATION ────────────────────────────────────────

export async function revokeInvitation(invitationId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const adminClient = createAdminClient()

  // Look up the invitation to find which workspace it belongs to
  const { data: inv } = await adminClient
    .from('invitations')
    .select('id, workspace_id')
    .eq('id', invitationId)
    .maybeSingle<{ id: string; workspace_id: string }>()

  if (!inv) return { error: 'Invitation not found' }

  // Verify the caller is MASTER or ADMIN of THAT invitation's workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('workspace_id', inv.workspace_id)
    .maybeSingle<{ role: UserRole }>()

  if (membership?.role !== 'MASTER' && membership?.role !== 'ADMIN') {
    return { error: 'Only MASTER or ADMIN can revoke invitations for this workspace' }
  }

  // Delete by id (workspace already validated)
  const { error } = await adminClient
    .from('invitations')
    .delete()
    .eq('id', invitationId)

  if (error) return { error: error.message }
  revalidatePath('/team')
  return { error: null }
}

// ── ACCEPT INVITATION (called on /invite/[token] page) ───────

export async function acceptInvitation(token: string): Promise<{
  workspaceName: string | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { workspaceName: null, error: 'You must be signed in to accept an invitation' }

  // Look up the invitation
  const { data: inv, error: invError } = await supabase
    .from('invitations')
    .select('id, workspace_id, email, role, accepted_at, expires_at')
    .eq('token', token)
    .maybeSingle<{ id: string; workspace_id: string; email: string; role: UserRole; accepted_at: string | null; expires_at: string }>()

  if (invError || !inv) return { workspaceName: null, error: 'Invitation not found or already used' }
  if (inv.accepted_at) return { workspaceName: null, error: 'This invitation has already been accepted' }
  if (new Date(inv.expires_at) < new Date()) return { workspaceName: null, error: 'This invitation has expired' }
  if (inv.email !== user.email?.toLowerCase()) {
    return { workspaceName: null, error: 'This invitation was sent to a different email address' }
  }

  // Use adminClient for operations that bypass user's current workspace RLS
  const adminClient = createAdminClient()

  // Check if user is already a member of this workspace
  const { data: existingMembership } = await adminClient
    .from('workspace_members')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('workspace_id', inv.workspace_id)
    .maybeSingle()

  if (existingMembership) {
    // Already a member, just update role
    const { error: updateErr } = await adminClient
      .from('workspace_members')
      // @ts-ignore - Database types are correct, IDE type resolution issue
      .update({ role: inv.role })
      .eq('user_id', user.id)
      .eq('workspace_id', inv.workspace_id)
    if (updateErr) return { workspaceName: null, error: updateErr.message }
  } else {
    // Add user to workspace_members
    type WorkspaceMemberInsert = {
      user_id: string;
      workspace_id: string;
      role: UserRole;
    }
    const { error: insertErr } = await adminClient
      .from('workspace_members')
      // @ts-ignore - Database types are correct, IDE type resolution issue
      .insert({
        // @ts-ignore
        user_id: user.id,
        workspace_id: inv.workspace_id,
        role: inv.role,
      } as WorkspaceMemberInsert)
    if (insertErr) return { workspaceName: null, error: insertErr.message }
  }

  // Also ensure user exists in users table (profile info)
  const { data: existingUser } = await adminClient
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (!existingUser) {
    type ProfileInsert = {
      id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
    }
    // @ts-ignore - Database types are correct, IDE type resolution issue
    await adminClient.from('users').insert({
      // @ts-ignore
      id: user.id,
      email: user.email!,
      first_name: user.user_metadata?.first_name ?? null,
      last_name: user.user_metadata?.last_name ?? null,
    } as ProfileInsert)
  }

  // Mark invitation as accepted
  await adminClient
    .from('invitations')
    // @ts-ignore - Database types are correct, IDE type resolution issue
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', inv.id)

  // Get workspace name for confirmation message
  const { data: ws } = await adminClient
    .from('workspaces')
    .select('name')
    .eq('id', inv.workspace_id)
    .single<{ name: string }>()

  // Set the new workspace as current workspace
  await supabase.auth.updateUser({
    data: { current_workspace_id: inv.workspace_id }
  })

  revalidatePath('/team')
  return { workspaceName: ws?.name ?? null, error: null }
}

// ── INVITATION INFO (public — used by /invite/[token] page) ──

export type InvitationInfo = {
  valid: boolean
  email: string | null
  workspaceName: string | null
  inviterName: string | null
  role: UserRole | null
  // true when the invited account still needs to set its first password
  needsPasswordSetup: boolean
  error: string | null
}

export async function getInvitationInfo(token: string): Promise<InvitationInfo> {
  const adminClient = createAdminClient()

  const { data: inv } = await adminClient
    .from('invitations')
    .select('id, workspace_id, email, role, invited_by, accepted_at, expires_at')
    .eq('token', token)
    .maybeSingle<{
      id: string
      workspace_id: string
      email: string
      role: UserRole
      invited_by: string
      accepted_at: string | null
      expires_at: string
    }>()

  const base: InvitationInfo = {
    valid: false,
    email: null,
    workspaceName: null,
    inviterName: null,
    role: null,
    needsPasswordSetup: false,
    error: null,
  }

  if (!inv) return { ...base, error: 'Invitation not found or already used' }
  if (inv.accepted_at) return { ...base, error: 'This invitation has already been accepted' }
  if (new Date(inv.expires_at) < new Date()) return { ...base, error: 'This invitation has expired' }

  // Workspace name
  const { data: ws } = await adminClient
    .from('workspaces')
    .select('name')
    .eq('id', inv.workspace_id)
    .single<{ name: string }>()

  // Inviter name
  const { data: inviter } = await adminClient
    .from('users')
    .select('first_name, last_name, email')
    .eq('id', inv.invited_by)
    .maybeSingle<{ first_name: string | null; last_name: string | null; email: string }>()
  const inviterName = inviter
    ? [inviter.first_name, inviter.last_name].filter(Boolean).join(' ') || inviter.email
    : null

  // Does the invited account still need to set a password?
  const { data: profile } = await adminClient
    .from('users')
    .select('id, password_change_required')
    .eq('email', inv.email)
    .maybeSingle<{ id: string; password_change_required: boolean }>()

  return {
    valid: true,
    email: inv.email,
    workspaceName: ws?.name ?? null,
    inviterName,
    role: inv.role,
    needsPasswordSetup: profile?.password_change_required === true,
    error: null,
  }
}

// ── SET PASSWORD + ACCEPT (new invited users) ────────────────

export async function setPasswordAndAccept(
  token: string,
  newPassword: string
): Promise<{ email: string | null; workspaceName: string | null; error: string | null }> {
  if (!newPassword || newPassword.length < 8) {
    return { email: null, workspaceName: null, error: 'Password must be at least 8 characters' }
  }

  const adminClient = createAdminClient()

  // Validate the invitation token
  const { data: inv } = await adminClient
    .from('invitations')
    .select('id, workspace_id, email, role, accepted_at, expires_at')
    .eq('token', token)
    .maybeSingle<{
      id: string
      workspace_id: string
      email: string
      role: UserRole
      accepted_at: string | null
      expires_at: string
    }>()

  if (!inv) return { email: null, workspaceName: null, error: 'Invitation not found or already used' }
  if (inv.accepted_at) return { email: null, workspaceName: null, error: 'This invitation has already been accepted' }
  if (new Date(inv.expires_at) < new Date()) return { email: null, workspaceName: null, error: 'This invitation has expired' }

  // Find the auth user created for this email
  const { data: profile } = await adminClient
    .from('users')
    .select('id')
    .eq('email', inv.email)
    .maybeSingle<{ id: string }>()

  if (!profile) return { email: null, workspaceName: null, error: 'Account not found for this invitation' }
  const userId = profile.id

  // Set the user's chosen password and confirm their email
  const { error: pwError } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword,
    email_confirm: true,
  })
  if (pwError) return { email: null, workspaceName: null, error: pwError.message }

  // Clear the password_change_required flag
  await adminClient
    .from('users')
    // @ts-ignore - Database types are correct, IDE type resolution issue
    .update({ password_change_required: false })
    .eq('id', userId)

  // Add to workspace_members (idempotent)
  const { data: existingMembership } = await adminClient
    .from('workspace_members')
    .select('user_id')
    .eq('user_id', userId)
    .eq('workspace_id', inv.workspace_id)
    .maybeSingle()

  if (!existingMembership) {
    type WorkspaceMemberInsert = { user_id: string; workspace_id: string; role: UserRole }
    const { error: insertErr } = await adminClient
      .from('workspace_members')
      // @ts-ignore - Database types are correct, IDE type resolution issue
      .insert({
        // @ts-ignore
        user_id: userId,
        workspace_id: inv.workspace_id,
        role: inv.role,
      } as WorkspaceMemberInsert)
    if (insertErr) return { email: null, workspaceName: null, error: insertErr.message }
  }

  // Set the joined workspace as current
  await adminClient.auth.admin.updateUserById(userId, {
    user_metadata: { current_workspace_id: inv.workspace_id },
  })

  // Mark invitation accepted
  await adminClient
    .from('invitations')
    // @ts-ignore - Database types are correct, IDE type resolution issue
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', inv.id)

  // Workspace name for confirmation
  const { data: ws } = await adminClient
    .from('workspaces')
    .select('name')
    .eq('id', inv.workspace_id)
    .single<{ name: string }>()

  return { email: inv.email, workspaceName: ws?.name ?? null, error: null }
}
