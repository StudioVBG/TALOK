-- ====================================================================
-- Sprint B2 — Phase 3 DANGEREUX — Batch 6/11
-- 5 migrations
--
-- COMMENT UTILISER :
--   1. Ouvrir Supabase Dashboard → SQL Editor → New query
--   2. Coller CE FICHIER ENTIER
--   3. Cliquer Run
--   4. Vérifier que les messages NOTICE affichent toutes les migrations en succès
--   5. Signaler "suivant" pour recevoir le batch suivant
--
-- En cas d'échec : toute la transaction est rollback. Le message d'erreur indique
-- la migration fautive. Corriger manuellement puis re-coller ce batch.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- Migration: 20260408120000_colocation_module.sql
-- Note: file on disk is 20260408120000_colocation_module.sql but will be renamed to 20260408120001_colocation_module.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on,on,on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260408120000_colocation_module.sql'; END $pre$;

-- ============================================================
-- Migration: Module Colocation SOTA 2026
-- Tables: colocation_rooms, colocation_members, colocation_rules,
--         colocation_tasks, colocation_expenses
-- View:   v_colocation_balances
-- Alters: properties, leases
-- ============================================================

-- ============================================================
-- 1. Alter existing tables
-- ============================================================

ALTER TABLE properties ADD COLUMN IF NOT EXISTS
  colocation_type TEXT CHECK (colocation_type IN ('bail_unique', 'baux_individuels'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS
  has_solidarity_clause BOOLEAN DEFAULT true;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS
  max_colocataires INTEGER;

ALTER TABLE leases ADD COLUMN IF NOT EXISTS
  is_colocation BOOLEAN DEFAULT false;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS
  colocation_type TEXT CHECK (colocation_type IN ('bail_unique', 'baux_individuels'));
ALTER TABLE leases ADD COLUMN IF NOT EXISTS
  solidarity_clause BOOLEAN DEFAULT false;

-- ============================================================
-- 2. Chambres d'une colocation
-- ============================================================

CREATE TABLE IF NOT EXISTS colocation_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  room_label TEXT,
  surface_m2 NUMERIC(6,2),
  rent_share_cents INTEGER NOT NULL,
  charges_share_cents INTEGER DEFAULT 0,
  is_furnished BOOLEAN DEFAULT false,
  description TEXT,
  photos JSONB DEFAULT '[]',
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, room_number)
);

ALTER TABLE colocation_rooms ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coloc_rooms_property ON colocation_rooms(property_id);

-- RLS: owner can manage rooms, tenant can read rooms of their property
DROP POLICY IF EXISTS coloc_rooms_owner_all ON colocation_rooms;
CREATE POLICY coloc_rooms_owner_all ON colocation_rooms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = colocation_rooms.property_id
        AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS coloc_rooms_tenant_select ON colocation_rooms;
CREATE POLICY coloc_rooms_tenant_select ON colocation_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE l.property_id = colocation_rooms.property_id
        AND pr.user_id = auth.uid()
        AND l.statut IN ('active', 'pending')
    )
  );

-- ============================================================
-- 3. Membres d'une colocation
-- ============================================================

CREATE TABLE IF NOT EXISTS colocation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  room_id UUID REFERENCES colocation_rooms(id),
  lease_id UUID NOT NULL REFERENCES leases(id),
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id),

  -- Statut
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'departing', 'departed')),

  -- Dates
  move_in_date DATE NOT NULL,
  move_out_date DATE,
  notice_given_at TIMESTAMPTZ,
  notice_effective_date DATE,
  solidarity_end_date DATE,

  -- Financier
  rent_share_cents INTEGER NOT NULL,
  charges_share_cents INTEGER DEFAULT 0,
  deposit_cents INTEGER DEFAULT 0,
  deposit_returned BOOLEAN DEFAULT false,

  -- Paiement SEPA
  stripe_payment_method_id TEXT,
  pays_individually BOOLEAN DEFAULT false,

  -- Remplacement
  replaced_by_member_id UUID REFERENCES colocation_members(id),
  replaces_member_id UUID REFERENCES colocation_members(id),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE colocation_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coloc_members_property ON colocation_members(property_id);
CREATE INDEX IF NOT EXISTS idx_coloc_members_lease ON colocation_members(lease_id);
CREATE INDEX IF NOT EXISTS idx_coloc_members_tenant ON colocation_members(tenant_profile_id);
CREATE INDEX IF NOT EXISTS idx_coloc_members_status ON colocation_members(status) WHERE status = 'active';

-- RLS: owner can manage members
DROP POLICY IF EXISTS coloc_members_owner_all ON colocation_members;
CREATE POLICY coloc_members_owner_all ON colocation_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = colocation_members.property_id
        AND pr.user_id = auth.uid()
    )
  );

-- RLS: tenant can read members of their colocation
DROP POLICY IF EXISTS coloc_members_tenant_select ON colocation_members;
CREATE POLICY coloc_members_tenant_select ON colocation_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM colocation_members cm2
      WHERE cm2.property_id = colocation_members.property_id
        AND cm2.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm2.status IN ('active', 'departing')
    )
  );

-- ============================================================
-- 4. Reglement interieur
-- ============================================================

CREATE TABLE IF NOT EXISTS colocation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'menage', 'bruit', 'invites', 'animaux',
                        'espaces_communs', 'charges', 'autre')),
  description TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE colocation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coloc_rules_owner_all ON colocation_rules;
CREATE POLICY coloc_rules_owner_all ON colocation_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = colocation_rules.property_id
        AND pr.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS coloc_rules_tenant_select ON colocation_rules;
CREATE POLICY coloc_rules_tenant_select ON colocation_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM colocation_members cm
      WHERE cm.property_id = colocation_rules.property_id
        AND cm.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm.status IN ('active', 'departing')
    )
  );

-- ============================================================
-- 5. Planning taches partagees
-- ============================================================

CREATE TABLE IF NOT EXISTS colocation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  recurrence TEXT DEFAULT 'weekly'
    CHECK (recurrence IN ('daily', 'weekly', 'biweekly', 'monthly')),
  assigned_member_id UUID REFERENCES colocation_members(id),
  assigned_room_id UUID REFERENCES colocation_rooms(id),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  rotation_enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE colocation_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coloc_tasks_owner_all ON colocation_tasks;
CREATE POLICY coloc_tasks_owner_all ON colocation_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = colocation_tasks.property_id
        AND pr.user_id = auth.uid()
    )
  );

-- Tenants can read and update tasks (mark as completed)
DROP POLICY IF EXISTS coloc_tasks_tenant_select ON colocation_tasks;
CREATE POLICY coloc_tasks_tenant_select ON colocation_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM colocation_members cm
      WHERE cm.property_id = colocation_tasks.property_id
        AND cm.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm.status IN ('active', 'departing')
    )
  );

