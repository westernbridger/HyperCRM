'use server'

import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import { revalidatePath } from 'next/cache'
import type {
  Workflow,
  WorkflowTriggerType,
  WorkflowActionType,
  WorkflowStatus,
} from '@/lib/supabase/database.types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type WorkflowInput = {
  name: string
  description?: string
  status: WorkflowStatus
  trigger_type: WorkflowTriggerType
  trigger_config: Record<string, any>
  action_type: WorkflowActionType
  action_config: Record<string, any>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const workspaceId =
    (user?.user_metadata?.current_workspace_id as string | undefined) ?? null
  return { supabase, workspaceId, userId: user?.id ?? null }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getWorkflows(): Promise<{
  data: Workflow[] | null
  error: string | null
}> {
  try {
    const { supabase, workspaceId } = await getContext()
    if (!workspaceId) return { data: null, error: 'No workspace selected' }

    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) return { data: null, error: error.message }
    return { data: data as Workflow[], error: null }
  } catch (err) {
    console.error('Error fetching workflows:', err)
    return { data: null, error: 'Failed to fetch workflows' }
  }
}

export async function createWorkflow(
  input: WorkflowInput
): Promise<{ data: Workflow | null; error: string | null }> {
  try {
    const { supabase, workspaceId, userId } = await getContext()
    if (!workspaceId) return { data: null, error: 'No workspace selected' }

    const { data, error } = await supabase
      .from('workflows')
      .insert({
        workspace_id: workspaceId,
        name: input.name,
        description: input.description ?? null,
        status: input.status,
        trigger_type: input.trigger_type,
        trigger_config: input.trigger_config,
        action_type: input.action_type,
        action_config: input.action_config,
        created_by: userId,
      })
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    revalidatePath('/automation')
    return { data: data as Workflow, error: null }
  } catch (err) {
    console.error('Error creating workflow:', err)
    return { data: null, error: 'Failed to create workflow' }
  }
}

export async function updateWorkflow(
  id: string,
  input: Partial<WorkflowInput>
): Promise<{ data: Workflow | null; error: string | null }> {
  try {
    const { supabase, workspaceId } = await getContext()
    if (!workspaceId) return { data: null, error: 'No workspace selected' }

    const { data, error } = await supabase
      .from('workflows')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    revalidatePath('/automation')
    return { data: data as Workflow, error: null }
  } catch (err) {
    console.error('Error updating workflow:', err)
    return { data: null, error: 'Failed to update workflow' }
  }
}

export async function deleteWorkflow(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { supabase, workspaceId } = await getContext()
    if (!workspaceId) return { success: false, error: 'No workspace selected' }

    const { error } = await supabase
      .from('workflows')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/automation')
    return { success: true, error: null }
  } catch (err) {
    console.error('Error deleting workflow:', err)
    return { success: false, error: 'Failed to delete workflow' }
  }
}

export async function toggleWorkflowStatus(
  id: string
): Promise<{ data: Workflow | null; error: string | null }> {
  try {
    const { supabase, workspaceId } = await getContext()
    if (!workspaceId) return { data: null, error: 'No workspace selected' }

    const { data: current } = await supabase
      .from('workflows')
      .select('status')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (!current) return { data: null, error: 'Workflow not found' }

    const newStatus: WorkflowStatus =
      current.status === 'active' ? 'paused' : 'active'

    const { data, error } = await supabase
      .from('workflows')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) return { data: null, error: error.message }
    revalidatePath('/automation')
    return { data: data as Workflow, error: null }
  } catch (err) {
    console.error('Error toggling workflow:', err)
    return { data: null, error: 'Failed to toggle workflow' }
  }
}

// ── Execution Engine ──────────────────────────────────────────────────────────

