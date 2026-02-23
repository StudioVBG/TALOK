-- Migration : Corriger les politiques RLS sur tenant_documents
-- Date : 2026-02-23
--
-- Problème : Les politiques RLS existantes utilisent profile_id = auth.uid()
-- mais auth.uid() retourne le user_id (auth.users.id), pas le profile_id (profiles.id).
-- Résultat : les locataires ne peuvent jamais voir leurs propres documents.

-- ============================================
-- SUPPRIMER LES POLITIQUES INCORRECTES
-- ============================================

DROP POLICY IF EXISTS "tenant_view_own_documents" ON tenant_documents;
DROP POLICY IF EXISTS "tenant_insert_own_documents" ON tenant_documents;

-- ============================================
-- RECRÉER AVEC LA BONNE LOGIQUE
-- ============================================

-- Le locataire peut voir ses propres documents
CREATE POLICY "tenant_view_own_documents" ON tenant_documents
  FOR SELECT USING (
    tenant_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Le locataire peut uploader ses documents
CREATE POLICY "tenant_insert_own_documents" ON tenant_documents
  FOR INSERT WITH CHECK (
    tenant_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- AJOUTER tenant_email DANS LES METADATA DE L'EXPIRY CRON
-- La fonction check_expiring_cni() utilise d.metadata->>'tenant_email'
-- mais cette donnée n'était pas toujours présente.
-- Mettre à jour les documents CNI existants pour ajouter le tenant_email.
-- ============================================

UPDATE documents d
SET metadata = COALESCE(d.metadata, '{}'::jsonb) || jsonb_build_object(
  'tenant_email', COALESCE(
    (SELECT u.email FROM profiles p JOIN auth.users u ON u.id = p.user_id WHERE p.id = d.tenant_id),
    ''
  )
)
WHERE d.type IN ('cni_recto', 'cni_verso')
  AND d.tenant_id IS NOT NULL
  AND (d.metadata->>'tenant_email' IS NULL OR d.metadata->>'tenant_email' = '');

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON POLICY "tenant_view_own_documents" ON tenant_documents
  IS 'Le locataire peut voir ses documents via la jointure profiles.user_id = auth.uid()';
COMMENT ON POLICY "tenant_insert_own_documents" ON tenant_documents
  IS 'Le locataire peut insérer ses documents via la jointure profiles.user_id = auth.uid()';
