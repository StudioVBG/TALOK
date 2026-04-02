-- =====================================================
-- SCRIPT DE CORRECTION RAPIDE - Exécuter dans Supabase Studio
-- =====================================================
-- Copiez tout ce script et exécutez-le dans : 
-- Supabase Studio → SQL Editor → New Query → Coller → Run

-- 1. Ajouter colonne email à profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Remplir les emails depuis auth.users
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id AND p.email IS NULL;

-- 2. Ajouter colonnes CNI à documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';

-- 3. Mettre à jour la contrainte de type pour autoriser cni_recto/cni_verso
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;

ALTER TABLE documents ADD CONSTRAINT documents_type_check CHECK (
  type IN (
    'bail', 'EDL_entree', 'EDL_sortie', 'quittance', 
    'attestation_assurance', 'attestation_loyer', 'justificatif_revenus',
    'piece_identite', 'annexe_pinel', 'etat_travaux',
    'diagnostic_amiante', 'diagnostic_tertiaire', 'diagnostic_performance',
    'publication_jal', 'autre',
    'cni_recto', 'cni_verso',
    'bail_signe_locataire', 'bail_signe_proprietaire', 'bail_complet_signe',
    'justificatif_domicile', 'avis_imposition', 'bulletins_salaire',
    'contrat_travail', 'attestation_employeur',
    'garant_piece_identite', 'garant_justificatif_revenus'
  )
);

-- 4. Créer index pour performances
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email) WHERE email IS NOT NULL;

-- Vérification
SELECT 'profiles.email' as colonne, EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='email') as existe
UNION ALL
SELECT 'documents.expiry_date', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='expiry_date')
UNION ALL
SELECT 'documents.is_archived', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='is_archived');

