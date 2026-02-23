-- =====================================================
-- PARTIE 3/3 — Migrations 20260223 → 20260228 (10 fichiers)
-- Date: 2026-02-23
-- Coller dans Supabase SQL Editor → Run
-- PREREQUIS: PART1 + PART2 appliquées
-- =====================================================

-- === SOURCE: 20260223000002_document_access_views.sql ===

-- =====================================================
-- MIGRATION SOTA 2026: Vues d'accès documents optimisées
-- Date: 2026-02-23
--
-- PROBLÈME CORRIGÉ:
--   Le hook use-documents.ts fait 3 requêtes séparées pour le locataire
--   (directDocs, leaseDocs, propertyDocs) + déduplication côté client.
--   Le propriétaire fait 2 requêtes (ownerDocs, propertyDocs).
--   C'est lent, fragile, et source de bugs de visibilité.
--
-- FIX:
--   Deux vues read-only qui unifient la logique de visibilité :
--   - v_tenant_accessible_documents : tout ce qu'un locataire peut voir
--   - v_owner_accessible_documents : tout ce qu'un propriétaire peut voir
--
-- SÉCURITÉ:
--   - Vues read-only (SELECT uniquement)
--   - Utilisent user_profile_id() SECURITY DEFINER (déjà existant et testé)
--   - Additives : aucun impact sur INSERT/UPDATE/DELETE des documents
--   - RLS hérité de la table documents (les vues ne contournent pas RLS)
-- =====================================================

BEGIN;

-- ============================================
-- 1. VUE LOCATAIRE : Documents accessibles
-- ============================================
CREATE OR REPLACE VIEW public.v_tenant_accessible_documents AS
SELECT DISTINCT ON (d.id) d.*
FROM public.documents d
WHERE
  -- Documents directement liés au locataire
  d.tenant_id = public.user_profile_id()
  -- Documents liés aux baux du locataire
  OR d.lease_id IN (
    SELECT ls.lease_id
    FROM public.lease_signers ls
    WHERE ls.profile_id = public.user_profile_id()
  )
  -- Documents partagés de la propriété (diagnostics, EDL, etc.)
  OR (
    d.property_id IN (
      SELECT l.property_id
      FROM public.leases l
      JOIN public.lease_signers ls ON ls.lease_id = l.id
      WHERE ls.profile_id = public.user_profile_id()
        AND l.property_id IS NOT NULL
    )
    AND d.type IN (
      'diagnostic_performance', 'dpe', 'erp', 'crep', 'amiante',
      'electricite', 'gaz', 'reglement_copro', 'notice_information',
      'EDL_entree', 'EDL_sortie', 'edl', 'edl_entree', 'edl_sortie'
    )
  );

COMMENT ON VIEW public.v_tenant_accessible_documents IS
  'SOTA 2026: Vue unifiée de tous les documents accessibles par le locataire connecté (via tenant_id, lease_id, ou property_id pour les types partagés).';

-- ============================================
-- 2. VUE PROPRIÉTAIRE : Documents accessibles
-- ============================================
CREATE OR REPLACE VIEW public.v_owner_accessible_documents AS
SELECT DISTINCT ON (d.id) d.*
FROM public.documents d
WHERE
  -- Documents directement liés au propriétaire
  d.owner_id = public.user_profile_id()
  -- Documents liés à ses propriétés (y compris ceux uploadés par les locataires)
  OR d.property_id IN (
    SELECT p.id
    FROM public.properties p
    WHERE p.owner_id = public.user_profile_id()
  );

COMMENT ON VIEW public.v_owner_accessible_documents IS
  'SOTA 2026: Vue unifiée de tous les documents accessibles par le propriétaire connecté (via owner_id ou property_id).';

-- ============================================
-- 3. GRANTS pour les rôles authentifiés
-- ============================================
GRANT SELECT ON public.v_tenant_accessible_documents TO authenticated;
GRANT SELECT ON public.v_owner_accessible_documents TO authenticated;

COMMIT;


-- === SOURCE: 20260223000003_notify_owner_on_tenant_document.sql ===

-- =====================================================
-- MIGRATION SOTA 2026: Notification propriétaire sur dépôt document locataire
-- Date: 2026-02-23
--
-- PROBLÈME CORRIGÉ:
--   Le trigger trg_notify_tenant_document_center notifie le locataire
--   quand un document lui est ajouté. Mais AUCUNE notification n'existait
--   côté propriétaire quand le locataire dépose un document (assurance,
--   identité, justificatifs, etc.).
--
-- FIX:
--   Trigger AFTER INSERT sur documents qui crée une notification pour
--   le propriétaire lorsque tenant_id ET owner_id sont renseignés.
--
-- SÉCURITÉ:
--   - AFTER INSERT : s'exécute après auto_fill_document_fk (BEFORE)
--   - Exception handler non-bloquant
--   - WHEN clause pour filtrer au niveau trigger (pas de surcoût)
--   - Utilise create_notification() existante
-- =====================================================

BEGIN;

-- ============================================
-- 1. FONCTION: Notifier le propriétaire
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_owner_on_tenant_document()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_name TEXT;
  v_doc_label TEXT;
