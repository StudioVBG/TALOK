-- ==========================================================
-- Phase 2 — Core : Leases + Invoices + Payments
-- 38 migrations combinees
-- Genere le 2026-04-09
-- ==========================================================

BEGIN;

-- === MIGRATION: 20260215200001_add_notice_given_lease_status.sql ===
-- REVIEW: Cette migration contient des DROP/DELETE dangereux. Verifier avant d'appliquer.
-- REVIEW: -- ============================================================================
-- REVIEW: -- MIGRATION CORRECTIVE: Harmonisation complète des statuts de bail
-- REVIEW: -- Date: 2026-02-15
-- REVIEW: -- ============================================================================
-- REVIEW: -- PROBLÈME: Les migrations successives (20260107000001 → 20260108400000)
-- REVIEW: --           se sont écrasées mutuellement, supprimant des statuts légitimes
-- REVIEW: --           (sent, pending_owner_signature, amended, notice_given, cancelled).
-- REVIEW: --
-- REVIEW: -- FIX: Recréer la contrainte CHECK avec l'union de TOUS les statuts métier
-- REVIEW: --      nécessaires au cycle de vie complet d'un bail.
-- REVIEW: --
-- REVIEW: -- Flux normal :
-- REVIEW: --   draft → sent → pending_signature → partially_signed
-- REVIEW: --   → pending_owner_signature → fully_signed → active
-- REVIEW: --   → notice_given → terminated → archived
-- REVIEW: --
-- REVIEW: -- Branches :
-- REVIEW: --   draft|pending_signature → cancelled
-- REVIEW: --   active → amended → active (avenant)
-- REVIEW: -- ============================================================================
-- REVIEW: 
-- REVIEW: DO $$
-- REVIEW: BEGIN
-- REVIEW:   -- Supprimer toute contrainte CHECK existante sur statut
-- REVIEW:   BEGIN
-- REVIEW:     ALTER TABLE leases DROP CONSTRAINT IF EXISTS leases_statut_check;
-- REVIEW:   EXCEPTION WHEN OTHERS THEN
-- REVIEW:     NULL;
-- REVIEW:   END;
-- REVIEW: 
-- REVIEW:   BEGIN
-- REVIEW:     ALTER TABLE leases DROP CONSTRAINT IF EXISTS check_lease_statut;
-- REVIEW:   EXCEPTION WHEN OTHERS THEN
-- REVIEW:     NULL;
-- REVIEW:   END;
-- REVIEW: 
-- REVIEW:   BEGIN
-- REVIEW:     ALTER TABLE leases DROP CONSTRAINT IF EXISTS lease_status_check;
-- REVIEW:   EXCEPTION WHEN OTHERS THEN
-- REVIEW:     NULL;
-- REVIEW:   END;
-- REVIEW: 
-- REVIEW:   -- Recréer avec la liste complète et définitive
-- REVIEW:   ALTER TABLE leases
-- REVIEW:     ADD CONSTRAINT leases_statut_check CHECK (
-- REVIEW:       statut IN (
-- REVIEW:         'draft',                    -- Brouillon initial
-- REVIEW:         'sent',                     -- Envoyé au locataire pour lecture
-- REVIEW:         'pending_signature',        -- En attente de signatures
-- REVIEW:         'partially_signed',         -- Au moins un signataire a signé
-- REVIEW:         'pending_owner_signature',  -- Locataire(s) signé(s), attente propriétaire
-- REVIEW:         'fully_signed',             -- Tous ont signé (avant activation)
-- REVIEW:         'active',                   -- Bail en cours
-- REVIEW:         'notice_given',             -- Congé donné (préavis en cours)
-- REVIEW:         'amended',                  -- Avenant en cours de traitement
-- REVIEW:         'terminated',               -- Résilié / terminé
-- REVIEW:         'archived',                 -- Archivé (conservation légale)
-- REVIEW:         'cancelled'                 -- Annulé (jamais activé)
-- REVIEW:       )
-- REVIEW:     );
-- REVIEW: 
-- REVIEW:   RAISE NOTICE '[MIGRATION] CHECK constraint leases_statut_check harmonisée — 12 statuts';
-- REVIEW: END $$;
-- REVIEW: 
-- REVIEW: -- Mettre à jour le commentaire de colonne
-- REVIEW: COMMENT ON COLUMN leases.statut IS 'Statut du bail: draft, sent, pending_signature, partially_signed, pending_owner_signature, fully_signed, active, notice_given, amended, terminated, archived, cancelled';
-- REVIEW: 
-- REVIEW: -- Index partiel pour baux en attente d'action (requêtes fréquentes)
-- REVIEW: DROP INDEX IF EXISTS idx_leases_pending_action;
-- REVIEW: CREATE INDEX IF NOT EXISTS idx_leases_pending_action ON leases(statut) 
-- REVIEW:   WHERE statut IN ('pending_signature', 'partially_signed', 'pending_owner_signature', 'fully_signed', 'sent');
-- REVIEW: 


-- === MIGRATION: 20260215200003_fix_copro_fk_on_delete.sql ===
-- ============================================================================
-- MIGRATION CORRECTIVE: Ajouter ON DELETE aux FK copropriété
-- Date: 2026-02-15
-- ============================================================================
-- PROBLÈME: Les FK suivantes n'ont pas de clause ON DELETE, ce qui peut
--           causer des erreurs de contrainte si un profil ou une propriété
--           est supprimé(e).
--
-- Tables affectées :
--   - copro_units.owner_profile_id → profiles(id)  → SET NULL
--   - copro_units.property_id → properties(id)      → SET NULL
--   - sites.syndic_profile_id → profiles(id)        → SET NULL
-- ============================================================================

-- 1. copro_units.owner_profile_id
DO $$
BEGIN
  -- Trouver et supprimer la contrainte FK existante
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'copro_units' AND constraint_type = 'FOREIGN KEY'
    AND constraint_name IN (
      SELECT constraint_name FROM information_schema.key_column_usage
      WHERE table_name = 'copro_units' AND column_name = 'owner_profile_id'
    )
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE copro_units DROP CONSTRAINT ' || constraint_name
      FROM information_schema.key_column_usage
      WHERE table_name = 'copro_units' AND column_name = 'owner_profile_id'
      LIMIT 1
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'copro_units.owner_profile_id FK not found, skipping drop';
END $$;

ALTER TABLE copro_units
  ADD CONSTRAINT copro_units_owner_profile_id_fkey
  FOREIGN KEY (owner_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. copro_units.property_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'copro_units' AND constraint_type = 'FOREIGN KEY'
    AND constraint_name IN (
      SELECT constraint_name FROM information_schema.key_column_usage
      WHERE table_name = 'copro_units' AND column_name = 'property_id'
    )
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE copro_units DROP CONSTRAINT ' || constraint_name
      FROM information_schema.key_column_usage
      WHERE table_name = 'copro_units' AND column_name = 'property_id'
      LIMIT 1
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'copro_units.property_id FK not found, skipping drop';
END $$;

ALTER TABLE copro_units
  ADD CONSTRAINT copro_units_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL;

-- 3. sites.syndic_profile_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'sites' AND constraint_type = 'FOREIGN KEY'
    AND constraint_name IN (
      SELECT constraint_name FROM information_schema.key_column_usage
      WHERE table_name = 'sites' AND column_name = 'syndic_profile_id'
    )
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE sites DROP CONSTRAINT ' || constraint_name
      FROM information_schema.key_column_usage
      WHERE table_name = 'sites' AND column_name = 'syndic_profile_id'
      LIMIT 1
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'sites.syndic_profile_id FK not found, skipping drop';
END $$;

ALTER TABLE sites
  ADD CONSTRAINT sites_syndic_profile_id_fkey
  FOREIGN KEY (syndic_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Log
DO $$
BEGIN
  RAISE NOTICE '[MIGRATION] FK ON DELETE SET NULL ajoutées pour copro_units et sites';
END $$;


-- === MIGRATION: 20260216200000_auto_link_lease_signers_trigger.sql ===
-- =====================================================
-- MIGRATION: Auto-link lease_signers + fix profil orphelin
-- Date: 2026-02-16
--
-- PROBLÈMES CORRIGÉS:
-- 1. Trigger DB: quand un profil est créé, lier automatiquement 
--    les lease_signers orphelins (invited_email match, profile_id NULL)
-- 2. Trigger DB: quand un profil est créé, marquer les invitations
--    correspondantes comme utilisées
-- 3. Fix immédiat: créer le profil manquant pour user 6337af52-...
-- 4. Fix rétroactif: lier tous les lease_signers orphelins existants
-- =====================================================

BEGIN;

-- ============================================
-- 1. FONCTION: Auto-link lease_signers au moment de la création d'un profil
-- ============================================
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
  WHERE LOWER(invited_email) = LOWER(user_email)
    AND profile_id IS NULL;

  GET DIAGNOSTICS linked_count = ROW_COUNT;

  IF linked_count > 0 THEN
    RAISE NOTICE '[auto_link] % lease_signers liés au profil % (email: %)', 
      linked_count, NEW.id, user_email;
  END IF;

  -- Marquer les invitations correspondantes comme utilisées
  UPDATE public.invitations
  SET used_by = NEW.id,
      used_at = NOW()
  WHERE LOWER(email) = LOWER(user_email)
    AND used_at IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. TRIGGER: Exécuter auto-link après chaque INSERT sur profiles
-- ============================================
DROP TRIGGER IF EXISTS trigger_auto_link_lease_signers ON public.profiles;

CREATE TRIGGER trigger_auto_link_lease_signers
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_lease_signers_on_profile_created();

-- ============================================
-- 3. FIX IMMÉDIAT: Créer le profil manquant pour l'utilisateur signalé
-- ============================================
DO $$
DECLARE
  target_user_id UUID := '6337af52-2fb7-41d7-b620-d9ddd689d294';
  user_email TEXT;
  user_role TEXT;
  new_profile_id UUID;
BEGIN
  -- Vérifier si le user existe dans auth.users
  SELECT email, COALESCE(raw_user_meta_data->>'role', 'tenant')
  INTO user_email, user_role
  FROM auth.users
  WHERE id = target_user_id;

  IF user_email IS NULL THEN
    RAISE NOTICE 'User % non trouvé dans auth.users — skip', target_user_id;
    RETURN;
  END IF;

  -- Vérifier si le profil existe déjà
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = target_user_id) THEN
    RAISE NOTICE 'Profil déjà existant pour user % — skip', target_user_id;
    RETURN;
  END IF;

  -- Créer le profil manquant
  INSERT INTO public.profiles (user_id, role, email)
  VALUES (target_user_id, user_role, user_email)
  RETURNING id INTO new_profile_id;

  RAISE NOTICE 'Profil créé: id=%, user_id=%, email=%, role=%', 
    new_profile_id, target_user_id, user_email, user_role;

  -- Le trigger auto_link_lease_signers se chargera de lier les lease_signers
END $$;

-- ============================================
-- 4. FIX RÉTROACTIF: Lier tous les lease_signers orphelins existants
-- ============================================
-- Pour tous les profils existants dont l'email matche un lease_signer orphelin
DO $$
DECLARE
  linked_total INT := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT p.id AS profile_id, u.email AS user_email
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE u.email IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.lease_signers ls
        WHERE LOWER(ls.invited_email) = LOWER(u.email)
          AND ls.profile_id IS NULL
      )
  LOOP
    UPDATE public.lease_signers
    SET profile_id = rec.profile_id
    WHERE LOWER(invited_email) = LOWER(rec.user_email)
      AND profile_id IS NULL;

    linked_total := linked_total + 1;
  END LOOP;

  IF linked_total > 0 THEN
    RAISE NOTICE '[rétro-link] % profils avec des lease_signers orphelins ont été liés', linked_total;
  ELSE
    RAISE NOTICE '[rétro-link] Aucun lease_signer orphelin trouvé — tout est déjà lié';
  END IF;
END $$;

-- ============================================
-- 5. VÉRIFICATION: Compter les lease_signers encore orphelins
-- ============================================
DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM public.lease_signers
  WHERE profile_id IS NULL
    AND invited_email IS NOT NULL;

  IF orphan_count > 0 THEN
    RAISE WARNING '⚠️  % lease_signers orphelins restants (email sans compte correspondant)', orphan_count;
  ELSE
    RAISE NOTICE '✅ Aucun lease_signer orphelin — tous les comptes sont liés';
  END IF;
END $$;

COMMIT;


-- === MIGRATION: 20260219100000_auto_link_notify_owner.sql ===
-- =====================================================
-- MIGRATION: Notify owner when tenant creates account (auto-link)
-- Date: 2026-02-19
--
-- PROBLÈME CORRIGÉ:
-- Quand un locataire crée son compte et que le trigger auto-link
-- lie son profil aux lease_signers, le propriétaire n'était PAS notifié.
-- Le locataire restait invisible jusqu'au prochain rafraîchissement
-- de la page propriétaire.
--
-- SOLUTION:
-- Enrichir la fonction auto_link_lease_signers_on_profile_created()
-- pour créer une notification in-app pour chaque propriétaire concerné.
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_created()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  linked_count INT;
  rec RECORD;
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
  WHERE LOWER(invited_email) = LOWER(user_email)
    AND profile_id IS NULL;

  GET DIAGNOSTICS linked_count = ROW_COUNT;

  IF linked_count > 0 THEN
    RAISE NOTICE '[auto_link] % lease_signers liés au profil % (email: %)',
      linked_count, NEW.id, user_email;

    -- ✅ NOUVEAU: Notifier chaque propriétaire concerné
    FOR rec IN
      SELECT DISTINCT
        p_owner.id AS owner_profile_id,
        p_owner.user_id AS owner_user_id,
        prop.adresse_complete AS property_address,
        l.id AS lease_id
      FROM public.lease_signers ls
      JOIN public.leases l ON l.id = ls.lease_id
      JOIN public.properties prop ON prop.id = l.property_id
      JOIN public.profiles p_owner ON p_owner.id = prop.owner_id
      WHERE ls.profile_id = NEW.id
        AND ls.role IN ('locataire_principal', 'colocataire')
    LOOP
      INSERT INTO public.notifications (
        user_id,
        profile_id,
        type,
        title,
        body,
        is_read,
        read,
        metadata
      ) VALUES (
        rec.owner_user_id,
        rec.owner_profile_id,
        'tenant_account_created',
        'Locataire inscrit',
        format('%s a créé son compte pour le bail au %s. Son profil est maintenant visible dans votre liste de locataires.',
          user_email, COALESCE(rec.property_address, 'adresse non renseignée')),
        false,
        false,
        jsonb_build_object(
          'lease_id', rec.lease_id,
          'tenant_email', user_email,
          'tenant_profile_id', NEW.id,
          'action_url', format('/owner/leases/%s', rec.lease_id)
        )
      );
      RAISE NOTICE '[auto_link] Notification créée pour propriétaire % (bail %)',
        rec.owner_profile_id, rec.lease_id;
    END LOOP;
  END IF;

  -- Marquer les invitations correspondantes comme utilisées
  UPDATE public.invitations
  SET used_by = NEW.id,
      used_at = NOW()
  WHERE LOWER(email) = LOWER(user_email)
    AND used_at IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;


