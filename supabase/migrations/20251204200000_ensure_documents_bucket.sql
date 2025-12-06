-- Migration : S'assurer que le bucket "documents" existe avec les bonnes policies
-- Date : 2025-12-04

-- ============================================
-- CRÉER LE BUCKET DOCUMENTS
-- ============================================

-- Créer le bucket s'il n'existe pas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800, -- 50 Mo max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- POLICIES POUR LE BUCKET DOCUMENTS
-- ============================================

-- Supprimer les anciennes policies si elles existent (pour éviter les conflits)
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view accessible documents" ON storage.objects;
DROP POLICY IF EXISTS "Owners and admins can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage documents" ON storage.objects;

-- Policy : Le service role peut tout faire (utilisé par les API routes)
CREATE POLICY "Service role can manage documents"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');

-- Policy : Les utilisateurs authentifiés peuvent uploader
CREATE POLICY "Users can upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Policy : Les utilisateurs authentifiés peuvent voir leurs documents
CREATE POLICY "Users can view accessible documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    -- Les propriétaires peuvent voir les documents de leurs propriétés
    EXISTS (
      SELECT 1 FROM documents d
      JOIN properties p ON p.id = d.property_id
      WHERE d.storage_path = name
      AND p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
    OR
    -- Les locataires peuvent voir leurs documents
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.storage_path = name
      AND d.tenant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
    OR
    -- Les propriétaires peuvent voir les documents de leurs baux
    EXISTS (
      SELECT 1 FROM documents d
      JOIN leases l ON l.id = d.lease_id
      JOIN properties p ON p.id = l.property_id
      WHERE d.storage_path = name
      AND p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
    OR
    -- Les locataires peuvent voir les documents de leurs baux
    EXISTS (
      SELECT 1 FROM documents d
      JOIN leases l ON l.id = d.lease_id
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE d.storage_path = name
      AND ls.profile_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
    OR
    -- Les admins peuvent tout voir
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  )
);

-- Policy : Suppression par propriétaires et admins
CREATE POLICY "Owners and admins can delete documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN properties p ON p.id = d.property_id
      WHERE d.storage_path = name
      AND p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  )
);

-- Note: COMMENT ON TABLE storage.buckets n'est pas possible car nous ne sommes pas owner du schema storage

