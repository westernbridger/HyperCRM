'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DocumentFile, DocumentCategory } from '@/lib/supabase/database.types'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const workspaceId =
    (user?.user_metadata?.current_workspace_id as string | undefined) ?? null
  return { supabase, workspaceId, userId: user?.id ?? null }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function inferCategory(fileName: string, fileType: string): DocumentCategory {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image'
  if (ext === 'pdf' || fileType.includes('pdf')) return 'contract'
  if (['doc', 'docx'].includes(ext)) return 'proposal'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'invoice'
  if (['txt', 'rtf'].includes(ext)) return 'resume'
  return 'general'
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getDocuments(contactId?: string): Promise<{
  data: DocumentFile[] | null
  error: string | null
}> {
  try {
    const { supabase, workspaceId } = await getContext()
    if (!workspaceId) return { data: null, error: 'No workspace selected' }

    let query = supabase
      .from('documents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (contactId) {
      query = query.eq('contact_id', contactId)
    }

    const { data, error } = await query

    if (error) return { data: null, error: error.message }
    return { data: data as DocumentFile[], error: null }
  } catch (err) {
    console.error('Error fetching documents:', err)
    return { data: null, error: 'Failed to fetch documents' }
  }
}

export async function uploadDocument(
  file: File,
  category?: DocumentCategory,
  contactId?: string
): Promise<{ data: DocumentFile | null; error: string | null }> {
  try {
    const { supabase, workspaceId, userId } = await getContext()
    if (!workspaceId) return { data: null, error: 'No workspace selected' }

    const ext = file.name.split('.').pop() ?? ''
    const fileName = `${crypto.randomUUID()}.${ext}`
    const filePath = `${workspaceId}/${fileName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) return { data: null, error: uploadError.message }

    // Determine category
    const finalCategory = category || inferCategory(file.name, file.type)

    // Insert metadata record
    const { data, error: dbError } = await supabase
      .from('documents')
      .insert({
        workspace_id: workspaceId,
        name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type || 'application/octet-stream',
        category: finalCategory,
        contact_id: contactId ?? null,
        uploaded_by: userId,
      })
      .select()
      .single()

    if (dbError) {
      // Clean up the uploaded file if DB insert fails
      await supabase.storage.from('documents').remove([filePath])
      return { data: null, error: dbError.message }
    }

    // Log activity if linked to a contact
    if (contactId) {
      await supabase.from('activities').insert({
        contact_id: contactId,
        workspace_id: workspaceId,
        type: 'document',
        title: `Document uploaded: ${file.name}`,
        content: `File "${file.name}" (${formatFileSize(file.size)}) was uploaded`,
        metadata: { document_id: data.id, category: finalCategory },
        created_by: userId,
      })
    }

    revalidatePath('/documents')
    return { data: data as DocumentFile, error: null }
  } catch (err) {
    console.error('Error uploading document:', err)
    return { data: null, error: 'Failed to upload document' }
  }
}

export async function deleteDocument(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { supabase, workspaceId } = await getContext()
    if (!workspaceId) return { success: false, error: 'No workspace selected' }

    // Get the document to find the file path
    const { data: doc } = await supabase
      .from('documents')
      .select('file_path')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (!doc) return { success: false, error: 'Document not found' }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([doc.file_path])

    if (storageError) {
      console.error('Storage delete error:', storageError)
    }

    // Delete metadata
    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (dbError) return { success: false, error: dbError.message }

    revalidatePath('/documents')
    return { success: true, error: null }
  } catch (err) {
    console.error('Error deleting document:', err)
    return { success: false, error: 'Failed to delete document' }
  }
}

export async function getDocumentUrl(
  id: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const { supabase, workspaceId } = await getContext()
    if (!workspaceId) return { url: null, error: 'No workspace selected' }

    const { data: doc } = await supabase
      .from('documents')
      .select('file_path')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (!doc) return { url: null, error: 'Document not found' }

    const { data: urlData } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 3600)

    if (!urlData?.signedUrl) return { url: null, error: 'Failed to generate URL' }

    return { url: urlData.signedUrl, error: null }
  } catch (err) {
    console.error('Error getting document URL:', err)
    return { url: null, error: 'Failed to get document URL' }
  }
}

export async function linkDocumentToContact(
  id: string,
  contactId: string | null
): Promise<{ data: DocumentFile | null; error: string | null }> {
  try {
    const { supabase, workspaceId } = await getContext()
    if (!workspaceId) return { data: null, error: 'No workspace selected' }

    const { data, error } = await supabase
      .from('documents')
      .update({ contact_id: contactId, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) return { data: null, error: error.message }

    // Log activity if linking
    if (contactId) {
      await supabase.from('activities').insert({
        contact_id: contactId,
        workspace_id: workspaceId,
        type: 'document',
        title: `Document linked: ${data.name}`,
        content: `Document "${data.name}" was linked to this contact`,
        metadata: { document_id: id },
        created_by: null,
      })
    }

    revalidatePath('/documents')
    return { data: data as DocumentFile, error: null }
  } catch (err) {
    console.error('Error linking document:', err)
    return { data: null, error: 'Failed to link document' }
  }
}

export async function updateDocumentCategory(
  id: string,
  category: DocumentCategory
): Promise<{ data: DocumentFile | null; error: string | null }> {
  try {
    const { supabase, workspaceId } = await getContext()
    if (!workspaceId) return { data: null, error: 'No workspace selected' }

    const { data, error } = await supabase
      .from('documents')
      .update({ category, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) return { data: null, error: error.message }

    revalidatePath('/documents')
    return { data: data as DocumentFile, error: null }
  } catch (err) {
    console.error('Error updating document category:', err)
    return { data: null, error: 'Failed to update document' }
  }
}

// formatFileSize moved to src/lib/utils.ts for client-side use
