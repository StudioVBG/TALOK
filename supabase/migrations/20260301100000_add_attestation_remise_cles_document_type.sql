-- Migration: Ajouter le type 'attestation_remise_cles' au CHECK constraint documents.type
-- Requis pour la fonctionnalité de remise des clés digitale (QR code)
-- Le workflow key-handover/confirm insère un document de type 'attestation_remise_cles'

-- Supprimer l'ancien constraint
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;

-- Recréer avec le nouveau type ajouté
ALTER TABLE documents ADD CONSTRAINT documents_type_check CHECK (
  type IN (
    -- Contrats
    'bail', 'avenant', 'engagement_garant', 'bail_signe_locataire', 'bail_signe_proprietaire',
    -- Identité
    'piece_identite', 'cni_recto', 'cni_verso', 'passeport', 'titre_sejour',
    -- Finance
    'quittance', 'facture', 'rib', 'avis_imposition', 'bulletin_paie', 'attestation_loyer',
    -- Assurance
    'attestation_assurance', 'assurance_pno',
    -- Diagnostics
    'diagnostic', 'dpe', 'diagnostic_gaz', 'diagnostic_electricite',
    'diagnostic_plomb', 'diagnostic_amiante', 'diagnostic_termites', 'erp',
    -- États des lieux
    'EDL_entree', 'EDL_sortie', 'inventaire',
    -- Remise des clés
    'attestation_remise_cles',
    -- Candidature (migrés depuis application_files)
    'candidature_identite', 'candidature_revenus', 'candidature_domicile', 'candidature_garantie',
    -- Garant (migrés depuis guarantor_documents)
    'garant_identite', 'garant_revenus', 'garant_domicile', 'garant_engagement',
    -- Prestataire
    'devis', 'ordre_mission', 'rapport_intervention',
    -- Copropriété
    'taxe_fonciere', 'taxe_sejour', 'copropriete', 'proces_verbal', 'appel_fonds',
    -- Divers
    'consentement', 'courrier', 'photo', 'justificatif_revenus', 'autre'
  )
);

COMMENT ON CONSTRAINT documents_type_check ON documents IS 'Types de documents autorisés — inclut attestation_remise_cles (remise des clés digitale)';
