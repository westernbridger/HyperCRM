import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Ensures that custom field definitions exist in the database for the given
 * keys. Called whenever server-side code (booking, meta leads, hyperforms)
 * creates or updates a contact with custom_fields that may not have definitions yet.
 *
 * Uses upsert with onConflict (workspace_id, key) so existing definitions
 * are never duplicated or overwritten.
 */
export async function ensureFieldDefinitions(
  workspaceId: string,
  customFields: Record<string, any>,
): Promise<void> {
  const keys = Object.keys(customFields)
  if (keys.length === 0) return

  const admin = createAdminClient()

  const rows = keys.map((key) => ({
    workspace_id: workspaceId,
    key,
    label: key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    type: 'text',
  }))

  const { error } = await admin
    .from('custom_field_definitions')
    .upsert(rows, { onConflict: 'workspace_id,key', ignoreDuplicates: true })

  if (error) {
    console.error('[ensureFieldDefinitions] Error:', error.message)
  }
}
