/**
 * Script pour exécuter la correction RLS des leases via l'API Supabase Management
 */

const https = require('https');

const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF;

if (!SUPABASE_PROJECT_REF) {
  throw new Error("SUPABASE_PROJECT_REF manquant. Renseignez la variable d'environnement avant d'exécuter ce script.");
}
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_ACCESS_TOKEN) {
  throw new Error("SUPABASE_ACCESS_TOKEN manquant. Renseignez la variable d'environnement (token management) avant d'exécuter ce script.");
}

const migrationSQL = `
-- Correction de la récursion infinie dans les politiques RLS pour leases

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

-- 1. Les admins peuvent tout voir
CREATE POLICY "Admins can view all leases"
  ON leases FOR SELECT
  USING (public.user_role() = 'admin');

-- 2. Les propriétaires peuvent voir les baux de leurs propriétés
CREATE POLICY "Owners can view leases of own properties"
  ON leases FOR SELECT
  USING (
    public.user_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = leases.property_id
      AND p.owner_id = public.user_profile_id()
    )
  );

-- 3. Les locataires peuvent voir leurs baux (vérification directe)
CREATE POLICY "Tenants can view own leases"
  ON leases FOR SELECT
  USING (
    public.user_role() = 'tenant'
    AND EXISTS (
      SELECT 1 FROM lease_signers ls
      WHERE ls.lease_id = leases.id
      AND ls.profile_id = public.user_profile_id()
    )
  );

-- 4. Les propriétaires peuvent créer des baux
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
      OR leases.property_id IS NULL
    )
  );

-- 5. Les propriétaires peuvent mettre à jour leurs baux
CREATE POLICY "Owners can update leases of own properties"
  ON leases FOR UPDATE
  USING (
    public.user_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM properties p
      WHERE p.id = leases.property_id
      AND p.owner_id = public.user_profile_id()
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

DROP POLICY IF EXISTS "Users can view signers of accessible leases" ON lease_signers;
DROP POLICY IF EXISTS "Users can update own signature" ON lease_signers;
DROP POLICY IF EXISTS "Owners can insert signers for own leases" ON lease_signers;
DROP POLICY IF EXISTS "Admins can manage all signers" ON lease_signers;
DROP POLICY IF EXISTS "Admins can view all signers" ON lease_signers;

-- 1. Les admins peuvent tout voir
CREATE POLICY "Admins can view all signers"
  ON lease_signers FOR SELECT
  USING (public.user_role() = 'admin');

-- 2. Les utilisateurs peuvent voir les signataires
CREATE POLICY "Users can view signers of accessible leases"
  ON lease_signers FOR SELECT
  USING (
    profile_id = public.user_profile_id()
    OR EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE l.id = lease_signers.lease_id
      AND p.owner_id = public.user_profile_id()
    )
  );

-- 3. Les utilisateurs peuvent mettre à jour leur propre signature
CREATE POLICY "Users can update own signature"
  ON lease_signers FOR UPDATE
  USING (profile_id = public.user_profile_id())
  WITH CHECK (profile_id = public.user_profile_id());

-- 4. Les propriétaires peuvent ajouter des signataires
CREATE POLICY "Owners can insert signers for own leases"
  ON lease_signers FOR INSERT
  WITH CHECK (
    public.user_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM leases l
      JOIN properties p ON p.id = l.property_id
      WHERE l.id = lease_signers.lease_id
      AND p.owner_id = public.user_profile_id()
    )
  );

-- 5. Les admins peuvent tout gérer
CREATE POLICY "Admins can manage all signers"
  ON lease_signers FOR ALL
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');
`;

async function runMigration() {
  console.log('🚀 Correction des politiques RLS pour leases...\n');
  
  const options = {
    hostname: 'api.supabase.com',
    port: 443,
    path: `/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ Politiques RLS corrigées avec succès!');
          resolve(data);
        } else {
          console.log('❌ Erreur:', data);
          reject(new Error(data));
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ Erreur de connexion:', e.message);
      reject(e);
    });

    req.write(JSON.stringify({ query: migrationSQL }));
    req.end();
  });
}

runMigration()
  .then(() => {
    console.log('\n✅ Correction RLS terminée!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Échec de la correction:', err.message);
    process.exit(1);
  });

