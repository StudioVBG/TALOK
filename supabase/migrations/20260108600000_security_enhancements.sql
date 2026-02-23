-- ============================================
-- MIGRATION: Améliorations de sécurité SOTA 2026
-- ============================================
-- 
-- Cette migration ajoute:
-- 1. Colonnes pour IBAN chiffré dans owner_profiles
-- 2. Table audit_log améliorée avec niveaux de risque
-- 3. Contraintes 2FA pour les rôles sensibles
-- 4. Index pour les recherches sécurisées
--
-- Date: 2026-01-08
-- Auteur: Security Enhancement
-- ============================================

-- ============================================
-- 1. IBAN CHIFFRÉ POUR PROPRIÉTAIRES
-- ============================================

-- Ajouter colonnes pour IBAN chiffré
ALTER TABLE owner_profiles
  ADD COLUMN IF NOT EXISTS iban_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS iban_hash TEXT,
  ADD COLUMN IF NOT EXISTS iban_last4 TEXT;

-- Index pour recherche par hash (sans déchiffrement)
CREATE INDEX IF NOT EXISTS idx_owner_profiles_iban_hash 
  ON owner_profiles(iban_hash);

-- Commentaires de documentation
COMMENT ON COLUMN owner_profiles.iban_encrypted IS 'IBAN chiffré avec AES-256-GCM (format: iv:tag:ciphertext)';
COMMENT ON COLUMN owner_profiles.iban_hash IS 'Hash SHA-256 de l''IBAN normalisé pour recherche';
COMMENT ON COLUMN owner_profiles.iban_last4 IS '4 derniers caractères de l''IBAN pour affichage';

-- ============================================
-- 2. TABLE AUDIT_LOG AMÉLIORÉE
-- ============================================

-- Créer ou recréer la table audit_log avec tous les champs
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  profile_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  ip_address INET,
  user_agent TEXT,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  metadata JSONB DEFAULT '{}'::jsonb,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ajouter les colonnes manquantes si la table existait déjà
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS profile_id UUID;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'low';
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT true;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON audit_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_risk_level ON audit_log(risk_level);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- Index composite pour recherches combinées
CREATE INDEX IF NOT EXISTS idx_audit_log_user_action 
  ON audit_log(user_id, action, created_at DESC);

-- Partitionnement mensuel recommandé pour les logs volumineux
-- (À activer en production si volume > 1M lignes/mois)

-- Commentaires
COMMENT ON TABLE audit_log IS 'Journal d''audit pour traçabilité des accès aux données sensibles (RGPD Art. 30)';
COMMENT ON COLUMN audit_log.risk_level IS 'Niveau de risque: low, medium, high, critical';
COMMENT ON COLUMN audit_log.metadata IS 'Données contextuelles additionnelles (JSON)';

-- ============================================
-- 3. COLONNES 2FA AMÉLIORÉES
-- ============================================

-- S'assurer que les colonnes 2FA existent
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_factor_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[],
  ADD COLUMN IF NOT EXISTS last_2fa_verified_at TIMESTAMPTZ;

-- Index pour requêtes 2FA
CREATE INDEX IF NOT EXISTS idx_profiles_2fa_required 
  ON profiles(two_factor_required) WHERE two_factor_required = true;

-- Commentaires
COMMENT ON COLUMN profiles.two_factor_required IS 'Si true, l''utilisateur DOIT activer le 2FA';
COMMENT ON COLUMN profiles.two_factor_backup_codes IS 'Codes de secours chiffrés pour récupération 2FA';
COMMENT ON COLUMN profiles.last_2fa_verified_at IS 'Dernière vérification 2FA réussie';

-- ============================================
-- 4. FONCTION: FORCER 2FA POUR ADMINS
-- ============================================

-- Trigger pour forcer 2FA sur les admins
CREATE OR REPLACE FUNCTION enforce_2fa_for_sensitive_roles()
RETURNS TRIGGER AS $$
BEGIN
  -- Les admins doivent avoir 2FA requis
  IF NEW.role = 'admin' THEN
    NEW.two_factor_required := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger si non existant
DROP TRIGGER IF EXISTS trigger_enforce_2fa_sensitive_roles ON profiles;
CREATE TRIGGER trigger_enforce_2fa_sensitive_roles
  BEFORE INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_2fa_for_sensitive_roles();

-- ============================================
-- 5. FONCTION: FORCER 2FA POUR GROS COMPTES
-- ============================================

