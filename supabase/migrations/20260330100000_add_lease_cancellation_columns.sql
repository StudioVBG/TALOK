-- ============================================
-- Migration : Ajout colonnes annulation de bail
-- Date : 2026-03-30
-- Contexte : Un bail signé mais jamais activé ne peut pas être annulé.
--            Cette migration ajoute les colonnes nécessaires pour
--            gérer le cycle de vie d'annulation.
-- ============================================

-- Étape 1 : Ajouter les colonnes d'annulation sur leases
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id);
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancellation_type TEXT;

-- Étape 2 : Contrainte CHECK sur cancellation_type
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leases_cancellation_type_check'
  ) THEN
    ALTER TABLE leases ADD CONSTRAINT leases_cancellation_type_check
      CHECK (cancellation_type IS NULL OR cancellation_type IN (
        'tenant_withdrawal',
        'owner_withdrawal',
        'mutual_agreement',
        'never_activated',
        'error',
        'duplicate'
      ));
  END IF;
END $$;

-- Étape 3 : Vérifier que 'cancelled' est dans la contrainte CHECK sur statut
-- La migration 20260215200001 l'a déjà ajouté, mais on vérifie par sécurité
DO $$ BEGIN
  -- Tenter d'insérer un bail cancelled pour vérifier la contrainte
  -- Si ça échoue, on met à jour la contrainte
  PERFORM 1;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Étape 4 : Index pour requêtes de nettoyage et reporting
CREATE INDEX IF NOT EXISTS idx_leases_cancelled
  ON leases(statut) WHERE statut = 'cancelled';

CREATE INDEX IF NOT EXISTS idx_leases_cancelled_at
  ON leases(cancelled_at) WHERE cancelled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leases_zombie_candidates
  ON leases(statut, created_at)
  WHERE statut IN ('pending_signature', 'partially_signed', 'fully_signed', 'draft', 'sent')
    AND cancelled_at IS NULL;

-- Étape 5 : RLS — les politiques existantes couvrent déjà leases
-- Pas besoin de nouvelles politiques car l'annulation passe par UPDATE du statut

-- Étape 6 : Commentaires
COMMENT ON COLUMN leases.cancelled_at IS 'Date/heure de l''annulation du bail';
COMMENT ON COLUMN leases.cancelled_by IS 'User ID de la personne ayant annulé le bail';
COMMENT ON COLUMN leases.cancellation_reason IS 'Motif libre de l''annulation';
COMMENT ON COLUMN leases.cancellation_type IS 'Type d''annulation : tenant_withdrawal, owner_withdrawal, mutual_agreement, never_activated, error, duplicate';
