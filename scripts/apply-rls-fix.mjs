/**
 * Script COMPLET et OPTIMISÉ pour corriger les RLS admin
 * Inclut TOUTES les tables : profiles, properties, leases, etc.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Lire les variables d'environnement depuis .env.local
const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length) {
    env[key.trim()] = value.join('=').trim();
  }
});

const SUPABASE_PROJECT_REF = 'poeijjosocmqlhgsacud';
const SUPABASE_ACCESS_TOKEN = env.SUPABASE_MANAGEMENT_API_TOKEN;

if (!SUPABASE_ACCESS_TOKEN) {
  console.error('❌ SUPABASE_MANAGEMENT_API_TOKEN non trouvé dans .env.local');
  process.exit(1);
}

// SQL COMPLET à exécuter - inclut properties et leases
const SQL = `
-- ============================================
-- PROFILES
-- ============================================
DROP POLICY IF EXISTS "admins_read_all_profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
DROP POLICY IF EXISTS "admin_profiles_all" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
DROP POLICY IF EXISTS "profiles_user_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_user_update_own" ON profiles;

CREATE POLICY "profiles_admin_all" ON profiles FOR ALL TO authenticated
  USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');
CREATE POLICY "profiles_user_select_own" ON profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "profiles_user_update_own" ON profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================
-- PROPERTIES (CRUCIAL)
-- ============================================
DROP POLICY IF EXISTS "properties_admin_all" ON properties;
DROP POLICY IF EXISTS "admin_select_properties" ON properties;
DROP POLICY IF EXISTS "Admins can view all properties" ON properties;

CREATE POLICY "properties_admin_all" ON properties FOR ALL TO authenticated
  USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- LEASES (CRUCIAL)
-- ============================================
DROP POLICY IF EXISTS "leases_admin_all" ON leases;
DROP POLICY IF EXISTS "Admins can view all leases" ON leases;
DROP POLICY IF EXISTS "Admins can manage all leases" ON leases;

CREATE POLICY "leases_admin_all" ON leases FOR ALL TO authenticated
  USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- LEASE_SIGNERS
-- ============================================
DROP POLICY IF EXISTS "lease_signers_admin_all" ON lease_signers;
DROP POLICY IF EXISTS "Admins can manage all signers" ON lease_signers;
DROP POLICY IF EXISTS "Admins can view all signers" ON lease_signers;

CREATE POLICY "lease_signers_admin_all" ON lease_signers FOR ALL TO authenticated
  USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- OWNER_PROFILES
-- ============================================
DROP POLICY IF EXISTS "Admins can view all owner profiles" ON owner_profiles;
DROP POLICY IF EXISTS "owner_profiles_admin_all" ON owner_profiles;

CREATE POLICY "owner_profiles_admin_all" ON owner_profiles FOR ALL TO authenticated
  USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- TENANT_PROFILES
-- ============================================
DROP POLICY IF EXISTS "Admins can view all tenant profiles" ON tenant_profiles;
DROP POLICY IF EXISTS "tenant_profiles_admin_all" ON tenant_profiles;

CREATE POLICY "tenant_profiles_admin_all" ON tenant_profiles FOR ALL TO authenticated
  USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- PROVIDER_PROFILES
-- ============================================
DROP POLICY IF EXISTS "Admins can view all provider profiles" ON provider_profiles;
DROP POLICY IF EXISTS "provider_profiles_admin_all" ON provider_profiles;

CREATE POLICY "provider_profiles_admin_all" ON provider_profiles FOR ALL TO authenticated
  USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- INVOICES
-- ============================================
DROP POLICY IF EXISTS "Admins can view all invoices" ON invoices;
DROP POLICY IF EXISTS "invoices_admin_all" ON invoices;

CREATE POLICY "invoices_admin_all" ON invoices FOR ALL TO authenticated
  USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- PAYMENTS
-- ============================================
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
DROP POLICY IF EXISTS "payments_admin_all" ON payments;

CREATE POLICY "payments_admin_all" ON payments FOR ALL TO authenticated
  USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- TICKETS
-- ============================================
DROP POLICY IF EXISTS "Admins can view all tickets" ON tickets;
DROP POLICY IF EXISTS "Admins can manage all tickets" ON tickets;
DROP POLICY IF EXISTS "tickets_admin_all" ON tickets;

CREATE POLICY "tickets_admin_all" ON tickets FOR ALL TO authenticated
  USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- WORK_ORDERS
-- ============================================
DROP POLICY IF EXISTS "Admins can view all work_orders" ON work_orders;
DROP POLICY IF EXISTS "work_orders_admin_all" ON work_orders;

CREATE POLICY "work_orders_admin_all" ON work_orders FOR ALL TO authenticated
  USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- DOCUMENTS
-- ============================================
DROP POLICY IF EXISTS "Admins can view all documents" ON documents;
DROP POLICY IF EXISTS "documents_admin_all" ON documents;

CREATE POLICY "documents_admin_all" ON documents FOR ALL TO authenticated
  USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- CHARGES
-- ============================================
DROP POLICY IF EXISTS "Admins can view all charges" ON charges;
DROP POLICY IF EXISTS "charges_admin_all" ON charges;

CREATE POLICY "charges_admin_all" ON charges FOR ALL TO authenticated
  USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- UNITS
-- ============================================
DROP POLICY IF EXISTS "Admins can view all units" ON units;
DROP POLICY IF EXISTS "units_admin_all" ON units;

CREATE POLICY "units_admin_all" ON units FOR ALL TO authenticated
  USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- ROOMMATES (si existe)
-- ============================================
DROP POLICY IF EXISTS "Admins can view all roommates" ON roommates;
DROP POLICY IF EXISTS "roommates_admin_all" ON roommates;

CREATE POLICY "roommates_admin_all" ON roommates FOR ALL TO authenticated
  USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');

-- ============================================
-- SUBSCRIPTIONS (vérifier si existe)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'subscriptions') THEN
    DROP POLICY IF EXISTS "subscriptions_admin_all" ON subscriptions;
    DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
    DROP POLICY IF EXISTS "subscriptions_user_select_own" ON subscriptions;
    DROP POLICY IF EXISTS "subscriptions_owner_select_own" ON subscriptions;
    DROP POLICY IF EXISTS "User voit son abonnement" ON subscriptions;
    
    -- Vérifier si la colonne owner_id existe (ancien schéma)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'owner_id') THEN
      CREATE POLICY "subscriptions_owner_select_own" ON subscriptions FOR SELECT TO authenticated
        USING (
          owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
          OR public.user_role() = 'admin'
        );
    -- Sinon utiliser user_id (nouveau schéma)
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'user_id') THEN
      CREATE POLICY "subscriptions_user_select_own" ON subscriptions FOR SELECT TO authenticated
        USING (user_id = auth.uid());
    END IF;
    
    CREATE POLICY "subscriptions_admin_all" ON subscriptions FOR ALL TO authenticated
      USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');
  END IF;
END $$;

-- ============================================
-- SUBSCRIPTION_PLANS (lecture publique)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'subscription_plans') THEN
    DROP POLICY IF EXISTS "subscription_plans_public_read" ON subscription_plans;
    DROP POLICY IF EXISTS "Plans visible by all authenticated" ON subscription_plans;
    
    CREATE POLICY "subscription_plans_public_read" ON subscription_plans FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

-- ============================================
-- SUBSCRIPTION_ADDONS (si existe)
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'subscription_addons') THEN
    DROP POLICY IF EXISTS "subscription_addons_public_read" ON subscription_addons;
    DROP POLICY IF EXISTS "Addons actifs visibles par tous" ON subscription_addons;
    DROP POLICY IF EXISTS "subscription_addons_admin_all" ON subscription_addons;
    
    CREATE POLICY "subscription_addons_public_read" ON subscription_addons FOR SELECT TO authenticated
      USING (is_active = true);
    CREATE POLICY "subscription_addons_admin_all" ON subscription_addons FOR ALL TO authenticated
      USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');
  END IF;
END $$;

-- ============================================
-- SUBSCRIPTION_EVENTS
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'subscription_events') THEN
    DROP POLICY IF EXISTS "subscription_events_user_read" ON subscription_events;
    DROP POLICY IF EXISTS "subscription_events_admin_all" ON subscription_events;
    
    CREATE POLICY "subscription_events_user_read" ON subscription_events FOR SELECT TO authenticated
      USING (user_id = auth.uid());
    CREATE POLICY "subscription_events_admin_all" ON subscription_events FOR ALL TO authenticated
      USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');
  END IF;
END $$;

-- ============================================
-- SUBSCRIPTION_INVOICES
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'subscription_invoices') THEN
    DROP POLICY IF EXISTS "subscription_invoices_user_read" ON subscription_invoices;
    DROP POLICY IF EXISTS "subscription_invoices_admin_all" ON subscription_invoices;
    
    CREATE POLICY "subscription_invoices_user_read" ON subscription_invoices FOR SELECT TO authenticated
      USING (user_id = auth.uid());
    CREATE POLICY "subscription_invoices_admin_all" ON subscription_invoices FOR ALL TO authenticated
      USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');
  END IF;
END $$;

-- ============================================
-- PROMO_CODES
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'promo_codes') THEN
    DROP POLICY IF EXISTS "promo_codes_active_read" ON promo_codes;
    DROP POLICY IF EXISTS "promo_codes_admin_all" ON promo_codes;
    
    CREATE POLICY "promo_codes_active_read" ON promo_codes FOR SELECT TO authenticated
      USING (is_active = true);
    CREATE POLICY "promo_codes_admin_all" ON promo_codes FOR ALL TO authenticated
      USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin');
  END IF;
END $$;
`;

async function executeSQL() {
  console.log('🔧 Application des corrections RLS COMPLÈTES...\n');
  console.log('📋 Tables concernées:');
  console.log('   - profiles, properties, leases, lease_signers');
  console.log('   - owner_profiles, tenant_profiles, provider_profiles');
  console.log('   - invoices, payments, tickets, work_orders');
  console.log('   - documents, charges, units, roommates');
  console.log('   - subscriptions, subscription_plans, subscription_usage\n');
  
  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: SQL }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erreur API Supabase:', response.status, errorText);
      process.exit(1);
    }

    const result = await response.json();
    console.log('✅ Corrections RLS appliquées avec succès!\n');
    
    if (result && result.length > 0) {
      console.log('📊 Résultat:', JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

executeSQL();