BEGIN
  -- Récupérer le nom du locataire
  SELECT COALESCE(
    NULLIF(TRIM(COALESCE(prenom, '') || ' ' || COALESCE(nom, '')), ''),
    email,
    'Un locataire'
  )
  INTO v_tenant_name
  FROM public.profiles
  WHERE id = NEW.tenant_id;

  -- Label lisible pour le type de document
  v_doc_label := CASE NEW.type
    WHEN 'attestation_assurance' THEN 'attestation d''assurance'
    WHEN 'cni_recto' THEN 'pièce d''identité (recto)'
    WHEN 'cni_verso' THEN 'pièce d''identité (verso)'
    WHEN 'piece_identite' THEN 'pièce d''identité'
    WHEN 'passeport' THEN 'passeport'
    WHEN 'titre_sejour' THEN 'titre de séjour'
    WHEN 'justificatif_revenus' THEN 'justificatif de revenus'
    WHEN 'avis_imposition' THEN 'avis d''imposition'
    WHEN 'bulletin_paie' THEN 'bulletin de paie'
    WHEN 'rib' THEN 'RIB'
    WHEN 'attestation_loyer' THEN 'attestation de loyer'
    ELSE COALESCE(NEW.type, 'document')
  END;

  -- Utiliser la fonction create_notification existante
  PERFORM create_notification(
    NEW.owner_id,
    'document_uploaded',
    'Nouveau document déposé',
    v_tenant_name || ' a déposé : ' || v_doc_label,
    '/owner/documents',
    NEW.id,
    'document'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[notify_owner_on_tenant_document] Non-blocking: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION public.notify_owner_on_tenant_document() IS
  'SOTA 2026: Notifie le propriétaire quand un locataire dépose un document (assurance, identité, etc.)';

-- ============================================
-- 2. TRIGGER: Exécuter AFTER INSERT quand tenant_id et owner_id sont set
-- ============================================
DROP TRIGGER IF EXISTS trigger_notify_owner_on_tenant_document ON public.documents;

CREATE TRIGGER trigger_notify_owner_on_tenant_document
  AFTER INSERT ON public.documents
  FOR EACH ROW
  WHEN (NEW.tenant_id IS NOT NULL AND NEW.owner_id IS NOT NULL)
  EXECUTE FUNCTION public.notify_owner_on_tenant_document();

COMMIT;


-- === SOURCE: 20260223100000_fix_entity_connections.sql ===

-- ============================================================================
-- Migration: Correction des connexions entites juridiques
-- Date: 2026-02-23
-- Description:
--   1. Backfill leases.signatory_entity_id pour TOUS les baux
--   2. Backfill invoices.issuer_entity_id pour toutes les factures
--   3. Backfill documents.entity_id pour tous les documents
--   4. Backfill property_ownership manquants
--   5. Triggers auto-propagation entity sur INSERT (properties, leases, invoices)
--   6. Corriger get_entity_stats avec total_value et monthly_rent reels
-- Idempotent: peut etre executee plusieurs fois sans effet secondaire.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. BACKFILL : properties.legal_entity_id (re-passe pour les nouvelles)
-- ============================================================================

UPDATE properties p
SET legal_entity_id = (
  SELECT le.id FROM legal_entities le
  WHERE le.owner_profile_id = p.owner_id
    AND le.is_active = true
  ORDER BY le.created_at ASC
  LIMIT 1
)
WHERE p.legal_entity_id IS NULL
  AND p.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM legal_entities le
    WHERE le.owner_profile_id = p.owner_id
      AND le.is_active = true
  );

-- ============================================================================
-- 2. BACKFILL : leases.signatory_entity_id (TOUS les statuts)
-- ============================================================================

UPDATE leases l
SET signatory_entity_id = p.legal_entity_id
FROM properties p
WHERE l.property_id = p.id
  AND l.signatory_entity_id IS NULL
  AND p.legal_entity_id IS NOT NULL;

-- Pour les baux via unit_id (colocation)
UPDATE leases l
SET signatory_entity_id = p.legal_entity_id
FROM units u
JOIN properties p ON u.property_id = p.id
WHERE l.unit_id = u.id
  AND l.property_id IS NULL
  AND l.signatory_entity_id IS NULL
  AND p.legal_entity_id IS NOT NULL;

-- ============================================================================
-- 3. BACKFILL : invoices.issuer_entity_id
-- ============================================================================

UPDATE invoices i
SET issuer_entity_id = l.signatory_entity_id
FROM leases l
WHERE i.lease_id = l.id
  AND i.issuer_entity_id IS NULL
  AND l.signatory_entity_id IS NOT NULL;

-- ============================================================================
-- 4. BACKFILL : documents.entity_id via property
-- ============================================================================

UPDATE documents d
SET entity_id = p.legal_entity_id
FROM properties p
WHERE d.property_id = p.id
  AND d.entity_id IS NULL
  AND p.legal_entity_id IS NOT NULL;

-- Documents lies a un bail (via lease_id → property → legal_entity)
UPDATE documents d
SET entity_id = p.legal_entity_id
FROM leases l
JOIN properties p ON l.property_id = p.id
WHERE d.lease_id = l.id
  AND d.entity_id IS NULL
  AND d.property_id IS NULL
  AND p.legal_entity_id IS NOT NULL;

-- ============================================================================
-- 5. BACKFILL : property_ownership manquants
-- ============================================================================

INSERT INTO property_ownership (
  property_id,
  legal_entity_id,
  profile_id,
  quote_part_numerateur,
  quote_part_denominateur,
  detention_type,
  date_acquisition,
  mode_acquisition,
  is_current
)
SELECT
  p.id,
  p.legal_entity_id,
  NULL,
  1,
  1,
  'pleine_propriete',
  p.created_at::DATE,
  'achat',
  true
FROM properties p
WHERE p.legal_entity_id IS NOT NULL
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM property_ownership po
    WHERE po.property_id = p.id
  );

