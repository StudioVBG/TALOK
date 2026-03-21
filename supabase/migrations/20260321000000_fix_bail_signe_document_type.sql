-- ============================================
-- Migration: Ajouter le type 'bail_signe' aux documents
-- Date: 2026-03-21
-- ============================================
-- Le code (seal route, lease-post-signature) insère des documents avec
-- type = 'bail_signe', mais la contrainte CHECK ne le permet pas.
-- Cela provoque un échec silencieux lors de l'insertion du document
-- après scellement du bail.
-- ============================================

-- Supprimer l'ancienne contrainte
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;

-- Recréer avec 'bail_signe' ajouté
ALTER TABLE documents ADD CONSTRAINT documents_type_check CHECK (
  type IN (
    -- Contrats
    'bail', 'avenant', 'engagement_garant', 'bail_signe', 'bail_signe_locataire', 'bail_signe_proprietaire',
    -- Identité
    'piece_identite', 'cni_recto', 'cni_verso', 'passeport', 'titre_sejour',
    -- Finance
    'quittance', 'facture', 'rib', 'avis_imposition', 'bulletin_paie', 'attestation_loyer',
    -- Assurance
    'attestation_assurance', 'assurance_pno',
    -- Diagnostics
    'diagnostic', 'dpe', 'diagnostic_gaz', 'diagnostic_electricite',
    'diagnostic_plomb', 'diagnostic_amiante', 'diagnostic_termites', 'erp',
    'diagnostic_performance', 'crep', 'plomb', 'electricite', 'gaz', 'risques', 'amiante', 'bruit',
    -- États des lieux
    'EDL_entree', 'EDL_sortie', 'inventaire',
    -- Candidature
    'candidature_identite', 'candidature_revenus', 'candidature_domicile', 'candidature_garantie',
    -- Garant
    'garant_identite', 'garant_revenus', 'garant_domicile', 'garant_engagement',
    -- Prestataire
    'devis', 'ordre_mission', 'rapport_intervention',
    -- Copropriété
    'taxe_fonciere', 'taxe_sejour', 'copropriete', 'proces_verbal', 'appel_fonds',
    -- Divers
    'consentement', 'courrier', 'photo', 'justificatif_revenus', 'autre'
  )
);

COMMENT ON CONSTRAINT documents_type_check ON documents
  IS 'Types de documents autorisés — inclut bail_signe pour les baux scellés et les types diagnostics étendus';