export async function runWorkflowForContact(
  workflowId: string,
  contactId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { supabase, workspaceId, userId } = await getContext()
    if (!workspaceId) return { success: false, error: 'No workspace selected' }

    // Load the workflow
    const { data: wf } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!wf) return { success: false, error: 'Workflow not found' }
    if (wf.status !== 'active') return { success: false, error: 'Workflow not active' }

    // Load the contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, company, status, custom_fields')
      .eq('id', contactId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!contact) return { success: false, error: 'Contact not found' }

    const actionType = wf.action_type as WorkflowActionType
    const actionConfig = wf.action_config as Record<string, any>
    let actionSuccess = false
    let actionError: string | null = null

    switch (actionType) {
      case 'send_email': {
        if (!contact.email) {
          actionError = 'Contact has no email'
          break
        }
        const { sent, error: sendErr } = await sendEmail({
          to: contact.email,
          subject: actionConfig.subject || 'Automated message',
          html: actionConfig.body || '<p>Automated message</p>',
        })
        actionSuccess = sent
        actionError = sendErr
        break
      }

      case 'add_to_segment': {
        if (!actionConfig.segment_id) {
          actionError = 'No segment specified'
          break
        }
        const { error: segErr } = await supabase
          .from('segment_contacts')
          .insert({
            segment_id: actionConfig.segment_id,
            contact_id: contactId,
            workspace_id: workspaceId,
            added_by: userId,
          })
        actionSuccess = !segErr
        actionError = segErr?.message ?? null
        break
      }

      case 'update_status': {
        if (!actionConfig.status) {
          actionError = 'No status specified'
          break
        }
        const { error: statusErr } = await supabase
          .from('contacts')
          .update({ status: actionConfig.status, updated_at: new Date().toISOString() })
          .eq('id', contactId)
          .eq('workspace_id', workspaceId)
        actionSuccess = !statusErr
        actionError = statusErr?.message ?? null
        break
      }

      case 'add_tag': {
        if (!actionConfig.tag) {
          actionError = 'No tag specified'
          break
        }
        const existingTags = (contact.custom_fields as Record<string, any>)?.tags ?? []
        if (existingTags.includes(actionConfig.tag)) {
          actionSuccess = true
          break
        }
        const { error: tagErr } = await supabase
          .from('contacts')
          .update({
            custom_fields: {
              ...(contact.custom_fields ?? {}),
              tags: [...existingTags, actionConfig.tag],
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', contactId)
          .eq('workspace_id', workspaceId)
        actionSuccess = !tagErr
        actionError = tagErr?.message ?? null
        break
      }

      case 'create_activity': {
        const { error: actErr } = await supabase.from('activities').insert({
          contact_id: contactId,
          workspace_id: workspaceId,
          type: actionConfig.type || 'note',
          title: actionConfig.title || 'Automated activity',
          content: actionConfig.content || '',
          metadata: { workflow_id: workflowId, automated: true },
          created_by: userId,
        })
        actionSuccess = !actErr
        actionError = actErr?.message ?? null
        break
      }

      default:
        actionError = `Unknown action type: ${actionType}`
    }

    // Increment run count
    await supabase
      .from('workflows')
      .update({
        run_count: (wf.run_count ?? 0) + 1,
        last_run_at: new Date().toISOString(),
      })
      .eq('id', workflowId)

    // Log activity for the automation run
    if (actionSuccess) {
      await supabase.from('activities').insert({
        contact_id: contactId,
        workspace_id: workspaceId,
        type: 'note',
        title: `Automation ran: ${wf.name}`,
        content: `Trigger: ${wf.trigger_type}, Action: ${wf.action_type}`,
        metadata: { workflow_id: workflowId, automated: true, action_success: true },
        created_by: userId,
      })
    }

    return { success: actionSuccess, error: actionError }
  } catch (err) {
    console.error('Error running workflow:', err)
    return { success: false, error: 'Failed to run workflow' }
  }
}

// ── Trigger dispatcher ────────────────────────────────────────────────────────
// Called from other server actions when events happen.

export async function triggerWorkflows(
  workspaceId: string,
  triggerType: WorkflowTriggerType,
  contactId: string,
  context?: Record<string, any>
): Promise<void> {
  try {
    const supabase = await createClient()

    const { data: workflows } = await supabase
      .from('workflows')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .eq('trigger_type', triggerType)

    for (const wf of (workflows ?? []) as any[]) {
      // Check trigger-specific conditions
      const triggerConfig = wf.trigger_config as Record<string, any>
      let shouldRun = true

      if (triggerType === 'contact_status_changed') {
        if (triggerConfig.from_status && triggerConfig.from_status !== context?.oldStatus) {
          shouldRun = false
        }
        if (triggerConfig.to_status && triggerConfig.to_status !== context?.newStatus) {
          shouldRun = false
        }
      }

      if (triggerType === 'contact_added_to_segment') {
        if (triggerConfig.segment_id && triggerConfig.segment_id !== context?.segmentId) {
          shouldRun = false
        }
      }

      if (shouldRun) {
        await runWorkflowForContact(wf.id, contactId).catch((e) =>
          console.error(`Workflow ${wf.id} run error:`, e)
        )
      }
    }
  } catch (err) {
    console.error('Error triggering workflows:', err)
  }
}
