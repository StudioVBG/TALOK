-- =====================================================
-- ACCOUNTING — Back-fill property_id / lease_id sur les lignes existantes
-- =====================================================
-- Suite de 20260427200000_accounting_analytical_axes.sql qui a ajouté les
-- colonnes nullables. Cette migration les renseigne rétroactivement pour
-- les écritures déjà en base, en remontant la chaîne payment → invoice
-- → lease → property selon la `reference` portée par accounting_entries.
--
-- Idempotente : ne touche que les lignes où property_id IS NULL.
-- Robuste : les sections 2, 3, 4 sont skippées si les tables source
-- (deposit_operations, deposit_movements, lease_charge_regularizations)
-- ne sont pas déployées dans cette base — utile en dev/staging avec un
-- subset de modules actifs.
-- =====================================================

SET lock_timeout = '10s';

-- =====================================================
-- 1. Back-fill via la chaîne payment → invoice → lease → property
--    pour les sources rent_received / rent_payment_clearing /
--    provision_received (tous accrochés sur payment.id côté reference).
-- =====================================================

WITH ent AS (
  SELECT
    ae.id          AS entry_id,
    SPLIT_PART(ae.reference, ':', 1) AS payment_id_str
  FROM accounting_entries ae
  WHERE ae.reference IS NOT NULL
    AND (
      ae.source LIKE 'auto:rent_received%'
      OR ae.source LIKE 'auto:rent_payment_clearing%'
      OR ae.source LIKE 'auto:provision_received%'
    )
), resolved AS (
  SELECT
    ent.entry_id,
    i.lease_id,
    pr.id          AS property_id,
    COALESCE(i.tenant_id, l.tenant_id) AS tenant_id
  FROM ent
  JOIN payments p ON p.id::text = ent.payment_id_str
  JOIN invoices i ON i.id = p.invoice_id
  JOIN leases l   ON l.id = i.lease_id
  JOIN properties pr ON pr.id = l.property_id
)
UPDATE accounting_entry_lines ael
   SET property_id = r.property_id,
       lease_id   = COALESCE(ael.lease_id, r.lease_id),
       third_party_type = COALESCE(ael.third_party_type,
                                   CASE WHEN r.tenant_id IS NOT NULL THEN 'tenant' END),
       third_party_id   = COALESCE(ael.third_party_id, r.tenant_id)
  FROM resolved r
 WHERE ael.entry_id = r.entry_id
   AND ael.property_id IS NULL;

-- =====================================================
-- 2. Dépôts via deposit_operations (skip si table absente)
-- =====================================================

DO $outer$
BEGIN
  IF to_regclass('public.deposit_operations') IS NOT NULL THEN
    EXECUTE $sql$
      WITH dep_op AS (
        SELECT
          ae.id      AS entry_id,
          dop.lease_id,
          l.property_id,
          dop.tenant_id
        FROM accounting_entries ae
        JOIN deposit_operations dop ON dop.id::text = ae.reference
        JOIN leases l ON l.id = dop.lease_id
        WHERE ae.source LIKE 'auto:deposit_%'
      )
      UPDATE accounting_entry_lines ael
         SET property_id = dop.property_id,
             lease_id    = COALESCE(ael.lease_id, dop.lease_id),
             third_party_type = COALESCE(ael.third_party_type, 'tenant'),
             third_party_id   = COALESCE(ael.third_party_id, dop.tenant_id)
        FROM dep_op dop
       WHERE ael.entry_id = dop.entry_id
         AND ael.property_id IS NULL
    $sql$;
    RAISE NOTICE 'Back-fill deposit_operations : OK';
  ELSE
    RAISE NOTICE 'Back-fill deposit_operations : SKIP (table absente)';
  END IF;
END $outer$;

-- =====================================================
-- 3. Dépôts via deposit_movements (skip si table absente)
-- =====================================================

DO $outer$
BEGIN
  IF to_regclass('public.deposit_movements') IS NOT NULL THEN
    EXECUTE $sql$
      WITH dep_mov AS (
        SELECT
          ae.id      AS entry_id,
          dm.lease_id,
          l.property_id,
          l.tenant_id
        FROM accounting_entries ae
        JOIN deposit_movements dm ON dm.id::text = ae.reference
        JOIN leases l ON l.id = dm.lease_id
        WHERE ae.source LIKE 'auto:deposit_%'
      )
      UPDATE accounting_entry_lines ael
         SET property_id = dm.property_id,
             lease_id    = COALESCE(ael.lease_id, dm.lease_id),
             third_party_type = COALESCE(ael.third_party_type, 'tenant'),
             third_party_id   = COALESCE(ael.third_party_id, dm.tenant_id)
        FROM dep_mov dm
       WHERE ael.entry_id = dm.entry_id
         AND ael.property_id IS NULL
    $sql$;
    RAISE NOTICE 'Back-fill deposit_movements : OK';
  ELSE
    RAISE NOTICE 'Back-fill deposit_movements : SKIP (table absente)';
  END IF;
END $outer$;

-- =====================================================
-- 4. Régularisation charges (skip si table absente)
-- =====================================================

DO $outer$
BEGIN
  IF to_regclass('public.lease_charge_regularizations') IS NOT NULL THEN
    EXECUTE $sql$
      WITH reg AS (
        SELECT
          ae.id      AS entry_id,
          lcr.lease_id,
          lcr.property_id,
          l.tenant_id
        FROM accounting_entries ae
        JOIN lease_charge_regularizations lcr ON lcr.id::text = ae.reference
        JOIN leases l ON l.id = lcr.lease_id
        WHERE ae.source LIKE 'auto:charge_regularization%'
      )
      UPDATE accounting_entry_lines ael
         SET property_id = reg.property_id,
             lease_id    = COALESCE(ael.lease_id, reg.lease_id),
             third_party_type = COALESCE(ael.third_party_type, 'tenant'),
             third_party_id   = COALESCE(ael.third_party_id, reg.tenant_id)
        FROM reg
       WHERE ael.entry_id = reg.entry_id
         AND ael.property_id IS NULL
    $sql$;
    RAISE NOTICE 'Back-fill lease_charge_regularizations : OK';
  ELSE
    RAISE NOTICE 'Back-fill lease_charge_regularizations : SKIP (table absente)';
  END IF;
END $outer$;

-- =====================================================
-- 5. Récap diagnostic
-- =====================================================

DO $$
DECLARE
  total_lines       INTEGER;
  with_property     INTEGER;
  with_third_party  INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_lines FROM accounting_entry_lines;
  SELECT COUNT(*) INTO with_property
    FROM accounting_entry_lines WHERE property_id IS NOT NULL;
  SELECT COUNT(*) INTO with_third_party
    FROM accounting_entry_lines WHERE third_party_id IS NOT NULL;

  RAISE NOTICE 'Back-fill analytique : % / % lignes property_id (%.1f%%), % avec third_party_id',
    with_property, total_lines,
    CASE WHEN total_lines > 0 THEN with_property * 100.0 / total_lines ELSE 0 END,
    with_third_party;
END $$;
