'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type Contact = {
  id: string
  workspace_id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  company: string | null
  status: 'Lead' | 'Prospect' | 'Customer' | 'Churned'
  custom_fields: Record<string, any>
  created_at: string
  updated_at: string
  created_by: string | null
  assigned_to: string | null
}

export type Activity = {
  id: string
  contact_id: string
  workspace_id: string
  type: 'note' | 'email' | 'call' | 'meeting' | 'document' | 'status_change' | 'creation'
  title: string
  content: string | null
  metadata: Record<string, any>
  created_by: string | null
  created_at: string
}

export type CreateContactInput = {
  first_name: string
  last_name: string
  email: string
  phone?: string
  company?: string
  status?: 'Lead' | 'Prospect' | 'Customer' | 'Churned'
  custom_fields?: Record<string, any>
}

export type UpdateContactInput = Partial<CreateContactInput>

const VALID_STATUSES = ['Lead', 'Prospect', 'Customer', 'Churned'] as const

function sanitizeStatus(status?: string): Contact['status'] {
  if (!status) return 'Lead'
  if ((VALID_STATUSES as readonly string[]).includes(status)) return status as Contact['status']
  // Map common UI labels to valid DB enum values
  const map: Record<string, Contact['status']> = {
    Active: 'Customer',
    Inactive: 'Churned',
    active: 'Customer',
    inactive: 'Churned',
    prospect: 'Prospect',
    customer: 'Customer',
    lead: 'Lead',
    churned: 'Churned',
  }
  return map[status] ?? 'Lead'
}

// Ensure the user has a workspace; create and assign one if missing.
// Returns the workspace_id or null on failure.
async function ensureWorkspace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  userEmail?: string | null
): Promise<string | null> {
  // Check for existing user record + workspace
  const { data: userData } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('id', userId)
    .maybeSingle()

  if (userData?.workspace_id) {
    return userData.workspace_id
  }

  // Create a new workspace (slug is required and must be unique)
  const emailPrefix = userEmail?.split('@')[0] || 'workspace'
  const workspaceName = `${emailPrefix} Workspace`
  const workspaceSlug = `${emailPrefix}-${userId.slice(0, 8)}`
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({ name: workspaceName, slug: workspaceSlug })
    .select('id')
    .single()

  if (wsError || !workspace) {
    console.error('Failed to create workspace:', wsError)
    return null
  }

  // Upsert the user record with the workspace_id
  const { error: userUpsertError } = await supabase
    .from('users')
    .upsert(
      {
        id: userId,
        email: userEmail || '',
        workspace_id: workspace.id,
        role: 'MASTER',
      },
      { onConflict: 'id' }
    )

  if (userUpsertError) {
    console.error('Failed to assign workspace to user:', userUpsertError)
    return null
  }

  return workspace.id
}

// Get all contacts for current workspace
export async function getContacts(): Promise<{ data: Contact[] | null; error: string | null }> {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: 'Not authenticated' }
    }

    // Get current workspace from user metadata
    const workspaceId = user.user_metadata?.current_workspace_id as string | undefined
    if (!workspaceId) {
      return { data: null, error: 'No workspace selected' }
    }

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching contacts:', error)
      return { data: null, error: error.message }
    }

    return { data: data as Contact[], error: null }
  } catch (err) {
    console.error('Unexpected error:', err)
    return { data: null, error: 'Failed to fetch contacts' }
  }
}

// Get single contact by ID
export async function getContactById(id: string): Promise<{ data: Contact | null; error: string | null }> {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: 'Not authenticated' }
    }

    // Get current workspace from user metadata
    const workspaceId = user.user_metadata?.current_workspace_id as string | undefined
    if (!workspaceId) {
      return { data: null, error: 'No workspace selected' }
    }

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (error) {
      console.error('Error fetching contact:', error)
      return { data: null, error: error.message }
    }

    return { data: data as Contact, error: null }
  } catch (err) {
    console.error('Unexpected error:', err)
    return { data: null, error: 'Failed to fetch contact' }
  }
}

