-- Migration : Rebranding global vers Talok
-- Date : 2026-01-07
-- Description : Met à jour les données de base (plans, providers, etc.) pour refléter le nouveau nom

BEGIN;

-- 1. Mise à jour des descriptions des plans d'abonnement
UPDATE subscription_plans 
SET description = REPLACE(description, 'la gestion locative', 'Talok')
WHERE description LIKE '%la gestion locative%';

UPDATE subscription_plans 
SET description = REPLACE(description, 'Gestion Locative', 'Talok')
WHERE description LIKE '%Gestion Locative%';

-- Mise à jour spécifique pour le plan gratuit si nécessaire
UPDATE subscription_plans 
SET description = 'Découvrez Talok et simplifiez la gestion de votre premier bien'
WHERE slug = 'gratuit';

-- 2. Mise à jour des métadonnées des providers API si nécessaire
-- (Par exemple, si des noms d'affichage par défaut étaient stockés en JSON)
UPDATE api_credentials
SET config = config || jsonb_build_object('email_from', REPLACE(config->>'email_from', 'Gestion Locative', 'Talok'))
WHERE config ? 'email_from' AND config->>'email_from' LIKE '%Gestion Locative%';

-- 3. Mise à jour des commentaires de table pour la cohérence
COMMENT ON TABLE subscription_plans IS 'Plans d''abonnement Talok';
COMMENT ON TABLE profiles IS 'Profils utilisateurs Talok';

-- 4. Nettoyage des anciennes références dans les fonctions si elles utilisaient le nom en dur
-- (Après vérification, la plupart utilisent des paramètres, mais on assure le coup pour les messages de log)

CREATE OR REPLACE FUNCTION create_owner_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Seulement pour les propriétaires
  IF NEW.role = 'owner' THEN
    -- Récupérer l'ID du plan gratuit (nouveau défaut)
    SELECT id INTO v_plan_id 
    FROM subscription_plans 
    WHERE slug = 'gratuit' 
    LIMIT 1;
    
    -- Fallback sur starter si gratuit n'existe pas
    IF v_plan_id IS NULL THEN
      SELECT id INTO v_plan_id 
      FROM subscription_plans 
      WHERE slug = 'starter' 
      LIMIT 1;
    END IF;
    
    -- Créer l'abonnement si le plan existe
    IF v_plan_id IS NOT NULL THEN
      INSERT INTO subscriptions (
        owner_id, 
        plan_id, 
        status, 
        billing_cycle, 
        current_period_start,
        current_period_end,
        properties_count,
        leases_count
      )
      VALUES (
        NEW.id,
        v_plan_id,
        'active',
        'monthly',
        NOW(),
        NOW() + INTERVAL '1 month',
        0,
        0
      )
      ON CONFLICT (owner_id) DO NOTHING;
      
      RAISE NOTICE 'Abonnement Talok Gratuit créé pour le propriétaire %', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