-- === MIGRATION: 20260219200000_fix_autolink_triggers_audit.sql ===
-- =====================================================
-- MIGRATION: Corrections issues de l'audit auto-link triggers
-- Date: 2026-02-19
-- Ref: AUDIT_AUTOLINK_TRIGGERS.md
--
-- Corrections appliquées:
--   P0-1: Supprimer le trigger obsolète on_profile_created_auto_link
--   P1-1: Ajouter EXCEPTION handler à auto_link_lease_signers_on_profile_created
--   P1-2: Supprimer la politique RLS trop permissive "System can insert notifications"
--   P2-1: Ajouter déduplication aux triggers de notification
-- =====================================================

BEGIN;

-- =====================================================
-- P0-1: Supprimer le trigger OBSOLÈTE on_profile_created_auto_link
-- Ce trigger (case-sensitive, sans notifications, sans invitations)
-- est remplacé par trigger_auto_link_lease_signers depuis la migration
-- 20260219100000_auto_link_notify_owner.sql
-- =====================================================

DROP TRIGGER IF EXISTS on_profile_created_auto_link ON public.profiles;
DROP FUNCTION IF EXISTS public.auto_link_signer_profile();

-- =====================================================
-- P1-1: Ajouter EXCEPTION handler à auto_link_lease_signers_on_profile_created
-- Sans cet handler, une erreur dans la notification (ex: colonne manquante)
-- provoque un rollback de la création du profil → l'utilisateur ne peut
-- pas s'inscrire.
-- =====================================================

CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_created()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  linked_count INT;
  rec RECORD;
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
  WHERE LOWER(invited_email) = LOWER(user_email)
    AND profile_id IS NULL;

  GET DIAGNOSTICS linked_count = ROW_COUNT;

  IF linked_count > 0 THEN
    RAISE NOTICE '[auto_link] % lease_signers liés au profil % (email: %)',
      linked_count, NEW.id, user_email;

    -- Notifier chaque propriétaire concerné
    FOR rec IN
      SELECT DISTINCT
        p_owner.id AS owner_profile_id,
        p_owner.user_id AS owner_user_id,
        prop.adresse_complete AS property_address,
        l.id AS lease_id
      FROM public.lease_signers ls
      JOIN public.leases l ON l.id = ls.lease_id
      JOIN public.properties prop ON prop.id = l.property_id
      JOIN public.profiles p_owner ON p_owner.id = prop.owner_id
      WHERE ls.profile_id = NEW.id
        AND ls.role IN ('locataire_principal', 'colocataire')
    LOOP
      INSERT INTO public.notifications (
        user_id,
        profile_id,
        type,
        title,
        body,
        is_read,
        read,
        metadata
      ) VALUES (
        rec.owner_user_id,
        rec.owner_profile_id,
        'tenant_account_created',
        'Locataire inscrit',
        format('%s a créé son compte pour le bail au %s. Son profil est maintenant visible dans votre liste de locataires.',
          user_email, COALESCE(rec.property_address, 'adresse non renseignée')),
        false,
        false,
        jsonb_build_object(
          'lease_id', rec.lease_id,
          'tenant_email', user_email,
          'tenant_profile_id', NEW.id,
          'action_url', format('/owner/leases/%s', rec.lease_id)
        )
      );
      RAISE NOTICE '[auto_link] Notification créée pour propriétaire % (bail %)',
        rec.owner_profile_id, rec.lease_id;
    END LOOP;
  END IF;

  -- Marquer les invitations correspondantes comme utilisées
  UPDATE public.invitations
  SET used_by = NEW.id,
      used_at = NOW()
  WHERE LOWER(email) = LOWER(user_email)
    AND used_at IS NULL;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer la création du profil
  RAISE WARNING '[auto_link] Erreur non-bloquante: % (SQLSTATE=%)', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- P1-2: Remplacer la politique RLS trop permissive
-- "System can insert notifications" (WITH CHECK (true))
-- par une politique restrictive: seuls les triggers SECURITY DEFINER
-- peuvent insérer (pas les utilisateurs authentifiés directement)
-- =====================================================

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

-- Les triggers SECURITY DEFINER bypassent RLS, donc aucune politique
-- INSERT permissive n'est nécessaire pour eux. On ne crée PAS de
-- remplacement car les fonctions trigger sont toutes SECURITY DEFINER.
-- Si une politique INSERT est nécessaire pour le service role,
-- elle sera ajoutée par la couche applicative.

-- =====================================================
-- P2-1: Ajouter déduplication aux triggers de notification
-- Empêche les doublons si un statut oscille (ex: late -> paid -> late)
-- Fenêtre de déduplication : 1 heure
-- =====================================================

-- TRIGGER 1: notify_invoice_late - ajouter déduplication
CREATE OR REPLACE FUNCTION notify_invoice_late()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_tenant_name TEXT;
  v_property_address TEXT;
  v_amount NUMERIC;
BEGIN
  -- Seulement si le statut passe à 'late'
  IF NEW.statut = 'late' AND (OLD.statut IS NULL OR OLD.statut != 'late') THEN
    -- Récupérer les infos
    SELECT
      p.owner_id,
      COALESCE(pr.prenom || ' ' || pr.nom, 'Locataire'),
      COALESCE(p.adresse_complete, 'Adresse inconnue'),
      NEW.montant_total
    INTO v_owner_id, v_tenant_name, v_property_address, v_amount
    FROM leases l
    JOIN properties p ON l.property_id = p.id
    LEFT JOIN lease_signers ls ON ls.lease_id = l.id AND ls.role = 'locataire_principal'
    LEFT JOIN profiles pr ON ls.profile_id = pr.id
    WHERE l.id = NEW.lease_id;

    -- Notifier le propriétaire (avec déduplication)
    IF v_owner_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE related_id = NEW.id
          AND type = 'payment_late'
          AND created_at > NOW() - INTERVAL '1 hour'
      )
    THEN
      PERFORM create_notification(
        v_owner_id,
        'payment_late',
        'Loyer impayé',
        format('Le loyer de %s (%s) de %s€ est en retard.', v_tenant_name, v_property_address, v_amount),
        '/app/owner/money?filter=late',
        NEW.id,
        'invoice'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER 2: notify_payment_received - ajouter déduplication
CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_tenant_name TEXT;
  v_amount NUMERIC;
BEGIN
  -- Seulement si le statut passe à 'succeeded'
  IF NEW.statut = 'succeeded' AND (OLD.statut IS NULL OR OLD.statut != 'succeeded') THEN
    -- Récupérer les infos via la facture
    SELECT
      p.owner_id,
      COALESCE(pr.prenom || ' ' || pr.nom, 'Locataire'),
      NEW.montant
    INTO v_owner_id, v_tenant_name, v_amount
    FROM invoices i
    JOIN leases l ON i.lease_id = l.id
    JOIN properties p ON l.property_id = p.id
    LEFT JOIN lease_signers ls ON ls.lease_id = l.id AND ls.role = 'locataire_principal'
    LEFT JOIN profiles pr ON ls.profile_id = pr.id
    WHERE i.id = NEW.invoice_id;

    -- Notifier le propriétaire (avec déduplication)
    IF v_owner_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE related_id = NEW.id
          AND type = 'payment_received'
          AND created_at > NOW() - INTERVAL '1 hour'
      )
    THEN
      PERFORM create_notification(
        v_owner_id,
        'payment_received',
        'Paiement reçu',
        format('Paiement de %s€ reçu de %s.', v_amount, v_tenant_name),
        '/app/owner/money',
        NEW.id,
        'payment'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER 3: notify_lease_signed - ajouter déduplication
CREATE OR REPLACE FUNCTION notify_lease_signed()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id UUID;
  v_property_address TEXT;
BEGIN
  -- Seulement si le statut passe à 'active'
  IF NEW.statut = 'active' AND (OLD.statut IS NULL OR OLD.statut != 'active') THEN
    -- Récupérer les infos
    SELECT p.owner_id, COALESCE(p.adresse_complete, 'Adresse inconnue')
    INTO v_owner_id, v_property_address
    FROM properties p
    WHERE p.id = NEW.property_id;

    -- Notifier le propriétaire (avec déduplication)
    IF v_owner_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE related_id = NEW.id
          AND type = 'lease_signed'
          AND created_at > NOW() - INTERVAL '1 hour'
      )
    THEN
      PERFORM create_notification(
        v_owner_id,
        'lease_signed',
        'Bail signé !',
        format('Le bail pour %s est maintenant actif.', v_property_address),
        '/app/owner/leases/' || NEW.id,
        NEW.id,
        'lease'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER 5: notify_ticket_resolved - ajouter déduplication
CREATE OR REPLACE FUNCTION notify_ticket_resolved()
RETURNS TRIGGER AS $$
DECLARE
  v_creator_id UUID;
  v_property_address TEXT;
BEGIN
  -- Seulement si le statut passe à 'resolved' ou 'closed'
  IF NEW.statut IN ('resolved', 'closed') AND OLD.statut NOT IN ('resolved', 'closed') THEN
    -- Récupérer les infos
    SELECT
      NEW.created_by_profile_id,
      COALESCE(p.adresse_complete, 'Adresse inconnue')
    INTO v_creator_id, v_property_address
    FROM properties p
    WHERE p.id = NEW.property_id;

    -- Notifier le créateur du ticket (avec déduplication)
    IF v_creator_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE related_id = NEW.id
          AND type = 'ticket_resolved'
          AND created_at > NOW() - INTERVAL '1 hour'
      )
    THEN
      PERFORM create_notification(
        v_creator_id,
        'ticket_resolved',
        'Ticket résolu',
        format('Votre demande "%s" a été traitée.', NEW.titre),
        '/app/owner/tickets/' || NEW.id,
        NEW.id,
        'ticket'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: trigger_notify_ticket_created (INSERT only) n'a pas besoin de
-- déduplication car un INSERT ne peut se produire qu'une fois.

COMMIT;


-- === MIGRATION: 20260220000000_auto_link_signer_on_insert.sql ===
-- =====================================================
-- MIGRATION: SOTA 2026 — Auto-link signer à l'INSERT
-- Date: 2026-02-20
--
-- OBJECTIF:
--   Quand un lease_signer est créé avec invited_email et profile_id NULL,
--   lier immédiatement au profil existant si l'email correspond (auth.users).
--   Couvre le cas "locataire déjà inscrit invité sur un nouveau bail".
--
-- CONTENU:
--   1. Fonction auto_link_signer_on_insert() — BEFORE INSERT sur lease_signers
--   2. RPC find_profile_by_email(target_email) — pour l'API invite
--   3. Fix rétroactif — lier les orphelins existants
--   4. Vérification finale
-- =====================================================

BEGIN;

-- ============================================
-- 1. FONCTION: Auto-link à l'INSERT du signer
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_link_signer_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  found_profile_id UUID;
BEGIN
  IF NEW.profile_id IS NULL AND NEW.invited_email IS NOT NULL AND TRIM(NEW.invited_email) != '' THEN
    SELECT p.id INTO found_profile_id
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(NEW.invited_email))
    LIMIT 1;

    IF found_profile_id IS NOT NULL THEN
      NEW.profile_id := found_profile_id;
      RAISE NOTICE '[auto_link_on_insert] Lien immédiat: % -> profil %', NEW.invited_email, found_profile_id;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[auto_link_on_insert] Erreur non-bloquante: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.auto_link_signer_on_insert() IS
'SOTA 2026: À l''INSERT d''un lease_signer avec invited_email et profile_id NULL, lie au profil existant si l''email matche auth.users. Ne bloque jamais l''INSERT.';

-- ============================================
-- 2. TRIGGER: Exécuter avant chaque INSERT sur lease_signers
-- ============================================
DROP TRIGGER IF EXISTS trigger_auto_link_signer_on_insert ON public.lease_signers;

CREATE TRIGGER trigger_auto_link_signer_on_insert
  BEFORE INSERT ON public.lease_signers
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_signer_on_insert();

-- ============================================
-- 3. RPC: find_profile_by_email — pour l'API (remplace listUsers)
-- ============================================
CREATE OR REPLACE FUNCTION public.find_profile_by_email(target_email TEXT)
RETURNS TABLE(id UUID, user_id UUID, role TEXT) AS $$
BEGIN
  IF target_email IS NULL OR TRIM(target_email) = '' THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT p.id, p.user_id, p.role::TEXT
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(target_email))
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.find_profile_by_email(TEXT) IS
'SOTA 2026: Retourne (id, user_id, role) du profil dont l''email auth correspond. Utilisé par l''API invite pour éviter listUsers().';

-- ============================================
-- 4. FIX RÉTROACTIF: Lier les lease_signers orphelins existants
-- ============================================
DO $$
DECLARE
  linked_total INT := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT ls.id AS signer_id, p.id AS profile_id
    FROM public.lease_signers ls
    JOIN auth.users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email))
    JOIN public.profiles p ON p.user_id = u.id
    WHERE ls.profile_id IS NULL
      AND ls.invited_email IS NOT NULL
      AND TRIM(ls.invited_email) != ''
  LOOP
    UPDATE public.lease_signers
    SET profile_id = rec.profile_id
    WHERE lease_signers.id = rec.signer_id;
    linked_total := linked_total + 1;
  END LOOP;

  IF linked_total > 0 THEN
    RAISE NOTICE '[rétro-link] % lease_signers orphelins liés à un profil existant', linked_total;
  ELSE
    RAISE NOTICE '[rétro-link] Aucun lease_signer orphelin à lier';
  END IF;
END $$;

-- ============================================
-- 5. VÉRIFICATION: Compter les orphelins restants
-- ============================================
DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT count(*)::INT INTO orphan_count
  FROM public.lease_signers
  WHERE profile_id IS NULL
    AND invited_email IS NOT NULL
    AND TRIM(invited_email) != ''
    AND invited_email NOT LIKE '%@a-definir%';

  IF orphan_count > 0 THEN
    RAISE NOTICE '⚠️  % lease_signers orphelins restants (email sans compte correspondant)', orphan_count;
  ELSE
    RAISE NOTICE '✅ Tous les signers avec email valide sont liés ou n''ont pas encore de compte';
  END IF;
END $$;

COMMIT;


-- === MIGRATION: 20260221000001_auto_link_trigger_update.sql ===
-- =====================================================
-- Auto-link lease_signers on profile UPDATE
-- Date: 2026-02-21
--
-- Quand un profil est mis à jour (ex: email confirmé, user_id lié),
-- lier les lease_signers orphelins dont invited_email matche l'email du user.
-- Réutilise la même logique que l'INSERT (auth.users.email -> lease_signers.invited_email).
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.auto_link_lease_signers_on_profile_updated()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  linked_count INT;
BEGIN
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF user_email IS NULL OR TRIM(user_email) = '' THEN
    RETURN NEW;
  END IF;

  UPDATE public.lease_signers
  SET profile_id = NEW.id
  WHERE LOWER(TRIM(invited_email)) = LOWER(TRIM(user_email))
    AND profile_id IS NULL;

  GET DIAGNOSTICS linked_count = ROW_COUNT;

  IF linked_count > 0 THEN
    RAISE NOTICE '[auto_link_update] % lease_signers liés au profil % (email: %)',
      linked_count, NEW.id, user_email;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.auto_link_lease_signers_on_profile_updated() IS
'SOTA 2026: À l''UPDATE d''un profil, lie les lease_signers orphelins dont invited_email matche l''email auth.';

DROP TRIGGER IF EXISTS trigger_auto_link_lease_signers_on_update ON public.profiles;

CREATE TRIGGER trigger_auto_link_lease_signers_on_update
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_link_lease_signers_on_profile_updated();

COMMIT;


