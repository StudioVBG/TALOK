-- =============================================================================
-- Migration : ajout du ciblage par territoire sur promo_codes
-- =============================================================================
-- Suite Option A (cf. AUDIT_ADMIN_PROMO_CODES.md) :
--  - eligible_territories TEXT[] : liste des territoires français éligibles
--    (slugs alignés sur lib/billing/tva.ts : metropole, martinique, guadeloupe,
--    reunion, guyane, mayotte). Vide = tous les territoires.
--  - Index GIN pour accélérer la validation territoire côté checkout.
--
-- Additive uniquement, aucune donnée à rétrocompatibiliser (table vide).
-- =============================================================================

ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS eligible_territories TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.promo_codes.eligible_territories IS
  'Territoires éligibles (slugs lib/billing/tva.ts : metropole, martinique,
   guadeloupe, reunion, guyane, mayotte). Tableau vide = tous les territoires.';

-- CHECK : chaque élément doit être un slug de territoire valide.
-- Utilise un sous-SELECT (UNNEST) via une contrainte nommée pour rejeter
-- un tableau contenant une valeur inconnue.
ALTER TABLE public.promo_codes
  DROP CONSTRAINT IF EXISTS promo_codes_eligible_territories_valid;
ALTER TABLE public.promo_codes
  ADD CONSTRAINT promo_codes_eligible_territories_valid
  CHECK (
    eligible_territories <@ ARRAY[
      'metropole',
      'martinique',
      'guadeloupe',
      'reunion',
      'guyane',
      'mayotte'
    ]::TEXT[]
  );

-- Index GIN pour les requêtes de type `WHERE eligible_territories @> ARRAY['martinique']`
CREATE INDEX IF NOT EXISTS idx_promo_codes_territories
  ON public.promo_codes USING GIN (eligible_territories);

-- =============================================================================
-- Trigger : incrémentation automatique de promo_codes.uses_count
-- =============================================================================
-- Source de vérité = nombre de lignes promo_code_uses. Le cache
-- uses_count est maintenu par ce trigger pour éviter une agrégation
-- COUNT(*) à chaque fois qu'on affiche la colonne « 12/100 utilisations ».
--
-- Atomique : l'UPDATE a lieu dans la même transaction que l'INSERT.
-- Pas de race : chaque INSERT incrémente de 1, PostgreSQL sérialise
-- les UPDATE sur la même ligne.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.increment_promo_code_uses()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.promo_codes
     SET uses_count = uses_count + 1,
         updated_at = NOW()
   WHERE id = NEW.promo_code_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promo_code_uses_increment ON public.promo_code_uses;
CREATE TRIGGER trg_promo_code_uses_increment
  AFTER INSERT ON public.promo_code_uses
  FOR EACH ROW EXECUTE FUNCTION public.increment_promo_code_uses();

COMMENT ON FUNCTION public.increment_promo_code_uses() IS
  'Maintient promo_codes.uses_count en cache à chaque INSERT dans
   promo_code_uses. Source de vérité = COUNT(*) FROM promo_code_uses.';
