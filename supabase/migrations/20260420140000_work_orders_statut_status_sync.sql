-- =====================================================
-- Migration: Sync bidirectionnelle statut (FR legacy) ↔ status (EN nouveau) sur work_orders
-- Date: 2026-04-20
--
-- CONTEXTE:
-- `work_orders` a deux colonnes qui représentent l'état de l'intervention :
--   - `statut`  TEXT CHECK (assigned | scheduled | in_progress | done | cancelled) — legacy FR
--   - `status`  TEXT CHECK (draft | quote_requested | quote_received | quote_approved |
--                           quote_rejected | scheduled | in_progress | completed |
--                           invoiced | paid | disputed | cancelled) — EN, étendu
--
-- Le code Talok écrit majoritairement dans `statut` (pattern historique)
-- mais les nouvelles features (devis/facturation) écrivent dans `status`.
-- Sans garde-fou, les deux colonnes peuvent diverger au fil du temps :
--   - UPDATE … SET statut='done' ne met pas status à 'completed'
--   - UPDATE … SET status='paid' ne met pas statut à 'done'
--
-- FIX:
-- Trigger BEFORE INSERT/UPDATE qui garde les deux colonnes cohérentes :
--   - Si l'INSERT/UPDATE change UNE des deux colonnes sans toucher l'autre,
--     on recalcule l'autre depuis le mapping.
--   - Si les deux changent simultanément, on respecte les valeurs écrites
--     (l'appelant sait ce qu'il fait).
--   - À l'INSERT, si une seule des deux colonnes est fournie, l'autre est
--     dérivée automatiquement.
--
-- Ceci décale la dette technique « déprécier `statut` » à un refactor
-- ultérieur, sans bloquer les deux chemins d'écriture actuels.
--
-- Idempotent : CREATE OR REPLACE, DROP TRIGGER IF EXISTS.
-- =====================================================

-- =====================================================
-- 1. Helpers de mapping
-- =====================================================

CREATE OR REPLACE FUNCTION public.work_order_statut_to_status(p_statut TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $func$
  SELECT CASE p_statut
    WHEN 'assigned'    THEN 'draft'
    WHEN 'scheduled'   THEN 'scheduled'
    WHEN 'in_progress' THEN 'in_progress'
    WHEN 'done'        THEN 'completed'
    WHEN 'cancelled'   THEN 'cancelled'
    ELSE 'draft'
  END;
$func$;

COMMENT ON FUNCTION public.work_order_statut_to_status(TEXT) IS
  'Mappe une valeur legacy FR (statut) vers la nouvelle machine d''état EN (status).';

CREATE OR REPLACE FUNCTION public.work_order_status_to_statut(p_status TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $func$
  SELECT CASE p_status
    -- draft et phases de devis sont des états pré-planification → assigned (par défaut legacy)
    WHEN 'draft'           THEN 'assigned'
    WHEN 'quote_requested' THEN 'assigned'
    WHEN 'quote_received'  THEN 'assigned'
    WHEN 'quote_approved'  THEN 'assigned'
    WHEN 'quote_rejected'  THEN 'cancelled'
    WHEN 'scheduled'       THEN 'scheduled'
    WHEN 'in_progress'     THEN 'in_progress'
    WHEN 'completed'       THEN 'done'
    -- phases post-intervention → done (pour rester compatible avec les KPI
    -- legacy qui agrègent sur statut = 'done')
    WHEN 'invoiced'        THEN 'done'
    WHEN 'paid'            THEN 'done'
    WHEN 'disputed'        THEN 'done'
    WHEN 'cancelled'       THEN 'cancelled'
    ELSE 'assigned'
  END;
$func$;

COMMENT ON FUNCTION public.work_order_status_to_statut(TEXT) IS
  'Mappe une valeur de la nouvelle machine d''état EN (status) vers legacy FR (statut). '
  'Les phases post-completion (invoiced/paid/disputed) sont mappées sur done pour '
  'compatibilité avec les KPI legacy agrégés sur statut = done.';

-- =====================================================
-- 2. Trigger function
-- =====================================================

CREATE OR REPLACE FUNCTION public.work_orders_sync_statut_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- INSERT : dériver la colonne manquante si nécessaire
    IF NEW.status IS NULL AND NEW.statut IS NOT NULL THEN
      NEW.status := public.work_order_statut_to_status(NEW.statut);
    ELSIF NEW.statut IS NULL AND NEW.status IS NOT NULL THEN
      NEW.statut := public.work_order_status_to_statut(NEW.status);
    ELSIF NEW.status IS NULL AND NEW.statut IS NULL THEN
      -- Les deux NULL : initialiser sur les valeurs par défaut
      NEW.statut := 'assigned';
      NEW.status := 'draft';
    END IF;
    -- Si les deux sont fournis à l'INSERT, on ne touche pas (respect du caller).
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE'
  IF NEW.statut IS DISTINCT FROM OLD.statut
     AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    -- Seul statut a changé → recalculer status
    NEW.status := public.work_order_statut_to_status(NEW.statut);
  ELSIF NEW.status IS DISTINCT FROM OLD.status
        AND NEW.statut IS NOT DISTINCT FROM OLD.statut THEN
    -- Seul status a changé → recalculer statut
    NEW.statut := public.work_order_status_to_statut(NEW.status);
  END IF;
  -- Si les deux changent en même temps : respect des valeurs fournies.
  -- Si aucune ne change : rien à faire.

  RETURN NEW;
END;
$func$;

COMMENT ON FUNCTION public.work_orders_sync_statut_status() IS
  'Garde statut (FR legacy) et status (EN) cohérents sur work_orders. '
  'Recalcule l''autre colonne quand une seule est modifiée. À retirer '
  'quand la dette technique sur statut sera purgée du code applicatif.';

-- =====================================================
-- 3. Trigger
-- =====================================================

DROP TRIGGER IF EXISTS trg_work_orders_sync_statut_status ON public.work_orders;
CREATE TRIGGER trg_work_orders_sync_statut_status
  BEFORE INSERT OR UPDATE OF statut, status ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.work_orders_sync_statut_status();

-- =====================================================
-- 4. Resync ponctuel des lignes existantes désynchronisées
-- =====================================================
-- Certaines lignes créées entre le déploiement de 20260408120000 et cette
-- migration peuvent être désynchronisées (ex: code qui a UPDATE statut sans
-- toucher status). On resynchronise en privilégiant `statut` comme source
-- de vérité (majoritaire dans le code applicatif actuel).

UPDATE public.work_orders
SET status = public.work_order_statut_to_status(statut)
WHERE statut IS NOT NULL
  AND (
    status IS NULL
    OR status <> public.work_order_statut_to_status(statut)
  )
  -- garde-fou : ne pas écraser les status « étendus » qui n'ont pas
  -- d'équivalent legacy (quote_requested, quote_received, quote_approved,
  -- invoiced, paid, disputed) — ces lignes ont forcément été écrites avec
  -- la nouvelle machine d'état et sont correctes.
  AND status NOT IN (
    'quote_requested', 'quote_received', 'quote_approved',
    'quote_rejected',  'invoiced',       'paid',
    'disputed'
  );

-- Lignes où `statut` est désynchronisé d'un `status` étendu : laisse-les,
-- le flux "étendu" écrit les deux à chaque transition (à vérifier dans
-- les routes API provider).