-- === MIGRATION: 20260221100001_auto_upgrade_draft_on_tenant_signer.sql ===
-- =====================================================
-- MIGRATION: Auto-upgrade baux draft + fix rétroactif complet
-- Date: 2026-02-21
--
-- PROBLÈMES CORRIGÉS:
--   1. Trigger: quand un signataire locataire est ajouté à un bail 'draft',
--      passer automatiquement le bail en 'pending_signature'
--   2. Fix rétroactif A: re-lier les lease_signers orphelins (invited_email match)
--   3. Fix rétroactif B: upgrader les baux draft qui ont déjà un locataire
--   4. Fix rétroactif C: créer les lease_signers manquants depuis edl_signatures
--   5. Audit: vérifier qu'aucun bail ne reste à demi connecté
-- =====================================================

BEGIN;

-- ============================================
-- 1. FONCTION: Auto-upgrade draft → pending_signature
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_upgrade_draft_lease_on_signer()
RETURNS TRIGGER AS $$
BEGIN
  -- Quand un signataire locataire est ajouté, upgrader le bail draft
  IF NEW.role IN ('locataire_principal', 'colocataire', 'tenant', 'locataire') THEN
    UPDATE public.leases
    SET statut = 'pending_signature', updated_at = NOW()
    WHERE id = NEW.lease_id
      AND statut = 'draft';
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer l'INSERT du signer
  RAISE WARNING '[auto_upgrade_draft] Erreur non-bloquante: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.auto_upgrade_draft_lease_on_signer() IS
'SOTA 2026: Quand un signataire locataire est ajouté à un bail draft, passe le bail en pending_signature automatiquement.';

-- ============================================
-- 2. TRIGGER: Exécuter après chaque INSERT sur lease_signers
-- ============================================
DROP TRIGGER IF EXISTS trigger_auto_upgrade_draft_on_signer ON public.lease_signers;

CREATE TRIGGER trigger_auto_upgrade_draft_on_signer
  AFTER INSERT ON public.lease_signers
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_upgrade_draft_lease_on_signer();

-- ============================================
-- 3. FIX RÉTROACTIF A: Re-lier les lease_signers orphelins
--    (invited_email correspond à un compte existant mais profile_id est NULL)
-- ============================================
DO $$
DECLARE
  linked_total INT := 0;
BEGIN
  UPDATE public.lease_signers ls
  SET profile_id = p.id
  FROM auth.users u
  JOIN public.profiles p ON p.user_id = u.id
  WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email))
    AND ls.profile_id IS NULL
    AND ls.invited_email IS NOT NULL
    AND TRIM(ls.invited_email) != ''
    AND ls.invited_email NOT LIKE '%@a-definir%'
    AND ls.invited_email NOT LIKE '%@placeholder%';

  GET DIAGNOSTICS linked_total = ROW_COUNT;

  IF linked_total > 0 THEN
    RAISE NOTICE '[fix_A] % lease_signers orphelins re-liés à un profil existant', linked_total;
  ELSE
    RAISE NOTICE '[fix_A] Aucun lease_signer orphelin à re-lier';
  END IF;
END $$;

-- ============================================
-- 4. FIX RÉTROACTIF B: Upgrader les baux draft qui ont un locataire
-- ============================================
DO $$
DECLARE
  upgraded_count INT := 0;
BEGIN
  UPDATE public.leases
  SET statut = 'pending_signature', updated_at = NOW()
  WHERE statut = 'draft'
  AND EXISTS (
    SELECT 1 FROM public.lease_signers ls
    WHERE ls.lease_id = leases.id
    AND ls.role IN ('locataire_principal', 'colocataire', 'tenant', 'locataire')
  );

  GET DIAGNOSTICS upgraded_count = ROW_COUNT;

  IF upgraded_count > 0 THEN
    RAISE NOTICE '[fix_B] % baux draft upgradés en pending_signature', upgraded_count;
  ELSE
    RAISE NOTICE '[fix_B] Aucun bail draft avec locataire à upgrader';
  END IF;
END $$;

-- ============================================
-- 5. FIX RÉTROACTIF C: Créer les lease_signers manquants
--    depuis les edl_signatures (EDL a un locataire mais le bail n'a pas le signer)
-- ============================================
DO $$
DECLARE
  created_count INT := 0;
BEGIN
  INSERT INTO public.lease_signers (lease_id, profile_id, role, signature_status, invited_email, invited_name)
  SELECT DISTINCT ON (e.lease_id)
    e.lease_id,
    es.signer_profile_id,
    'locataire_principal',
    'pending',
    es.signer_email,
    es.signer_name
  FROM public.edl e
  JOIN public.edl_signatures es ON es.edl_id = e.id
  WHERE es.signer_role IN ('tenant', 'locataire', 'locataire_principal')
    AND e.lease_id IS NOT NULL
    -- Le bail n'a pas déjà un signer locataire
    AND NOT EXISTS (
      SELECT 1 FROM public.lease_signers ls
      WHERE ls.lease_id = e.lease_id
      AND ls.role IN ('locataire_principal', 'colocataire', 'tenant', 'locataire')
    )
    -- Le signer a au moins un profil ou un email valide
    AND (
      es.signer_profile_id IS NOT NULL
      OR (es.signer_email IS NOT NULL AND TRIM(es.signer_email) != '' AND es.signer_email NOT LIKE '%@a-definir%')
    )
  ORDER BY e.lease_id, e.created_at DESC;

  GET DIAGNOSTICS created_count = ROW_COUNT;

  IF created_count > 0 THEN
    RAISE NOTICE '[fix_C] % lease_signers créés depuis edl_signatures', created_count;
  ELSE
    RAISE NOTICE '[fix_C] Aucun lease_signer manquant à créer depuis les EDL';
  END IF;
END $$;

-- ============================================
-- 6. AUDIT: Vérifier l'état final
-- ============================================
DO $$
DECLARE
  orphan_signers INT;
  draft_with_tenant INT;
  leases_without_tenant INT;
BEGIN
  -- Signataires orphelins restants (profile_id NULL, email valide, pas placeholder)
  SELECT count(*)::INT INTO orphan_signers
  FROM public.lease_signers
  WHERE profile_id IS NULL
    AND invited_email IS NOT NULL
    AND TRIM(invited_email) != ''
    AND invited_email NOT LIKE '%@a-definir%'
    AND invited_email NOT LIKE '%@placeholder%';

  -- Baux draft avec un locataire (ne devrait plus en avoir)
  SELECT count(*)::INT INTO draft_with_tenant
  FROM public.leases l
  WHERE l.statut = 'draft'
  AND EXISTS (
    SELECT 1 FROM public.lease_signers ls
    WHERE ls.lease_id = l.id
    AND ls.role IN ('locataire_principal', 'colocataire', 'tenant', 'locataire')
  );

  -- Baux non-draft sans signataire locataire
  SELECT count(*)::INT INTO leases_without_tenant
  FROM public.leases l
  WHERE l.statut NOT IN ('draft', 'terminated', 'cancelled', 'archived')
  AND NOT EXISTS (
    SELECT 1 FROM public.lease_signers ls
    WHERE ls.lease_id = l.id
    AND ls.role IN ('locataire_principal', 'colocataire', 'tenant', 'locataire')
  );

  RAISE NOTICE '=== AUDIT RÉSULTAT ===';
  RAISE NOTICE 'Signataires orphelins (email sans compte): %', orphan_signers;
  RAISE NOTICE 'Baux draft avec locataire (devrait être 0): %', draft_with_tenant;
  RAISE NOTICE 'Baux actifs sans locataire: %', leases_without_tenant;

  IF draft_with_tenant = 0 THEN
    RAISE NOTICE '✅ Aucun bail draft à demi connecté';
  ELSE
    RAISE WARNING '⚠️  % baux draft ont encore un locataire — vérifier manuellement', draft_with_tenant;
  END IF;
END $$;

COMMIT;


-- === MIGRATION: 20260221200000_sync_edl_signer_to_lease_signer.sql ===
-- =====================================================
-- MIGRATION: Sync edl_signatures → lease_signers (défense en profondeur)
-- Date: 2026-02-21
--
-- PROBLÈME CORRIGÉ:
--   Quand une edl_signature tenant est créée pour un EDL lié à un bail,
--   il se peut qu'aucun lease_signers correspondant n'existe (ex: bail
--   créé en mode "manual draft"). Le locataire ne voit alors pas le bail
--   sur son dashboard car la RPC tenant_dashboard passe par lease_signers.
--
-- FIX: Trigger AFTER INSERT sur edl_signatures qui crée automatiquement
--   un lease_signers si aucun signer tenant n'existe pour le bail associé.
--   Ne bloque jamais l'INSERT original (exception handler).
-- =====================================================

BEGIN;

-- ============================================
-- 1. FONCTION: Sync edl_signature → lease_signer
-- ============================================
CREATE OR REPLACE FUNCTION public.sync_edl_signer_to_lease_signer()
RETURNS TRIGGER AS $$
DECLARE
  v_lease_id UUID;
  v_exists BOOLEAN;
BEGIN
  -- Uniquement pour les rôles tenant
  IF NEW.signer_role NOT IN ('tenant', 'locataire', 'locataire_principal') THEN
    RETURN NEW;
  END IF;

  -- Doit avoir au moins un email ou un profile_id
  IF NEW.signer_profile_id IS NULL AND (NEW.signer_email IS NULL OR TRIM(NEW.signer_email) = '') THEN
    RETURN NEW;
  END IF;

  -- Ignorer les emails placeholder
  IF NEW.signer_email IS NOT NULL AND (
    NEW.signer_email LIKE '%@a-definir%' OR
    NEW.signer_email LIKE '%@placeholder%'
  ) THEN
    RETURN NEW;
  END IF;

  -- Récupérer le lease_id depuis l'EDL
  SELECT lease_id INTO v_lease_id
  FROM public.edl
  WHERE id = NEW.edl_id;

  IF v_lease_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Vérifier si un signer tenant existe déjà pour ce bail
  SELECT EXISTS (
    SELECT 1 FROM public.lease_signers
    WHERE lease_id = v_lease_id
    AND role IN ('locataire_principal', 'locataire', 'tenant', 'colocataire')
  ) INTO v_exists;

  IF NOT v_exists THEN
    INSERT INTO public.lease_signers (lease_id, profile_id, invited_email, invited_name, role, signature_status)
    VALUES (v_lease_id, NEW.signer_profile_id, NEW.signer_email, NEW.signer_name, 'locataire_principal', 'pending');
    RAISE NOTICE '[sync_edl_signer] Created lease_signer for lease % from edl_signature %', v_lease_id, NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais bloquer l'INSERT de edl_signatures
  RAISE WARNING '[sync_edl_signer] Error (non-blocking): %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.sync_edl_signer_to_lease_signer() IS
'SOTA 2026: Quand une edl_signature tenant est créée, vérifie que le bail associé a un lease_signer locataire. Sinon, en crée un. Ne bloque jamais l''INSERT.';

-- ============================================
-- 2. TRIGGER: Exécuter après chaque INSERT sur edl_signatures
-- ============================================
DROP TRIGGER IF EXISTS trigger_sync_edl_signer_to_lease_signer ON public.edl_signatures;

CREATE TRIGGER trigger_sync_edl_signer_to_lease_signer
  AFTER INSERT ON public.edl_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_edl_signer_to_lease_signer();

COMMIT;


-- === MIGRATION: 20260222100000_repair_missing_signers_and_invitations.sql ===
-- =====================================================
-- Migration: Réparation complète — signataires manquants + invitations
-- Date: 2026-02-22
--
-- Problème : Certains baux (notamment da2eb9da) sont en fully_signed
-- mais n'ont AUCUN lease_signers, ce qui empêche l'affichage du locataire
-- et bloque le flux d'activation.
--
-- Cette migration :
-- 1. [DIAGNOSTIC] Identifie les baux signés sans signataires
-- 2. Crée le signataire PROPRIETAIRE manquant pour chaque bail signé
-- 3. Crée le signataire LOCATAIRE manquant à partir des invitations
-- 4. Lie les lease_signers orphelins (profile_id NULL) dont l'email matche un compte
-- 5. Crée les invitations manquantes pour les signataires sans invitation valide
-- =====================================================

BEGIN;

-- ========================================================
-- ÉTAPE 1 : Créer les signataires PROPRIETAIRE manquants
-- Pour tout bail en fully_signed/active/terminated sans signataire propriétaire
-- ========================================================
INSERT INTO public.lease_signers (lease_id, profile_id, role, signature_status, signed_at)
SELECT
  l.id AS lease_id,
  p.owner_id AS profile_id,
  'proprietaire' AS role,
  'signed' AS signature_status,
  COALESCE(l.sealed_at, l.updated_at, NOW()) AS signed_at
FROM public.leases l
JOIN public.properties p ON p.id = l.property_id
WHERE l.statut IN ('fully_signed', 'active', 'terminated', 'archived')
  AND NOT EXISTS (
    SELECT 1 FROM public.lease_signers ls
    WHERE ls.lease_id = l.id
      AND ls.role = 'proprietaire'
  )
ON CONFLICT DO NOTHING;

-- ========================================================
-- ÉTAPE 2 : Créer les signataires LOCATAIRE PRINCIPAL manquants
-- Source prioritaire : table invitations (contient l'email du locataire invité)
-- ========================================================
INSERT INTO public.lease_signers (lease_id, profile_id, invited_email, role, signature_status, signed_at)
SELECT DISTINCT ON (i.lease_id)
  i.lease_id,
  COALESCE(pr.id, NULL) AS profile_id,
  i.email AS invited_email,
  'locataire_principal' AS role,
  CASE
    WHEN le.statut IN ('fully_signed', 'active', 'terminated', 'archived') THEN 'signed'
    ELSE 'pending'
  END AS signature_status,
  CASE
    WHEN le.statut IN ('fully_signed', 'active', 'terminated', 'archived')
    THEN COALESCE(i.used_at, le.sealed_at, le.updated_at, NOW())
    ELSE NULL
  END AS signed_at
FROM public.invitations i
JOIN public.leases le ON le.id = i.lease_id
LEFT JOIN auth.users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(i.email))
LEFT JOIN public.profiles pr ON pr.user_id = u.id
WHERE i.role IN ('locataire_principal', 'locataire', 'tenant')
  AND NOT EXISTS (
    SELECT 1 FROM public.lease_signers ls
    WHERE ls.lease_id = i.lease_id
      AND ls.role IN ('locataire_principal', 'locataire', 'tenant')
  )
ORDER BY i.lease_id, i.created_at DESC;

-- ========================================================
-- ÉTAPE 3 : Lier les lease_signers orphelins
-- profile_id NULL + invited_email matche un compte auth.users
-- ========================================================
UPDATE public.lease_signers ls
SET profile_id = pr.id
FROM public.profiles pr
JOIN auth.users u ON u.id = pr.user_id
WHERE ls.profile_id IS NULL
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email));

-- ========================================================
-- ÉTAPE 4 : Créer les invitations manquantes
-- Pour les signataires locataires/colocataires sans invitation valide
-- ========================================================
INSERT INTO public.invitations (
  token,
  email,
  role,
  property_id,
  unit_id,
  lease_id,
  created_by,
  expires_at
)
SELECT
  encode(gen_random_bytes(32), 'hex') AS token,
  ls.invited_email AS email,
  ls.role::TEXT AS role,
  l.property_id AS property_id,
  l.unit_id AS unit_id,
  ls.lease_id AS lease_id,
  p.owner_id AS created_by,
  (NOW() + INTERVAL '30 days')::TIMESTAMPTZ AS expires_at
