-- =============================================
-- TENANT SELF-SERVICE : le locataire peut réserver directement
-- un prestataire pour certaines catégories, selon l'autorisation
-- donnée par le propriétaire dans le bail.
-- =============================================

-- 1. Autorisations de booking côté bail
-- Schéma JSONB :
--   {
--     "enabled": true,
--     "allowed_categories": ["jardinage", "nettoyage"],
--     "max_amount_cents": 20000,           -- plafond par intervention (null = illimité)
--     "requires_owner_approval": false     -- si true, owner doit valider avant que le provider soit notifié
--   }
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS tenant_service_bookings JSONB
  NOT NULL DEFAULT '{
    "enabled": false,
    "allowed_categories": [],
    "max_amount_cents": null,
    "requires_owner_approval": false
  }'::jsonb;

COMMENT ON COLUMN leases.tenant_service_bookings IS
  'Permissions self-service données au locataire (booking direct de prestataires) — config posée par le propriétaire à la signature du bail';

-- 2. Sur work_orders : savoir qui a demandé l'intervention
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS requester_role TEXT
  CHECK (requester_role IN ('owner', 'tenant', 'syndic', 'agency'));

COMMENT ON COLUMN work_orders.requester_role IS
  'Qui a initié cette intervention. tenant = parcours self-service, owner = flux classique.';

-- 3. Workflow d'approbation (utilisé seulement si le bail exige l'approbation)
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS owner_approval_status TEXT
  DEFAULT 'not_required'
  CHECK (owner_approval_status IN ('not_required', 'pending', 'approved', 'rejected'));

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS owner_approval_decided_at TIMESTAMPTZ;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS owner_approval_rejection_reason TEXT;

-- 4. Index pour la recherche tenant → providers par catégorie + département
CREATE INDEX IF NOT EXISTS idx_providers_marketplace_categories
  ON providers USING GIN (trade_categories)
  WHERE is_marketplace = true AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_providers_department_active
  ON providers (department)
  WHERE status = 'active';

-- 5. Index work_orders par demandeur (stats + filtrage UI)
CREATE INDEX IF NOT EXISTS idx_work_orders_requester_role
  ON work_orders (requester_role)
  WHERE requester_role IS NOT NULL;