DROP POLICY IF EXISTS coloc_tasks_tenant_update ON colocation_tasks;
CREATE POLICY coloc_tasks_tenant_update ON colocation_tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM colocation_members cm
      WHERE cm.property_id = colocation_tasks.property_id
        AND cm.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm.status = 'active'
    )
  );

-- ============================================================
-- 6. Depenses partagees entre colocataires
-- ============================================================

CREATE TABLE IF NOT EXISTS colocation_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  paid_by_member_id UUID NOT NULL REFERENCES colocation_members(id),
  title TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  category TEXT DEFAULT 'autre'
    CHECK (category IN ('menage', 'courses', 'internet', 'electricite',
                        'eau', 'reparation', 'autre')),
  split_type TEXT DEFAULT 'equal'
    CHECK (split_type IN ('equal', 'by_room', 'custom')),
  split_details JSONB,
  receipt_document_id UUID REFERENCES documents(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_settled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE colocation_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coloc_expenses_owner_all ON colocation_expenses;
CREATE POLICY coloc_expenses_owner_all ON colocation_expenses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE p.id = colocation_expenses.property_id
        AND pr.user_id = auth.uid()
    )
  );

-- Tenants can read and create expenses
DROP POLICY IF EXISTS coloc_expenses_tenant_select ON colocation_expenses;
CREATE POLICY coloc_expenses_tenant_select ON colocation_expenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM colocation_members cm
      WHERE cm.property_id = colocation_expenses.property_id
        AND cm.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm.status IN ('active', 'departing')
    )
  );

DROP POLICY IF EXISTS coloc_expenses_tenant_insert ON colocation_expenses;
CREATE POLICY coloc_expenses_tenant_insert ON colocation_expenses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM colocation_members cm
      WHERE cm.property_id = colocation_expenses.property_id
        AND cm.tenant_profile_id = (
          SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
        )
        AND cm.status = 'active'
    )
  );

-- ============================================================
-- 7. Vue : Soldes entre colocataires
-- ============================================================

CREATE OR REPLACE VIEW v_colocation_balances AS
WITH active_member_counts AS (
  SELECT property_id, COUNT(*) AS cnt
  FROM colocation_members
  WHERE status = 'active'
  GROUP BY property_id
),
room_rent_totals AS (
  SELECT cr.property_id,
         SUM(cr.rent_share_cents) AS total_rent
  FROM colocation_rooms cr
  WHERE cr.is_available = false
  GROUP BY cr.property_id
),
expense_shares AS (
  SELECT
    e.property_id,
    e.paid_by_member_id AS payer_id,
    cm.id AS debtor_id,
    CASE e.split_type
      WHEN 'equal' THEN e.amount_cents / NULLIF(amc.cnt, 0)
      WHEN 'by_room' THEN
        CASE WHEN rrt.total_rent > 0 AND cr.rent_share_cents IS NOT NULL
          THEN cr.rent_share_cents * e.amount_cents / rrt.total_rent
          ELSE e.amount_cents / NULLIF(amc.cnt, 0)
        END
      ELSE COALESCE((e.split_details->>(cm.id::text))::int, 0)
    END AS share_cents
  FROM colocation_expenses e
  JOIN colocation_members cm
    ON cm.property_id = e.property_id AND cm.status = 'active'
  LEFT JOIN active_member_counts amc
    ON amc.property_id = e.property_id
  LEFT JOIN colocation_rooms cr
    ON cr.id = cm.room_id
  LEFT JOIN room_rent_totals rrt
    ON rrt.property_id = e.property_id
  WHERE NOT e.is_settled
)
SELECT
  property_id,
  payer_id,
  debtor_id,
  SUM(share_cents)::INTEGER AS total_owed_cents
FROM expense_shares
WHERE payer_id != debtor_id
GROUP BY property_id, payer_id, debtor_id;

-- ============================================================
-- 8. Triggers updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_colocation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_coloc_rooms_updated_at ON colocation_rooms;
CREATE TRIGGER trg_coloc_rooms_updated_at
  BEFORE UPDATE ON colocation_rooms
  FOR EACH ROW EXECUTE FUNCTION update_colocation_updated_at();

DROP TRIGGER IF EXISTS trg_coloc_members_updated_at ON colocation_members;
CREATE TRIGGER trg_coloc_members_updated_at
  BEFORE UPDATE ON colocation_members
  FOR EACH ROW EXECUTE FUNCTION update_colocation_updated_at();

-- ============================================================
-- 9. Function: Auto-calculate solidarity_end_date
-- ============================================================

CREATE OR REPLACE FUNCTION auto_solidarity_end_date()
RETURNS TRIGGER AS $$
BEGIN
  -- If member is departing and has a move_out_date, calculate solidarity end
  IF NEW.status = 'departing' AND NEW.move_out_date IS NOT NULL THEN
    -- If replaced, solidarity ends immediately
    IF NEW.replaced_by_member_id IS NOT NULL THEN
      NEW.solidarity_end_date = NEW.move_out_date;
    ELSE
      -- 6 months after move_out (loi ALUR)
      NEW.solidarity_end_date = NEW.move_out_date + INTERVAL '6 months';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_coloc_solidarity_end ON colocation_members;
CREATE TRIGGER trg_coloc_solidarity_end
  BEFORE INSERT OR UPDATE ON colocation_members
  FOR EACH ROW EXECUTE FUNCTION auto_solidarity_end_date();

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260408120001', 'colocation_module')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260408120000_colocation_module.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260408120000_edl_sortie_workflow.sql
-- Note: file on disk is 20260408120000_edl_sortie_workflow.sql but will be renamed to 20260408120002_edl_sortie_workflow.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : using
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260408120000_edl_sortie_workflow.sql'; END $pre$;

-- ============================================================================
-- MIGRATION: EDL Sortie Workflow — Pièces, Vétusté, Retenues, Comparaison
-- Date: 2026-04-08
-- Description:
--   - Table edl_rooms (pièces structurées avec cotation globale)
--   - Extension edl_items avec champs comparaison entrée/sortie
--   - Extension edl avec champs sortie (retenues, dépôt, lien entrée)
--   - Table vetuste_grid (grille de vétusté)
--   - Mise à jour contraintes condition (6 niveaux)
-- ============================================================================

-- ─── 1. Étendre la table edl pour le workflow sortie ────────────────────────

DO $$
BEGIN
    -- Lien vers l'EDL d'entrée (pour EDL sortie)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'linked_entry_edl_id') THEN
        ALTER TABLE edl ADD COLUMN linked_entry_edl_id UUID REFERENCES edl(id);
    END IF;

    -- Parties présentes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'owner_present') THEN
        ALTER TABLE edl ADD COLUMN owner_present BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'owner_representative') THEN
        ALTER TABLE edl ADD COLUMN owner_representative TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'tenant_profiles') THEN
        ALTER TABLE edl ADD COLUMN tenant_profiles UUID[] DEFAULT '{}';
    END IF;

    -- Retenues sur dépôt (sortie uniquement)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'total_retenue_cents') THEN
        ALTER TABLE edl ADD COLUMN total_retenue_cents INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'retenue_details') THEN
        ALTER TABLE edl ADD COLUMN retenue_details JSONB DEFAULT '[]'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'depot_garantie_cents') THEN
        ALTER TABLE edl ADD COLUMN depot_garantie_cents INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl' AND column_name = 'montant_restitue_cents') THEN
        ALTER TABLE edl ADD COLUMN montant_restitue_cents INTEGER;
    END IF;