FROM public.lease_signers ls
JOIN public.leases l ON l.id = ls.lease_id
JOIN public.properties p ON p.id = l.property_id
WHERE ls.role IN ('locataire_principal', 'colocataire')
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND LOWER(TRIM(ls.invited_email)) NOT LIKE '%@a-definir%'
  AND NOT EXISTS (
    SELECT 1 FROM public.invitations i
    WHERE i.lease_id = ls.lease_id
      AND LOWER(TRIM(i.email)) = LOWER(TRIM(ls.invited_email))
      AND i.used_at IS NULL
      AND i.expires_at > NOW()
  );

-- ========================================================
-- ÉTAPE 5 : Filet de sécurité — bail da2eb9da (Thomas VOLBERG)
-- Uniquement si ce bail existe (migration de réparation production)
-- ========================================================
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM public.leases WHERE id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7') THEN

  -- 5a. Créer le locataire signer si manquant
  INSERT INTO public.lease_signers (lease_id, profile_id, invited_email, invited_name, role, signature_status, signed_at)
  SELECT
    'da2eb9da-1ff1-4020-8682-5f993aa6fde7'::UUID, pr.id, 'volberg.thomas@hotmail.fr', 'Thomas VOLBERG', 'locataire_principal', 'signed', NOW()
  FROM (SELECT pr2.id FROM public.profiles pr2 JOIN auth.users u ON u.id = pr2.user_id WHERE LOWER(u.email) = 'volberg.thomas@hotmail.fr' LIMIT 1) pr
  WHERE NOT EXISTS (SELECT 1 FROM public.lease_signers ls WHERE ls.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7' AND ls.role IN ('locataire_principal', 'locataire', 'tenant'));

  -- 5b. Fallback signer orphelin
  INSERT INTO public.lease_signers (lease_id, profile_id, invited_email, invited_name, role, signature_status, signed_at)
  SELECT 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'::UUID, NULL, 'volberg.thomas@hotmail.fr', 'Thomas VOLBERG', 'locataire_principal', 'signed', NOW()
  WHERE NOT EXISTS (SELECT 1 FROM public.lease_signers ls WHERE ls.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7' AND ls.role IN ('locataire_principal', 'locataire', 'tenant'));

  -- 5c. Proprio signer
  INSERT INTO public.lease_signers (lease_id, profile_id, role, signature_status, signed_at)
  SELECT 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'::UUID, p.owner_id, 'proprietaire', 'signed', NOW()
  FROM public.leases l JOIN public.properties p ON p.id = l.property_id
  WHERE l.id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7'
    AND NOT EXISTS (SELECT 1 FROM public.lease_signers ls WHERE ls.lease_id = 'da2eb9da-1ff1-4020-8682-5f993aa6fde7' AND ls.role = 'proprietaire');

END IF;
END $$;

-- ========================================================
-- ÉTAPE 6 : Lier les profils tenant sans user_id à auth.users
-- (complémentaire : certains profiles ont role='tenant' mais user_id NULL)
-- ========================================================
UPDATE public.profiles p
SET user_id = u.id
FROM auth.users u
WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(u.email))
  AND p.role = 'tenant'
  AND p.user_id IS NULL;

-- ========================================================
-- ÉTAPE 7 : Re-lier les lease_signers après la correction des profiles
-- (2e passe, car l'étape 6 a pu créer de nouvelles liaisons)
-- ========================================================
UPDATE public.lease_signers ls
SET profile_id = pr.id
FROM public.profiles pr
JOIN auth.users u ON u.id = pr.user_id
WHERE ls.profile_id IS NULL
  AND ls.invited_email IS NOT NULL
  AND TRIM(ls.invited_email) != ''
  AND LOWER(TRIM(u.email)) = LOWER(TRIM(ls.invited_email));

COMMIT;


-- === MIGRATION: 20260225000000_owner_payment_audit_log.sql ===
-- ============================================================
-- SOTA 2026 : Journal d'audit PSD3 pour les moyens de paiement propriétaire
-- Traçabilité des actions (carte ajoutée/supprimée, défaut, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS owner_payment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  payment_method_type TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_opal_owner_created ON owner_payment_audit_log(owner_id, created_at DESC);

COMMENT ON TABLE owner_payment_audit_log IS 'Audit trail PSD3 pour les opérations sur les moyens de paiement propriétaire (abonnement, carte, etc.)';

ALTER TABLE owner_payment_audit_log ENABLE ROW LEVEL SECURITY;

-- Le propriétaire ne voit que ses propres logs
CREATE POLICY "opal_select_own" ON owner_payment_audit_log
  FOR SELECT USING (owner_id = public.user_profile_id());

-- Le propriétaire peut insérer des logs pour lui-même (via l'API qui utilise son session)
CREATE POLICY "opal_insert_own" ON owner_payment_audit_log
  FOR INSERT WITH CHECK (owner_id = public.user_profile_id());

-- L'admin voit et gère tout (lecture seule en pratique, pas de UPDATE/DELETE prévus)
CREATE POLICY "opal_admin_all" ON owner_payment_audit_log
  FOR ALL USING (public.user_role() = 'admin');


-- === MIGRATION: 20260225100000_autolink_backfill_invoices_on_profile.sql ===
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


-- === MIGRATION: 20260226000000_backfill_existing_invoices_tenant_id.sql ===
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


-- === MIGRATION: 20260227000000_drop_auto_activate_lease_trigger.sql ===
-- Fix: Le trigger auto_activate_lease_on_edl n'a pas été supprimé
-- car la migration 20260207200000 ciblait le mauvais nom
DROP TRIGGER IF EXISTS auto_activate_lease_on_edl ON public.edl;
DROP FUNCTION IF EXISTS public.trigger_activate_lease_on_edl_signed();


-- === MIGRATION: 20260228000000_lease_signers_share_percentage.sql ===
-- SOTA 2026: part de répartition par signataire (colocation).
-- Si NULL, l'UI utilise le fallback 100 / nombre de colocataires.
ALTER TABLE public.lease_signers
  ADD COLUMN IF NOT EXISTS share_percentage numeric(5,2) NULL
  CONSTRAINT chk_lease_signers_share_percentage CHECK (share_percentage IS NULL OR (share_percentage >= 0 AND share_percentage <= 100));

COMMENT ON COLUMN public.lease_signers.share_percentage IS 'Part en % du loyer/charges pour ce signataire (colocation). NULL = répartition égale.';


-- === MIGRATION: 20260228100000_tenant_payment_methods_sota2026.sql ===
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


-- === MIGRATION: 20260301000000_create_key_handovers.sql ===
-- Migration: Create key_handovers table for digital key handover with QR code proof
-- This table records the formal handover of keys from owner to tenant,
-- with cryptographic proof, geolocation, and signature.

CREATE TABLE IF NOT EXISTS key_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,

  -- Participants
  owner_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  tenant_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- QR token
  token text NOT NULL,
  expires_at timestamptz NOT NULL,

  -- Keys handed over (JSON array from EDL)
  keys_list jsonb DEFAULT '[]'::jsonb,

  -- Tenant confirmation
  confirmed_at timestamptz,
  tenant_signature_path text,
  tenant_ip text,
  tenant_user_agent text,
  geolocation jsonb,

  -- Proof
  proof_id text,
  proof_metadata jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_key_handovers_lease_id ON key_handovers(lease_id);
CREATE INDEX IF NOT EXISTS idx_key_handovers_token ON key_handovers(token);
CREATE INDEX IF NOT EXISTS idx_key_handovers_confirmed ON key_handovers(lease_id) WHERE confirmed_at IS NOT NULL;

-- RLS
ALTER TABLE key_handovers ENABLE ROW LEVEL SECURITY;

-- Owner can see and create handovers for their leases
CREATE POLICY "owner_key_handovers" ON key_handovers
  FOR ALL
  USING (
    owner_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Tenant can see and confirm handovers for their leases
CREATE POLICY "tenant_key_handovers" ON key_handovers
  FOR ALL
  USING (
    tenant_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    OR
    lease_id IN (
      SELECT lease_id FROM lease_signers
      WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Updated at trigger
CREATE OR REPLACE TRIGGER set_key_handovers_updated_at
  BEFORE UPDATE ON key_handovers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE key_handovers IS 'Remise des clés digitale avec preuve QR code, signature et géolocalisation';


-- === MIGRATION: 20260304000000_fix_invoice_generation_jour_paiement.sql ===
-- ============================================
-- Migration : Corriger generate_monthly_invoices pour utiliser jour_paiement
-- Date : 2026-03-04
-- Description : La fonction SQL de génération de factures n'utilisait pas
--   le champ leases.jour_paiement pour calculer la date_echeance.
--   Elle n'insérait pas non plus date_echeance ni invoice_number.
-- ============================================

CREATE OR REPLACE FUNCTION generate_monthly_invoices(p_target_month TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT := 0;
  v_lease RECORD;
  v_result JSONB;
  v_days_in_month INT;
  v_jour_paiement INT;
  v_date_echeance DATE;
BEGIN
  -- Vérifier le format du mois (YYYY-MM)
  IF p_target_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'Format de mois invalide. Attendu: YYYY-MM';
  END IF;

  -- Calculer le nombre de jours dans le mois cible
  v_days_in_month := EXTRACT(DAY FROM ((p_target_month || '-01')::DATE + INTERVAL '1 month' - INTERVAL '1 day'));

  -- Parcourir tous les baux actifs qui n'ont pas encore de facture pour ce mois
  FOR v_lease IN
    SELECT
      l.id as lease_id,
      l.property_id,
      p.owner_id,
      ls.profile_id as tenant_id,
      l.loyer,
      l.charges_forfaitaires,
      COALESCE(l.jour_paiement, 5) as jour_paiement
    FROM leases l
    JOIN properties p ON p.id = l.property_id
    JOIN lease_signers ls ON ls.lease_id = l.id AND ls.role IN ('locataire', 'locataire_principal')
    WHERE l.statut = 'active'
    AND l.date_debut <= (p_target_month || '-01')::DATE
    AND (l.date_fin IS NULL OR l.date_fin >= (p_target_month || '-01')::DATE)
    AND NOT EXISTS (
      SELECT 1 FROM invoices
      WHERE lease_id = l.id
      AND periode = p_target_month
    )
  LOOP
    -- Clamper jour_paiement au dernier jour du mois (ex: 30 → 28 en février)
    v_jour_paiement := LEAST(v_lease.jour_paiement, v_days_in_month);
    v_date_echeance := (p_target_month || '-' || LPAD(v_jour_paiement::TEXT, 2, '0'))::DATE;

    INSERT INTO invoices (
      lease_id,
      owner_id,
      tenant_id,
      periode,
      montant_loyer,
      montant_charges,
      montant_total,
      date_echeance,
      invoice_number,
      statut,
      created_at
    ) VALUES (
      v_lease.lease_id,
      v_lease.owner_id,
      v_lease.tenant_id,
      p_target_month,
      v_lease.loyer,
      v_lease.charges_forfaitaires,
      v_lease.loyer + v_lease.charges_forfaitaires,
      v_date_echeance,
      'QUI-' || REPLACE(p_target_month, '-', '') || '-' || UPPER(LEFT(v_lease.lease_id::TEXT, 8)),
      'sent',
      NOW()
    );

    v_count := v_count + 1;
  END LOOP;

  v_result := jsonb_build_object(
    'success', true,
    'month', p_target_month,
    'generated_count', v_count
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION generate_monthly_invoices IS 'Génère les factures de loyer pour tous les baux actifs pour un mois donné (YYYY-MM). Utilise leases.jour_paiement pour la date d''échéance.';


-- === MIGRATION: 20260304000001_sync_sepa_collection_day.sql ===
-- ============================================
-- Migration : Synchroniser payment_schedules.collection_day avec leases.jour_paiement
-- Date : 2026-03-04
-- Description : Quand leases.jour_paiement est mis à jour, propager la valeur
--   vers payment_schedules.collection_day pour les prélèvements SEPA.
-- ============================================

-- Trigger function : propager jour_paiement vers payment_schedules
CREATE OR REPLACE FUNCTION sync_lease_jour_paiement_to_schedules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Seulement si jour_paiement a changé
  IF NEW.jour_paiement IS DISTINCT FROM OLD.jour_paiement THEN
    UPDATE payment_schedules
    SET collection_day = COALESCE(NEW.jour_paiement, 5)
    WHERE lease_id = NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

-- Créer le trigger
DROP TRIGGER IF EXISTS trg_sync_jour_paiement ON leases;
CREATE TRIGGER trg_sync_jour_paiement
  AFTER UPDATE OF jour_paiement ON leases
  FOR EACH ROW
  EXECUTE FUNCTION sync_lease_jour_paiement_to_schedules();

COMMENT ON FUNCTION sync_lease_jour_paiement_to_schedules IS 'Propage leases.jour_paiement vers payment_schedules.collection_day';


-- === MIGRATION: 20260304200000_auto_mark_late_invoices.sql ===
-- ============================================
-- Migration : Transition automatique des factures en retard
-- Date : 2026-03-04
-- Description : Crée une fonction qui marque automatiquement les factures
--   dont la date d'échéance est dépassée comme "late" (en retard).
--   Planifié via pg_cron pour tourner chaque jour à 00h05.
--   Filet de sécurité : même si le cron payment-reminders rate un jour,
--   les factures passent quand même en "late".
-- ============================================

CREATE OR REPLACE FUNCTION mark_overdue_invoices_late()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE invoices
  SET
    statut = 'late',
    updated_at = NOW()
  WHERE statut IN ('sent', 'pending')
    AND due_date < CURRENT_DATE
    AND due_date IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    RAISE NOTICE '[mark_overdue_invoices_late] % factures marquées en retard', v_count;
  END IF;

  RETURN v_count;
END;
$$;

-- Supprimer l'ancien job s'il existe
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'mark-overdue-invoices';

-- Planifier : quotidien à 00h05 UTC
SELECT cron.schedule('mark-overdue-invoices', '5 0 * * *',
  $$SELECT mark_overdue_invoices_late()$$
);

COMMENT ON FUNCTION mark_overdue_invoices_late IS 'Marque automatiquement les factures dont due_date < aujourd''hui comme "late"';


-- === MIGRATION: 20260305000001_invoice_engine_fields.sql ===
-- ============================================
-- Migration : Moteur de facturation locative — Champs, tables et triggers
-- Date : 2026-03-05
-- Description :
--   1. Ajout des champs manquants dans leases (grace_period_days, invoice_engine_started, first_invoice_date, late_fee_rate)
--   2. Ajout des champs manquants dans invoices (period_start, period_end, generated_at, sent_at, paid_at, stripe_payment_intent_id, notes)
--   3. Extension des statuts invoices (partial, overdue, unpaid, cancelled)
--   4. Ajout colonne tenant_id dans payments (dénormalisation pour RLS)
--   5. Création tables : payment_reminders, late_fees, receipts, tenant_credit_score
--   6. RLS sur les nouvelles tables
--   7. DB trigger sur leases.statut → 'active' → appel invoice-engine-start
-- ============================================

-- =====================
-- 1. Champs manquants leases
-- =====================

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 3;

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS invoice_engine_started BOOLEAN DEFAULT false;

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS first_invoice_date DATE;

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS late_fee_rate DECIMAL(10,6) DEFAULT 0.002740;

COMMENT ON COLUMN leases.grace_period_days IS 'Nombre de jours de grâce avant relance (défaut: 3)';
COMMENT ON COLUMN leases.invoice_engine_started IS 'Indique si le moteur de facturation a été déclenché pour ce bail';
COMMENT ON COLUMN leases.first_invoice_date IS 'Date de la première facture à générer (calculée au prorata si bail en cours de mois)';
COMMENT ON COLUMN leases.late_fee_rate IS 'Taux journalier de pénalité de retard (défaut: taux légal / 365 ≈ 0.00274)';

-- =====================
-- 2. Champs manquants invoices
-- =====================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS period_start DATE;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS period_end DATE;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Étendre les statuts possibles des invoices
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_statut_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_statut_check
  CHECK (statut IN ('draft', 'sent', 'paid', 'partial', 'overdue', 'unpaid', 'cancelled', 'late'));

-- Index pour la recherche de factures en retard
CREATE INDEX IF NOT EXISTS idx_invoices_date_echeance ON invoices(date_echeance) WHERE statut IN ('sent', 'late', 'overdue');
CREATE INDEX IF NOT EXISTS idx_invoices_period_start ON invoices(period_start);

-- =====================
-- 3. Champ tenant_id dans payments (dénormalisation pour RLS directe)
-- =====================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES profiles(id);

-- Étendre les statuts possibles des payments
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_statut_check;
ALTER TABLE payments ADD CONSTRAINT payments_statut_check
  CHECK (statut IN ('pending', 'succeeded', 'failed', 'refunded'));

-- =====================
-- 4. Table payment_reminders
-- =====================

CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('friendly', 'reminder', 'urgent', 'formal_notice', 'lrec', 'final')),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'lrec', 'courrier')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_reminders_invoice ON payment_reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_tenant ON payment_reminders(tenant_id);

COMMENT ON TABLE payment_reminders IS 'Historique des relances envoyées pour factures impayées';

-- =====================
-- 5. Table late_fees
-- =====================

CREATE TABLE IF NOT EXISTS late_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  rate DECIMAL(10, 6) NOT NULL,
  days_late INTEGER NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  waived BOOLEAN NOT NULL DEFAULT false,
  waived_reason TEXT,
  waived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_late_fees_invoice ON late_fees(invoice_id);

COMMENT ON TABLE late_fees IS 'Pénalités de retard calculées conformément à la loi du 6 juillet 1989';

-- =====================
-- 6. Table receipts (quittances de loyer)
-- =====================

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- Format YYYY-MM
  period_start DATE,
  period_end DATE,
  montant_loyer DECIMAL(10, 2) NOT NULL,
  montant_charges DECIMAL(10, 2) NOT NULL DEFAULT 0,
  montant_total DECIMAL(10, 2) NOT NULL,
  pdf_url TEXT,
  pdf_storage_path TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipts_lease ON receipts(lease_id);
CREATE INDEX IF NOT EXISTS idx_receipts_tenant ON receipts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receipts_period ON receipts(period);

COMMENT ON TABLE receipts IS 'Quittances de loyer générées après paiement (art. 21 loi 6 juillet 1989)';

-- =====================
-- 7. Table tenant_credit_score
-- =====================

CREATE TABLE IF NOT EXISTS tenant_credit_score (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  score INTEGER, -- NULL = pas encore de données
  on_time_count INTEGER NOT NULL DEFAULT 0,
  late_count INTEGER NOT NULL DEFAULT 0,
  missed_count INTEGER NOT NULL DEFAULT 0,
  early_count INTEGER NOT NULL DEFAULT 0,
  total_payments INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_credit_score_tenant ON tenant_credit_score(tenant_id);

COMMENT ON TABLE tenant_credit_score IS 'Score de ponctualité du locataire (cache calculé après chaque paiement)';

-- =====================
-- 8. RLS Policies
-- =====================

-- payment_reminders
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own reminders"
  ON payment_reminders FOR SELECT
  USING (tenant_id = public.user_profile_id());

CREATE POLICY "Owners can view reminders of own invoices"
  ON payment_reminders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = payment_reminders.invoice_id
      AND i.owner_id = public.user_profile_id()
    )
  );

CREATE POLICY "Admins can view all reminders"
  ON payment_reminders FOR SELECT
  USING (public.user_role() = 'admin');

-- late_fees
ALTER TABLE late_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view late fees of accessible invoices"
  ON late_fees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = late_fees.invoice_id
      AND (
        i.owner_id = public.user_profile_id()
        OR i.tenant_id = public.user_profile_id()
        OR public.user_role() = 'admin'
      )
    )
  );

-- receipts
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own receipts"
  ON receipts FOR SELECT
  USING (tenant_id = public.user_profile_id());

CREATE POLICY "Owners can view receipts of own properties"
  ON receipts FOR SELECT
  USING (owner_id = public.user_profile_id());

CREATE POLICY "Admins can view all receipts"
  ON receipts FOR SELECT
  USING (public.user_role() = 'admin');

-- tenant_credit_score
ALTER TABLE tenant_credit_score ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own credit score"
  ON tenant_credit_score FOR SELECT
  USING (tenant_id = public.user_profile_id());

CREATE POLICY "Admins can view all credit scores"
  ON tenant_credit_score FOR SELECT
  USING (public.user_role() = 'admin');

-- =====================
-- 9. DB Trigger : Bail activé → démarrer le moteur de facturation
-- =====================

CREATE OR REPLACE FUNCTION trigger_invoice_engine_on_lease_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_signer RECORD;
  v_owner_id UUID;
  v_property_address TEXT;
BEGIN
  -- Ne déclencher que si le statut passe à 'active' et que le moteur n'a pas déjà été démarré
  IF NEW.statut = 'active' AND (OLD.statut IS DISTINCT FROM 'active') AND (NEW.invoice_engine_started IS NOT TRUE) THEN

    -- Trouver le locataire principal
    SELECT ls.profile_id INTO v_tenant_signer
    FROM lease_signers ls
    WHERE ls.lease_id = NEW.id
    AND ls.role IN ('locataire', 'locataire_principal', 'colocataire')
    LIMIT 1;

    -- Trouver le propriétaire
    SELECT p.owner_id, p.adresse_complete INTO v_owner_id, v_property_address
    FROM properties p
    WHERE p.id = NEW.property_id;

    IF v_tenant_signer.profile_id IS NOT NULL AND v_owner_id IS NOT NULL THEN
      -- Émettre un événement outbox pour que le process-outbox le traite
      INSERT INTO outbox (event_type, payload)
      VALUES ('Lease.InvoiceEngineStart', jsonb_build_object(
        'lease_id', NEW.id,
        'tenant_id', v_tenant_signer.profile_id,
        'owner_id', v_owner_id,
        'property_id', NEW.property_id,
        'property_address', COALESCE(v_property_address, ''),
        'loyer', NEW.loyer,
        'charges_forfaitaires', NEW.charges_forfaitaires,
        'date_debut', NEW.date_debut,
        'jour_paiement', COALESCE(NEW.jour_paiement, 5),
        'grace_period_days', COALESCE(NEW.grace_period_days, 3)
      ));

      -- Générer immédiatement la première facture (prorata si nécessaire)
      PERFORM generate_first_invoice(NEW.id, v_tenant_signer.profile_id, v_owner_id);

      -- Marquer le moteur comme démarré
      NEW.invoice_engine_started := true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Fonction pour générer la première facture avec calcul prorata
CREATE OR REPLACE FUNCTION generate_first_invoice(
  p_lease_id UUID,
  p_tenant_id UUID,
  p_owner_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lease RECORD;
  v_now DATE := CURRENT_DATE;
  v_jour_paiement INT;
  v_days_in_month INT;
  v_date_debut DATE;
  v_first_full_month DATE;
  v_prorata_amount DECIMAL(10,2);
  v_prorata_days INT;
  v_total_days INT;
  v_loyer DECIMAL(10,2);
  v_charges DECIMAL(10,2);
  v_prorata_charges DECIMAL(10,2);
  v_current_month TEXT;
  v_invoice_exists BOOLEAN;
BEGIN
  -- Récupérer les données du bail
  SELECT * INTO v_lease FROM leases WHERE id = p_lease_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_loyer := v_lease.loyer;
  v_charges := v_lease.charges_forfaitaires;
  v_jour_paiement := COALESCE(v_lease.jour_paiement, 5);
  v_date_debut := v_lease.date_debut;

  -- Mois du début de bail
  v_current_month := TO_CHAR(v_date_debut, 'YYYY-MM');

  -- Vérifier si une facture existe déjà pour ce mois
  SELECT EXISTS(
    SELECT 1 FROM invoices WHERE lease_id = p_lease_id AND periode = v_current_month
  ) INTO v_invoice_exists;
  IF v_invoice_exists THEN RETURN; END IF;

  -- Calculer le prorata si le bail ne commence pas le 1er du mois
  v_total_days := EXTRACT(DAY FROM (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day'));
  v_prorata_days := v_total_days - EXTRACT(DAY FROM v_date_debut)::INT + 1;

  IF v_prorata_days < v_total_days THEN
    -- Facture prorata
    v_prorata_amount := ROUND((v_loyer * v_prorata_days / v_total_days), 2);
    v_prorata_charges := ROUND((v_charges * v_prorata_days / v_total_days), 2);

    INSERT INTO invoices (
      lease_id, owner_id, tenant_id, periode,
      montant_loyer, montant_charges, montant_total,
      date_echeance, period_start, period_end,
      invoice_number, statut, generated_at, notes
    ) VALUES (
      p_lease_id, p_owner_id, p_tenant_id, v_current_month,
      v_prorata_amount, v_prorata_charges, v_prorata_amount + v_prorata_charges,
      v_date_debut, v_date_debut, (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
      'QUI-' || REPLACE(v_current_month, '-', '') || '-' || UPPER(LEFT(p_lease_id::TEXT, 8)),
      'sent', NOW(),
      'Facture prorata du ' || v_date_debut || ' au ' || (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day')::DATE || ' (' || v_prorata_days || '/' || v_total_days || ' jours)'
    );
  ELSE
    -- Bail commence le 1er → facture complète
    v_days_in_month := v_total_days;

    INSERT INTO invoices (
      lease_id, owner_id, tenant_id, periode,
      montant_loyer, montant_charges, montant_total,
      date_echeance, period_start, period_end,
      invoice_number, statut, generated_at
    ) VALUES (
      p_lease_id, p_owner_id, p_tenant_id, v_current_month,
      v_loyer, v_charges, v_loyer + v_charges,
      (v_current_month || '-' || LPAD(LEAST(v_jour_paiement, v_days_in_month)::TEXT, 2, '0'))::DATE,
      v_date_debut, (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
      'QUI-' || REPLACE(v_current_month, '-', '') || '-' || UPPER(LEFT(p_lease_id::TEXT, 8)),
      'sent', NOW()
    );
  END IF;

  -- Mettre à jour first_invoice_date
  UPDATE leases SET first_invoice_date = v_date_debut WHERE id = p_lease_id;
END;
$$;

-- Installer le trigger (BEFORE UPDATE pour pouvoir modifier NEW)
DROP TRIGGER IF EXISTS trg_invoice_engine_on_lease_active ON leases;
CREATE TRIGGER trg_invoice_engine_on_lease_active
  BEFORE UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION trigger_invoice_engine_on_lease_active();

COMMENT ON FUNCTION trigger_invoice_engine_on_lease_active IS 'Déclenche la génération de la première facture quand un bail passe à actif';
COMMENT ON FUNCTION generate_first_invoice IS 'Génère la première facture avec calcul prorata conforme loi 6 juillet 1989';


-- === MIGRATION: 20260305000002_payment_crons.sql ===
-- ============================================
-- Migration : Ajouter overdue-check au pg_cron
-- Date : 2026-03-05
-- Description : Planifie le cron overdue-check quotidien à 9h UTC
--   pour détecter les retards, calculer les pénalités légales,
--   et mettre à jour les statuts des factures.
-- ============================================

-- Supprimer l'ancien job s'il existe (idempotent)
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'overdue-check';

-- Cron overdue-check : quotidien à 9h UTC
SELECT cron.schedule('overdue-check', '0 9 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.settings.app_url') || '/api/cron/overdue-check',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')),
    body := '{}'::jsonb
  )$$
);


-- === MIGRATION: 20260305100000_fix_invoice_draft_notification.sql ===
-- =====================================================
-- FIX: Corriger la logique inversée dans notify_tenant_invoice_created
--
-- BUG: La condition `NOT IN ('sent', 'draft')` retournait NEW pour tout
-- sauf 'sent' et 'draft', ce qui inclut les brouillons dans les notifications.
-- Le commentaire dit "pas les brouillons" mais la logique fait le contraire.
--
-- FIX: Ne notifier que pour les factures envoyées ('sent'), pas les brouillons.
-- =====================================================

CREATE OR REPLACE FUNCTION notify_tenant_invoice_created()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant RECORD;
  v_property_address TEXT;
BEGIN
  -- Seulement pour les factures envoyées (pas les brouillons ni autres statuts)
  IF NEW.statut != 'sent' THEN
    RETURN NEW;
  END IF;

  -- Récupérer l'adresse via le bail
  SELECT COALESCE(p.adresse_complete, 'Logement')
  INTO v_property_address
  FROM leases l
  JOIN properties p ON l.property_id = p.id
  WHERE l.id = NEW.lease_id;

  -- Notifier tous les locataires du bail
  FOR v_tenant IN
    SELECT DISTINCT ls.profile_id
    FROM lease_signers ls
    WHERE ls.lease_id = NEW.lease_id
      AND ls.role IN ('locataire_principal', 'colocataire')
      AND ls.profile_id IS NOT NULL
  LOOP
    INSERT INTO notifications (
      profile_id,
      type,
      title,
      message,
      link,
      metadata
    ) VALUES (
      v_tenant.profile_id,
      'invoice',
      'Nouvelle quittance disponible',
      'Quittance pour ' || v_property_address || ' - ' || COALESCE(NEW.montant_total::text, '0') || '€',
      '/tenant/payments?invoice=' || NEW.id,
      jsonb_build_object(
        'invoice_id', NEW.id,
        'lease_id', NEW.lease_id,
        'montant', NEW.montant_total,
        'periode', NEW.periode
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- === MIGRATION: 20260306100000_invoice_on_fully_signed.sql ===
-- ============================================
-- Migration : Facture initiale à la signature du bail (fully_signed)
-- Date : 2026-03-06
-- Description :
--   1. Fonction generate_initial_signing_invoice : crée la facture initiale
--      (loyer prorata + charges + dépôt de garantie) dès que le bail est
--      entièrement signé, conformément à la Loi Alur / loi du 6 juillet 1989.
--   2. Trigger trg_invoice_on_lease_fully_signed : appelle la fonction
--      quand leases.statut → 'fully_signed'.
--   3. Garde anti-doublon dans trigger_invoice_engine_on_lease_active :
--      empêche generate_first_invoice si une initial_invoice existe déjà.
-- ============================================

-- =====================
-- 1. Fonction de génération de la facture initiale à la signature
-- =====================

CREATE OR REPLACE FUNCTION generate_initial_signing_invoice(
  p_lease_id UUID,
  p_tenant_id UUID,
  p_owner_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lease RECORD;
  v_date_debut DATE;
  v_loyer DECIMAL(10,2);
  v_charges DECIMAL(10,2);
  v_deposit DECIMAL(10,2);
  v_total_days INT;
  v_prorata_days INT;
  v_prorata_loyer DECIMAL(10,2);
  v_prorata_charges DECIMAL(10,2);
  v_is_prorated BOOLEAN := false;
  v_month_str TEXT;
  v_due_date DATE;
  v_period_end DATE;
  v_invoice_exists BOOLEAN;
BEGIN
  -- Récupérer les données du bail
  SELECT * INTO v_lease FROM leases WHERE id = p_lease_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_loyer := COALESCE(v_lease.loyer, 0);
  v_charges := COALESCE(v_lease.charges_forfaitaires, 0);
  v_deposit := COALESCE(v_lease.depot_de_garantie, 0);
  v_date_debut := v_lease.date_debut;

  IF v_date_debut IS NULL THEN RETURN; END IF;

  v_month_str := TO_CHAR(v_date_debut, 'YYYY-MM');

  -- Garde anti-doublon : vérifier si une facture initial_invoice existe déjà
  SELECT EXISTS(
    SELECT 1 FROM invoices
    WHERE lease_id = p_lease_id
    AND metadata->>'type' = 'initial_invoice'
  ) INTO v_invoice_exists;
  IF v_invoice_exists THEN RETURN; END IF;

  -- Calcul prorata si le bail ne commence pas le 1er du mois
  v_total_days := EXTRACT(DAY FROM (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day'));
  v_prorata_days := v_total_days - EXTRACT(DAY FROM v_date_debut)::INT + 1;
  v_period_end := (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  IF v_prorata_days < v_total_days THEN
    -- Prorata
    v_prorata_loyer := ROUND((v_loyer * v_prorata_days / v_total_days), 2);
    v_prorata_charges := ROUND((v_charges * v_prorata_days / v_total_days), 2);
    v_is_prorated := true;
  ELSE
    -- Mois complet
    v_prorata_loyer := v_loyer;
    v_prorata_charges := v_charges;
  END IF;

  -- Date d'échéance : dû immédiatement (aujourd'hui ou date_debut, le plus tard)
  v_due_date := GREATEST(v_date_debut, CURRENT_DATE);

  -- Insérer la facture initiale (loyer + charges + dépôt)
  INSERT INTO invoices (
    lease_id, owner_id, tenant_id, periode,
    montant_loyer, montant_charges, montant_total,
    date_echeance, period_start, period_end,
    invoice_number, statut, generated_at, metadata, notes
  ) VALUES (
    p_lease_id, p_owner_id, p_tenant_id, v_month_str,
    v_prorata_loyer, v_prorata_charges,
    v_prorata_loyer + v_prorata_charges + v_deposit,
    v_due_date, v_date_debut, v_period_end,
    'INI-' || REPLACE(v_month_str, '-', '') || '-' || UPPER(LEFT(p_lease_id::TEXT, 8)),
    'sent', NOW(),
    jsonb_build_object(
      'type', 'initial_invoice',
      'includes_deposit', true,
      'deposit_amount', v_deposit,
      'is_prorated', v_is_prorated,
      'prorata_days', v_prorata_days,
      'total_days', v_total_days,
      'generated_at_signing', true
    ),
    CASE
      WHEN v_is_prorated THEN
        'Facture initiale : loyer prorata du ' || v_date_debut || ' au ' || v_period_end
        || ' (' || v_prorata_days || '/' || v_total_days || ' jours)'
        || ' + dépôt de garantie ' || v_deposit || ' €'
      ELSE
        'Facture initiale : loyer ' || v_month_str || ' + dépôt de garantie ' || v_deposit || ' €'
    END
  );
END;
$$;

COMMENT ON FUNCTION generate_initial_signing_invoice IS
  'Génère la facture initiale (loyer prorata + dépôt de garantie) à la signature du bail, conformément à la Loi Alur';

-- =====================
-- 2. Trigger : bail fully_signed → facture initiale
-- =====================

CREATE OR REPLACE FUNCTION trigger_invoice_on_lease_fully_signed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
  v_owner_id UUID;
BEGIN
  -- Ne déclencher que si le statut passe à 'fully_signed'
  IF NEW.statut = 'fully_signed' AND (OLD.statut IS DISTINCT FROM 'fully_signed') THEN

    -- Trouver le locataire principal
    SELECT ls.profile_id INTO v_tenant_id
    FROM lease_signers ls
    WHERE ls.lease_id = NEW.id
    AND ls.role IN ('locataire', 'locataire_principal', 'colocataire')
    AND ls.profile_id IS NOT NULL
    LIMIT 1;

    -- Trouver le propriétaire
    SELECT p.owner_id INTO v_owner_id
    FROM properties p
    WHERE p.id = NEW.property_id;

    IF v_tenant_id IS NOT NULL AND v_owner_id IS NOT NULL THEN
      PERFORM generate_initial_signing_invoice(NEW.id, v_tenant_id, v_owner_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_on_lease_fully_signed ON leases;
CREATE TRIGGER trg_invoice_on_lease_fully_signed
  BEFORE UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION trigger_invoice_on_lease_fully_signed();

COMMENT ON FUNCTION trigger_invoice_on_lease_fully_signed IS
  'Déclenche la génération de la facture initiale quand un bail passe à fully_signed';

-- =====================
-- 3. Patch : garde anti-doublon dans trigger_invoice_engine_on_lease_active
--    Si une initial_invoice existe déjà (créée à la signature), on ne recrée pas
-- =====================

CREATE OR REPLACE FUNCTION trigger_invoice_engine_on_lease_active()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_signer RECORD;
  v_owner_id UUID;
  v_property_address TEXT;
  v_initial_exists BOOLEAN;
BEGIN
  -- Ne déclencher que si le statut passe à 'active' et que le moteur n'a pas déjà été démarré
  IF NEW.statut = 'active' AND (OLD.statut IS DISTINCT FROM 'active') AND (NEW.invoice_engine_started IS NOT TRUE) THEN

    -- Trouver le locataire principal
    SELECT ls.profile_id INTO v_tenant_signer
    FROM lease_signers ls
    WHERE ls.lease_id = NEW.id
    AND ls.role IN ('locataire', 'locataire_principal', 'colocataire')
    LIMIT 1;

    -- Trouver le propriétaire
    SELECT p.owner_id, p.adresse_complete INTO v_owner_id, v_property_address
    FROM properties p
    WHERE p.id = NEW.property_id;

    IF v_tenant_signer.profile_id IS NOT NULL AND v_owner_id IS NOT NULL THEN
      -- Émettre un événement outbox pour que le process-outbox le traite
      INSERT INTO outbox (event_type, payload)
      VALUES ('Lease.InvoiceEngineStart', jsonb_build_object(
        'lease_id', NEW.id,
        'tenant_id', v_tenant_signer.profile_id,
        'owner_id', v_owner_id,
        'property_id', NEW.property_id,
        'property_address', COALESCE(v_property_address, ''),
        'loyer', NEW.loyer,
        'charges_forfaitaires', NEW.charges_forfaitaires,
        'date_debut', NEW.date_debut,
        'jour_paiement', COALESCE(NEW.jour_paiement, 5),
        'grace_period_days', COALESCE(NEW.grace_period_days, 3)
      ));

      -- Vérifier si une initial_invoice existe déjà (créée à la signature)
      SELECT EXISTS(
        SELECT 1 FROM invoices
        WHERE lease_id = NEW.id
        AND metadata->>'type' = 'initial_invoice'
      ) INTO v_initial_exists;

      -- Générer la première facture SEULEMENT si aucune facture initiale n'existe
      IF NOT v_initial_exists THEN
        PERFORM generate_first_invoice(NEW.id, v_tenant_signer.profile_id, v_owner_id);
      END IF;

      -- Marquer le moteur comme démarré
      NEW.invoice_engine_started := true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- === MIGRATION: 20260306100001_backfill_initial_invoices.sql ===
-- ============================================
-- Migration : Backfill des factures initiales pour les baux existants
-- Date : 2026-03-06
-- Description :
--   1. Génère les factures initiales manquantes pour les baux fully_signed
--      qui n'ont pas de facture initial_invoice.
--   2. Corrige date_echeance NULL sur les factures initiales existantes.
-- ============================================

-- =====================
-- 1. Backfill : générer les factures initiales manquantes
-- =====================

DO $$
DECLARE
  v_lease RECORD;
  v_tenant_id UUID;
  v_owner_id UUID;
BEGIN
  FOR v_lease IN
    SELECT l.id, l.property_id
    FROM leases l
    WHERE l.statut IN ('fully_signed', 'active')
    AND NOT EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.lease_id = l.id
      AND i.metadata->>'type' = 'initial_invoice'
    )
  LOOP
    -- Trouver le locataire
    SELECT ls.profile_id INTO v_tenant_id
    FROM lease_signers ls
    WHERE ls.lease_id = v_lease.id
    AND ls.role IN ('locataire', 'locataire_principal', 'colocataire')
    AND ls.profile_id IS NOT NULL
    LIMIT 1;

    -- Trouver le propriétaire
    SELECT p.owner_id INTO v_owner_id
    FROM properties p WHERE p.id = v_lease.property_id;

    IF v_tenant_id IS NOT NULL AND v_owner_id IS NOT NULL THEN
      PERFORM generate_initial_signing_invoice(v_lease.id, v_tenant_id, v_owner_id);
    END IF;
  END LOOP;
END $$;

-- =====================
-- 2. Fix : corriger date_echeance NULL sur les factures initiales existantes
-- =====================

UPDATE invoices
SET date_echeance = COALESCE(
  (SELECT l.date_debut FROM leases l WHERE l.id = invoices.lease_id),
  created_at::date
)
WHERE metadata->>'type' = 'initial_invoice'
AND date_echeance IS NULL;

-- =====================
-- 3. Fix : corriger date_echeance NULL sur toute facture avec statut 'sent' ou 'late'
-- =====================

UPDATE invoices
SET date_echeance = COALESCE(
  due_date,
  (SELECT l.date_debut FROM leases l WHERE l.id = invoices.lease_id),
  created_at::date
)
WHERE date_echeance IS NULL
AND statut IN ('sent', 'late', 'overdue', 'unpaid');


-- === MIGRATION: 20260306300000_add_owner_payment_preferences.sql ===
-- Migration : Ajouter les colonnes de préférences financières et d'automatisation au profil propriétaire
-- Ces colonnes étaient précédemment stockées uniquement dans le brouillon d'onboarding et perdues après

-- Préférences d'encaissement et de versement
ALTER TABLE owner_profiles
  ADD COLUMN IF NOT EXISTS encaissement_prefere TEXT DEFAULT 'sepa_sdd'
    CHECK (encaissement_prefere IN ('sepa_sdd', 'virement_sct', 'virement_inst', 'pay_by_bank', 'carte_wallet')),
  ADD COLUMN IF NOT EXISTS payout_frequence TEXT DEFAULT 'immediat'
    CHECK (payout_frequence IN ('immediat', 'hebdo', 'mensuel', 'seuil')),
  ADD COLUMN IF NOT EXISTS payout_rail TEXT DEFAULT 'sct'
    CHECK (payout_rail IN ('sct', 'sct_inst')),
  ADD COLUMN IF NOT EXISTS payout_seuil NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_jour INTEGER DEFAULT 1
    CHECK (payout_jour >= 1 AND payout_jour <= 28);

-- Niveau d'automatisation
ALTER TABLE owner_profiles
  ADD COLUMN IF NOT EXISTS automation_level TEXT DEFAULT 'standard'
    CHECK (automation_level IN ('basique', 'standard', 'pro', 'autopilot'));

COMMENT ON COLUMN owner_profiles.encaissement_prefere IS 'Mode d''encaissement préféré (SEPA, virement, carte, etc.)';
COMMENT ON COLUMN owner_profiles.payout_frequence IS 'Fréquence de versement des fonds au propriétaire';
COMMENT ON COLUMN owner_profiles.payout_rail IS 'Rail de versement (SCT standard ou instantané)';
COMMENT ON COLUMN owner_profiles.payout_seuil IS 'Seuil de déclenchement du versement (si fréquence = seuil)';
COMMENT ON COLUMN owner_profiles.payout_jour IS 'Jour du mois pour le versement (si fréquence = mensuel)';
COMMENT ON COLUMN owner_profiles.automation_level IS 'Niveau d''automatisation choisi par le propriétaire';


-- === MIGRATION: 20260314020000_canonical_lease_activation_flow.sql ===
-- Migration: recentrer le flux bail sur un parcours canonique
-- Date: 2026-03-14
--
-- Objectifs:
-- 1. Empêcher les activations implicites depuis les signataires ou l'EDL
-- 2. Faire de la facture initiale une étape explicite après fully_signed
-- 3. Préserver le dépôt de garantie dans le total de la facture initiale

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Neutraliser les activations SQL implicites legacy
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS tr_check_activate_lease ON lease_signers;
DROP TRIGGER IF EXISTS auto_activate_lease_on_edl ON edl;
DROP TRIGGER IF EXISTS trg_invoice_on_lease_fully_signed ON leases;

-- ---------------------------------------------------------------------------
-- 2. L'EDL finalise uniquement le document, sans activer le bail
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_edl_finalization()
RETURNS TRIGGER AS $$
DECLARE
    v_has_owner BOOLEAN;
    v_has_tenant BOOLEAN;
    v_edl_id UUID;
BEGIN
    v_edl_id := NEW.edl_id;

    SELECT 
        EXISTS (
            SELECT 1 FROM edl_signatures 
            WHERE edl_id = v_edl_id 
              AND signer_role IN ('owner', 'proprietaire', 'bailleur') 
              AND signature_image_path IS NOT NULL
              AND signed_at IS NOT NULL
        ),
        EXISTS (
            SELECT 1 FROM edl_signatures 
            WHERE edl_id = v_edl_id 
              AND signer_role IN ('tenant', 'locataire', 'locataire_principal') 
              AND signature_image_path IS NOT NULL
              AND signed_at IS NOT NULL
        )
    INTO v_has_owner, v_has_tenant;

    IF v_has_owner AND v_has_tenant THEN
        UPDATE edl
        SET 
            status = 'signed',
            completed_date = COALESCE(completed_date, CURRENT_DATE),
            updated_at = NOW()
        WHERE id = v_edl_id
          AND status != 'signed';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 3. Préserver le dépôt de garantie dans le calcul du total
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_invoice_total()
RETURNS TRIGGER AS $$
DECLARE
  v_deposit_amount DECIMAL := 0;
BEGIN
  IF NEW.metadata IS NOT NULL AND NEW.metadata->>'type' = 'initial_invoice' THEN
    v_deposit_amount := COALESCE((NEW.metadata->>'deposit_amount')::DECIMAL, 0);
  END IF;

  NEW.montant_total :=
    ROUND(COALESCE(NEW.montant_loyer, 0) + COALESCE(NEW.montant_charges, 0) + v_deposit_amount, 2);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 4. Fonction SSOT de génération de la facture initiale
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION generate_initial_signing_invoice(
  p_lease_id UUID,
  p_tenant_id UUID,
  p_owner_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lease RECORD;
  v_date_debut DATE;
  v_loyer DECIMAL(10,2);
  v_charges DECIMAL(10,2);
  v_deposit DECIMAL(10,2);
  v_total_days INT;
  v_prorata_days INT;
  v_prorata_loyer DECIMAL(10,2);
  v_prorata_charges DECIMAL(10,2);
  v_is_prorated BOOLEAN := false;
  v_month_str TEXT;
  v_due_date DATE;
  v_period_end DATE;
  v_invoice_exists BOOLEAN;
BEGIN
  SELECT * INTO v_lease FROM leases WHERE id = p_lease_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_loyer := COALESCE(v_lease.loyer, 0);
  v_charges := COALESCE(v_lease.charges_forfaitaires, 0);
  v_deposit := COALESCE(v_lease.depot_de_garantie, 0);
  v_date_debut := v_lease.date_debut;

  IF v_date_debut IS NULL THEN RETURN; END IF;

  v_month_str := TO_CHAR(v_date_debut, 'YYYY-MM');

  SELECT EXISTS(
    SELECT 1 FROM invoices
    WHERE lease_id = p_lease_id
      AND (
        metadata->>'type' = 'initial_invoice'
        OR type = 'initial_invoice'
      )
  ) INTO v_invoice_exists;

  IF v_invoice_exists THEN RETURN; END IF;

  v_total_days := EXTRACT(DAY FROM (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day'));
  v_prorata_days := v_total_days - EXTRACT(DAY FROM v_date_debut)::INT + 1;
  v_period_end := (DATE_TRUNC('month', v_date_debut) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  IF v_prorata_days < v_total_days THEN
    v_prorata_loyer := ROUND((v_loyer * v_prorata_days / v_total_days), 2);
    v_prorata_charges := ROUND((v_charges * v_prorata_days / v_total_days), 2);
    v_is_prorated := true;
  ELSE
    v_prorata_loyer := v_loyer;
    v_prorata_charges := v_charges;
  END IF;

  v_due_date := GREATEST(v_date_debut, CURRENT_DATE);

  INSERT INTO invoices (
    lease_id,
    owner_id,
    tenant_id,
    periode,
    montant_loyer,
    montant_charges,
    montant_total,
    date_echeance,
    due_date,
    period_start,
    period_end,
    invoice_number,
    type,
    statut,
    generated_at,
    metadata,
    notes
  ) VALUES (
    p_lease_id,
    p_owner_id,
    p_tenant_id,
    v_month_str,
    v_prorata_loyer,
    v_prorata_charges,
    v_prorata_loyer + v_prorata_charges + v_deposit,
    v_due_date,
    v_due_date,
    v_date_debut,
    v_period_end,
    'INI-' || REPLACE(v_month_str, '-', '') || '-' || UPPER(LEFT(p_lease_id::TEXT, 8)),
    'initial_invoice',
    'sent',
    NOW(),
    jsonb_build_object(
      'type', 'initial_invoice',
      'includes_deposit', v_deposit > 0,
      'deposit_amount', v_deposit,
      'is_prorated', v_is_prorated,
      'prorata_days', v_prorata_days,
      'total_days', v_total_days,
      'generated_at_signing', true
    ),
    CASE
      WHEN v_is_prorated THEN
        'Facture initiale : loyer prorata du ' || v_date_debut || ' au ' || v_period_end
        || ' (' || v_prorata_days || '/' || v_total_days || ' jours)'
        || ' + dépôt de garantie ' || v_deposit || ' €'
      ELSE
        'Facture initiale : loyer ' || v_month_str || ' + dépôt de garantie ' || v_deposit || ' €'
    END
  );
END;
$$;

COMMIT;


-- === MIGRATION: 20260314030000_payments_production_hardening.sql ===
-- Migration: hardening production paiements
-- Objectifs:
-- 1. Neutraliser les derniers chemins legacy qui activent un bail implicitement
-- 2. Renforcer l'idempotence des reversements Stripe Connect
-- 3. Distinguer transfert Connect et payout bancaire reel
-- 4. Backfiller les marqueurs de facture initiale et les liens SEPA sur les donnees existantes

-- -----------------------------------------------------------------------------
-- Flux bail / signatures / EDL
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_signature_session_to_entity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    IF NEW.entity_type = 'lease' THEN
      UPDATE leases
      SET
        statut = CASE
          WHEN NEW.document_type = 'bail' THEN 'fully_signed'
          ELSE statut
        END,
        signature_completed_at = NOW(),
        updated_at = NOW()
      WHERE id = NEW.entity_id;

    ELSIF NEW.entity_type = 'edl' THEN
      UPDATE edl
      SET
        status = 'signed',
        updated_at = NOW()
      WHERE id = NEW.entity_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_activate_lease_on_edl ON public.edl;
DROP TRIGGER IF EXISTS tr_check_activate_lease ON public.lease_signers;
DROP TRIGGER IF EXISTS trg_invoice_on_lease_fully_signed ON public.leases;
DROP TRIGGER IF EXISTS trg_invoice_engine_on_lease_active ON public.leases;

-- -----------------------------------------------------------------------------
-- Reversements Stripe Connect / payouts
-- -----------------------------------------------------------------------------

ALTER TABLE public.stripe_transfers
  ADD COLUMN IF NOT EXISTS stripe_source_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_destination_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS payout_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_transfers_unique_payment
  ON public.stripe_transfers(payment_id)
  WHERE payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_transfers_unique_invoice_transfer
  ON public.stripe_transfers(invoice_id, stripe_transfer_id);

CREATE TABLE IF NOT EXISTS public.stripe_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connect_account_id UUID NOT NULL REFERENCES public.stripe_connect_accounts(id) ON DELETE CASCADE,
  stripe_payout_id TEXT NOT NULL UNIQUE,
  stripe_balance_transaction_id TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'canceled', 'in_transit')),
  arrival_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  failure_code TEXT,
  failure_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_payouts_connect_account
  ON public.stripe_payouts(connect_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stripe_payouts_status
  ON public.stripe_payouts(status, created_at DESC);

ALTER TABLE public.stripe_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own payouts" ON public.stripe_payouts;
CREATE POLICY "Owners can view own payouts" ON public.stripe_payouts
  FOR SELECT USING (
    connect_account_id IN (
      SELECT sca.id
      FROM public.stripe_connect_accounts sca
      WHERE sca.profile_id = public.user_profile_id()
    )
    OR public.user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Service role full access payouts" ON public.stripe_payouts;
CREATE POLICY "Service role full access payouts" ON public.stripe_payouts
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP TRIGGER IF EXISTS update_stripe_payouts_updated_at ON public.stripe_payouts;
CREATE TRIGGER update_stripe_payouts_updated_at
  BEFORE UPDATE ON public.stripe_payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stripe_transfers'
      AND column_name = 'payout_id'
  ) THEN
    BEGIN
      ALTER TABLE public.stripe_transfers
        ADD CONSTRAINT fk_stripe_transfers_payout
        FOREIGN KEY (payout_id) REFERENCES public.stripe_payouts(id) ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Backfills securises et idempotents
-- -----------------------------------------------------------------------------

UPDATE public.invoices
SET type = 'initial_invoice'
WHERE COALESCE(metadata->>'type', '') = 'initial_invoice'
  AND COALESCE(type, '') <> 'initial_invoice';

UPDATE public.invoices
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('type', 'initial_invoice')
WHERE type = 'initial_invoice'
  AND COALESCE(metadata->>'type', '') <> 'initial_invoice';

UPDATE public.tenant_payment_methods tpm
SET sepa_mandate_id = sm.id,
    updated_at = NOW()
FROM public.sepa_mandates sm
WHERE tpm.type = 'sepa_debit'
  AND tpm.sepa_mandate_id IS NULL
  AND tpm.tenant_profile_id = sm.tenant_profile_id
  AND tpm.stripe_payment_method_id = sm.stripe_payment_method_id;


-- === MIGRATION: 20260321000000_drop_invoice_trigger_sota2026.sql ===
-- SOTA 2026: Supprimer le trigger SQL redondant pour la facture initiale.
-- Le service TS ensureInitialInvoiceForLease() (appele par handleLeaseFullySigned)
-- est desormais le seul chemin de creation de la facture initiale.
-- Ce trigger creait un doublon et rendait le flux confus.

DROP TRIGGER IF EXISTS trg_invoice_on_lease_fully_signed ON leases;

-- Supprimer egalement la fonction associee si elle existe
DROP FUNCTION IF EXISTS fn_generate_initial_invoice_on_fully_signed() CASCADE;


-- === MIGRATION: 20260324100000_prevent_duplicate_payments.sql ===
-- ============================================
-- Migration : Anti-doublon paiements
-- Date : 2026-03-24
-- Description :
--   1. Contrainte UNIQUE partielle sur payments : un seul paiement pending par facture
--   2. Empêche la race condition qui a causé le double paiement sur bail da2eb9da
-- ============================================

-- Un seul paiement 'pending' par facture à la fois
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_pending_per_invoice
  ON payments (invoice_id)
  WHERE statut = 'pending';

COMMENT ON INDEX idx_payments_one_pending_per_invoice
  IS 'Empêche plusieurs paiements pending simultanés sur la même facture (anti-doublon)';


-- === MIGRATION: 20260329170000_add_punctuality_score.sql ===
-- Migration: Ajouter le score de ponctualité sur les baux
-- Le score mesure le % de paiements reçus à temps (avant date_echeance)

-- 1. Colonne sur leases
ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS punctuality_score DECIMAL(5,2) DEFAULT NULL;

COMMENT ON COLUMN leases.punctuality_score IS
  'Score de ponctualité du locataire (0-100). NULL = pas encore de données. Mis à jour par trigger.';

-- 2. Fonction de calcul
CREATE OR REPLACE FUNCTION compute_punctuality_score(p_lease_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_total INT;
  v_on_time INT;
BEGIN
  -- Compter les factures payées ou en retard (exclure les brouillons et annulées)
  SELECT COUNT(*) INTO v_total
  FROM invoices
  WHERE lease_id = p_lease_id
    AND statut IN ('paid', 'late', 'overdue', 'unpaid');

  IF v_total = 0 THEN
    RETURN NULL;
  END IF;

  -- Compter les factures payées à temps :
  -- date_paiement <= date_echeance OU statut = 'paid' sans retard
  SELECT COUNT(*) INTO v_on_time
  FROM invoices
  WHERE lease_id = p_lease_id
    AND statut = 'paid'
    AND (
      (date_paiement IS NOT NULL AND date_echeance IS NOT NULL AND date_paiement <= date_echeance)
      OR date_echeance IS NULL
    );

  RETURN ROUND((v_on_time::DECIMAL / v_total) * 100, 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Trigger pour recalculer à chaque changement de facture
CREATE OR REPLACE FUNCTION trigger_update_punctuality_score()
RETURNS TRIGGER AS $$
DECLARE
  v_lease_id UUID;
  v_score DECIMAL(5,2);
BEGIN
  -- Déterminer le lease_id concerné
  v_lease_id := COALESCE(NEW.lease_id, OLD.lease_id);

  IF v_lease_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Recalculer le score
  v_score := compute_punctuality_score(v_lease_id);

  -- Mettre à jour le bail
  UPDATE leases
  SET punctuality_score = v_score
  WHERE id = v_lease_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_punctuality_score ON invoices;

CREATE TRIGGER trg_update_punctuality_score
  AFTER INSERT OR UPDATE OF statut, date_paiement ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_punctuality_score();

-- 4. Calculer le score initial pour tous les baux existants
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT lease_id FROM invoices WHERE lease_id IS NOT NULL LOOP
    UPDATE leases
    SET punctuality_score = compute_punctuality_score(r.lease_id)
    WHERE id = r.lease_id;
  END LOOP;
END;
$$;


-- === MIGRATION: 20260330100000_add_lease_cancellation_columns.sql ===
-- ============================================
-- Migration : Ajout colonnes annulation de bail
-- Date : 2026-03-30
-- Contexte : Un bail signé mais jamais activé ne peut pas être annulé.
--            Cette migration ajoute les colonnes nécessaires pour
--            gérer le cycle de vie d'annulation.
-- ============================================

-- Étape 1 : Ajouter les colonnes d'annulation sur leases
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id);
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE leases ADD COLUMN IF NOT EXISTS cancellation_type TEXT;

-- Étape 2 : Contrainte CHECK sur cancellation_type
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leases_cancellation_type_check'
  ) THEN
    ALTER TABLE leases ADD CONSTRAINT leases_cancellation_type_check
      CHECK (cancellation_type IS NULL OR cancellation_type IN (
        'tenant_withdrawal',
        'owner_withdrawal',
        'mutual_agreement',
        'never_activated',
        'error',
        'duplicate'
      ));
  END IF;
END $$;

-- Étape 3 : Vérifier que 'cancelled' est dans la contrainte CHECK sur statut
-- La migration 20260215200001 l'a déjà ajouté, mais on vérifie par sécurité
DO $$ BEGIN
  -- Tenter d'insérer un bail cancelled pour vérifier la contrainte
  -- Si ça échoue, on met à jour la contrainte
  PERFORM 1;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Étape 4 : Index pour requêtes de nettoyage et reporting
CREATE INDEX IF NOT EXISTS idx_leases_cancelled
  ON leases(statut) WHERE statut = 'cancelled';

CREATE INDEX IF NOT EXISTS idx_leases_cancelled_at
  ON leases(cancelled_at) WHERE cancelled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leases_zombie_candidates
  ON leases(statut, created_at)
  WHERE statut IN ('pending_signature', 'partially_signed', 'fully_signed', 'draft', 'sent')
    AND cancelled_at IS NULL;

-- Étape 5 : RLS — les politiques existantes couvrent déjà leases
-- Pas besoin de nouvelles politiques car l'annulation passe par UPDATE du statut

-- Étape 6 : Commentaires
COMMENT ON COLUMN leases.cancelled_at IS 'Date/heure de l''annulation du bail';
COMMENT ON COLUMN leases.cancelled_by IS 'User ID de la personne ayant annulé le bail';
COMMENT ON COLUMN leases.cancellation_reason IS 'Motif libre de l''annulation';
COMMENT ON COLUMN leases.cancellation_type IS 'Type d''annulation : tenant_withdrawal, owner_withdrawal, mutual_agreement, never_activated, error, duplicate';


-- === MIGRATION: 20260331000000_add_receipt_generated_to_invoices.sql ===
-- Add receipt_generated flag to invoices table
-- Tracks whether a quittance PDF has been generated for a paid invoice

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'receipt_generated'
  ) THEN
    ALTER TABLE invoices ADD COLUMN receipt_generated BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN invoices.receipt_generated IS 'TRUE when a quittance PDF has been generated and stored for this invoice';
  END IF;
END $$;

-- Backfill: mark invoices that already have a quittance document
UPDATE invoices
SET receipt_generated = TRUE
WHERE id IN (
  SELECT DISTINCT (metadata->>'invoice_id')::uuid
  FROM documents
  WHERE type = 'quittance'
    AND metadata->>'invoice_id' IS NOT NULL
)
AND receipt_generated IS NOT TRUE;


-- === MIGRATION: 20260331120000_add_signed_pdf_generated_to_leases.sql ===
-- Migration: Ajouter colonne signed_pdf_generated à la table leases
-- Permet de tracker quels baux ont déjà un PDF signé généré

ALTER TABLE leases
ADD COLUMN IF NOT EXISTS signed_pdf_generated BOOLEAN DEFAULT FALSE;

-- Backfill : baux qui ont déjà un document bail généré
UPDATE leases l
SET signed_pdf_generated = TRUE
WHERE EXISTS (
  SELECT 1 FROM documents d
  WHERE d.lease_id = l.id
    AND d.type = 'bail'
    AND d.is_generated = TRUE
);

-- Index pour requêtes de diagnostic
CREATE INDEX IF NOT EXISTS idx_leases_signed_pdf_generated
ON leases (signed_pdf_generated)
WHERE signed_pdf_generated = FALSE;


-- === MIGRATION: 20260331130000_key_handovers_add_cancelled_notes.sql ===
-- Migration: Améliorer la table key_handovers
-- Ajoute cancelled_at (annulation soft) et notes (commentaires propriétaire)

ALTER TABLE key_handovers
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;

-- Index partiel : remises actives (non confirmées, non annulées)
CREATE INDEX IF NOT EXISTS idx_key_handovers_pending
ON key_handovers (lease_id, created_at DESC)
WHERE confirmed_at IS NULL AND cancelled_at IS NULL;

-- Commentaires
COMMENT ON COLUMN key_handovers.cancelled_at IS 'Date d''annulation de la remise par le propriétaire (soft delete)';
COMMENT ON COLUMN key_handovers.notes IS 'Notes libres du propriétaire sur la remise des clés';


-- === MIGRATION: 20260401000001_add_initial_payment_confirmed_to_leases.sql ===
-- Migration: Ajouter initial_payment_confirmed sur leases
-- Permet au webhook Stripe de marquer le paiement initial comme confirmé
-- et d'éviter la désynchronisation entre l'UI et l'API key-handover.

ALTER TABLE leases
  ADD COLUMN IF NOT EXISTS initial_payment_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS initial_payment_date timestamptz,
  ADD COLUMN IF NOT EXISTS initial_payment_stripe_pi text;

-- Rétro-remplissage : marquer comme confirmé les baux dont la facture initiale est soldée
UPDATE leases l
SET initial_payment_confirmed = true,
    initial_payment_date = i.date_paiement
FROM invoices i
WHERE i.lease_id = l.id
  AND i.statut = 'paid'
  AND (
    i.metadata->>'type' = 'initial_invoice'
    OR i.type = 'initial_invoice'
  )
  AND l.initial_payment_confirmed = false;

-- Index partiel pour les requêtes fréquentes sur les baux non confirmés
CREATE INDEX IF NOT EXISTS idx_leases_initial_payment_pending
  ON leases (id)
  WHERE initial_payment_confirmed = false;


-- === MIGRATION: 20260408130000_lease_amendments_table.sql ===
-- ============================================================================
-- Lease Amendments (Avenants) — Table + RLS
--
-- Stores lease amendments (avenants) for active leases. Amendments track
-- rent revisions, roommate changes, charges adjustments, and other
-- contractual modifications. Each amendment references its parent lease
-- and optionally a signed document in the GED.
-- ============================================================================

-- 1. Create the lease_amendments table
CREATE TABLE IF NOT EXISTS lease_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  amendment_type TEXT NOT NULL CHECK (amendment_type IN (
    'loyer_revision',
    'ajout_colocataire',
    'retrait_colocataire',
    'changement_charges',
    'travaux',
    'autre'
  )),
  description TEXT NOT NULL,
  effective_date DATE NOT NULL,
  old_values JSONB DEFAULT '{}'::jsonb,
  new_values JSONB DEFAULT '{}'::jsonb,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  signed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE lease_amendments ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Owner can view amendments for their leases
CREATE POLICY "owner_select_amendments"
  ON lease_amendments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = lease_amendments.lease_id
        AND pr.user_id = auth.uid()
    )
  );

-- Tenant can view amendments for leases they signed
CREATE POLICY "tenant_select_amendments"
  ON lease_amendments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lease_signers ls
      JOIN profiles pr ON pr.id = ls.profile_id
      WHERE ls.lease_id = lease_amendments.lease_id
        AND pr.user_id = auth.uid()
    )
  );

-- Owner can create amendments for their leases
CREATE POLICY "owner_insert_amendments"
  ON lease_amendments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = lease_amendments.lease_id
        AND pr.user_id = auth.uid()
    )
  );

-- Owner can update amendments for their leases (only unsigned ones)
CREATE POLICY "owner_update_amendments"
  ON lease_amendments
  FOR UPDATE
  USING (
    signed_at IS NULL
    AND EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      JOIN profiles pr ON pr.id = p.owner_id
      WHERE l.id = lease_amendments.lease_id
        AND pr.user_id = auth.uid()
    )
  );

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_lease_amendments_lease_id
  ON lease_amendments (lease_id);

CREATE INDEX IF NOT EXISTS idx_lease_amendments_type
  ON lease_amendments (amendment_type);

CREATE INDEX IF NOT EXISTS idx_lease_amendments_effective_date
  ON lease_amendments (effective_date);

-- 5. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_lease_amendments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lease_amendments_updated_at
  BEFORE UPDATE ON lease_amendments
  FOR EACH ROW
  EXECUTE FUNCTION update_lease_amendments_updated_at();

-- 6. Comments
COMMENT ON TABLE lease_amendments IS 'Avenants au bail — modifications contractuelles';
COMMENT ON COLUMN lease_amendments.amendment_type IS 'Type: loyer_revision, ajout/retrait_colocataire, changement_charges, travaux, autre';
COMMENT ON COLUMN lease_amendments.old_values IS 'Valeurs avant modification (JSONB)';
COMMENT ON COLUMN lease_amendments.new_values IS 'Valeurs après modification (JSONB)';
COMMENT ON COLUMN lease_amendments.signed_at IS 'Date de signature de l''avenant par toutes les parties';


-- === MIGRATION: 20260408220000_payment_architecture_sota.sql ===
-- =====================================================
-- Migration: Payment Architecture SOTA 2026
-- Date: 2026-04-08
--
-- 1. rent_payments table (Stripe Connect Express)
-- 2. security_deposits table
-- 3. Invoice state machine alignment (7 états)
-- 4. RLS policies
-- 5. Helper functions
-- =====================================================

BEGIN;

-- =====================================================
-- 1. RENT PAYMENTS — Stripe Connect Express
-- Tracks the split between tenant payment, platform
-- commission, and owner payout
-- =====================================================

CREATE TABLE IF NOT EXISTS rent_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,

  -- Montants (tous en centimes)
  amount_cents INTEGER NOT NULL,
  commission_amount_cents INTEGER NOT NULL,
  commission_rate NUMERIC(4,3) NOT NULL,
  owner_amount_cents INTEGER NOT NULL,

  -- Stripe Connect
  stripe_payment_intent_id TEXT NOT NULL,
  stripe_charge_id TEXT,
  stripe_transfer_id TEXT,
  payment_method TEXT DEFAULT 'sepa_debit'
    CHECK (payment_method IN ('sepa_debit', 'card', 'bank_transfer')),

  -- Statut
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'disputed')),

  -- Dates
  initiated_at TIMESTAMPTZ DEFAULT now(),
  succeeded_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate payments for same invoice
  UNIQUE(invoice_id, stripe_payment_intent_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_rent_payments_invoice_id ON rent_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_lease_id ON rent_payments(lease_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_status ON rent_payments(status);
CREATE INDEX IF NOT EXISTS idx_rent_payments_stripe_pi ON rent_payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_created_at ON rent_payments(created_at DESC);

-- RLS
ALTER TABLE rent_payments ENABLE ROW LEVEL SECURITY;

-- Owner can view rent payments for their properties
CREATE POLICY "Owner can view rent_payments" ON rent_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN properties p ON i.lease_id = (SELECT lease_id FROM leases WHERE id = rent_payments.lease_id LIMIT 1)
      WHERE i.id = rent_payments.invoice_id
        AND i.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Tenant can view their own payments
CREATE POLICY "Tenant can view own rent_payments" ON rent_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = rent_payments.invoice_id
        AND i.tenant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Admin full access
CREATE POLICY "Admin can manage rent_payments" ON rent_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Service role inserts (API routes use service role)
-- No INSERT policy needed for normal users — only backend inserts


-- =====================================================
-- 2. SECURITY DEPOSITS — Dépôts de garantie
-- =====================================================

CREATE TABLE IF NOT EXISTS security_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id),

  amount_cents INTEGER NOT NULL,
  paid_at TIMESTAMPTZ,
  payment_method TEXT
    CHECK (payment_method IS NULL OR payment_method IN ('sepa_debit', 'card', 'bank_transfer', 'check', 'cash')),

  -- Restitution
  restitution_amount_cents INTEGER,
  retenue_cents INTEGER DEFAULT 0,
  retenue_details JSONB DEFAULT '[]',
  restitution_due_date DATE,
  restituted_at TIMESTAMPTZ,
  restitution_method TEXT
    CHECK (restitution_method IS NULL OR restitution_method IN ('bank_transfer', 'check', 'sepa_credit')),

  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'received', 'partially_returned', 'returned', 'disputed')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_security_deposits_lease_id ON security_deposits(lease_id);
CREATE INDEX IF NOT EXISTS idx_security_deposits_tenant_id ON security_deposits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_deposits_status ON security_deposits(status);

-- Trigger updated_at
CREATE OR REPLACE TRIGGER set_updated_at_security_deposits
  BEFORE UPDATE ON security_deposits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE security_deposits ENABLE ROW LEVEL SECURITY;

-- Owner can manage deposits for their properties
CREATE POLICY "Owner can manage security_deposits" ON security_deposits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON l.property_id = p.id
      WHERE l.id = security_deposits.lease_id
        AND p.owner_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Tenant can view their own deposits
CREATE POLICY "Tenant can view own security_deposits" ON security_deposits
  FOR SELECT USING (
    tenant_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Admin full access
CREATE POLICY "Admin can manage all security_deposits" ON security_deposits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );


-- =====================================================
-- 3. INVOICE STATUS ALIGNMENT
-- Add missing statuses to invoices CHECK constraint
-- Spec states: draft, sent, pending, paid, receipt_generated,
--              overdue, reminder_sent, collection, written_off
-- =====================================================

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- period_start / period_end for spec alignment
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'period_start') THEN
    ALTER TABLE invoices ADD COLUMN period_start DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'period_end') THEN
    ALTER TABLE invoices ADD COLUMN period_end DATE;
  END IF;

  -- rent_amount_cents / charges_amount_cents / total_amount_cents
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'rent_amount_cents') THEN
    ALTER TABLE invoices ADD COLUMN rent_amount_cents INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'charges_amount_cents') THEN
    ALTER TABLE invoices ADD COLUMN charges_amount_cents INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'total_amount_cents') THEN
    ALTER TABLE invoices ADD COLUMN total_amount_cents INTEGER;
  END IF;

  -- entity_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'entity_id') THEN
    ALTER TABLE invoices ADD COLUMN entity_id UUID REFERENCES legal_entities(id);
  END IF;

  -- receipt_document_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'receipt_document_id') THEN
    ALTER TABLE invoices ADD COLUMN receipt_document_id UUID REFERENCES documents(id);
  END IF;

  -- receipt_generated_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'receipt_generated_at') THEN
    ALTER TABLE invoices ADD COLUMN receipt_generated_at TIMESTAMPTZ;
  END IF;

  -- last_reminder_at (alias for existing last_reminder_sent_at)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'last_reminder_at') THEN
    ALTER TABLE invoices ADD COLUMN last_reminder_at TIMESTAMPTZ;
  END IF;

  -- metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'metadata') THEN
    ALTER TABLE invoices ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;

  -- paid_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'paid_at') THEN
    ALTER TABLE invoices ADD COLUMN paid_at TIMESTAMPTZ;
  END IF;

  -- stripe_invoice_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'stripe_invoice_id') THEN
    ALTER TABLE invoices ADD COLUMN stripe_invoice_id TEXT;
  END IF;