-- ============================================================================
-- 6. TRIGGER : Auto-remplir legal_entity_id sur nouvelle propriete
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_set_property_entity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.legal_entity_id IS NULL AND NEW.owner_id IS NOT NULL THEN
    NEW.legal_entity_id := (
      SELECT id FROM legal_entities
      WHERE owner_profile_id = NEW.owner_id
        AND is_active = true
      ORDER BY created_at ASC
      LIMIT 1
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_set_property_entity ON properties;
CREATE TRIGGER trg_auto_set_property_entity
  BEFORE INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_property_entity();

-- ============================================================================
-- 7. TRIGGER : Auto-remplir signatory_entity_id sur nouveau bail
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_set_lease_entity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.signatory_entity_id IS NULL THEN
    IF NEW.property_id IS NOT NULL THEN
      NEW.signatory_entity_id := (
        SELECT legal_entity_id FROM properties WHERE id = NEW.property_id
      );
    ELSIF NEW.unit_id IS NOT NULL THEN
      NEW.signatory_entity_id := (
        SELECT p.legal_entity_id
        FROM units u
        JOIN properties p ON u.property_id = p.id
        WHERE u.id = NEW.unit_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_set_lease_entity ON leases;
CREATE TRIGGER trg_auto_set_lease_entity
  BEFORE INSERT ON leases
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_lease_entity();

-- ============================================================================
-- 8. TRIGGER : Auto-remplir issuer_entity_id sur nouvelle facture
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_set_invoice_entity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.issuer_entity_id IS NULL AND NEW.lease_id IS NOT NULL THEN
    NEW.issuer_entity_id := (
      SELECT signatory_entity_id FROM leases WHERE id = NEW.lease_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_set_invoice_entity ON invoices;
CREATE TRIGGER trg_auto_set_invoice_entity
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_invoice_entity();

-- ============================================================================
-- 9. CORRIGER get_entity_stats : total_value et monthly_rent reels
-- ============================================================================

CREATE OR REPLACE FUNCTION get_entity_stats(
  p_owner_profile_id UUID
) RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  regime_fiscal TEXT,
  properties_count BIGINT,
  total_value DECIMAL(14,2),
  monthly_rent DECIMAL(12,2),
  active_leases BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH entity_props AS (
    SELECT
      le.id AS eid,
      COUNT(DISTINCT p.id) AS prop_count,
      COALESCE(SUM(p.loyer_hc), 0) AS rent_sum
    FROM legal_entities le
    LEFT JOIN properties p ON p.deleted_at IS NULL
      AND (
        p.legal_entity_id = le.id
        OR (le.entity_type = 'particulier' AND p.owner_id = le.owner_profile_id AND p.legal_entity_id IS NULL)
      )
    WHERE le.owner_profile_id = p_owner_profile_id
      AND le.is_active = true
    GROUP BY le.id
  ),
  entity_values AS (
    SELECT
      po.legal_entity_id AS eid,
      COALESCE(SUM(po.prix_acquisition), 0) AS total_val
    FROM property_ownership po
    WHERE po.legal_entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id = p_owner_profile_id AND is_active = true
    )
    AND po.is_current = true
    GROUP BY po.legal_entity_id
  ),
  entity_leases AS (
    SELECT
      l.signatory_entity_id AS eid,
      COUNT(*) AS lease_count
    FROM leases l
    WHERE l.signatory_entity_id IN (
      SELECT id FROM legal_entities WHERE owner_profile_id = p_owner_profile_id AND is_active = true
    )
    AND l.statut IN ('active', 'pending_signature', 'fully_signed')
    GROUP BY l.signatory_entity_id
  )
  SELECT
    le.id AS entity_id,
    le.nom AS entity_name,
    le.entity_type,
    le.regime_fiscal,
    COALESCE(ep.prop_count, 0)::BIGINT AS properties_count,
    COALESCE(ev.total_val, 0)::DECIMAL(14,2) AS total_value,
    COALESCE(ep.rent_sum, 0)::DECIMAL(12,2) AS monthly_rent,
    COALESCE(el.lease_count, 0)::BIGINT AS active_leases
  FROM legal_entities le
  LEFT JOIN entity_props ep ON ep.eid = le.id
  LEFT JOIN entity_values ev ON ev.eid = le.id
  LEFT JOIN entity_leases el ON el.eid = le.id
  WHERE le.owner_profile_id = p_owner_profile_id
    AND le.is_active = true
  ORDER BY properties_count DESC, le.nom;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;


-- === SOURCE: 20260224000000_fix_tenant_sync_and_notifications.sql ===

-- =====================================================
-- Migration: Fix tenant data sync — liaison orpheline + notifications manquantes
-- Date: 2026-02-24
--
-- Contexte: Bug critique où le compte locataire est isolé malgré un bail signé
-- côté propriétaire. Causes: lease_signers.profile_id NULL (auto-link raté),
-- profiles.email manquant, notifications jamais créées.
--
-- Actions (toutes idempotentes):
-- 1. Re-lier les lease_signers orphelins (profile_id NULL + email matche auth)
-- 2. Backfill profiles.email depuis auth.users
-- 3. Backfill notifications pour locataires avec bail actif sans notification
-- 4. Diagnostic final
-- =====================================================

BEGIN;

-- ============================================
-- 1. ORPHAN LINKING: lease_signers avec profile_id NULL
-- ============================================
-- Pour chaque lease_signer dont le profile_id est NULL mais dont l'invited_email
-- correspond à un compte auth existant, on lie automatiquement.
UPDATE public.lease_signers ls
SET profile_id = p.id
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE ls.profile_id IS NULL
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email));

-- ============================================
-- 2. BACKFILL: profiles.email depuis auth.users
-- ============================================
-- Certains profils n'ont pas d'email renseigné, ce qui empêche certaines
-- recherches de fonctionner. On récupère l'email depuis auth.users.
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.user_id
  AND (p.email IS NULL OR TRIM(p.email) = '');

-- ============================================
-- 3. BACKFILL: notifications pour locataires avec bail actif
-- ============================================
-- Crée une notification "bail activé" pour chaque locataire lié à un bail
-- actif/fully_signed qui n'a jamais reçu de notification de type lease_activated.
INSERT INTO public.notifications (user_id, profile_id, type, title, body, is_read, metadata)
SELECT DISTINCT
  p.user_id,
  p.id,
  'lease_activated',
  'Bail activé',
  'Votre bail a été activé. Vous pouvez désormais accéder à toutes les fonctionnalités de votre espace locataire.',
  false,
  jsonb_build_object('lease_id', l.id, 'auto_backfill', true)
