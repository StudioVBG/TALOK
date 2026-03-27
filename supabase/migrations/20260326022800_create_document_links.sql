-- Table document_links: liens de partage temporaires
-- Utilisee par POST /api/documents/[id]/download et /api/documents/[id]/copy-link

CREATE TABLE IF NOT EXISTS document_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  max_views INTEGER DEFAULT 10,
  view_count INTEGER NOT NULL DEFAULT 0,
  accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_links_token ON document_links(token);
CREATE INDEX IF NOT EXISTS idx_document_links_document_id ON document_links(document_id);
CREATE INDEX IF NOT EXISTS idx_document_links_expires_at ON document_links(expires_at);

-- RLS
ALTER TABLE document_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own document links" ON document_links
  FOR SELECT TO authenticated
  USING (
    created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_links.document_id
      AND (d.owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
           OR d.tenant_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
    )
  );

CREATE POLICY "Users can create document links" ON document_links
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role full access document_links" ON document_links
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
