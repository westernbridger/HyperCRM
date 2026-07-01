'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureFieldDefinitions } from '@/lib/data/field-definitions'
import { revalidatePath } from 'next/cache'
import type {
  HyperFormField,
  HyperFormTheme,
  HyperFormBranding,
  HyperFormLayout,
} from '@/lib/supabase/database.types'

export type HyperForm = {
  id: string
  workspace_id: string
  name: string
  description: string | null
  fields: HyperFormField[]
  is_active: boolean
  theme: HyperFormTheme
  layout: HyperFormLayout
  branding: HyperFormBranding
  created_by: string | null
  created_at: string
  updated_at: string
}

export type HyperFormSubmission = {
  id: string
  form_id: string
  workspace_id: string
  contact_id: string | null
  answers: Record<string, any>
  status: 'Lead' | 'Prospect' | 'Customer' | 'Churned'
  submitted_at: string
}

export type CreateFormInput = {
  name: string
  description?: string
  fields?: HyperFormField[]
}

export type UpdateFormInput = Partial<
  CreateFormInput & {
    is_active: boolean
    theme: HyperFormTheme
    layout: HyperFormLayout
    branding: HyperFormBranding
  }
>

// ── helpers ────────────────────────────────────────────────────────────────

async function getWorkspaceId(): Promise<{ workspaceId: string | null; userId: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { workspaceId: null, userId: null }
  const workspaceId = user.user_metadata?.current_workspace_id as string | undefined
  return { workspaceId: workspaceId ?? null, userId: user.id }
}

// ── Forms CRUD ─────────────────────────────────────────────────────────────

export async function getForms(): Promise<{ data: HyperForm[] | null; error: string | null }> {
  const supabase = await createClient()
  const { workspaceId } = await getWorkspaceId()
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  const { data, error } = await supabase
    .from('hyperforms')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data: data as HyperForm[], error: null }
}

export async function getFormById(id: string): Promise<{ data: HyperForm | null; error: string | null }> {
  const supabase = await createClient()
  const { workspaceId } = await getWorkspaceId()
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  const { data, error } = await supabase
    .from('hyperforms')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as HyperForm, error: null }
}

export async function getFormByIdPublic(id: string): Promise<{ data: HyperForm | null; error: string | null }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('hyperforms')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as HyperForm, error: null }
}