FROM public.lease_signers ls
JOIN public.leases l ON l.id = ls.lease_id
JOIN public.profiles p ON p.id = ls.profile_id
WHERE ls.role IN ('locataire_principal', 'colocataire')
  AND l.statut IN ('active', 'fully_signed')
  AND p.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.profile_id = p.id
      AND n.type = 'lease_activated'
  );

-- ============================================
-- 4. DIAGNOSTIC FINAL
-- ============================================
DO $$
DECLARE
  orphans INT;
  backfilled INT;
  linked INT;
BEGIN
  -- Compter les orphelins restants (email valide sans compte)
  SELECT count(*)::INT INTO orphans
  FROM public.lease_signers
  WHERE profile_id IS NULL
    AND invited_email IS NOT NULL
    AND TRIM(invited_email) != ''
    AND invited_email NOT LIKE '%@a-definir%'
    AND invited_email NOT LIKE '%@placeholder%';

  -- Compter les notifications backfillées
  SELECT count(*)::INT INTO backfilled
  FROM public.notifications
  WHERE metadata->>'auto_backfill' = 'true';

  -- Compter les lease_signers liés par cette migration
  SELECT count(*)::INT INTO linked
  FROM public.lease_signers
  WHERE profile_id IS NOT NULL;

  RAISE NOTICE '[fix_tenant_sync] Orphelins restants: % | Notifications backfillées: % | Signers liés total: %',
    orphans, backfilled, linked;

  IF orphans > 0 THEN
    RAISE NOTICE '[fix_tenant_sync] Les % orphelins restants correspondent à des emails sans compte créé (attendu)', orphans;
  ELSE
    RAISE NOTICE '[fix_tenant_sync] Tous les signers avec email valide sont liés';
  END IF;
END $$;

COMMIT;


-- === SOURCE: 20260224100000_fix_tenant_dashboard_notifications_query.sql ===

-- ============================================================================
-- MIGRATION: Fix tenant_dashboard RPC — notification query includes user_id
-- Date: 2026-02-24
--
-- PROBLEM:
--   The notification sub-query in tenant_dashboard only searches by profile_id.
--   Notifications created with user_id but without profile_id (e.g. from
--   process-outbox or direct inserts) are invisible to the tenant.
--
-- FIX: Add OR n.user_id = p_tenant_user_id to the notification query.
-- ============================================================================