END $$;

-- Index pour la jointure entrée→sortie
CREATE INDEX IF NOT EXISTS idx_edl_linked_entry ON edl(linked_entry_edl_id);

-- ─── 2. Table edl_rooms (pièces structurées) ───────────────────────────────

CREATE TABLE IF NOT EXISTS edl_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edl_id UUID NOT NULL REFERENCES edl(id) ON DELETE CASCADE,

    room_name TEXT NOT NULL,
    room_type TEXT NOT NULL DEFAULT 'autre'
        CHECK (room_type IN (
            'entree','salon','sejour','cuisine','chambre','salle_de_bain',
            'wc','couloir','buanderie','cave','parking','balcon','terrasse',
            'jardin','garage','autre'
        )),
    sort_order INTEGER DEFAULT 0,

    -- État global de la pièce
    general_condition TEXT DEFAULT 'bon'
        CHECK (general_condition IN ('neuf','tres_bon','bon','usage_normal','mauvais','tres_mauvais')),
    observations TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE edl_rooms ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_edl_rooms_edl ON edl_rooms(edl_id);

-- RLS policies pour edl_rooms
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'edl_rooms' AND policyname = 'edl_rooms_select_policy') THEN
        DROP POLICY IF EXISTS edl_rooms_select_policy ON edl_rooms;
        CREATE POLICY edl_rooms_select_policy ON edl_rooms FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'edl_rooms' AND policyname = 'edl_rooms_insert_policy') THEN
        DROP POLICY IF EXISTS edl_rooms_insert_policy ON edl_rooms;
        CREATE POLICY edl_rooms_insert_policy ON edl_rooms FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'edl_rooms' AND policyname = 'edl_rooms_update_policy') THEN
        DROP POLICY IF EXISTS edl_rooms_update_policy ON edl_rooms;
        CREATE POLICY edl_rooms_update_policy ON edl_rooms FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'edl_rooms' AND policyname = 'edl_rooms_delete_policy') THEN
        DROP POLICY IF EXISTS edl_rooms_delete_policy ON edl_rooms;
        CREATE POLICY edl_rooms_delete_policy ON edl_rooms FOR DELETE USING (true);
    END IF;
END $$;

-- ─── 3. Étendre edl_items pour comparaison entrée/sortie ───────────────────

DO $$
BEGIN
    -- Lien vers la pièce
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'room_id') THEN
        ALTER TABLE edl_items ADD COLUMN room_id UUID REFERENCES edl_rooms(id) ON DELETE CASCADE;
    END IF;

    -- Type d'élément normalisé
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'element_type') THEN
        ALTER TABLE edl_items ADD COLUMN element_type TEXT;
    END IF;

    -- Label personnalisé
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'element_label') THEN
        ALTER TABLE edl_items ADD COLUMN element_label TEXT;
    END IF;

    -- Ordre d'affichage
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'sort_order') THEN
        ALTER TABLE edl_items ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;

    -- Photos JSONB
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'photos') THEN
        ALTER TABLE edl_items ADD COLUMN photos JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- Champs comparaison entrée (remplis auto pour EDL sortie)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'entry_condition') THEN
        ALTER TABLE edl_items ADD COLUMN entry_condition TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'entry_description') THEN
        ALTER TABLE edl_items ADD COLUMN entry_description TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'entry_photos') THEN
        ALTER TABLE edl_items ADD COLUMN entry_photos JSONB DEFAULT '[]'::jsonb;
    END IF;

    -- Dégradation notée
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'degradation_noted') THEN
        ALTER TABLE edl_items ADD COLUMN degradation_noted BOOLEAN DEFAULT false;
    END IF;

    -- Vétusté
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'vetuste_applicable') THEN
        ALTER TABLE edl_items ADD COLUMN vetuste_applicable BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'vetuste_coefficient') THEN
        ALTER TABLE edl_items ADD COLUMN vetuste_coefficient NUMERIC(3,2);
    END IF;

    -- Retenue sur cet élément
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'retenue_cents') THEN
        ALTER TABLE edl_items ADD COLUMN retenue_cents INTEGER DEFAULT 0;
    END IF;

    -- Coût de réparation estimé
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'edl_items' AND column_name = 'cout_reparation_cents') THEN
        ALTER TABLE edl_items ADD COLUMN cout_reparation_cents INTEGER DEFAULT 0;
    END IF;
END $$;

-- Mettre à jour la contrainte condition pour 6 niveaux
-- D'abord supprimer l'ancienne contrainte si elle existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'edl_items' AND column_name = 'condition'
    ) THEN
        ALTER TABLE edl_items DROP CONSTRAINT IF EXISTS edl_items_condition_check;
    END IF;
END $$;

ALTER TABLE edl_items ADD CONSTRAINT edl_items_condition_check_v2
    CHECK (condition IS NULL OR condition IN ('neuf','tres_bon','bon','usage_normal','moyen','mauvais','tres_mauvais'));

-- Index pour room_id
CREATE INDEX IF NOT EXISTS idx_edl_items_room_id ON edl_items(room_id);
CREATE INDEX IF NOT EXISTS idx_edl_items_element_type ON edl_items(element_type);

-- ─── 4. Table vetuste_grid (grille de vétusté) ─────────────────────────────

CREATE TABLE IF NOT EXISTS vetuste_grid (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_type TEXT NOT NULL,
    duree_vie_ans INTEGER NOT NULL,
    taux_abattement_annuel NUMERIC(4,2),
    valeur_residuelle_min NUMERIC(3,2) DEFAULT 0.10,
    source TEXT DEFAULT 'talok',
    notes TEXT
);

-- Seed grille standard (idempotent)
INSERT INTO vetuste_grid (element_type, duree_vie_ans, taux_abattement_annuel, notes)
SELECT * FROM (VALUES
    ('peinture',           7,  14.29::NUMERIC(4,2), 'Peinture murale standard'),
    ('papier_peint',       7,  14.29, 'Revêtement mural'),
    ('moquette',           7,  14.29, 'Revêtement sol textile'),
    ('parquet',            15,  6.67, 'Parquet massif ou contrecollé'),
    ('carrelage',          20,  5.00, 'Sol carrelé'),
    ('lino',               10, 10.00, 'Revêtement sol PVC/lino'),
    ('robinetterie',       10, 10.00, 'Robinets, mitigeurs'),
    ('sanitaires',         15,  6.67, 'WC, lavabo, baignoire'),
    ('volets',             15,  6.67, 'Volets roulants ou battants'),
    ('porte_interieure',   15,  6.67, 'Portes intérieures'),
    ('fenetre',            20,  5.00, 'Menuiseries extérieures'),
    ('chaudiere',          15,  6.67, 'Chaudière/cumulus'),
    ('electrique',         20,  5.00, 'Installation électrique'),
    ('placards',           15,  6.67, 'Rangements intégrés')
) AS v(element_type, duree_vie_ans, taux_abattement_annuel, notes)
WHERE NOT EXISTS (SELECT 1 FROM vetuste_grid LIMIT 1);

