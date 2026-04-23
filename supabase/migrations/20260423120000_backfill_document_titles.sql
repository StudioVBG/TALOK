-- Backfill des titres de documents historiques.
--
-- Contexte : les anciens uploads n'ont jamais rempli `documents.title` correctement
-- (soit NULL, soit le filename brut "Capture d'écran 2026-02-26 à 20.xx.xx"), ce qui
-- entraîne l'affichage fallback "Document" dans l'UI locataire/proprio.
--
-- Cette migration ne modifie QUE les lignes dont le titre actuel est manifestement
-- brut/sans valeur (NULL, filename de capture d'écran, TYPE uppercase, date ISO),
-- et n'écrase jamais un titre déjà sensé.
--
-- Source canonique des libellés : lib/documents/constants.ts (TYPE_TO_LABEL).

UPDATE documents SET
  title = CASE
    WHEN type = 'cni_recto' THEN 'Carte d''identité (recto)'
    WHEN type = 'cni_verso' THEN 'Carte d''identité (verso)'
    WHEN type = 'piece_identite' THEN 'Pièce d''identité'
    WHEN type = 'passeport' THEN 'Passeport'
    WHEN type = 'titre_sejour' THEN 'Titre de séjour'
    WHEN type IN ('attestation_assurance', 'assurance_pno', 'assurance') THEN 'Attestation d''assurance'
    WHEN type = 'assurance_gli' THEN 'Assurance GLI'
    WHEN type IN ('bail', 'bail_signe_locataire', 'bail_signe_proprietaire', 'bail_signe', 'contrat_bail', 'lease', 'contrat') THEN 'Contrat de bail'
    WHEN type = 'avenant' THEN 'Avenant au bail'
    WHEN type = 'engagement_garant' THEN 'Engagement de caution'
    WHEN type IN ('EDL_entree', 'edl_entree', 'edl') THEN 'État des lieux d''entrée'
    WHEN type IN ('EDL_sortie', 'edl_sortie') THEN 'État des lieux de sortie'
    WHEN type = 'inventaire' THEN 'Inventaire mobilier'
    WHEN type IN ('quittance', 'quittance_loyer', 'receipt') THEN 'Quittance de loyer'
    WHEN type = 'attestation_loyer' THEN 'Attestation de loyer'
    WHEN type = 'facture' THEN 'Facture'
    WHEN type = 'rib' THEN 'RIB'
    WHEN type = 'avis_imposition' THEN 'Avis d''imposition'
    WHEN type = 'bulletin_paie' THEN 'Bulletin de paie'
    WHEN type = 'justificatif_revenus' THEN 'Justificatif de revenus'
    WHEN type = 'dpe' THEN 'Diagnostic de performance énergétique'
    WHEN type = 'erp' THEN 'État des risques (ERP)'
    WHEN type = 'diagnostic_gaz' THEN 'Diagnostic gaz'
    WHEN type = 'diagnostic_electricite' THEN 'Diagnostic électricité'
    WHEN type = 'diagnostic_plomb' THEN 'Diagnostic plomb'
    WHEN type = 'diagnostic_amiante' THEN 'Diagnostic amiante'
    WHEN type = 'diagnostic_termites' THEN 'Diagnostic termites'
    WHEN type = 'attestation_remise_cles' THEN 'Attestation de remise des clés'
    WHEN type = 'taxe_fonciere' THEN 'Taxe foncière'
    WHEN type = 'proces_verbal' THEN 'Procès-verbal d''AG'
    WHEN type = 'convocation_ag' THEN 'Convocation d''assemblée générale'
    WHEN type = 'appel_fonds' THEN 'Appel de fonds'
    WHEN type = 'regularisation_charges' THEN 'Régularisation de charges'
    WHEN type = 'reglement_copropriete' THEN 'Règlement de copropriété'
    ELSE title
  END
WHERE type IS NOT NULL
  AND type <> 'autre'
  AND (
    title IS NULL
    OR title = ''
    OR title = 'Document'
    OR title ~ '^Capture d.écran'           -- "Capture d'écran 2026-02-26 à 20.xx"
    OR title ~ '^[A-Z_]{3,}$'                -- "EDL_ENTREE", "CONTRAT_BAIL"
    OR title ~ '^\d{4}-\d{2}-\d{2}'          -- "2026-02-26 quelque chose"
    OR title ~ '^IMG_\d+'                    -- "IMG_20260226_200000"
    OR title ~ '^\d{8}_'                     -- "20260226_quelquechose"
    OR title ~ '^u\d+_'                      -- "u4725513253_file.pdf"
  );