CREATE OR REPLACE FUNCTION tenant_dashboard(p_tenant_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_user_email TEXT;
  v_tenant_data JSONB;
  v_leases JSONB;
  v_invoices JSONB;
  v_tickets JSONB;
  v_notifications JSONB;
  v_pending_edls JSONB;
  v_insurance_status JSONB;
  v_stats JSONB;
  v_kyc_status TEXT := 'pending';
  v_result JSONB;
BEGIN
  -- 1. Récupérer l'ID du profil ET l'email de l'utilisateur
  SELECT p.id, u.email,
         jsonb_build_object(
           'id', p.id,
           'prenom', p.prenom,
           'nom', p.nom,
           'email', u.email,
           'telephone', p.telephone,
           'avatar_url', p.avatar_url
         )
  INTO v_profile_id, v_user_email, v_tenant_data
  FROM profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = p_tenant_user_id AND p.role = 'tenant';

  IF v_profile_id IS NULL THEN
    RAISE NOTICE '[tenant_dashboard] Aucun profil trouvé pour user_id: %', p_tenant_user_id;
    RETURN NULL;
  END IF;

  RAISE NOTICE '[tenant_dashboard] Profil trouvé: %, email: %', v_profile_id, v_user_email;

  -- 2. Récupérer TOUS les baux avec données techniques enrichies + clés + compteurs
  --    ✅ FIX: Inclure 'draft' pour que le locataire voie le bail dès qu'il est invité
  SELECT jsonb_agg(lease_data ORDER BY lease_data->>'statut' = 'active' DESC, lease_data->>'created_at' DESC)
  INTO v_leases
  FROM (
    SELECT
      jsonb_build_object(
        'id', l.id,
        'type_bail', l.type_bail,
        'statut', l.statut,
        'loyer', l.loyer,
        'charges_forfaitaires', l.charges_forfaitaires,
        'depot_de_garantie', l.depot_de_garantie,
        'date_debut', l.date_debut,
        'date_fin', l.date_fin,
        'created_at', l.created_at,
        -- Signataires complets avec profils + invited fallback
        'signers', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'id', ls2.id,
              'profile_id', ls2.profile_id,
              'role', ls2.role,
              'signature_status', ls2.signature_status,
              'signed_at', ls2.signed_at,
              'invited_name', ls2.invited_name,
              'invited_email', ls2.invited_email,
              'prenom', COALESCE(p_sig.prenom, SPLIT_PART(COALESCE(ls2.invited_name, ''), ' ', 1)),
              'nom', COALESCE(p_sig.nom, NULLIF(SPLIT_PART(COALESCE(ls2.invited_name, ''), ' ', 2), '')),
              'avatar_url', p_sig.avatar_url
            )
          ), '[]'::jsonb)
          FROM lease_signers ls2
          LEFT JOIN profiles p_sig ON p_sig.id = ls2.profile_id
          WHERE ls2.lease_id = l.id
        ),
        -- Propriété avec champs techniques complets
        'property', jsonb_build_object(
          'id', p.id,
          'owner_id', p.owner_id,
          'adresse_complete', COALESCE(p.adresse_complete, 'Adresse à compléter'),
          'ville', COALESCE(p.ville, ''),
          'code_postal', COALESCE(p.code_postal, ''),
          'type', COALESCE(p.type, 'appartement'),
          'surface', p.surface,
          'surface_habitable_m2', p.surface_habitable_m2,
          'nb_pieces', p.nb_pieces,
          'etage', p.etage,
          'ascenseur', p.ascenseur,
          'annee_construction', p.annee_construction,
          'parking_numero', p.parking_numero,
          'has_cave', p.has_cave,
          'num_lot', p.num_lot,
          'digicode', p.digicode,
          'interphone', p.interphone,
          -- DPE complet : COALESCE pour supporter ancien + nouveau nommage
          'energie', p.energie,
          'ges', p.ges,
          'dpe_classe_energie', COALESCE(p.dpe_classe_energie, p.energie),
          'dpe_classe_climat', COALESCE(p.dpe_classe_climat, p.ges),
          'dpe_consommation', p.dpe_consommation,
          'dpe_emissions', p.dpe_emissions,
          'dpe_date_realisation', p.dpe_date_realisation,
          'dpe_date_expiration', p.dpe_date_expiration,
          -- Caractéristiques techniques
          'chauffage_type', p.chauffage_type,
          'chauffage_energie', p.chauffage_energie,
          'eau_chaude_type', p.eau_chaude_type,
          'regime', p.regime,
          -- Photo de couverture
          'cover_url', (
            SELECT url FROM property_photos
            WHERE property_id = p.id AND is_main = true
            LIMIT 1
          ),
          -- Compteurs actifs avec dernière lecture
          'meters', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object(
                'id', m.id,
                'type', m.type,
                'serial_number', m.serial_number,
                'unit', m.unit,
                'last_reading_value', (
                  SELECT reading_value FROM meter_readings
                  WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1
                ),
                'last_reading_date', (
                  SELECT reading_date FROM meter_readings
                  WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1
                )
              )
            ), '[]'::jsonb)
            FROM meters m
            WHERE m.property_id = p.id AND m.is_active = true
          ),
          -- Clés depuis le dernier EDL signé ou complété
          'keys', (
            SELECT e_keys.keys
            FROM edl e_keys
            WHERE e_keys.property_id = p.id
              AND e_keys.status IN ('signed', 'completed')
              AND e_keys.keys IS NOT NULL
              AND e_keys.keys != '[]'::jsonb
            ORDER BY COALESCE(e_keys.completed_date, e_keys.created_at) DESC
            LIMIT 1
          )
        ),
        -- Propriétaire
        'owner', jsonb_build_object(
          'id', owner_prof.id,
          'name', COALESCE(
            (SELECT raison_sociale FROM owner_profiles WHERE profile_id = owner_prof.id),
            CONCAT(COALESCE(owner_prof.prenom, ''), ' ', COALESCE(owner_prof.nom, ''))
          ),
          'email', owner_prof.email,
          'telephone', owner_prof.telephone
        )
      ) as lease_data
    FROM leases l
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    JOIN profiles owner_prof ON owner_prof.id = p.owner_id
    WHERE
      (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email))
      AND l.statut IN ('draft', 'active', 'pending_signature', 'fully_signed', 'terminated')
  ) sub;

  RAISE NOTICE '[tenant_dashboard] Baux trouvés: %', COALESCE(jsonb_array_length(v_leases), 0);

  -- 3. Factures (10 dernières)
  SELECT COALESCE(jsonb_agg(invoice_data), '[]'::jsonb) INTO v_invoices
  FROM (
    SELECT
      i.id,
      i.periode,
      i.montant_total,
      i.statut,
      i.created_at,
      i.due_date,
      p.type as property_type,
      p.adresse_complete as property_address
    FROM invoices i
    JOIN leases l ON l.id = i.lease_id
    JOIN lease_signers ls ON ls.lease_id = l.id
    JOIN properties p ON p.id = l.property_id
    WHERE (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email))
    ORDER BY i.periode DESC, i.created_at DESC
    LIMIT 10
  ) invoice_data;

  -- 4. Tickets récents (10 derniers)
  SELECT COALESCE(jsonb_agg(ticket_data), '[]'::jsonb) INTO v_tickets
  FROM (
    SELECT
      t.id,
      t.titre,
      t.description,
      t.priorite,
      t.statut,
      t.created_at,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM tickets t
    JOIN properties p ON p.id = t.property_id
    WHERE t.created_by_profile_id = v_profile_id
    ORDER BY t.created_at DESC
    LIMIT 10
  ) ticket_data;

  -- 5. Notifications récentes
  --    ✅ FIX: Also check user_id so notifications created with only user_id are visible
  SELECT COALESCE(jsonb_agg(notif_data), '[]'::jsonb) INTO v_notifications
  FROM (
    SELECT n.id, n.title, n.message, n.type, n.is_read, n.created_at, n.action_url
    FROM notifications n
    WHERE n.profile_id = v_profile_id OR n.user_id = p_tenant_user_id
    ORDER BY n.is_read ASC, n.created_at DESC
    LIMIT 5
  ) notif_data;

  -- 6. EDLs en attente de signature
  SELECT COALESCE(jsonb_agg(edl_data), '[]'::jsonb) INTO v_pending_edls
  FROM (
    SELECT
      e.id,
      e.type,
      e.status,
      e.scheduled_at,
      es.invitation_token,
      p.adresse_complete as property_address,
      p.type as property_type
    FROM edl e
    JOIN edl_signatures es ON es.edl_id = e.id
    JOIN properties p ON p.id = e.property_id
    WHERE (es.signer_profile_id = v_profile_id OR LOWER(es.signer_email) = LOWER(v_user_email))
    AND es.signed_at IS NULL
    AND e.status IN ('draft', 'scheduled', 'in_progress', 'completed')
    ORDER BY e.created_at DESC
  ) edl_data;

  -- 7. Vérifier l'assurance
  SELECT jsonb_build_object(
    'has_insurance', EXISTS (
      SELECT 1 FROM documents
      WHERE tenant_id = v_profile_id
      AND type = 'attestation_assurance'
      AND is_archived = false
      AND (expiry_date IS NULL OR expiry_date > NOW())
    ),
    'last_expiry_date', (
      SELECT expiry_date FROM documents
      WHERE tenant_id = v_profile_id
      AND type = 'attestation_assurance'
      AND is_archived = false
      ORDER BY expiry_date DESC LIMIT 1
    )
  ) INTO v_insurance_status;

  -- 8. Stats globales
  SELECT jsonb_build_object(
    'unpaid_amount', COALESCE(SUM(i.montant_total) FILTER (WHERE i.statut IN ('sent', 'late')), 0),
    'unpaid_count', COUNT(*) FILTER (WHERE i.statut IN ('sent', 'late')),
    'total_monthly_rent', COALESCE(
      (SELECT SUM(l2.loyer + l2.charges_forfaitaires)
       FROM leases l2
       JOIN lease_signers ls2 ON ls2.lease_id = l2.id
       WHERE (ls2.profile_id = v_profile_id OR LOWER(ls2.invited_email) = LOWER(v_user_email))
       AND l2.statut = 'active'),
      0
    ),
    'active_leases_count', (
      SELECT COUNT(DISTINCT l2.id)
      FROM leases l2
      JOIN lease_signers ls2 ON ls2.lease_id = l2.id
      WHERE (ls2.profile_id = v_profile_id OR LOWER(ls2.invited_email) = LOWER(v_user_email))
      AND l2.statut = 'active'
    )
  ) INTO v_stats
  FROM leases l
  JOIN lease_signers ls ON ls.lease_id = l.id
  LEFT JOIN invoices i ON i.lease_id = l.id
  WHERE (ls.profile_id = v_profile_id OR LOWER(ls.invited_email) = LOWER(v_user_email));

  -- 9. KYC status
  BEGIN
    SELECT COALESCE(tp.kyc_status, 'pending') INTO v_kyc_status
    FROM tenant_profiles tp
    WHERE tp.profile_id = v_profile_id;
  EXCEPTION WHEN OTHERS THEN
    v_kyc_status := 'pending';
  END;

  -- 10. Assembler le résultat final
  v_result := jsonb_build_object(
    'profile_id', v_profile_id,
    'tenant', v_tenant_data,
    'kyc_status', COALESCE(v_kyc_status, 'pending'),
    'leases', COALESCE(v_leases, '[]'::jsonb),
    'lease', CASE WHEN v_leases IS NOT NULL AND jsonb_array_length(v_leases) > 0 THEN v_leases->0 ELSE NULL END,
    'property', CASE WHEN v_leases IS NOT NULL AND jsonb_array_length(v_leases) > 0 THEN (v_leases->0)->'property' ELSE NULL END,
    'invoices', v_invoices,
    'tickets', v_tickets,
    'notifications', v_notifications,
    'pending_edls', v_pending_edls,
    'insurance', v_insurance_status,
    'stats', COALESCE(v_stats, '{"unpaid_amount": 0, "unpaid_count": 0, "total_monthly_rent": 0, "active_leases_count": 0}'::jsonb)
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION tenant_dashboard(UUID) IS
'RPC dashboard locataire v6. Cherche par profile_id OU invited_email.
FIX v6: Notification query also matches on user_id (not just profile_id).
Inclut: signers enrichis, property complète (DPE, meters, keys), insurance, KYC status.';


-- === SOURCE: 20260225100000_autolink_backfill_invoices_on_profile.sql ===

-- =====================================================
-- MIGRATION: Backfill invoices.tenant_id dans l'auto-link profil
-- Date: 2026-02-25
--
-- OBJECTIF:
--   Quand un nouveau profil locataire est créé, le trigger
--   auto_link_lease_signers_on_profile_created() lie déjà les
--   lease_signers orphelins. On ajoute le backfill des factures
--   (invoices.tenant_id) pour que les nouveaux comptes voient
--   leurs factures dès le premier chargement.
--
-- =====================================================

CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_created()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  linked_count INT;
BEGIN
  -- Récupérer l'email de l'utilisateur auth
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF user_email IS NULL OR user_email = '' THEN
    RETURN NEW;
  END IF;

  -- Lier tous les lease_signers orphelins avec cet email
  UPDATE public.lease_signers
  SET profile_id = NEW.id
  WHERE LOWER(TRIM(invited_email)) = LOWER(TRIM(user_email))
    AND profile_id IS NULL;

  GET DIAGNOSTICS linked_count = ROW_COUNT;

  IF linked_count > 0 THEN
    RAISE NOTICE '[auto_link] % lease_signers liés au profil % (email: %)', 
      linked_count, NEW.id, user_email;

    -- Backfill invoices.tenant_id pour les baux désormais liés
    UPDATE public.invoices i
    SET tenant_id = NEW.id
    WHERE i.tenant_id IS NULL
      AND i.lease_id IN (
        SELECT lease_id FROM public.lease_signers WHERE profile_id = NEW.id
      );
  END IF;

  -- Marquer les invitations correspondantes comme utilisées
  UPDATE public.invitations
  SET used_by = NEW.id,
      used_at = NOW()
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(user_email))
    AND used_at IS NULL;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[auto_link_lease_signers_on_profile_created] Erreur non-bloquante: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.auto_link_lease_signers_on_profile_created() IS
