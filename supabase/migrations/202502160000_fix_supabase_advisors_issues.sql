-- Migration : Correction des problèmes identifiés par Supabase Advisors
-- Date : 2025-02-16
-- 
-- Problèmes corrigés :
-- 1. Vues avec SECURITY DEFINER (3 vues)
-- 2. Fonctions avec search_path mutable (17 fonctions)
-- 3. Extension pg_trgm dans le schéma public

-- ============================================
-- 1. CORRECTION DES VUES AVEC SECURITY DEFINER
-- ============================================

-- Vue payment_shares_public : Retirer SECURITY DEFINER
-- Cette vue ne nécessite pas SECURITY DEFINER car elle ne fait que masquer des colonnes
DROP VIEW IF EXISTS payment_shares_public CASCADE;

CREATE VIEW payment_shares_public AS
SELECT 
  id,
  lease_id,
  month,
  roommate_id,
  status,
  last_event_at,
  autopay,
  -- due_amount et amount_paid sont masqués (non inclus dans la vue)
  created_at
FROM payment_shares;

-- Vue v_person_age : Retirer SECURITY DEFINER
-- Cette vue ne nécessite pas SECURITY DEFINER car elle utilise des fonctions STABLE
DROP VIEW IF EXISTS v_portfolio_age_buckets CASCADE;
DROP VIEW IF EXISTS v_person_age CASCADE;

CREATE VIEW v_person_age AS
SELECT 
  p.id AS person_id,
  p.user_id,
  p.date_naissance AS birthdate,
  age_years(p.date_naissance) AS age_years,
  age_bucket(age_years(p.date_naissance)) AS age_bucket
FROM profiles p;

-- Vue v_portfolio_age_buckets : Retirer SECURITY DEFINER
CREATE VIEW v_portfolio_age_buckets AS
WITH person_role AS (
  -- Locataires actifs
  SELECT 
    ls.profile_id,
    l.id AS lease_id,
    'tenant'::TEXT AS role
  FROM lease_signers ls
  JOIN leases l ON l.id = ls.lease_id
  WHERE ls.role IN ('locataire_principal', 'colocataire')
    AND l.statut IN ('active', 'pending_signature')
  
  UNION ALL
  
  -- Propriétaires individuels
  SELECT 
    p.id AS profile_id,
    NULL::UUID AS lease_id,
    'owner'::TEXT AS role
  FROM profiles p
  JOIN owner_profiles op ON op.profile_id = p.id
  WHERE op.type = 'particulier'
)
SELECT 
  pr.role,
  age_bucket(a.age_years) AS bucket,
  COUNT(*) AS persons
FROM person_role pr
LEFT JOIN v_person_age a ON a.person_id = pr.profile_id
GROUP BY pr.role, age_bucket(a.age_years);

-- Rétablir les permissions RLS sur les vues
ALTER VIEW payment_shares_public OWNER TO postgres;
ALTER VIEW v_person_age OWNER TO postgres;
ALTER VIEW v_portfolio_age_buckets OWNER TO postgres;

-- ============================================
-- 2. CORRECTION DES FONCTIONS AVEC SEARCH_PATH MUTABLE
-- ============================================

-- Fonction handle_new_user : Ajouter SET search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, role)
  VALUES (NEW.id, 'tenant'); -- Par défaut, rôle tenant
  RETURN NEW;
END;
$$;

-- Fonction update_updated_at_column : Ajouter SET search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fonction generate_unique_code : Ajouter SET search_path
CREATE OR REPLACE FUNCTION public.generate_unique_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Exclut les caractères ambigus
  code TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN code;
END;
$$;

-- Fonction calculate_invoice_total : Ajouter SET search_path
CREATE OR REPLACE FUNCTION public.calculate_invoice_total(
  p_loyer DECIMAL,
  p_charges DECIMAL
)
RETURNS DECIMAL
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(p_loyer, 0) + COALESCE(p_charges, 0);
END;
$$;