-- ─── 5. Commentaires ───────────────────────────────────────────────────────

COMMENT ON TABLE edl_rooms IS 'Pièces structurées pour l''état des lieux';
COMMENT ON TABLE vetuste_grid IS 'Grille de vétusté pour calcul des retenues (décret 2016-382)';
COMMENT ON COLUMN edl.linked_entry_edl_id IS 'EDL sortie: référence vers l''EDL d''entrée correspondant';
COMMENT ON COLUMN edl.total_retenue_cents IS 'Montant total des retenues sur dépôt de garantie (en centimes)';
COMMENT ON COLUMN edl.depot_garantie_cents IS 'Montant du dépôt de garantie du bail (en centimes)';
COMMENT ON COLUMN edl.montant_restitue_cents IS 'Montant à restituer au locataire (dépôt − retenues, en centimes)';
COMMENT ON COLUMN edl_items.entry_condition IS 'État de l''élément à l''entrée (rempli auto lors de l''EDL sortie)';
COMMENT ON COLUMN edl_items.vetuste_coefficient IS 'Coefficient vétusté 0.00 à 1.00 (calculé auto)';
COMMENT ON COLUMN edl_items.retenue_cents IS 'Retenue nette après vétusté (en centimes)';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260408120002', 'edl_sortie_workflow')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260408120000_edl_sortie_workflow.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260408120000_providers_module_sota.sql
-- Note: file on disk is 20260408120000_providers_module_sota.sql but will be renamed to 20260408120003_providers_module_sota.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : own,on,on,of,of
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260408120000_providers_module_sota.sql'; END $pre$;

-- =====================================================
-- MIGRATION: Module Prestataires SOTA 2026
-- Tables: providers, owner_providers
-- Alter: work_orders (extended state machine + fields)
-- Triggers: rating auto-update, updated_at
-- RLS: policies per role
-- =====================================================

-- =====================================================
-- 1. TABLE: providers (annuaire prestataires)
-- Standalone provider directory — not coupled to profiles
-- =====================================================

CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Identité
  company_name TEXT NOT NULL,
  siret TEXT,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,

  -- Activité
  trade_categories TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,

  -- Localisation
  address TEXT,
  city TEXT,
  postal_code TEXT,
  department TEXT,
  service_radius_km INTEGER DEFAULT 30,

  -- Qualifications
  certifications TEXT[] DEFAULT '{}',
  insurance_number TEXT,
  insurance_expiry DATE,
  decennale_number TEXT,
  decennale_expiry DATE,

  -- Notation (auto-updated by trigger)
  avg_rating NUMERIC(2,1) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_interventions INTEGER DEFAULT 0,

  -- Disponibilité
  is_available BOOLEAN DEFAULT true,
  response_time_hours INTEGER DEFAULT 48,
  emergency_available BOOLEAN DEFAULT false,

  -- Relation avec proprio
  added_by_owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_marketplace BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,

  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'archived')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_providers_department ON providers(department);
CREATE INDEX IF NOT EXISTS idx_providers_categories ON providers USING GIN(trade_categories);
CREATE INDEX IF NOT EXISTS idx_providers_owner ON providers(added_by_owner_id);
CREATE INDEX IF NOT EXISTS idx_providers_marketplace ON providers(is_marketplace) WHERE is_marketplace = true;
CREATE INDEX IF NOT EXISTS idx_providers_email ON providers(email);
CREATE INDEX IF NOT EXISTS idx_providers_status ON providers(status);

-- RLS
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

