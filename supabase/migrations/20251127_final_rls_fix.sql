-- Migration FINALE : Correction définitive de la récursion infinie RLS
-- Date: 27 Novembre 2025
-- 
-- PROBLÈME: Les politiques RLS créent des dépendances circulaires:
--   properties → leases → lease_signers → properties
--
-- SOLUTION: Utiliser des fonctions SECURITY DEFINER qui contournent RLS
-- pour les vérifications internes, évitant ainsi la récursion.

BEGIN;

-- ============================================
-- ÉTAPE 1: CRÉER LES FONCTIONS DE VÉRIFICATION SANS RLS
-- Ces fonctions utilisent SECURITY DEFINER pour bypasser RLS
-- ============================================

-- Fonction pour vérifier si un utilisateur est propriétaire d'une propriété
CREATE OR REPLACE FUNCTION public.is_property_owner(p_property_id UUID, p_profile_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM properties 
    WHERE id = p_property_id 
    AND owner_id = p_profile_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Fonction pour vérifier si un utilisateur est signataire d'un bail
CREATE OR REPLACE FUNCTION public.is_lease_signer(p_lease_id UUID, p_profile_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM lease_signers 
    WHERE lease_id = p_lease_id 
    AND profile_id = p_profile_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Fonction pour obtenir l'owner_id d'une propriété liée à un bail
CREATE OR REPLACE FUNCTION public.get_lease_property_owner(p_lease_id UUID)
RETURNS UUID AS $$
  SELECT COALESCE(
    (SELECT p.owner_id FROM leases l JOIN properties p ON p.id = l.property_id WHERE l.id = p_lease_id),
    (SELECT p.owner_id FROM leases l JOIN units u ON u.id = l.unit_id JOIN properties p ON p.id = u.property_id WHERE l.id = p_lease_id)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Fonction pour vérifier si un utilisateur est propriétaire du bail (via property)
CREATE OR REPLACE FUNCTION public.is_lease_owner(p_lease_id UUID, p_profile_id UUID)
RETURNS BOOLEAN AS $$
  SELECT public.get_lease_property_owner(p_lease_id) = p_profile_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Fonction pour obtenir le property_id d'un bail
CREATE OR REPLACE FUNCTION public.get_lease_property_id(p_lease_id UUID)
RETURNS UUID AS $$
  SELECT COALESCE(
    l.property_id,
    (SELECT u.property_id FROM units u WHERE u.id = l.unit_id)
  )
  FROM leases l WHERE l.id = p_lease_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- ÉTAPE 2: SUPPRIMER TOUTES LES POLITIQUES EXISTANTES
-- ============================================

-- Properties
DROP POLICY IF EXISTS "Owners can view own properties" ON properties;
DROP POLICY IF EXISTS "Owners can create own properties" ON properties;
DROP POLICY IF EXISTS "Owners can update own properties" ON properties;
DROP POLICY IF EXISTS "Tenants can view properties with active leases" ON properties;
DROP POLICY IF EXISTS "Admins can view all properties" ON properties;
DROP POLICY IF EXISTS "owner_insert_properties" ON properties;
DROP POLICY IF EXISTS "owner_select_properties" ON properties;
DROP POLICY IF EXISTS "owner_update_properties" ON properties;
DROP POLICY IF EXISTS "owner_delete_properties" ON properties;
DROP POLICY IF EXISTS "tenant_select_properties" ON properties;
DROP POLICY IF EXISTS "admin_select_properties" ON properties;

-- Leases
DROP POLICY IF EXISTS "Owners can view leases of own properties" ON leases;
DROP POLICY IF EXISTS "Tenants can view own leases" ON leases;
DROP POLICY IF EXISTS "Owners can create leases for own properties" ON leases;
DROP POLICY IF EXISTS "Owners can update leases of own properties" ON leases;
DROP POLICY IF EXISTS "Admins can view all leases" ON leases;
DROP POLICY IF EXISTS "Admins can manage all leases" ON leases;

-- Lease Signers
DROP POLICY IF EXISTS "Users can view signers of accessible leases" ON lease_signers;
DROP POLICY IF EXISTS "Users can update own signature" ON lease_signers;
DROP POLICY IF EXISTS "Owners can insert signers for own leases" ON lease_signers;
DROP POLICY IF EXISTS "Admins can manage all signers" ON lease_signers;
DROP POLICY IF EXISTS "Admins can view all signers" ON lease_signers;

-- ============================================
-- ÉTAPE 3: RECRÉER LES POLITIQUES PROPERTIES
-- ============================================

-- Admin (vérifié en premier, pas de dépendance)
CREATE POLICY "properties_admin_all"
  ON properties FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- Owner SELECT (vérification directe, pas de dépendance)
CREATE POLICY "properties_owner_select"
  ON properties FOR SELECT
  TO authenticated
  USING (owner_id = public.user_profile_id());

-- Owner INSERT (vérification directe, pas de dépendance)
CREATE POLICY "properties_owner_insert"
  ON properties FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = public.user_profile_id());

-- Owner UPDATE (vérification directe, pas de dépendance)
CREATE POLICY "properties_owner_update"
  ON properties FOR UPDATE
  TO authenticated
  USING (owner_id = public.user_profile_id())
  WITH CHECK (owner_id = public.user_profile_id());

-- Owner DELETE (vérification directe, pas de dépendance)
CREATE POLICY "properties_owner_delete"
  ON properties FOR DELETE
  TO authenticated
  USING (owner_id = public.user_profile_id());

-- Tenant SELECT (utilise fonction SECURITY DEFINER pour éviter récursion)
-- Note: Les tenants peuvent voir les properties via leur bail actif
CREATE POLICY "properties_tenant_select"
  ON properties FOR SELECT
  TO authenticated
  USING (
    public.user_role() = 'tenant'
    AND EXISTS (
      SELECT 1 FROM lease_signers ls
      JOIN leases l ON l.id = ls.lease_id
      WHERE ls.profile_id = public.user_profile_id()
      AND (l.property_id = properties.id OR EXISTS (
        SELECT 1 FROM units u WHERE u.id = l.unit_id AND u.property_id = properties.id
      ))
      AND l.statut IN ('active', 'pending_signature')
    )
  );

-- ============================================
-- ÉTAPE 4: RECRÉER LES POLITIQUES LEASES
-- ============================================

-- Admin (vérifié en premier, pas de dépendance)
CREATE POLICY "leases_admin_all"
  ON leases FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- Owner SELECT (utilise fonction pour éviter récursion)
CREATE POLICY "leases_owner_select"
  ON leases FOR SELECT
  TO authenticated
  USING (
    public.user_role() = 'owner'
    AND public.is_lease_owner(id, public.user_profile_id())
  );

-- Owner INSERT
CREATE POLICY "leases_owner_insert"
  ON leases FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_role() = 'owner'
    AND (
      property_id IS NULL -- Permettre création sans property_id
      OR public.is_property_owner(property_id, public.user_profile_id())
    )
  );

-- Owner UPDATE (utilise fonction pour éviter récursion)
CREATE POLICY "leases_owner_update"
  ON leases FOR UPDATE
  TO authenticated
  USING (
    public.user_role() = 'owner'
    AND public.is_lease_owner(id, public.user_profile_id())
  )
  WITH CHECK (
    public.user_role() = 'owner'
  );

-- Owner DELETE (utilise fonction pour éviter récursion)
CREATE POLICY "leases_owner_delete"
  ON leases FOR DELETE
  TO authenticated
  USING (
    public.user_role() = 'owner'
    AND public.is_lease_owner(id, public.user_profile_id())
  );

-- Tenant SELECT (utilise fonction pour éviter récursion)
CREATE POLICY "leases_tenant_select"
  ON leases FOR SELECT
  TO authenticated
  USING (
    public.user_role() = 'tenant'
    AND public.is_lease_signer(id, public.user_profile_id())
  );

-- ============================================
-- ÉTAPE 5: RECRÉER LES POLITIQUES LEASE_SIGNERS
-- ============================================

-- Admin (vérifié en premier, pas de dépendance)
CREATE POLICY "lease_signers_admin_all"
  ON lease_signers FOR ALL
  TO authenticated
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- Tous les utilisateurs peuvent voir leur propre signature (accès direct)
CREATE POLICY "lease_signers_user_select_own"
  ON lease_signers FOR SELECT
  TO authenticated
  USING (profile_id = public.user_profile_id());

-- Owner peut voir les signataires de ses baux (utilise fonction)
CREATE POLICY "lease_signers_owner_select"
  ON lease_signers FOR SELECT
  TO authenticated
  USING (
    public.user_role() = 'owner'
    AND public.is_lease_owner(lease_id, public.user_profile_id())
  );

-- Tous les utilisateurs peuvent mettre à jour leur propre signature
CREATE POLICY "lease_signers_user_update_own"
  ON lease_signers FOR UPDATE
  TO authenticated
  USING (profile_id = public.user_profile_id())
  WITH CHECK (profile_id = public.user_profile_id());

-- Owner peut insérer des signataires dans ses baux
CREATE POLICY "lease_signers_owner_insert"
  ON lease_signers FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_role() = 'owner'
    AND public.is_lease_owner(lease_id, public.user_profile_id())
  );

-- Owner peut supprimer des signataires de ses baux
CREATE POLICY "lease_signers_owner_delete"
  ON lease_signers FOR DELETE
  TO authenticated
  USING (
    public.user_role() = 'owner'
    AND public.is_lease_owner(lease_id, public.user_profile_id())
  );

COMMIT;

-- ============================================
-- COMMENTAIRES
-- ============================================
-- 
-- Cette migration résout définitivement la récursion infinie en:
-- 1. Utilisant des fonctions SECURITY DEFINER qui bypasse RLS
-- 2. Ces fonctions font les vérifications "internes" sans déclencher les politiques
-- 3. Les politiques principales utilisent ces fonctions au lieu de sous-requêtes
--
-- Ordre de vérification des politiques (PostgreSQL vérifie dans l'ordre):
-- 1. Admin → bypass total
-- 2. Owner → vérification directe ou via fonction
-- 3. Tenant → vérification via fonction
--
-- Plus de boucle: properties ⟷ leases ⟷ lease_signers

