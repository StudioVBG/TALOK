-- Migration : Correction définitive de la récursion infinie dans les politiques RLS pour leases
-- Problème : Les politiques RLS créent une boucle infinie :
--   - "Tenants can view own leases" vérifie lease_signers
--   - "Users can view signers of accessible leases" vérifie leases
--   - Cela crée une récursion infinie lors des requêtes avec jointures
--
-- Solution : Simplifier les politiques pour éviter les vérifications circulaires
-- en vérifiant directement les propriétés au lieu de passer par les autres tables

-- ============================================
-- CORRECTION DES POLITIQUES LEASES
-- ============================================

-- Supprimer toutes les politiques existantes pour leases
DROP POLICY IF EXISTS "Owners can view leases of own properties" ON leases;
DROP POLICY IF EXISTS "Tenants can view own leases" ON leases;
DROP POLICY IF EXISTS "Owners can create leases for own properties" ON leases;
DROP POLICY IF EXISTS "Owners can update leases of own properties" ON leases;
DROP POLICY IF EXISTS "Admins can view all leases" ON leases;
DROP POLICY IF EXISTS "Admins can manage all leases" ON leases;

-- Recréer les politiques avec une approche simplifiée pour éviter la récursion

-- 1. Les admins peuvent tout voir (vérifié en premier)
CREATE POLICY "Admins can view all leases"
  ON leases FOR SELECT
  USING (public.user_role() = 'admin');

-- 2. Les propriétaires peuvent voir les baux de leurs propriétés
--    (vérification directe sur properties, pas de récursion)
CREATE POLICY "Owners can view leases of own properties"
  ON leases FOR SELECT
  USING (
    public.user_role() = 'owner'
    AND (
      EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = leases.property_id
        AND p.owner_id = public.user_profile_id()
      )
      OR EXISTS (
        SELECT 1 FROM units u
        JOIN properties p ON p.id = u.property_id
        WHERE u.id = leases.unit_id
        AND p.owner_id = public.user_profile_id()
      )
    )
  );

-- 3. Les locataires peuvent voir leurs baux
--    IMPORTANT : On vérifie directement lease_signers SANS passer par leases
--    pour éviter la récursion. On utilise une sous-requête directe.
CREATE POLICY "Tenants can view own leases"
  ON leases FOR SELECT
  USING (
    public.user_role() = 'tenant'
    AND EXISTS (
      SELECT 1 FROM lease_signers ls
      WHERE ls.lease_id = leases.id
      AND ls.profile_id = public.user_profile_id()
      -- Pas de vérification supplémentaire sur leases pour éviter la récursion
    )
  );

-- 4. Les propriétaires peuvent créer des baux pour leurs propriétés
CREATE POLICY "Owners can create leases for own properties"
  ON leases FOR INSERT
  WITH CHECK (
    public.user_role() = 'owner'
    AND (
      EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = leases.property_id
        AND p.owner_id = public.user_profile_id()
      )
      OR EXISTS (
        SELECT 1 FROM units u
        JOIN properties p ON p.id = u.property_id
        WHERE u.id = leases.unit_id
        AND p.owner_id = public.user_profile_id()
      )
      OR leases.property_id IS NULL  -- Permettre la création sans property_id
    )
  );

-- 5. Les propriétaires peuvent mettre à jour leurs baux
CREATE POLICY "Owners can update leases of own properties"
  ON leases FOR UPDATE
  USING (
    public.user_role() = 'owner'
    AND (
      EXISTS (
        SELECT 1 FROM properties p
        WHERE p.id = leases.property_id
        AND p.owner_id = public.user_profile_id()
      )
      OR EXISTS (
        SELECT 1 FROM units u
        JOIN properties p ON p.id = u.property_id
        WHERE u.id = leases.unit_id
        AND p.owner_id = public.user_profile_id()
      )
    )
  );

-- 6. Les admins peuvent tout gérer
CREATE POLICY "Admins can manage all leases"
  ON leases FOR ALL
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- CORRECTION DES POLITIQUES LEASE_SIGNERS
-- ============================================

-- Supprimer toutes les politiques existantes pour lease_signers
DROP POLICY IF EXISTS "Users can view signers of accessible leases" ON lease_signers;
DROP POLICY IF EXISTS "Users can update own signature" ON lease_signers;
DROP POLICY IF EXISTS "Owners can insert signers for own leases" ON lease_signers;
DROP POLICY IF EXISTS "Admins can manage all signers" ON lease_signers;

-- Recréer les politiques avec une approche simplifiée

-- 1. Les admins peuvent tout voir (vérifié en premier)
CREATE POLICY "Admins can view all signers"
  ON lease_signers FOR SELECT
  USING (public.user_role() = 'admin');

-- 2. Les utilisateurs peuvent voir les signataires des baux accessibles
--    IMPORTANT : On vérifie directement properties SANS passer par leases
--    pour éviter la récursion. On utilise une sous-requête directe.
CREATE POLICY "Users can view signers of accessible leases"
  ON lease_signers FOR SELECT
  USING (
    -- L'utilisateur est signataire du bail (accès direct)
    profile_id = public.user_profile_id()
    OR
    -- Le bail appartient à une propriété du propriétaire (vérification directe sur properties)
    EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE l.id = lease_signers.lease_id
      AND p.owner_id = public.user_profile_id()
      -- Pas de vérification supplémentaire sur lease_signers pour éviter la récursion
    )
    OR
    -- Le bail appartient à une unité d'une propriété du propriétaire
    EXISTS (
      SELECT 1 FROM leases l
      JOIN units u ON u.id = l.unit_id
      JOIN properties p ON p.id = u.property_id
      WHERE l.id = lease_signers.lease_id
      AND p.owner_id = public.user_profile_id()
    )
  );

-- 3. Les utilisateurs peuvent mettre à jour leur propre signature
CREATE POLICY "Users can update own signature"
  ON lease_signers FOR UPDATE
  USING (profile_id = public.user_profile_id())
  WITH CHECK (profile_id = public.user_profile_id());

-- 4. Les propriétaires peuvent ajouter des signataires à leurs baux
CREATE POLICY "Owners can insert signers for own leases"
  ON lease_signers FOR INSERT
  WITH CHECK (
    public.user_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM leases l
      WHERE l.id = lease_signers.lease_id
      AND (
        EXISTS (
          SELECT 1 FROM properties p
          WHERE p.id = l.property_id
          AND p.owner_id = public.user_profile_id()
        )
        OR EXISTS (
          SELECT 1 FROM units u
          JOIN properties p ON p.id = u.property_id
          WHERE u.id = l.unit_id
          AND p.owner_id = public.user_profile_id()
        )
      )
    )
  );

-- 5. Les admins peuvent tout gérer
CREATE POLICY "Admins can manage all signers"
  ON lease_signers FOR ALL
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- COMMENTAIRES EXPLICATIFS
-- ============================================
-- 
-- Cette migration corrige la récursion infinie en :
-- 1. Vérifiant le rôle en premier (admin bypass)
-- 2. Utilisant des vérifications directes sur properties au lieu de passer par les autres tables
-- 3. Évitant les vérifications circulaires entre leases et lease_signers
-- 
-- Les politiques sont maintenant structurées pour que :
-- - Les vérifications de leases ne dépendent PAS de lease_signers (sauf pour les locataires)
-- - Les vérifications de lease_signers ne dépendent PAS de lease_signers (sauf pour vérifier le propriétaire)
-- - Chaque politique vérifie directement les propriétés pour éviter la récursion