-- Owners see their own providers + marketplace
DROP POLICY IF EXISTS "Owners see own providers and marketplace" ON providers;
CREATE POLICY "Owners see own providers and marketplace"
  ON providers FOR SELECT
  USING (
    added_by_owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR is_marketplace = true
    OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Owners can insert providers they add
DROP POLICY IF EXISTS "Owners can add providers" ON providers;
CREATE POLICY "Owners can add providers"
  ON providers FOR INSERT
  WITH CHECK (
    added_by_owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
  );

-- Owners can update their own providers, providers can update themselves
DROP POLICY IF EXISTS "Owners update own providers" ON providers;
CREATE POLICY "Owners update own providers"
  ON providers FOR UPDATE
  USING (
    added_by_owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    added_by_owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Admins full access
DROP POLICY IF EXISTS "Admins full access providers" ON providers;
CREATE POLICY "Admins full access providers"
  ON providers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_providers_updated_at ON providers;
CREATE TRIGGER trg_providers_updated_at
  BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE providers IS 'Annuaire prestataires (carnet personnel + marketplace)';

-- =====================================================
-- 2. TABLE: owner_providers (carnet d adresses)
-- =====================================================

CREATE TABLE IF NOT EXISTS owner_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  nickname TEXT,
  notes TEXT,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner_id, provider_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_owner_providers_owner ON owner_providers(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_providers_provider ON owner_providers(provider_id);

-- RLS
ALTER TABLE owner_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage own provider links" ON owner_providers;
CREATE POLICY "Owners manage own provider links"
  ON owner_providers FOR ALL
  USING (owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

COMMENT ON TABLE owner_providers IS 'Lien propriétaire ↔ prestataire (carnet d adresses personnel)';

-- =====================================================
-- 3. ALTER: work_orders — Extended state machine
-- Add new columns for the full ticket→devis→intervention→facture→paiement flow
-- =====================================================

-- Add new columns (idempotent with IF NOT EXISTS pattern via DO block)
DO $$
BEGIN
  -- property_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'property_id') THEN
    ALTER TABLE work_orders ADD COLUMN property_id UUID REFERENCES properties(id);
  END IF;

  -- owner_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'owner_id') THEN
    ALTER TABLE work_orders ADD COLUMN owner_id UUID REFERENCES profiles(id);
  END IF;

  -- entity_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'entity_id') THEN
    ALTER TABLE work_orders ADD COLUMN entity_id UUID REFERENCES legal_entities(id);
  END IF;

  -- lease_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'lease_id') THEN
    ALTER TABLE work_orders ADD COLUMN lease_id UUID REFERENCES leases(id);
  END IF;

  -- title
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'title') THEN
    ALTER TABLE work_orders ADD COLUMN title TEXT;
  END IF;

  -- description
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'description') THEN
    ALTER TABLE work_orders ADD COLUMN description TEXT;
  END IF;

  -- category
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'category') THEN
    ALTER TABLE work_orders ADD COLUMN category TEXT;
  END IF;

  -- urgency
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'urgency') THEN
    ALTER TABLE work_orders ADD COLUMN urgency TEXT DEFAULT 'normal'
      CHECK (urgency IN ('low', 'normal', 'urgent', 'emergency'));
  END IF;

  -- status (new extended state machine — coexists with legacy statut)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'status') THEN
    ALTER TABLE work_orders ADD COLUMN status TEXT DEFAULT 'draft'
      CHECK (status IN (
        'draft', 'quote_requested', 'quote_received', 'quote_approved',
        'quote_rejected', 'scheduled', 'in_progress', 'completed',
        'invoiced', 'paid', 'disputed', 'cancelled'
      ));
  END IF;

  -- Quote dates & financials
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'requested_at') THEN
    ALTER TABLE work_orders ADD COLUMN requested_at TIMESTAMPTZ DEFAULT now();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'quote_received_at') THEN
    ALTER TABLE work_orders ADD COLUMN quote_received_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'approved_at') THEN
    ALTER TABLE work_orders ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'scheduled_date') THEN
    ALTER TABLE work_orders ADD COLUMN scheduled_date DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'scheduled_time_slot') THEN
    ALTER TABLE work_orders ADD COLUMN scheduled_time_slot TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'started_at') THEN
    ALTER TABLE work_orders ADD COLUMN started_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'completed_at') THEN
    ALTER TABLE work_orders ADD COLUMN completed_at TIMESTAMPTZ;
  END IF;

  -- Financials
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'quote_amount_cents') THEN
    ALTER TABLE work_orders ADD COLUMN quote_amount_cents INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'quote_document_id') THEN
    ALTER TABLE work_orders ADD COLUMN quote_document_id UUID REFERENCES documents(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'invoice_amount_cents') THEN
    ALTER TABLE work_orders ADD COLUMN invoice_amount_cents INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'invoice_document_id') THEN
    ALTER TABLE work_orders ADD COLUMN invoice_document_id UUID REFERENCES documents(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'payment_method') THEN
    ALTER TABLE work_orders ADD COLUMN payment_method TEXT
      CHECK (payment_method IN ('bank_transfer', 'check', 'cash', 'stripe'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'paid_at') THEN
    ALTER TABLE work_orders ADD COLUMN paid_at TIMESTAMPTZ;
  END IF;

  -- Intervention report
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'intervention_report') THEN
    ALTER TABLE work_orders ADD COLUMN intervention_report TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'intervention_photos') THEN
    ALTER TABLE work_orders ADD COLUMN intervention_photos JSONB DEFAULT '[]';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'tenant_signature_url') THEN
    ALTER TABLE work_orders ADD COLUMN tenant_signature_url TEXT;
  END IF;

  -- Accounting link
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'accounting_entry_id') THEN
    ALTER TABLE work_orders ADD COLUMN accounting_entry_id UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'is_deductible') THEN
    ALTER TABLE work_orders ADD COLUMN is_deductible BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'deductible_category') THEN
    ALTER TABLE work_orders ADD COLUMN deductible_category TEXT;
  END IF;

  -- notes column (may already exist in some forks)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'notes') THEN
    ALTER TABLE work_orders ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Make ticket_id nullable (work orders can now be created standalone)
ALTER TABLE work_orders ALTER COLUMN ticket_id DROP NOT NULL;

-- New indexes
CREATE INDEX IF NOT EXISTS idx_work_orders_property ON work_orders(property_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_owner ON work_orders(owner_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_new_status ON work_orders(status);

-- Backfill: set status from legacy statut for existing rows
UPDATE work_orders
SET status = CASE
  WHEN statut = 'assigned' THEN 'draft'
  WHEN statut = 'scheduled' THEN 'scheduled'
  WHEN statut = 'done' THEN 'completed'
  WHEN statut = 'cancelled' THEN 'cancelled'
  WHEN statut = 'in_progress' THEN 'in_progress'
  ELSE 'draft'
END
WHERE status IS NULL;

-- Backfill: property_id from ticket if missing
UPDATE work_orders wo
SET property_id = t.property_id
FROM tickets t
WHERE wo.ticket_id = t.id
  AND wo.property_id IS NULL
  AND t.property_id IS NOT NULL;

-- Backfill: title from ticket titre
UPDATE work_orders wo
SET title = t.titre
FROM tickets t
WHERE wo.ticket_id = t.id
  AND wo.title IS NULL;

-- Backfill: description from ticket description
UPDATE work_orders wo
SET description = t.description
FROM tickets t
WHERE wo.ticket_id = t.id
  AND wo.description IS NULL;

-- =====================================================
-- 4. FUNCTION: Update provider rating from reviews
-- Uses the new providers table
-- =====================================================

CREATE OR REPLACE FUNCTION update_provider_rating_from_reviews()
RETURNS TRIGGER AS $$
DECLARE
  v_provider_id UUID;
BEGIN
  -- Find the provider linked to this provider_profile_id
  SELECT p.id INTO v_provider_id
  FROM providers p
  WHERE p.profile_id = NEW.provider_profile_id
  LIMIT 1;

  IF v_provider_id IS NOT NULL THEN
    UPDATE providers SET
      avg_rating = COALESCE(
        (SELECT ROUND(AVG(rating_overall)::NUMERIC, 1)
         FROM provider_reviews
         WHERE provider_profile_id = NEW.provider_profile_id AND is_published = true),
        0
      ),
      total_reviews = (
        SELECT COUNT(*)
        FROM provider_reviews
        WHERE provider_profile_id = NEW.provider_profile_id AND is_published = true
      )
    WHERE id = v_provider_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_provider_rating_from_reviews ON provider_reviews;
CREATE TRIGGER trg_update_provider_rating_from_reviews
  AFTER INSERT OR UPDATE ON provider_reviews
  FOR EACH ROW EXECUTE FUNCTION update_provider_rating_from_reviews();

-- =====================================================
-- 5. FUNCTION: Update provider total_interventions
-- =====================================================

CREATE OR REPLACE FUNCTION update_provider_intervention_count()
RETURNS TRIGGER AS $$
DECLARE
  v_provider_record RECORD;
BEGIN
  -- Find the provider entry for this provider_id
  -- provider_id on work_orders references profiles(id)
  SELECT p.id INTO v_provider_record
  FROM providers p
  WHERE p.profile_id = COALESCE(NEW.provider_id, OLD.provider_id)
  LIMIT 1;

  IF v_provider_record.id IS NOT NULL THEN
    UPDATE providers SET
      total_interventions = (
        SELECT COUNT(*)
        FROM work_orders
        WHERE provider_id = COALESCE(NEW.provider_id, OLD.provider_id)
          AND (status IN ('completed', 'invoiced', 'paid') OR statut = 'done')
      )
    WHERE id = v_provider_record.id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_provider_intervention_count ON work_orders;
CREATE TRIGGER trg_update_provider_intervention_count
  AFTER INSERT OR UPDATE OF status, statut OR DELETE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION update_provider_intervention_count();

-- =====================================================
-- 6. FUNCTION: Validate SIRET (14 digits)
-- =====================================================

CREATE OR REPLACE FUNCTION validate_provider_siret()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.siret IS NOT NULL AND NEW.siret <> '' THEN
    IF NEW.siret !~ '^\d{14}$' THEN
      RAISE EXCEPTION 'SIRET invalide: doit contenir exactement 14 chiffres';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_provider_siret ON providers;
CREATE TRIGGER trg_validate_provider_siret
  BEFORE INSERT OR UPDATE OF siret ON providers
  FOR EACH ROW EXECUTE FUNCTION validate_provider_siret();

-- =====================================================
-- 7. COMMENTS
-- =====================================================

COMMENT ON COLUMN providers.trade_categories IS 'plomberie, electricite, serrurerie, peinture, menuiserie, chauffage, climatisation, toiture, maconnerie, jardinage, nettoyage, demenagement, diagnostic, general';
COMMENT ON COLUMN work_orders.status IS 'Extended state machine: draft→quote_requested→quote_received→quote_approved→scheduled→in_progress→completed→invoiced→paid';
COMMENT ON COLUMN work_orders.urgency IS 'low, normal, urgent, emergency';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260408120003', 'providers_module_sota')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260408120000_providers_module_sota.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260408120000_smart_meters_connected.sql
-- Note: file on disk is 20260408120000_smart_meters_connected.sql but will be renamed to 20260408120004_smart_meters_connected.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260408120000_smart_meters_connected.sql'; END $pre$;

-- Migration : Compteurs connectés — Enedis SGE, GRDF ADICT, alertes conso
-- Feature gate : Pro+ (connected_meters)

-- ============================================================
-- Table 1 : Compteurs liés à un bien (property_meters)
-- Complète la table "meters" existante (liée à lease_id)
-- property_meters est liée au bien, pas au bail
-- ============================================================
CREATE TABLE IF NOT EXISTS property_meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  meter_type TEXT NOT NULL
    CHECK (meter_type IN ('electricity', 'gas', 'water', 'heating', 'other')),
  provider TEXT,                          -- 'enedis', 'grdf', 'veolia', 'manual'

  -- Identifiant compteur
  meter_reference TEXT NOT NULL,          -- PDL, PCE, ou numéro compteur eau
  meter_serial TEXT,                      -- Numéro de série physique

  -- Connexion API
  is_connected BOOLEAN DEFAULT false,
  connection_consent_at TIMESTAMPTZ,      -- Date consentement locataire
  connection_consent_by UUID REFERENCES profiles(id),
  oauth_token_encrypted TEXT,             -- Token chiffré
  oauth_refresh_token_encrypted TEXT,
  oauth_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'active', 'error', 'expired')),
  sync_error_message TEXT,

  -- Contrat
  contract_holder TEXT,                   -- Nom titulaire contrat
  contract_start_date DATE,
  tariff_option TEXT,                     -- 'base', 'hc_hp', 'tempo'
  subscribed_power_kva INTEGER,           -- Puissance souscrite (kVA)

  -- Config alertes
  alert_threshold_daily NUMERIC,          -- Seuil alerte conso journalière
  alert_threshold_monthly NUMERIC,        -- Seuil mensuel

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(property_id, meter_type, meter_reference)
);