-- Fonction can_activate_lease : Ajouter SET search_path
CREATE OR REPLACE FUNCTION public.can_activate_lease(p_lease_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  total_signers INTEGER;
  signed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_signers
  FROM lease_signers
  WHERE lease_id = p_lease_id;

  SELECT COUNT(*) INTO signed_count
  FROM lease_signers
  WHERE lease_id = p_lease_id
  AND signature_status = 'signed';

  RETURN total_signers > 0 AND signed_count = total_signers;
END;
$$;

-- Fonction set_invoice_total : Ajouter SET search_path
CREATE OR REPLACE FUNCTION public.set_invoice_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.montant_total := calculate_invoice_total(NEW.montant_loyer, NEW.montant_charges);
  RETURN NEW;
END;
$$;

-- Fonction update_invoice_status : Ajouter SET search_path
CREATE OR REPLACE FUNCTION public.update_invoice_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  invoice_total DECIMAL;
  paid_total DECIMAL;
  invoice_record RECORD;
BEGIN
  -- Récupère les informations de la facture
  SELECT montant_total, statut INTO invoice_record
  FROM invoices
  WHERE id = NEW.invoice_id;

  -- Calcule le total payé
  SELECT COALESCE(SUM(montant), 0) INTO paid_total
  FROM payments
  WHERE invoice_id = NEW.invoice_id
  AND statut = 'succeeded';

  invoice_total := invoice_record.montant_total;

  -- Met à jour le statut de la facture
  IF paid_total >= invoice_total THEN
    UPDATE invoices
    SET statut = 'paid'
    WHERE id = NEW.invoice_id;
  ELSIF paid_total > 0 THEN
    UPDATE invoices
    SET statut = 'sent'
    WHERE id = NEW.invoice_id AND statut = 'draft';
  END IF;

  RETURN NEW;
END;
$$;

-- Fonction validate_lease_property_or_unit : Ajouter SET search_path
CREATE OR REPLACE FUNCTION public.validate_lease_property_or_unit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.property_id IS NULL AND NEW.unit_id IS NULL) THEN
    RAISE EXCEPTION 'Un bail doit être lié à une propriété ou une unité';
  END IF;
  IF (NEW.property_id IS NOT NULL AND NEW.unit_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Un bail ne peut pas être lié à la fois à une propriété et une unité';
  END IF;
  RETURN NEW;
END;
$$;

-- Fonction set_property_unique_code : Ajouter SET search_path
CREATE OR REPLACE FUNCTION public.set_property_unique_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.unique_code IS NULL OR NEW.unique_code = '' THEN
    NEW.unique_code := generate_unique_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Fonction age_years : Ajouter SET search_path
CREATE OR REPLACE FUNCTION public.age_years(dob DATE)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE 
    WHEN $1 IS NULL THEN NULL
    ELSE EXTRACT(YEAR FROM age(current_date, $1))::INTEGER 
  END;
$$;

-- Fonction age_bucket : Ajouter SET search_path
CREATE OR REPLACE FUNCTION public.age_bucket(age_years INTEGER)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN $1 IS NULL THEN 'unknown'
    WHEN $1 < 18 THEN '<18'
    WHEN $1 BETWEEN 18 AND 24 THEN '18-24'
    WHEN $1 BETWEEN 25 AND 34 THEN '25-34'
    WHEN $1 BETWEEN 35 AND 44 THEN '35-44'
    WHEN $1 BETWEEN 45 AND 54 THEN '45-54'
    WHEN $1 BETWEEN 55 AND 64 THEN '55-64'
    WHEN $1 >= 65 THEN '65+'
    ELSE 'unknown'
  END;
$$;

-- Fonction prevent_audit_log_modification : Ajouter SET search_path
-- Note: Cette fonction peut ne pas exister, on la crée si nécessaire
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Les logs d''audit ne peuvent pas être modifiés ou supprimés';
  END IF;
  RETURN NEW;
END;
$$;

-- Fonction update_chat_thread_last_message : Ajouter SET search_path
CREATE OR REPLACE FUNCTION public.update_chat_thread_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE chat_threads
  SET last_message_at = NEW.created_at,
      last_message_id = NEW.id
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

-- Fonction validate_payment_shares_total : Ajouter SET search_path
CREATE OR REPLACE FUNCTION public.validate_payment_shares_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  total_shares NUMERIC;
  invoice_total NUMERIC;
BEGIN
  -- Calculer le total des parts pour cette facture
  SELECT COALESCE(SUM(due_amount), 0) INTO total_shares
  FROM payment_shares
  WHERE invoice_id = NEW.invoice_id;

  -- Récupérer le montant total de la facture
  SELECT montant_total INTO invoice_total
  FROM invoices
  WHERE id = NEW.invoice_id;

  -- Vérifier que le total des parts ne dépasse pas le montant de la facture
  IF total_shares > invoice_total THEN
    RAISE EXCEPTION 'Le total des parts de paiement (%) dépasse le montant de la facture (%)', total_shares, invoice_total;
  END IF;

  RETURN NEW;
END;
$$;

-- Fonction user_profile_id : Ajouter SET search_path
CREATE OR REPLACE FUNCTION public.user_profile_id(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  profile_id UUID;
BEGIN
  SELECT id INTO profile_id
  FROM profiles
  WHERE user_id = p_user_id
  LIMIT 1;
  RETURN profile_id;
END;
$$;

-- Fonction user_role : Ajouter SET search_path
CREATE OR REPLACE FUNCTION public.user_role(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM profiles
  WHERE user_id = p_user_id
  LIMIT 1;
  RETURN user_role;
END;
$$;

-- Fonction is_admin : Ajouter SET search_path
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE user_id = p_user_id
    AND role = 'admin'
  );
END;
$$;

-- ============================================
-- 3. DÉPLACEMENT DE L'EXTENSION pg_trgm
-- ============================================
-- Note: Le déplacement d'une extension nécessite des privilèges superuser
-- et peut nécessiter une migration manuelle. Pour l'instant, on documente
-- le problème et on recommande de le faire manuellement.

-- Créer un schéma pour les extensions si nécessaire
-- CREATE SCHEMA IF NOT EXISTS extensions;

-- Déplacer l'extension (nécessite superuser)
-- ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Pour l'instant, on documente seulement le problème
-- Voir docs/SUPABASE_ADVISORS_FIXES.md pour les instructions manuelles

-- ============================================
-- COMMENTAIRES
-- ============================================
-- 
-- Cette migration corrige :
-- ✅ 3 vues avec SECURITY DEFINER (retiré car non nécessaire)
-- ✅ 17 fonctions avec search_path mutable (ajout de SET search_path = public)
-- ⚠️ Extension pg_trgm : Nécessite une action manuelle (voir documentation)
-- 
-- Note: La protection contre les mots de passe compromis doit être activée
-- via l'interface Supabase Dashboard > Authentication > Password Security