-- Fonction pour vérifier et activer 2FA requis pour les gros propriétaires
CREATE OR REPLACE FUNCTION check_2fa_requirement_for_property_count()
RETURNS TRIGGER AS $$
DECLARE
  property_count INTEGER;
  owner_profile_id UUID;
BEGIN
  -- Récupérer le profile_id du propriétaire
  owner_profile_id := NEW.owner_id;
  
  -- Compter les biens de ce propriétaire
  SELECT COUNT(*) INTO property_count
  FROM properties
  WHERE owner_id = owner_profile_id
    AND deleted_at IS NULL;
  
  -- Si plus de 5 biens, forcer le 2FA
  IF property_count >= 5 THEN
    UPDATE profiles
    SET two_factor_required = true
    WHERE id = owner_profile_id
      AND two_factor_required = false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur ajout de propriété
DROP TRIGGER IF EXISTS trigger_check_2fa_on_property_add ON properties;
CREATE TRIGGER trigger_check_2fa_on_property_add
  AFTER INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION check_2fa_requirement_for_property_count();

-- ============================================
-- 6. RLS POUR AUDIT_LOG
-- ============================================

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent lire les logs d'audit
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_log;
CREATE POLICY "Admins can view all audit logs"
  ON audit_log FOR SELECT
  USING (public.user_role() = 'admin');

-- Les utilisateurs peuvent voir leurs propres logs
CREATE POLICY "Users can view own audit logs"
  ON audit_log FOR SELECT
  USING (user_id = auth.uid());

-- Seul le système peut insérer (via service role)
CREATE POLICY "System can insert audit logs"
  ON audit_log FOR INSERT
  WITH CHECK (true); -- Le service role bypasse RLS

-- ============================================
-- 7. TABLE POUR SESSIONS 2FA
-- ============================================

CREATE TABLE IF NOT EXISTS two_factor_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_2fa_sessions_user_id 
  ON two_factor_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_2fa_sessions_expires_at 
  ON two_factor_sessions(expires_at);

-- Nettoyage automatique des sessions expirées
CREATE OR REPLACE FUNCTION cleanup_expired_2fa_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM two_factor_sessions
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. MIGRATION DES IBAN EXISTANTS
-- ============================================

-- Note: Cette étape doit être exécutée via un script applicatif
-- pour chiffrer les IBAN existants. Voir: scripts/migrate-iban-encryption.ts

-- Marquer les IBAN non migrés
-- UPDATE owner_profiles 
-- SET iban_encrypted = NULL, iban_hash = NULL, iban_last4 = NULL
-- WHERE iban IS NOT NULL AND iban_encrypted IS NULL;

-- ============================================
-- 9. CONTRAINTES SUPPLÉMENTAIRES
-- ============================================

-- Empêcher la désactivation du 2FA pour les comptes qui le requièrent
CREATE OR REPLACE FUNCTION prevent_2fa_disable_if_required()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.two_factor_required = true AND NEW.two_factor_enabled = false AND OLD.two_factor_enabled = true THEN
    RAISE EXCEPTION 'Impossible de désactiver le 2FA car il est requis pour ce compte';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_2fa_disable ON profiles;
CREATE TRIGGER trigger_prevent_2fa_disable
  BEFORE UPDATE OF two_factor_enabled ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_2fa_disable_if_required();

-- ============================================
-- 10. VUE POUR MONITORING SÉCURITÉ
-- ============================================

CREATE OR REPLACE VIEW security_dashboard AS
SELECT 
  COUNT(*) FILTER (WHERE risk_level = 'critical' AND created_at > NOW() - INTERVAL '24 hours') as critical_events_24h,
  COUNT(*) FILTER (WHERE risk_level = 'high' AND created_at > NOW() - INTERVAL '24 hours') as high_events_24h,
  COUNT(*) FILTER (WHERE action = 'failed_login' AND created_at > NOW() - INTERVAL '1 hour') as failed_logins_1h,
  COUNT(*) FILTER (WHERE entity_type = 'iban' AND action = 'decrypt' AND created_at > NOW() - INTERVAL '24 hours') as iban_decrypts_24h,
  COUNT(DISTINCT user_id) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as active_users_24h
FROM audit_log;

COMMENT ON VIEW security_dashboard IS 'Vue récapitulative pour le monitoring de sécurité';

-- ============================================
-- FIN DE LA MIGRATION
-- ============================================

-- Log de fin
DO $$
BEGIN
  RAISE NOTICE 'Migration 20260108600000_security_enhancements terminée avec succès';
END $$;