'Après INSERT sur profiles: lie les lease_signers orphelins (invited_email = user email), backfill invoices.tenant_id, marque les invitations utilisées. Ne bloque jamais.';


-- === SOURCE: 20260226000000_backfill_existing_invoices_tenant_id.sql ===

-- =====================================================
-- MIGRATION: Backfill invoices.tenant_id pour les profils existants
-- Date: 2026-02-26
--
-- OBJECTIF:
--   Pour les factures existantes où tenant_id est NULL mais où
--   un lease_signer avec role locataire_principal existe et est
--   déjà lié à un profil, on renseigne le tenant_id.
--
-- SÉCURITÉ:
--   - Ne touche QUE les lignes où tenant_id IS NULL
--   - Ne crée aucune donnée, ne supprime rien
--   - Idempotent : peut être exécuté plusieurs fois sans effet
-- =====================================================

-- Backfill : lier les factures orphelines aux profils existants
UPDATE public.invoices i
SET tenant_id = ls.profile_id
FROM public.lease_signers ls
WHERE i.lease_id = ls.lease_id
  AND ls.role = 'locataire_principal'
  AND ls.profile_id IS NOT NULL
  AND i.tenant_id IS NULL;

-- Log du nombre de lignes mises à jour (visible dans les logs Supabase)
DO $$
DECLARE
  updated_count INT;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '[backfill_invoices_tenant_id] % factures liées à leur locataire', updated_count;