export async function createForm(
  input: CreateFormInput
): Promise<{ data: HyperForm | null; error: string | null }> {
  const supabase = await createClient()
  const { workspaceId, userId } = await getWorkspaceId()
  if (!workspaceId || !userId) return { data: null, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('hyperforms')
    // @ts-ignore
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      description: input.description ?? null,
      fields: input.fields ?? [],
      created_by: userId,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  revalidatePath('/documents')
  return { data: data as HyperForm, error: null }
}

export async function updateForm(
  id: string,
  input: UpdateFormInput
): Promise<{ data: HyperForm | null; error: string | null }> {
  const supabase = await createClient()
  const { workspaceId } = await getWorkspaceId()
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  const { data, error } = await supabase
    .from('hyperforms')
    // @ts-ignore
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  revalidatePath('/documents')
  return { data: data as HyperForm, error: null }
}

export async function deleteForm(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { workspaceId } = await getWorkspaceId()
  if (!workspaceId) return { error: 'No workspace selected' }

  const { error } = await supabase
    .from('hyperforms')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (error) return { error: error.message }
  revalidatePath('/documents')
  return { error: null }
}

// ── Submissions ────────────────────────────────────────────────────────────

export async function getFormSubmissions(
  formId: string
): Promise<{ data: HyperFormSubmission[] | null; error: string | null }> {
  const supabase = await createClient()
  const { workspaceId } = await getWorkspaceId()
  if (!workspaceId) return { data: null, error: 'No workspace selected' }

  const { data, error } = await supabase
    .from('hyperform_submissions')
    .select('*')
    .eq('form_id', formId)
    .eq('workspace_id', workspaceId)
    .order('submitted_at', { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data: data as HyperFormSubmission[], error: null }
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: HyperFormSubmission['status']
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { workspaceId } = await getWorkspaceId()
  if (!workspaceId) return { error: 'No workspace selected' }

  // Update submission status
  const { error: subError } = await supabase
    .from('hyperform_submissions')
    // @ts-ignore
    .update({ status })
    .eq('id', submissionId)
    .eq('workspace_id', workspaceId)

  if (subError) return { error: subError.message }

  // Mirror status onto the linked contact
  const { data: sub } = await supabase
    .from('hyperform_submissions')
    .select('contact_id')
    .eq('id', submissionId)
    .maybeSingle<{ contact_id: string | null }>()

  if (sub?.contact_id) {
    await supabase
      .from('contacts')
      // @ts-ignore
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', sub.contact_id)
  }

  revalidatePath('/documents')
  revalidatePath('/leads')
  return { error: null }
}

// ── Public submission (called from /forms/[formId] — no auth required) ─────

export async function submitHyperForm(
  formId: string,
  answers: Record<string, any>
): Promise<{ error: string | null; submissionId: string | null }> {
  const admin = createAdminClient()

  // 1. Fetch the form (validates it exists + is active)
  const { data: form, error: formErr } = await admin
    .from('hyperforms')
    .select('id, workspace_id, fields, name')
    .eq('id', formId)
    .eq('is_active', true)
    .single<{ id: string; workspace_id: string; fields: HyperFormField[]; name: string }>()

  if (formErr || !form) return { error: 'Form not found or inactive', submissionId: null }

  // 2. Map answers to contact fields via fields[].maps_to
  const mapped: Record<string, string> = {}
  for (const field of form.fields) {
    if (field.maps_to && answers[field.id] !== undefined) {
      mapped[field.maps_to] = String(answers[field.id])
    }
  }

  const firstName = mapped.first_name || 'Unknown'
  const lastName  = mapped.last_name  || ''
  const email     = mapped.email      || `hyperform_${Date.now()}@noreply.local`
  const phone     = mapped.phone      || null
  const company   = mapped.company    || null

  // 3. Upsert contact (deduplicate by email within workspace)
  const { data: existing } = await admin
    .from('contacts')
    .select('id')
    .eq('workspace_id', form.workspace_id)
    .eq('email', email)
    .maybeSingle<{ id: string }>()

  let contactId: string

  const custom_fields: Record<string, any> = {
    source: 'HyperForm',
    hyperform_id: formId,
    hyperform_name: form.name,
    ...answers,
  }

  if (existing) {
    // Update custom_fields on existing contact
    await admin
      .from('contacts')
      // @ts-ignore
      .update({ custom_fields, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    contactId = existing.id
  } else {
    const { data: newContact, error: createErr } = await admin
      .from('contacts')
      .insert({
        workspace_id: form.workspace_id,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        company,
        status: 'Lead',
        custom_fields,
      })
      .select('id')
      .single<{ id: string }>()

    if (createErr || !newContact) {
      return { error: createErr?.message ?? 'Failed to create contact', submissionId: null }
    }

    contactId = newContact.id

    // Log creation activity
    await admin.from('activities').insert({
      contact_id: contactId,
      workspace_id: form.workspace_id,
      type: 'creation',
      title: 'Lead captured via HyperForm',
      content: `Submitted "${form.name}" form.`,
      metadata: { source: 'HyperForm', form_id: formId },
    })
  }

  // 4. Create the submission record
  // Auto-create custom field definitions for any new attributes
  await ensureFieldDefinitions(form.workspace_id, custom_fields).catch((e) =>
    console.error('HyperForm field definition error (non-fatal):', e)
  )

  const { data: submission, error: subErr } = await admin
    .from('hyperform_submissions')
    .insert({
      form_id: formId,
      workspace_id: form.workspace_id,
      contact_id: contactId,
      answers,
      status: 'Lead',
    })
    .select('id')
    .single<{ id: string }>()

  if (subErr || !submission) {
    return { error: subErr?.message ?? 'Failed to record submission', submissionId: null }
  }

  return { error: null, submissionId: submission.id }
}

// ── Asset upload (logo / cover / background) ────────────────────────────────

export async function uploadFormAsset(
  formData: FormData
): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createClient()
  const { workspaceId } = await getWorkspaceId()
  if (!workspaceId) return { url: null, error: 'No workspace selected' }

  const file = formData.get('file') as File | null
  const kind = (formData.get('kind') as string) || 'asset'
  if (!file) return { url: null, error: 'No file provided' }

  if (!file.type.startsWith('image/')) {
    return { url: null, error: 'Only image files are allowed' }
  }
  if (file.size > 5 * 1024 * 1024) {
    return { url: null, error: 'Image must be under 5MB' }
  }

  const ext = file.name.split('.').pop() || 'png'
  const path = `${workspaceId}/${kind}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('form-assets')
    .upload(path, file, { cacheControl: '3600', upsert: false })

  if (uploadError) return { url: null, error: uploadError.message }

  const { data } = supabase.storage.from('form-assets').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}
