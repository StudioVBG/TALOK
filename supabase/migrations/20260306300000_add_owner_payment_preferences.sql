-- Migration : Ajouter les colonnes de préférences financières et d'automatisation au profil propriétaire
-- Ces colonnes étaient précédemment stockées uniquement dans le brouillon d'onboarding et perdues après

-- Préférences d'encaissement et de versement
ALTER TABLE owner_profiles
  ADD COLUMN IF NOT EXISTS encaissement_prefere TEXT DEFAULT 'sepa_sdd'
    CHECK (encaissement_prefere IN ('sepa_sdd', 'virement_sct', 'virement_inst', 'pay_by_bank', 'carte_wallet')),
  ADD COLUMN IF NOT EXISTS payout_frequence TEXT DEFAULT 'immediat'
    CHECK (payout_frequence IN ('immediat', 'hebdo', 'mensuel', 'seuil')),
  ADD COLUMN IF NOT EXISTS payout_rail TEXT DEFAULT 'sct'
    CHECK (payout_rail IN ('sct', 'sct_inst')),
  ADD COLUMN IF NOT EXISTS payout_seuil NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_jour INTEGER DEFAULT 1
    CHECK (payout_jour >= 1 AND payout_jour <= 28);

-- Niveau d'automatisation
ALTER TABLE owner_profiles
  ADD COLUMN IF NOT EXISTS automation_level TEXT DEFAULT 'standard'
    CHECK (automation_level IN ('basique', 'standard', 'pro', 'autopilot'));

COMMENT ON COLUMN owner_profiles.encaissement_prefere IS 'Mode d''encaissement préféré (SEPA, virement, carte, etc.)';
COMMENT ON COLUMN owner_profiles.payout_frequence IS 'Fréquence de versement des fonds au propriétaire';
COMMENT ON COLUMN owner_profiles.payout_rail IS 'Rail de versement (SCT standard ou instantané)';
COMMENT ON COLUMN owner_profiles.payout_seuil IS 'Seuil de déclenchement du versement (si fréquence = seuil)';
COMMENT ON COLUMN owner_profiles.payout_jour IS 'Jour du mois pour le versement (si fréquence = mensuel)';
COMMENT ON COLUMN owner_profiles.automation_level IS 'Niveau d''automatisation choisi par le propriétaire';
