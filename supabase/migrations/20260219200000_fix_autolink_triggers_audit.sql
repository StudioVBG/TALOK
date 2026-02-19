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
