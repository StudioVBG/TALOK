-- =============================================
-- TICKETS / WORK_ORDERS : classification "charges récupérables"
-- (décret 87-713 du 26 août 1987)
-- =============================================
-- Ajoute 2 colonnes qui permettront à terme d'imputer automatiquement
-- le coût d'une intervention au locataire (charge récupérable) ou
-- au propriétaire (non récupérable), puis de générer les entrées
-- correspondantes dans le système canonique de régularisation
-- (lease_charge_regularizations / charge_entries).
--
-- Cette migration pose UNIQUEMENT la structure + une suggestion par
-- défaut à la création. L'écriture dans charge_entries est traitée
-- dans un commit séparé (étape 2 de la feuille de route).

-- 1. Tickets : classification suggérée à la création (modifiable par owner)
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS is_tenant_chargeable BOOLEAN;
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS charge_category_code TEXT;

COMMENT ON COLUMN tickets.is_tenant_chargeable IS
  'Le coût de cette intervention est-il récupérable auprès du locataire (décret 87-713) ? NULL = à décider par le propriétaire.';
COMMENT ON COLUMN tickets.charge_category_code IS
  'Code de la catégorie canonique (charge_categories.code) : ascenseurs, eau_chauffage, installations_individuelles, parties_communes, espaces_exterieurs, taxes_redevances. NULL si non récupérable.';

-- 2. Work orders : même logique, c'est lui qui porte le paiement et donc
--    la source de l'écriture comptable à venir.
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS is_tenant_chargeable BOOLEAN;
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS charge_category_code TEXT;

COMMENT ON COLUMN work_orders.is_tenant_chargeable IS
  'Récupérable auprès du locataire ? Hérité du ticket par défaut, modifiable par owner. Utilisé à la clôture pour injecter la dépense dans la régularisation annuelle.';
COMMENT ON COLUMN work_orders.charge_category_code IS
  'Catégorie canonique décret 87-713 (voir tickets.charge_category_code).';

-- 3. FK souple : on référence charge_categories.code quand il est posé,
--    mais NULL reste autorisé (ticket non classifié). Index btree pour les
--    requêtes de reporting "charges récupérables sur la période X".
CREATE INDEX IF NOT EXISTS idx_tickets_chargeable
  ON tickets (is_tenant_chargeable)
  WHERE is_tenant_chargeable IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_orders_chargeable
  ON work_orders (is_tenant_chargeable)
  WHERE is_tenant_chargeable IS NOT NULL;

-- 4. Contrainte cohérence : si charge_category_code est posé et non NULL,
--    il doit correspondre à une catégorie connue. Pas de FK stricte pour
--    ne pas bloquer si charge_categories.code évolue, mais un CHECK sur
--    la liste des 6 valeurs canoniques.
ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_charge_category_check;
ALTER TABLE tickets
  ADD CONSTRAINT tickets_charge_category_check
  CHECK (
    charge_category_code IS NULL OR charge_category_code IN (
      'ascenseurs', 'eau_chauffage', 'installations_individuelles',
      'parties_communes', 'espaces_exterieurs', 'taxes_redevances'
    )
  );

ALTER TABLE work_orders
  DROP CONSTRAINT IF EXISTS work_orders_charge_category_check;
ALTER TABLE work_orders
  ADD CONSTRAINT work_orders_charge_category_check
  CHECK (
    charge_category_code IS NULL OR charge_category_code IN (
      'ascenseurs', 'eau_chauffage', 'installations_individuelles',
      'parties_communes', 'espaces_exterieurs', 'taxes_redevances'
    )
  );
