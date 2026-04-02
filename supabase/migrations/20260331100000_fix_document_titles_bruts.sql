-- B7: Corriger les titres bruts des anciens documents
-- Remplacer les noms de fichiers (ex: "Capture_d_ecran_2024-03-15.png")
-- par des titres lisibles selon le type de document

UPDATE documents SET title = CASE
  WHEN type = 'cni_recto' THEN 'Carte d''Identité (Recto)'
  WHEN type = 'cni_verso' THEN 'Carte d''Identité (Verso)'
  WHEN type = 'assurance_habitation' THEN 'Attestation d''assurance habitation'
  WHEN type = 'contrat_bail' THEN 'Contrat de bail'
  WHEN type = 'quittance_loyer' THEN 'Quittance de loyer'
  WHEN type = 'bulletin_salaire' THEN 'Bulletin de salaire'
  WHEN type = 'avis_imposition' THEN 'Avis d''imposition'
  WHEN type = 'justificatif_domicile' THEN 'Justificatif de domicile'
  WHEN type = 'rib' THEN 'Relevé d''Identité Bancaire'
  WHEN type = 'kbis' THEN 'Extrait KBIS'
  WHEN type = 'attestation_assurance_rc' THEN 'Attestation assurance RC Pro'
  WHEN type = 'dpe' THEN 'Diagnostic de Performance Énergétique'
  WHEN type = 'edl_entree' THEN 'État des lieux d''entrée'
  WHEN type = 'edl_sortie' THEN 'État des lieux de sortie'
  WHEN type = 'mandat_gestion' THEN 'Mandat de gestion'
  WHEN type = 'reglement_copropriete' THEN 'Règlement de copropriété'
  ELSE title
END
WHERE (
  title IS NULL
  OR title ~ '^Capture d.écran'
  OR title ~ '^capture'
  OR title ~ '^Screenshot'
  OR title ~ '^IMG_'
  OR title ~ '^[A-Z_]{4,}$'
  OR title ~ '^\d{4}-\d{2}-\d{2}'
  OR title ~ '\.(png|jpg|jpeg|pdf|webp)$'
)
AND type IS NOT NULL;
