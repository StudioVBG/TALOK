-- Migration: Ajout du statut 'phone_skipped' à identity_status_enum
-- Permet à un utilisateur de différer la vérification téléphone tout en
-- accédant aux pages standard du dashboard. Les actions sensibles
-- (signature de bail, paiements, etc.) restent gardées par les niveaux
-- supérieurs (document_uploaded, identity_verified).

ALTER TYPE identity_status_enum ADD VALUE IF NOT EXISTS 'phone_skipped' BEFORE 'phone_verified';
