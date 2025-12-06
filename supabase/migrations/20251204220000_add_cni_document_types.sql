-- Migration : Ajouter les types de documents CNI
-- Date : 2025-12-04
-- 
-- Ajoute les types cni_recto, cni_verso, bail_signe_locataire à la contrainte

-- Supprimer l'ancienne contrainte
ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS documents_type_check;

-- Recréer avec les nouveaux types
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

-- Commenter pour documentation
COMMENT ON CONSTRAINT documents_type_check ON documents 
  IS 'Types de documents autorisés incluant CNI et documents de signature';