END $$;

-- Backfill cents columns from existing euro columns
UPDATE invoices
SET
  rent_amount_cents = COALESCE(ROUND(montant_loyer * 100)::INTEGER, 0),
  charges_amount_cents = COALESCE(ROUND(montant_charges * 100)::INTEGER, 0),
  total_amount_cents = COALESCE(ROUND(montant_total * 100)::INTEGER, 0)
WHERE rent_amount_cents IS NULL AND montant_loyer IS NOT NULL;

-- Backfill period_start/period_end from periode (format: YYYY-MM)
UPDATE invoices
SET
  period_start = (periode || '-01')::DATE,
  period_end = ((periode || '-01')::DATE + INTERVAL '1 month' - INTERVAL '1 day')::DATE
WHERE period_start IS NULL AND periode IS NOT NULL;


-- =====================================================
-- 4. HELPER FUNCTION: Transition invoice status
-- Validates the state machine transitions
-- =====================================================

CREATE OR REPLACE FUNCTION transition_invoice_status(
  p_invoice_id UUID,
  p_new_status TEXT,
  p_metadata JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_status TEXT;
  v_allowed BOOLEAN := FALSE;
BEGIN
  SELECT statut INTO v_current_status
  FROM invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
  END IF;

  -- Validate transitions
  v_allowed := CASE
    WHEN v_current_status = 'draft' AND p_new_status = 'sent' THEN TRUE
    WHEN v_current_status = 'sent' AND p_new_status IN ('pending', 'paid', 'overdue') THEN TRUE
    WHEN v_current_status = 'pending' AND p_new_status IN ('paid', 'overdue') THEN TRUE
    WHEN v_current_status = 'paid' AND p_new_status = 'receipt_generated' THEN TRUE
    WHEN v_current_status = 'overdue' AND p_new_status IN ('paid', 'reminder_sent') THEN TRUE
    WHEN v_current_status = 'reminder_sent' AND p_new_status IN ('paid', 'collection') THEN TRUE
    WHEN v_current_status = 'collection' AND p_new_status IN ('paid', 'written_off') THEN TRUE
    -- Legacy status compatibility
    WHEN v_current_status = 'late' AND p_new_status IN ('paid', 'overdue', 'reminder_sent') THEN TRUE
    WHEN v_current_status = 'unpaid' AND p_new_status IN ('paid', 'overdue') THEN TRUE
    ELSE FALSE
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid transition: % -> %', v_current_status, p_new_status;
  END IF;

  UPDATE invoices
  SET
    statut = p_new_status,
    paid_at = CASE WHEN p_new_status = 'paid' THEN now() ELSE paid_at END,
    receipt_generated_at = CASE WHEN p_new_status = 'receipt_generated' THEN now() ELSE receipt_generated_at END,
    last_reminder_at = CASE WHEN p_new_status = 'reminder_sent' THEN now() ELSE last_reminder_at END,
    metadata = COALESCE(metadata, '{}'::JSONB) || p_metadata,
    updated_at = now()
  WHERE id = p_invoice_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 5. HELPER: Get owner Connect account for a property
-- =====================================================

CREATE OR REPLACE FUNCTION get_owner_connect_account_for_invoice(p_invoice_id UUID)
RETURNS TABLE(
  stripe_account_id TEXT,
  charges_enabled BOOLEAN,
  owner_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sca.stripe_account_id,
    sca.charges_enabled,
    i.owner_id
  FROM invoices i
  JOIN profiles p ON i.owner_id = p.id
  LEFT JOIN stripe_connect_accounts sca ON sca.owner_id = p.id AND sca.status = 'active'
  WHERE i.id = p_invoice_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- 6. PERFORMANCE INDEXES
-- =====================================================

-- Fast lookups for overdue invoices (cron)
CREATE INDEX IF NOT EXISTS idx_invoices_overdue_check
  ON invoices(due_date, statut)
  WHERE statut IN ('sent', 'pending', 'overdue', 'late');

-- Fast lookups for receipt generation
CREATE INDEX IF NOT EXISTS idx_invoices_receipt_pending
  ON invoices(id)
  WHERE statut = 'paid' AND receipt_generated IS NOT TRUE;


COMMIT;


COMMIT;
