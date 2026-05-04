-- =====================================================
-- Synchronisation provider_profiles.type_services
-- → providers.trade_categories
--
-- Contexte : un prestataire Talok possède une ligne
-- provider_profiles (compte legacy, alimenté par l'UI
-- /provider/settings et l'onboarding services) et,
-- s'il a complété l'étape Profile, une ligne providers
-- (table SOTA 2026 alimentée via /api/provider/legal-identity).
--
-- Les services sont édités côté provider_profiles.type_services
-- mais lus côté providers.trade_categories (marketplace,
-- carnet d'adresses owner, work_orders). Ce trigger maintient
-- les deux colonnes alignées.
--
-- Ne crée PAS de ligne providers si elle n'existe pas — la
-- création reste explicite via /api/provider/legal-identity
-- pour garantir les données INSEE.
-- =====================================================

CREATE OR REPLACE FUNCTION public.sync_provider_trade_categories()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type_services IS DISTINCT FROM COALESCE(OLD.type_services, ARRAY[]::text[]) THEN
    UPDATE providers
       SET trade_categories = NEW.type_services,
           updated_at       = now()
     WHERE profile_id = NEW.profile_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_provider_trade_categories ON provider_profiles;

CREATE TRIGGER trg_sync_provider_trade_categories
  AFTER INSERT OR UPDATE OF type_services ON provider_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_provider_trade_categories();

-- Backfill ponctuel : aligner les lignes existantes
UPDATE providers p
   SET trade_categories = pp.type_services,
       updated_at       = now()
  FROM provider_profiles pp
 WHERE pp.profile_id = p.profile_id
   AND p.trade_categories IS DISTINCT FROM pp.type_services
   AND COALESCE(array_length(pp.type_services, 1), 0) > 0;
