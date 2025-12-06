-- Migration : Corriger les colonnes manquantes
-- Date : 2025-12-04
-- 
-- Cette migration ajoute les colonnes manquantes qui causent des erreurs 500

-- ============================================
-- 1. AJOUTER EMAIL À PROFILES (si manquant)
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email TEXT;
    
    -- Remplir depuis auth.users si possible
    UPDATE profiles p
    SET email = u.email
    FROM auth.users u
    WHERE p.user_id = u.id
    AND p.email IS NULL;
    
    RAISE NOTICE 'Colonne email ajoutée à profiles';
  END IF;
END $$;

-- ============================================
-- 2. AJOUTER LES COLONNES CNI À DOCUMENTS
-- ============================================

-- Date d'expiration
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- Date de demande de renouvellement
ALTER TABLE documents ADD COLUMN IF NOT EXISTS renewal_requested_at TIMESTAMPTZ;

-- Document archivé
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Lien vers le document de remplacement
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'replaced_by'
  ) THEN
    ALTER TABLE documents ADD COLUMN replaced_by UUID REFERENCES documents(id);
  END IF;
END $$;

-- Statut de vérification
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';

-- Notes de vérification
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- Date de vérification
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Vérifié par
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'documents' 
    AND column_name = 'verified_by'
  ) THEN
    ALTER TABLE documents ADD COLUMN verified_by UUID REFERENCES profiles(id);
  END IF;
END $$;

-- ============================================
-- 3. METTRE À JOUR LA CONTRAINTE DE TYPE
-- ============================================

-- Supprimer l'ancienne contrainte
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;

-- Recréer avec les nouveaux types CNI
ALTER TABLE documents
  ADD CONSTRAINT documents_type_check
  CHECK (
    type IN (
      -- Types originaux
      'bail',
      'EDL_entree',
      'EDL_sortie',
      'quittance',
      'attestation_assurance',
      'attestation_loyer',
      'justificatif_revenus',
      'piece_identite',
      'annexe_pinel',
      'etat_travaux',
      'diagnostic_amiante',
      'diagnostic_tertiaire',
      'diagnostic_performance',
      'publication_jal',
      'autre',
      -- Nouveaux types pour CNI et signature
      'cni_recto',
      'cni_verso',
      'bail_signe_locataire',
      'bail_signe_proprietaire',
      'bail_complet_signe',
      -- Documents complémentaires locataire
      'justificatif_domicile',
      'avis_imposition',
      'bulletins_salaire',
      'contrat_travail',
      'attestation_employeur',
      'garant_piece_identite',
      'garant_justificatif_revenus'
    )
  );

-- ============================================
-- 4. INDEX POUR LES PERFORMANCES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_documents_expiry_date 
ON documents(expiry_date) 
WHERE type IN ('cni_recto', 'cni_verso') AND is_archived = false;

CREATE INDEX IF NOT EXISTS idx_profiles_email 
ON profiles(email) 
WHERE email IS NOT NULL;

-- ============================================
-- VÉRIFICATION
-- ============================================

DO $$
DECLARE
  email_exists BOOLEAN;
  expiry_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) INTO email_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'documents' AND column_name = 'expiry_date'
  ) INTO expiry_exists;
  
  RAISE NOTICE 'Vérification: profiles.email = %, documents.expiry_date = %', email_exists, expiry_exists;
END $$;