ALTER TABLE property_meters ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_property_meters_property ON property_meters(property_id);
CREATE INDEX IF NOT EXISTS idx_property_meters_sync ON property_meters(is_connected, sync_status);
CREATE INDEX IF NOT EXISTS idx_property_meters_type ON property_meters(meter_type);

-- ============================================================
-- Table 2 : Relevés compteurs connectés
-- Étend le concept de meter_readings pour les compteurs connectés
-- ============================================================
CREATE TABLE IF NOT EXISTS property_meter_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id UUID NOT NULL REFERENCES property_meters(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id),

  reading_date DATE NOT NULL,
  value NUMERIC NOT NULL,                 -- kWh, m³, etc.
  unit TEXT NOT NULL DEFAULT 'kWh'
    CHECK (unit IN ('kWh', 'm3', 'litres')),

  -- Source
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'enedis', 'grdf', 'veolia', 'import')),
  recorded_by UUID REFERENCES profiles(id), -- NULL si auto

  -- Photo (relevé manuel)
  photo_document_id UUID REFERENCES documents(id),

  -- Coût estimé
  estimated_cost_cents INTEGER,           -- Coût estimé basé sur le tarif

  -- Déduplication
  external_id TEXT,                       -- ID unique côté fournisseur

  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(meter_id, reading_date, source)
);

ALTER TABLE property_meter_readings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pm_readings_meter_date ON property_meter_readings(meter_id, reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_pm_readings_property ON property_meter_readings(property_id);
CREATE INDEX IF NOT EXISTS idx_pm_readings_source ON property_meter_readings(source);

-- ============================================================
-- Table 3 : Alertes consommation
-- ============================================================
CREATE TABLE IF NOT EXISTS meter_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id UUID NOT NULL REFERENCES property_meters(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id),
  alert_type TEXT NOT NULL
    CHECK (alert_type IN ('overconsumption', 'no_reading', 'anomaly', 'contract_expiry')),
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  data JSONB DEFAULT '{}',
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meter_alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_meter_alerts_meter ON meter_alerts(meter_id);
CREATE INDEX IF NOT EXISTS idx_meter_alerts_property ON meter_alerts(property_id);
CREATE INDEX IF NOT EXISTS idx_meter_alerts_type ON meter_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_meter_alerts_unacked ON meter_alerts(meter_id) WHERE acknowledged_at IS NULL;

-- ============================================================
-- RLS Policies
-- ============================================================

-- property_meters: propriétaire du bien peut tout faire
DROP POLICY IF EXISTS "property_meters_owner_select" ON property_meters;
CREATE POLICY "property_meters_owner_select" ON property_meters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "property_meters_owner_insert" ON property_meters;
CREATE POLICY "property_meters_owner_insert" ON property_meters
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "property_meters_owner_update" ON property_meters;
CREATE POLICY "property_meters_owner_update" ON property_meters
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "property_meters_owner_delete" ON property_meters;
CREATE POLICY "property_meters_owner_delete" ON property_meters
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

-- property_meters: locataire avec bail actif peut lire
DROP POLICY IF EXISTS "property_meters_tenant_select" ON property_meters;
CREATE POLICY "property_meters_tenant_select" ON property_meters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = property_meters.property_id
        AND ls.profile_id = auth.uid()
        AND l.status IN ('active', 'signed')
    )
  );