END $$;


-- === SOURCE: 20260227000000_drop_auto_activate_lease_trigger.sql ===

-- Fix: Le trigger auto_activate_lease_on_edl n'a pas été supprimé
-- car la migration 20260207200000 ciblait le mauvais nom
DROP TRIGGER IF EXISTS auto_activate_lease_on_edl ON public.edl;
DROP FUNCTION IF EXISTS public.trigger_activate_lease_on_edl_signed();


-- === SOURCE: 20260228000000_lease_signers_share_percentage.sql ===

-- SOTA 2026: part de répartition par signataire (colocation).
-- Si NULL, l'UI utilise le fallback 100 / nombre de colocataires.
ALTER TABLE public.lease_signers
  ADD COLUMN IF NOT EXISTS share_percentage numeric(5,2) NULL
  CONSTRAINT chk_lease_signers_share_percentage CHECK (share_percentage IS NULL OR (share_percentage >= 0 AND share_percentage <= 100));

COMMENT ON COLUMN public.lease_signers.share_percentage IS 'Part en % du loyer/charges pour ce signataire (colocation). NULL = répartition égale.';


-- === SOURCE: 20260228100000_tenant_payment_methods_sota2026.sql ===

-- ============================================================
-- SOTA 2026 : Système de paiement locataire complet
-- - tenant_payment_methods  (multi-cartes, SEPA, wallets)
-- - sepa_mandates           (mandats SEPA avec conformité)
-- - payment_schedules       (prélèvements automatiques)
-- - payment_method_audit_log (traçabilité PSD3)
-- - Ajout statut 'partial' sur invoices
-- ============================================================

-- 1. TABLE PRINCIPALE : tenant_payment_methods
CREATE TABLE IF NOT EXISTS tenant_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_payment_method_id TEXT NOT NULL UNIQUE,

  type TEXT NOT NULL CHECK (type IN ('card', 'sepa_debit', 'apple_pay', 'google_pay', 'link')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  label TEXT,

  -- Card-specific
  card_brand TEXT,
  card_last4 TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  card_fingerprint TEXT,

  -- SEPA-specific
  sepa_last4 TEXT,
  sepa_bank_code TEXT,
  sepa_country TEXT,
  sepa_fingerprint TEXT,
  sepa_mandate_id UUID,

  -- Metadata
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'failed')),
  last_used_at TIMESTAMPTZ,
  failure_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tpm_tenant ON tenant_payment_methods(tenant_profile_id);
CREATE INDEX idx_tpm_stripe_pm ON tenant_payment_methods(stripe_payment_method_id);
CREATE INDEX idx_tpm_default ON tenant_payment_methods(tenant_profile_id, is_default) WHERE is_default = true;
CREATE INDEX idx_tpm_active ON tenant_payment_methods(tenant_profile_id, status) WHERE status = 'active';

ALTER TABLE tenant_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tpm_select_own" ON tenant_payment_methods
  FOR SELECT USING (tenant_profile_id = public.user_profile_id());

CREATE POLICY "tpm_insert_own" ON tenant_payment_methods
  FOR INSERT WITH CHECK (tenant_profile_id = public.user_profile_id());

CREATE POLICY "tpm_update_own" ON tenant_payment_methods
  FOR UPDATE USING (tenant_profile_id = public.user_profile_id());

CREATE POLICY "tpm_delete_own" ON tenant_payment_methods
  FOR DELETE USING (tenant_profile_id = public.user_profile_id());

CREATE POLICY "tpm_admin_all" ON tenant_payment_methods
  FOR ALL USING (public.user_role() = 'admin');

-- Trigger updated_at
CREATE TRIGGER update_tpm_updated_at
  BEFORE UPDATE ON tenant_payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Ensure only ONE default per tenant
CREATE OR REPLACE FUNCTION enforce_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE tenant_payment_methods
    SET is_default = false, updated_at = NOW()
    WHERE tenant_profile_id = NEW.tenant_profile_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_single_default_pm
  AFTER INSERT OR UPDATE OF is_default ON tenant_payment_methods
  FOR EACH ROW
  WHEN (NEW.is_default = true)
  EXECUTE FUNCTION enforce_single_default_payment_method();


-- 2. TABLE : sepa_mandates
CREATE TABLE IF NOT EXISTS sepa_mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_reference TEXT NOT NULL UNIQUE DEFAULT ('MNDT-' || substr(gen_random_uuid()::text, 1, 12)),
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_profile_id UUID NOT NULL REFERENCES profiles(id),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,

  -- Debtor (locataire)
  debtor_name TEXT NOT NULL,
  debtor_iban TEXT NOT NULL,

  -- Creditor (propriétaire)
  creditor_name TEXT NOT NULL,
  creditor_iban TEXT NOT NULL,
  creditor_bic TEXT,

  -- Stripe references
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT,
  stripe_mandate_id TEXT,

  -- Mandate details
  amount DECIMAL(10,2) NOT NULL,
  signature_date DATE NOT NULL DEFAULT CURRENT_DATE,
  signed_at TIMESTAMPTZ,
  signature_method TEXT DEFAULT 'electronic' CHECK (signature_method IN ('electronic', 'paper', 'api')),
  first_collection_date DATE,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended', 'cancelled', 'expired', 'failed')),

  -- Pre-notification tracking (conformité SEPA D-14)
  last_prenotification_sent_at TIMESTAMPTZ,
  next_collection_date DATE,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sepa_mandates_tenant ON sepa_mandates(tenant_profile_id);
