-- HyperCRM Documents Library Schema
-- File metadata + per-contact attachment linking with Supabase Storage

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  file_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  category TEXT NOT NULL DEFAULT 'general',
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_documents_contact ON documents(contact_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(workspace_id, category);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read documents" ON documents;
CREATE POLICY "members read documents"
  ON documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = documents.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "members create documents" ON documents;
CREATE POLICY "members create documents"
  ON documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = documents.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "members update documents" ON documents;
CREATE POLICY "members update documents"
  ON documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = documents.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "members delete documents" ON documents;
CREATE POLICY "members delete documents"
  ON documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = documents.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

-- ── Storage Bucket ────────────────────────────────────────────────────────────
-- Create a private storage bucket for document uploads

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: members can read/upload/delete in their workspace folder
DROP POLICY IF EXISTS "members read documents storage" ON storage.objects;
CREATE POLICY "members read documents storage"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
      AND wm.workspace_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "members upload documents storage" ON storage.objects;
CREATE POLICY "members upload documents storage"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
      AND wm.workspace_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "members delete documents storage" ON storage.objects;
CREATE POLICY "members delete documents storage"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
      AND wm.workspace_id::text = (storage.foldername(name))[1]
    )
  );