-- property_meter_readings: propriétaire
DROP POLICY IF EXISTS "pm_readings_owner_select" ON property_meter_readings;
CREATE POLICY "pm_readings_owner_select" ON property_meter_readings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "pm_readings_owner_insert" ON property_meter_readings;
CREATE POLICY "pm_readings_owner_insert" ON property_meter_readings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

-- property_meter_readings: locataire avec bail actif
DROP POLICY IF EXISTS "pm_readings_tenant_select" ON property_meter_readings;
CREATE POLICY "pm_readings_tenant_select" ON property_meter_readings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = property_meter_readings.property_id
        AND ls.profile_id = auth.uid()
        AND l.status IN ('active', 'signed')
    )
  );

DROP POLICY IF EXISTS "pm_readings_tenant_insert" ON property_meter_readings;
CREATE POLICY "pm_readings_tenant_insert" ON property_meter_readings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = property_meter_readings.property_id
        AND ls.profile_id = auth.uid()
        AND l.status IN ('active', 'signed')
    )
  );

-- meter_alerts: propriétaire
DROP POLICY IF EXISTS "meter_alerts_owner_select" ON meter_alerts;
CREATE POLICY "meter_alerts_owner_select" ON meter_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "meter_alerts_owner_update" ON meter_alerts;
CREATE POLICY "meter_alerts_owner_update" ON meter_alerts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

-- meter_alerts: locataire
DROP POLICY IF EXISTS "meter_alerts_tenant_select" ON meter_alerts;
CREATE POLICY "meter_alerts_tenant_select" ON meter_alerts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.property_id = meter_alerts.property_id
        AND ls.profile_id = auth.uid()
        AND l.status IN ('active', 'signed')
    )
  );

-- ============================================================
-- Trigger updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_property_meters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_property_meters_updated_at ON property_meters;
CREATE TRIGGER trg_property_meters_updated_at
  BEFORE UPDATE ON property_meters
  FOR EACH ROW EXECUTE FUNCTION update_property_meters_updated_at();

-- ============================================================
-- Service role policies (for cron sync & OAuth callbacks)
-- ============================================================
DROP POLICY IF EXISTS "property_meters_service_all" ON property_meters;
CREATE POLICY "property_meters_service_all" ON property_meters
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );

DROP POLICY IF EXISTS "pm_readings_service_all" ON property_meter_readings;
CREATE POLICY "pm_readings_service_all" ON property_meter_readings
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );

DROP POLICY IF EXISTS "meter_alerts_service_all" ON meter_alerts;
CREATE POLICY "meter_alerts_service_all" ON meter_alerts
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260408120004', 'smart_meters_connected')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260408120000_smart_meters_connected.sql'; END $post$;

-- --------------------------------------------------------------------
-- Migration: 20260408120000_whitelabel_agency_module.sql
-- Note: file on disk is 20260408120000_whitelabel_agency_module.sql but will be renamed to 20260408120006_whitelabel_agency_module.sql
-- Risk: DANGEREUX
-- Why: UPDATE sans WHERE : on,on,on,on
-- --------------------------------------------------------------------
DO $pre$ BEGIN RAISE NOTICE '▶ Applying 20260408120000_whitelabel_agency_module.sql'; END $pre$;

-- ============================================================================
-- White-label Agency Module
--
-- Tables for agency white-label branding, mandates (Hoguet-compliant),
-- CRG (Compte Rendu de Gestion), and mandant accounts.
-- ============================================================================

-- 1. whitelabel_configs — branding & domain config per agency
CREATE TABLE IF NOT EXISTS whitelabel_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#2563EB',
  secondary_color TEXT,
  font_family TEXT DEFAULT 'Manrope',
  custom_domain TEXT,
  subdomain TEXT,
  domain_verified BOOLEAN DEFAULT false,
  company_name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  siret TEXT,
  carte_g_number TEXT NOT NULL,
  carte_g_expiry DATE,
  caisse_garantie TEXT,
  caisse_garantie_montant INTEGER,
  rcp_assurance TEXT,
  show_powered_by_talok BOOLEAN DEFAULT true,
  custom_email_sender TEXT,
  custom_email_domain_verified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('setup', 'active', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whitelabel_configs ENABLE ROW LEVEL SECURITY;

-- Unique domain index
CREATE UNIQUE INDEX IF NOT EXISTS idx_wl_domain
  ON whitelabel_configs(custom_domain)
  WHERE custom_domain IS NOT NULL;

-- Unique subdomain index
CREATE UNIQUE INDEX IF NOT EXISTS idx_wl_subdomain
  ON whitelabel_configs(subdomain)
  WHERE subdomain IS NOT NULL;

-- One config per agency
CREATE UNIQUE INDEX IF NOT EXISTS idx_wl_agency_profile
  ON whitelabel_configs(agency_profile_id);

-- RLS: agency sees own config only
DROP POLICY IF EXISTS whitelabel_configs_select ON whitelabel_configs;
CREATE POLICY whitelabel_configs_select ON whitelabel_configs
  FOR SELECT USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS whitelabel_configs_insert ON whitelabel_configs;
CREATE POLICY whitelabel_configs_insert ON whitelabel_configs
  FOR INSERT WITH CHECK (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'agency'
    )
  );

DROP POLICY IF EXISTS whitelabel_configs_update ON whitelabel_configs;
CREATE POLICY whitelabel_configs_update ON whitelabel_configs
  FOR UPDATE USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Admin full access
DROP POLICY IF EXISTS whitelabel_configs_admin ON whitelabel_configs;
CREATE POLICY whitelabel_configs_admin ON whitelabel_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- 2. agency_mandates — Hoguet-compliant mandates
CREATE TABLE IF NOT EXISTS agency_mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agency_entity_id UUID NOT NULL REFERENCES legal_entities(id) ON DELETE CASCADE,
  owner_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mandate_number TEXT NOT NULL,
  mandate_type TEXT DEFAULT 'gestion' CHECK (mandate_type IN ('gestion', 'location', 'syndic', 'transaction')),
  start_date DATE NOT NULL,
  end_date DATE,
  tacit_renewal BOOLEAN DEFAULT true,
  management_fee_type TEXT DEFAULT 'percentage' CHECK (management_fee_type IN ('percentage', 'fixed')),
  management_fee_rate NUMERIC(5,2),
  management_fee_fixed_cents INTEGER,
  property_ids UUID[] DEFAULT '{}',
  mandate_document_id UUID REFERENCES documents(id),
  mandant_bank_iban TEXT,
  mandant_bank_bic TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'terminated', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agency_mandates ENABLE ROW LEVEL SECURITY;

-- Sequential mandate numbering per agency
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_mandates_number
  ON agency_mandates(agency_profile_id, mandate_number);

-- RLS: agency sees own mandates
DROP POLICY IF EXISTS agency_mandates_agency_select ON agency_mandates;
CREATE POLICY agency_mandates_agency_select ON agency_mandates
  FOR SELECT USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- RLS: owner sees mandates where they are mandant