// Create new contact
export async function createContact(
  input: CreateContactInput
): Promise<{ data: Contact | null; error: string | null }> {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: 'Not authenticated' }
    }

    // Get current workspace from user metadata
    const workspaceId = user.user_metadata?.current_workspace_id as string | undefined
    if (!workspaceId) {
      return { data: null, error: 'No workspace selected' }
    }

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        ...input,
        workspace_id: workspaceId,
        created_by: user.id,
        status: sanitizeStatus(input.status),
        custom_fields: input.custom_fields || {},
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating contact:', error)
      return { data: null, error: error.message }
    }

    // Create initial activity for contact creation
    await supabase.from('activities').insert({
      contact_id: data.id,
      workspace_id: workspaceId,
      type: 'creation',
      title: 'Contact created',
      content: `Contact ${input.first_name} ${input.last_name} was added to the system`,
      metadata: {},
      created_by: user.id,
    })

    revalidatePath('/contacts')
    return { data: data as Contact, error: null }
  } catch (err) {
    console.error('Unexpected error:', err)
    return { data: null, error: 'Failed to create contact' }
  }
}

// Update contact
export async function updateContact(
  id: string,
  input: UpdateContactInput,
  oldStatus?: string
): Promise<{ data: Contact | null; error: string | null }> {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: 'Not authenticated' }
    }

    // Get current workspace from user metadata
    const workspaceId = user.user_metadata?.current_workspace_id as string | undefined
    if (!workspaceId) {
      return { data: null, error: 'No workspace selected' }
    }

    const { data, error } = await supabase
      .from('contacts')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) {
      console.error('Error updating contact:', error)
      return { data: null, error: error.message }
    }

    // If status changed, log activity
    if (input.status && oldStatus && input.status !== oldStatus) {
      // @ts-ignore
      await supabase.from('activities').insert({
        contact_id: id,
        workspace_id: workspaceId,
        type: 'status_change',
        title: 'Status updated',
        content: `Status changed from ${oldStatus} to ${input.status}`,
        metadata: { old_status: oldStatus, new_status: input.status },
        created_by: user.id,
      })
    }

    revalidatePath('/contacts')
    revalidatePath(`/contacts/${id}`)
    return { data: data as Contact, error: null }
  } catch (err) {
    console.error('Unexpected error:', err)
    return { data: null, error: 'Failed to update contact' }
  }
}

// Delete contact
export async function deleteContact(id: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting contact:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/contacts')
    return { success: true, error: null }
  } catch (err) {
    console.error('Unexpected error:', err)
    return { success: false, error: 'Failed to delete contact' }
  }
}

// Bulk delete contacts
export async function bulkDeleteContacts(ids: string[]): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { error } = await supabase
      .from('contacts')
      .delete()
      .in('id', ids)

    if (error) {
      console.error('Error bulk deleting contacts:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/contacts')
    return { success: true, error: null }
  } catch (err) {
    console.error('Unexpected error:', err)
    return { success: false, error: 'Failed to delete contacts' }
  }
}

// Bulk update status
export async function bulkUpdateStatus(
  ids: string[],
  status: 'Lead' | 'Prospect' | 'Customer' | 'Churned'
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get current workspace from user metadata
    const workspaceId = user.user_metadata?.current_workspace_id as string | undefined
    if (!workspaceId) {
      return { success: false, error: 'No workspace selected' }
    }

    const { error } = await supabase
      .from('contacts')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', ids)
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error('Error bulk updating status:', error)
      return { success: false, error: error.message }
    }

    // Log activities for each contact
    const activities = ids.map(contactId => ({
      contact_id: contactId,
      workspace_id: workspaceId,
      type: 'status_change' as const,
      title: 'Status updated (bulk)',
      content: `Status updated to ${status} via bulk action`,
      metadata: { new_status: status },
      created_by: user.id,
    }))

    await supabase.from('activities').insert(activities)

    revalidatePath('/contacts')
    return { success: true, error: null }
  } catch (err) {
    console.error('Unexpected error:', err)
    return { success: false, error: 'Failed to update contacts' }
  }
}

