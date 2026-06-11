# Workspace Isolation Pattern

## Rule: ALL Data Belongs to a Workspace

Every feature, table, and query must respect workspace boundaries. Users can be members of multiple workspaces with different roles, but data must never leak between workspaces.

## The Pattern

### 1. Database Tables
Every workspace-scoped table MUST have:
```sql
workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
```

### 2. RLS Policies
Use the helper functions for ALL workspace-scoped tables:

```sql
CREATE POLICY "Table is isolated by workspace" ON table_name
    FOR ALL USING (
        workspace_id = get_user_current_workspace()
        AND is_workspace_member(auth.uid(), workspace_id)
    )
    WITH CHECK (
        workspace_id = get_user_current_workspace()
        AND is_workspace_member(auth.uid(), workspace_id)
    );
```

### 3. Server Actions
Always get workspace from user metadata:

```typescript
export async function someAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }
  
  // Get current workspace from user metadata
  const workspaceId = user.user_metadata?.current_workspace_id as string | undefined
  if (!workspaceId) {
    return { error: 'No workspace selected' }
  }
  
  // Use workspaceId in ALL queries
  const { data } = await supabase
    .from('some_table')
    .select('*')
    .eq('workspace_id', workspaceId)  // Always filter!
    ...
}
```

### 4. Client Components
For client-side data fetching, get workspace from auth:

```typescript
const supabase = createClient()
const { data: { user } } = await supabase.auth.getUser()
const workspaceId = user?.user_metadata?.current_workspace_id

// Use workspaceId in all queries
```

## Critical Rules

1. **NEVER** query by `user_id` alone — always include `workspace_id`
2. **NEVER** use `users.workspace_id` (deprecated column) — use `user_metadata.current_workspace_id`
3. **NEVER** use `ensureWorkspace()` function — it bypasses workspace selection
4. **ALWAYS** filter SELECT queries by `workspace_id`
5. **ALWAYS** include `workspace_id` in INSERT statements
6. **ALWAYS** add `workspace_id` to UPDATE WHERE clauses to prevent cross-workspace updates

## Workspace-Switching Flow

```typescript
// Switch workspace
await supabase.auth.updateUser({
  data: { current_workspace_id: newWorkspaceId }
})

// Hard reload to refresh all data with new workspace context
window.location.href = '/'
```

## Tables That Must Have Workspace Isolation

- [x] `contacts` - Done
- [x] `activities` - Done
- [x] `dashboard_layouts` - Done
- [ ] `documents` - TODO
- [ ] `communications` - TODO
- [ ] `workflows` / `automation` - TODO
- [ ] `leads` - TODO
- [ ] Any future feature tables

## Testing Workspace Isolation

1. Create Workspace A, add Contact "Alice"
2. Switch to Workspace B
3. Contact "Alice" should NOT appear
4. Create Contact "Bob" in Workspace B
5. Switch back to Workspace A
6. Contact "Bob" should NOT appear, "Alice" should be visible

If data leaks between workspaces, the isolation is broken.

## Anti-Patterns (NEVER DO)

```typescript
// WRONG: No workspace filter
await supabase.from('contacts').select('*')

// WRONG: Using deprecated users.workspace_id
const { data } = await supabase.from('users').select('workspace_id')
const workspaceId = data.workspace_id

// WRONG: ensureWorkspace() creates random workspaces
const workspaceId = await ensureWorkspace(supabase, user.id)

// WRONG: Querying by user_id alone
await supabase.from('contacts').select('*').eq('user_id', user.id)
```

## Good Patterns (ALWAYS DO)

```typescript
// CORRECT: Get workspace from user metadata
const workspaceId = user.user_metadata?.current_workspace_id

// CORRECT: Filter by workspace_id
await supabase.from('contacts').select('*').eq('workspace_id', workspaceId)

// CORRECT: Include workspace_id in inserts
await supabase.from('contacts').insert({ ..., workspace_id: workspaceId })

// CORRECT: Filter updates by workspace_id
await supabase.from('contacts').update({...}).eq('id', id).eq('workspace_id', workspaceId)
```