DROP POLICY IF EXISTS agency_mandates_owner_select ON agency_mandates;
CREATE POLICY agency_mandates_owner_select ON agency_mandates
  FOR SELECT USING (
    owner_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS agency_mandates_insert ON agency_mandates;
CREATE POLICY agency_mandates_insert ON agency_mandates
  FOR INSERT WITH CHECK (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'agency'
    )
  );

DROP POLICY IF EXISTS agency_mandates_update ON agency_mandates;
CREATE POLICY agency_mandates_update ON agency_mandates
  FOR UPDATE USING (
    agency_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Admin full access
DROP POLICY IF EXISTS agency_mandates_admin ON agency_mandates;
CREATE POLICY agency_mandates_admin ON agency_mandates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- 3. agency_crg — Compte Rendu de Gestion
CREATE TABLE IF NOT EXISTS agency_crg (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id UUID NOT NULL REFERENCES agency_mandates(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_rent_collected_cents INTEGER DEFAULT 0,
  total_charges_paid_cents INTEGER DEFAULT 0,
  total_fees_cents INTEGER DEFAULT 0,
  net_reversement_cents INTEGER DEFAULT 0,
  unpaid_rent_cents INTEGER DEFAULT 0,
  details_per_property JSONB DEFAULT '[]',
  works_summary JSONB DEFAULT '[]',
  document_id UUID REFERENCES documents(id),
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent', 'acknowledged')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agency_crg ENABLE ROW LEVEL SECURITY;

-- Prevent duplicate CRG for same mandate/period
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_crg_mandate_period
  ON agency_crg(mandate_id, period_start, period_end);

-- RLS: agency sees CRGs for own mandates
DROP POLICY IF EXISTS agency_crg_agency_select ON agency_crg;
CREATE POLICY agency_crg_agency_select ON agency_crg
  FOR SELECT USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS: owner sees CRGs for their mandates
DROP POLICY IF EXISTS agency_crg_owner_select ON agency_crg;
CREATE POLICY agency_crg_owner_select ON agency_crg
  FOR SELECT USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.owner_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS agency_crg_insert ON agency_crg;
CREATE POLICY agency_crg_insert ON agency_crg
  FOR INSERT WITH CHECK (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS agency_crg_update ON agency_crg;
CREATE POLICY agency_crg_update ON agency_crg
  FOR UPDATE USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Admin full access
DROP POLICY IF EXISTS agency_crg_admin ON agency_crg;
CREATE POLICY agency_crg_admin ON agency_crg
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- 4. agency_mandant_accounts — fund separation (Hoguet compliance)
CREATE TABLE IF NOT EXISTS agency_mandant_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id UUID NOT NULL REFERENCES agency_mandates(id) ON DELETE CASCADE,
  balance_cents INTEGER DEFAULT 0,
  last_reversement_at TIMESTAMPTZ,
  reversement_overdue BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agency_mandant_accounts ENABLE ROW LEVEL SECURITY;

-- One account per mandate
CREATE UNIQUE INDEX IF NOT EXISTS idx_mandant_accounts_mandate
  ON agency_mandant_accounts(mandate_id);

-- RLS: agency sees own mandant accounts
DROP POLICY IF EXISTS mandant_accounts_agency_select ON agency_mandant_accounts;
CREATE POLICY mandant_accounts_agency_select ON agency_mandant_accounts
  FOR SELECT USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- RLS: owner sees their mandant account
DROP POLICY IF EXISTS mandant_accounts_owner_select ON agency_mandant_accounts;
CREATE POLICY mandant_accounts_owner_select ON agency_mandant_accounts
  FOR SELECT USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.owner_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS mandant_accounts_insert ON agency_mandant_accounts;
CREATE POLICY mandant_accounts_insert ON agency_mandant_accounts
  FOR INSERT WITH CHECK (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS mandant_accounts_update ON agency_mandant_accounts;
CREATE POLICY mandant_accounts_update ON agency_mandant_accounts
  FOR UPDATE USING (
    mandate_id IN (
      SELECT am.id FROM agency_mandates am
      JOIN profiles p ON p.id = am.agency_profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Admin full access
DROP POLICY IF EXISTS mandant_accounts_admin ON agency_mandant_accounts;
CREATE POLICY mandant_accounts_admin ON agency_mandant_accounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin')
    )
  );

-- ============================================================================
-- Triggers: auto-update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_whitelabel_configs') THEN
    DROP TRIGGER IF EXISTS set_updated_at_whitelabel_configs ON whitelabel_configs;
    CREATE TRIGGER set_updated_at_whitelabel_configs
      BEFORE UPDATE ON whitelabel_configs
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_agency_mandates') THEN
    DROP TRIGGER IF EXISTS set_updated_at_agency_mandates ON agency_mandates;
    CREATE TRIGGER set_updated_at_agency_mandates
      BEFORE UPDATE ON agency_mandates
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_mandant_accounts') THEN
    DROP TRIGGER IF EXISTS set_updated_at_mandant_accounts ON agency_mandant_accounts;
    CREATE TRIGGER set_updated_at_mandant_accounts
      BEFORE UPDATE ON agency_mandant_accounts
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END $$;

-- ============================================================================
-- Trigger: auto-flag overdue reversements (> 30 days)
-- ============================================================================

CREATE OR REPLACE FUNCTION check_reversement_overdue()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.balance_cents > 0 AND (
    NEW.last_reversement_at IS NULL
    OR NEW.last_reversement_at < now() - interval '30 days'
  ) THEN
    NEW.reversement_overdue = true;
  ELSE
    NEW.reversement_overdue = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'check_reversement_overdue_trigger') THEN
    DROP TRIGGER IF EXISTS check_reversement_overdue_trigger ON agency_mandant_accounts;
    CREATE TRIGGER check_reversement_overdue_trigger
      BEFORE INSERT OR UPDATE ON agency_mandant_accounts
      FOR EACH ROW EXECUTE FUNCTION check_reversement_overdue();
  END IF;
END $$;

-- Comments
COMMENT ON TABLE whitelabel_configs IS 'White-label branding and domain configuration per agency (Enterprise plan)';
COMMENT ON TABLE agency_mandates IS 'Hoguet-compliant management mandates between agencies and property owners';
COMMENT ON TABLE agency_crg IS 'Compte Rendu de Gestion - periodic management reports for mandants';
COMMENT ON TABLE agency_mandant_accounts IS 'Mandant fund accounts - strict separation from agency own funds (Hoguet)';
COMMENT ON COLUMN agency_mandant_accounts.reversement_overdue IS 'Auto-flagged true when balance > 0 and last reversement > 30 days ago';

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260408120006', 'whitelabel_agency_module')
ON CONFLICT (version) DO NOTHING;

DO $post$ BEGIN RAISE NOTICE '✓ Applied  20260408120000_whitelabel_agency_module.sql'; END $post$;

COMMIT;

-- END OF BATCH 6/11 (Phase 3 DANGEREUX)