// Batch import contacts (for CSV import)
export async function batchImportContacts(
  contacts: CreateContactInput[]
): Promise<{ 
  success: boolean
  inserted: number
  failed: number
  error: string | null 
}> {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, inserted: 0, failed: contacts.length, error: 'Not authenticated' }
    }

    // Get current workspace from user metadata
    const workspaceId = user.user_metadata?.current_workspace_id as string | undefined
    if (!workspaceId) {
      return { success: false, inserted: 0, failed: contacts.length, error: 'No workspace selected' }
    }

    // Prepare contacts with workspace_id and created_by
    const contactsToInsert = contacts.map(contact => ({
      ...contact,
      workspace_id: workspaceId,
      created_by: user.id,
      status: sanitizeStatus(contact.status),
      custom_fields: contact.custom_fields || {},
    }))

    const { data, error } = await supabase
      .from('contacts')
      .insert(contactsToInsert)
      .select()

    if (error) {
      console.error('Error batch importing contacts:', error)
      return { success: false, inserted: 0, failed: contacts.length, error: error.message }
    }

    // Create activities for imported contacts
    if (data && data.length > 0) {
      const activities = data.map(contact => ({
        contact_id: contact.id,
        workspace_id: workspaceId,
        type: 'creation' as const,
        title: 'Contact imported',
        content: `Contact ${contact.first_name} ${contact.last_name} was imported via CSV`,
        metadata: { source: 'csv_import' },
        created_by: user.id,
      }))

      await supabase.from('activities').insert(activities)
    }

    revalidatePath('/contacts')
    return { 
      success: true, 
      inserted: data?.length || 0, 
      failed: contacts.length - (data?.length || 0),
      error: null 
    }
  } catch (err) {
    console.error('Unexpected error:', err)
    return { success: false, inserted: 0, failed: contacts.length, error: 'Failed to import contacts' }
  }
}

// Get activities for a contact
export async function getContactActivities(
  contactId: string
): Promise<{ data: Activity[] | null; error: string | null }> {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: 'Not authenticated' }
    }

    // Get current workspace from user metadata
    const workspaceId = user.user_metadata?.current_workspace_id as string | undefined
    if (!workspaceId) {
      return { data: null, error: 'No workspace selected' }
    }

    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('contact_id', contactId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching activities:', error)
      return { data: null, error: error.message }
    }

    return { data: data as Activity[], error: null }
  } catch (err) {
    console.error('Unexpected error:', err)
    return { data: null, error: 'Failed to fetch activities' }
  }
}

// Add activity to contact
export async function addActivity(
  contactId: string,
  type: Activity['type'],
  title: string,
  content?: string,
  metadata?: Record<string, any>
): Promise<{ data: Activity | null; error: string | null }> {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: 'Not authenticated' }
    }

    // Get current workspace from user metadata
    const workspaceId = user.user_metadata?.current_workspace_id as string | undefined
    if (!workspaceId) {
      return { data: null, error: 'No workspace selected' }
    }

    const { data, error } = await supabase
      .from('activities')
      .insert({
        // @ts-ignore
        contact_id: contactId,
        workspace_id: workspaceId,
        type,
        title,
        content: content || null,
        metadata: metadata || {},
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding activity:', error)
      return { data: null, error: error.message }
    }

    revalidatePath(`/contacts/${contactId}`)
    return { data: data as Activity, error: null }
  } catch (err) {
    console.error('Unexpected error:', err)
    return { data: null, error: 'Failed to add activity' }
  }
}

// Get dashboard stats (for dashboard widgets)
export async function getDashboardStats(): Promise<{ 
  totalContacts: number
  leadsCount: number
  customersCount: number
  recentContacts: Contact[]
  error: string | null 
}> {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { 
        totalContacts: 0, 
        leadsCount: 0, 
        customersCount: 0, 
        recentContacts: [],
        error: 'Not authenticated' 
      }
    }

    // Get current workspace from user metadata
    const workspaceId = user.user_metadata?.current_workspace_id as string | undefined
    if (!workspaceId) {
      return { 
        totalContacts: 0, 
        leadsCount: 0, 
        customersCount: 0, 
        recentContacts: [],
        error: 'No workspace selected' 
      }
    }

    // Get counts (filtered by workspace)
    const { count: totalCount, error: totalError } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)

    const { count: leadsCount, error: leadsError } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'Lead')

    const { count: customersCount, error: customersError } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'Customer')

    // Get recent contacts (filtered by workspace)
    const { data: recentContacts, error: recentError } = await supabase
      .from('contacts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (totalError || leadsError || customersError || recentError) {
      return { 
        totalContacts: 0, 
        leadsCount: 0, 
        customersCount: 0, 
        recentContacts: [],
        error: 'Failed to fetch stats' 
      }
    }

    return { 
      totalContacts: totalCount || 0, 
      leadsCount: leadsCount || 0, 
      customersCount: customersCount || 0, 
      recentContacts: recentContacts as Contact[] || [],
      error: null 
    }
  } catch (err) {
    console.error('Unexpected error:', err)
    return { 
      totalContacts: 0, 
      leadsCount: 0, 
      customersCount: 0, 
      recentContacts: [],
      error: 'Failed to fetch stats' 
    }
  }
}