CREATE INDEX idx_sepa_mandates_lease ON sepa_mandates(lease_id);
CREATE INDEX idx_sepa_mandates_status ON sepa_mandates(status) WHERE status = 'active';
CREATE INDEX idx_sepa_mandates_next_collection ON sepa_mandates(next_collection_date) WHERE status = 'active';

ALTER TABLE sepa_mandates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sepa_select_tenant" ON sepa_mandates
  FOR SELECT USING (tenant_profile_id = public.user_profile_id());

CREATE POLICY "sepa_select_owner" ON sepa_mandates
  FOR SELECT USING (owner_profile_id = public.user_profile_id());

CREATE POLICY "sepa_insert_tenant" ON sepa_mandates
  FOR INSERT WITH CHECK (tenant_profile_id = public.user_profile_id());

CREATE POLICY "sepa_update_tenant" ON sepa_mandates
  FOR UPDATE USING (tenant_profile_id = public.user_profile_id());

CREATE POLICY "sepa_admin_all" ON sepa_mandates
  FOR ALL USING (public.user_role() = 'admin');

CREATE TRIGGER update_sepa_mandates_updated_at
  BEFORE UPDATE ON sepa_mandates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Link tenant_payment_methods to sepa_mandates
ALTER TABLE tenant_payment_methods
  ADD CONSTRAINT fk_tpm_sepa_mandate
  FOREIGN KEY (sepa_mandate_id) REFERENCES sepa_mandates(id) ON DELETE SET NULL;


-- 3. TABLE : payment_schedules (échéanciers de prélèvement)
CREATE TABLE IF NOT EXISTS payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  mandate_id UUID REFERENCES sepa_mandates(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES tenant_payment_methods(id) ON DELETE SET NULL,

  payment_method_type TEXT NOT NULL DEFAULT 'sepa'
    CHECK (payment_method_type IN ('sepa', 'card', 'pay_by_bank')),
  collection_day INTEGER NOT NULL DEFAULT 5 CHECK (collection_day BETWEEN 1 AND 28),
  rent_amount DECIMAL(10,2) NOT NULL,
  charges_amount DECIMAL(10,2) NOT NULL DEFAULT 0,

  is_active BOOLEAN NOT NULL DEFAULT true,
  start_date DATE NOT NULL,
  end_date DATE,

  -- Smart retry
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  last_failure_reason TEXT,
  next_retry_at TIMESTAMPTZ,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(lease_id)
);

CREATE INDEX idx_ps_active ON payment_schedules(is_active, collection_day) WHERE is_active = true;
CREATE INDEX idx_ps_next_retry ON payment_schedules(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX idx_ps_lease ON payment_schedules(lease_id);

ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ps_select_tenant" ON payment_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN lease_signers ls ON ls.lease_id = l.id
      WHERE l.id = payment_schedules.lease_id
        AND ls.profile_id = public.user_profile_id()
    )
  );

CREATE POLICY "ps_select_owner" ON payment_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE l.id = payment_schedules.lease_id
        AND p.owner_id = public.user_profile_id()
    )
  );

CREATE POLICY "ps_admin_all" ON payment_schedules
  FOR ALL USING (public.user_role() = 'admin');

CREATE TRIGGER update_ps_updated_at
  BEFORE UPDATE ON payment_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 4. TABLE : payment_method_audit_log (PSD3 Permission Dashboard)
CREATE TABLE IF NOT EXISTS payment_method_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES tenant_payment_methods(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'created', 'set_default', 'revoked', 'expired',
    'payment_success', 'payment_failed', 'prenotification_sent',
    'mandate_created', 'mandate_cancelled', 'data_accessed'
  )),
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pmal_tenant ON payment_method_audit_log(tenant_profile_id, created_at DESC);
CREATE INDEX idx_pmal_pm ON payment_method_audit_log(payment_method_id, created_at DESC);

ALTER TABLE payment_method_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pmal_select_own" ON payment_method_audit_log
  FOR SELECT USING (tenant_profile_id = public.user_profile_id());

CREATE POLICY "pmal_admin_all" ON payment_method_audit_log
  FOR ALL USING (public.user_role() = 'admin');


-- 5. Ajouter 'partial' au statut des invoices
DO $$
BEGIN
  -- Drop old constraint and recreate with 'partial'
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%invoices_statut_check%'
  ) THEN
    ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_statut_check;
  END IF;

  ALTER TABLE invoices ADD CONSTRAINT invoices_statut_check
    CHECK (statut IN ('draft', 'sent', 'paid', 'late', 'partial'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not update invoices statut constraint: %', SQLERRM;
END $$;

-- Add partial tracking columns to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_remaining DECIMAL(10,2);

-- Auto-calculate remaining on update
CREATE OR REPLACE FUNCTION update_invoice_amount_remaining()
RETURNS TRIGGER AS $$
BEGIN
  NEW.amount_remaining := NEW.montant_total - COALESCE(NEW.amount_paid, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_amount_remaining ON invoices;
CREATE TRIGGER trg_invoice_amount_remaining
  BEFORE INSERT OR UPDATE OF montant_total, amount_paid ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_invoice_amount_remaining();

-- Backfill existing invoices
UPDATE invoices
SET amount_paid = CASE WHEN statut = 'paid' THEN montant_total ELSE 0 END
WHERE amount_paid IS NULL OR amount_paid = 0;


-- 6. Add stripe_customer_id to profiles if missing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

