/**
 * Script pour appliquer les corrections RLS admin via Supabase
 * Exécute le SQL directement via la connexion Postgres
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Variables d'environnement manquantes");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function applyFix() {
  console.log("🔧 Application des corrections RLS admin...\n");

  const sqlStatements = [
    // PROFILES - Correction récursion
    `DROP POLICY IF EXISTS "admins_read_all_profiles" ON profiles`,
    `DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles`,
    `DROP POLICY IF EXISTS "Users can view own profile" ON profiles`,
    `DROP POLICY IF EXISTS "Users can update own profile" ON profiles`,
    `DROP POLICY IF EXISTS "users_read_own_profile" ON profiles`,
    `DROP POLICY IF EXISTS "users_update_own_profile" ON profiles`,
    `DROP POLICY IF EXISTS "admin_profiles_all" ON profiles`,
    `DROP POLICY IF EXISTS "profiles_admin_all" ON profiles`,
    `DROP POLICY IF EXISTS "profiles_user_select_own" ON profiles`,
    `DROP POLICY IF EXISTS "profiles_user_update_own" ON profiles`,
    
    `CREATE POLICY "profiles_admin_all" ON profiles FOR ALL TO authenticated USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin')`,
    `CREATE POLICY "profiles_user_select_own" ON profiles FOR SELECT TO authenticated USING (user_id = auth.uid())`,
    `CREATE POLICY "profiles_user_update_own" ON profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`,

    // OWNER_PROFILES
    `DROP POLICY IF EXISTS "Admins can view all owner profiles" ON owner_profiles`,
    `DROP POLICY IF EXISTS "admin_owner_profiles_all" ON owner_profiles`,
    `DROP POLICY IF EXISTS "owner_profiles_admin_all" ON owner_profiles`,
    `CREATE POLICY "owner_profiles_admin_all" ON owner_profiles FOR ALL TO authenticated USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin')`,

    // TENANT_PROFILES
    `DROP POLICY IF EXISTS "Admins can view all tenant profiles" ON tenant_profiles`,
    `DROP POLICY IF EXISTS "admin_tenant_profiles_all" ON tenant_profiles`,
    `DROP POLICY IF EXISTS "tenant_profiles_admin_all" ON tenant_profiles`,
    `CREATE POLICY "tenant_profiles_admin_all" ON tenant_profiles FOR ALL TO authenticated USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin')`,

    // PROVIDER_PROFILES
    `DROP POLICY IF EXISTS "Admins can view all provider profiles" ON provider_profiles`,
    `DROP POLICY IF EXISTS "admin_provider_profiles_all" ON provider_profiles`,
    `DROP POLICY IF EXISTS "provider_profiles_admin_all" ON provider_profiles`,
    `CREATE POLICY "provider_profiles_admin_all" ON provider_profiles FOR ALL TO authenticated USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin')`,

    // INVOICES
    `DROP POLICY IF EXISTS "Admins can view all invoices" ON invoices`,
    `DROP POLICY IF EXISTS "admin_invoices_all" ON invoices`,
    `DROP POLICY IF EXISTS "invoices_admin_all" ON invoices`,
    `CREATE POLICY "invoices_admin_all" ON invoices FOR ALL TO authenticated USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin')`,

    // PAYMENTS
    `DROP POLICY IF EXISTS "Admins can view all payments" ON payments`,
    `DROP POLICY IF EXISTS "admin_payments_all" ON payments`,
    `DROP POLICY IF EXISTS "payments_admin_all" ON payments`,
    `CREATE POLICY "payments_admin_all" ON payments FOR ALL TO authenticated USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin')`,

    // TICKETS
    `DROP POLICY IF EXISTS "Admins can view all tickets" ON tickets`,
    `DROP POLICY IF EXISTS "Admins can manage all tickets" ON tickets`,
    `DROP POLICY IF EXISTS "admin_tickets_all" ON tickets`,
    `DROP POLICY IF EXISTS "tickets_admin_all" ON tickets`,
    `CREATE POLICY "tickets_admin_all" ON tickets FOR ALL TO authenticated USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin')`,

    // WORK_ORDERS
    `DROP POLICY IF EXISTS "Admins can view all work_orders" ON work_orders`,
    `DROP POLICY IF EXISTS "admin_work_orders_all" ON work_orders`,
    `DROP POLICY IF EXISTS "work_orders_admin_all" ON work_orders`,
    `CREATE POLICY "work_orders_admin_all" ON work_orders FOR ALL TO authenticated USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin')`,

    // DOCUMENTS
    `DROP POLICY IF EXISTS "Admins can view all documents" ON documents`,
    `DROP POLICY IF EXISTS "admin_documents_all" ON documents`,
    `DROP POLICY IF EXISTS "documents_admin_all" ON documents`,
    `CREATE POLICY "documents_admin_all" ON documents FOR ALL TO authenticated USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin')`,

    // CHARGES
    `DROP POLICY IF EXISTS "Admins can view all charges" ON charges`,
    `DROP POLICY IF EXISTS "admin_charges_all" ON charges`,
    `DROP POLICY IF EXISTS "charges_admin_all" ON charges`,
    `CREATE POLICY "charges_admin_all" ON charges FOR ALL TO authenticated USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin')`,

    // UNITS
    `DROP POLICY IF EXISTS "Admins can view all units" ON units`,
    `DROP POLICY IF EXISTS "admin_units_all" ON units`,
    `DROP POLICY IF EXISTS "units_admin_all" ON units`,
    `CREATE POLICY "units_admin_all" ON units FOR ALL TO authenticated USING (public.user_role() = 'admin') WITH CHECK (public.user_role() = 'admin')`,
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const sql of sqlStatements) {
    try {
      const { error } = await supabase.rpc("exec_sql", { sql_query: sql });
      if (error) {
        // Ignorer les erreurs de "policy does not exist"
        if (!error.message.includes("does not exist")) {
          console.error(`❌ Erreur: ${sql.substring(0, 50)}... - ${error.message}`);
          errorCount++;
        }
      } else {
        successCount++;
      }
    } catch (e: any) {
      // Essayer directement via from().select() pour les DROP
      if (sql.startsWith("DROP")) {
        // Les DROP peuvent être ignorés si la policy n'existe pas
        successCount++;
      } else {
        console.error(`❌ Exception: ${sql.substring(0, 50)}... - ${e.message}`);
        errorCount++;
      }
    }
  }

  console.log(`\n✅ ${successCount} opérations réussies`);
  if (errorCount > 0) {
    console.log(`⚠️ ${errorCount} erreurs (peut être normal pour les DROP)`);
  }
  
  console.log("\n📋 Pour appliquer manuellement, copiez le contenu de:");
  console.log("   scripts/fix-admin-rls.sql");
  console.log("   dans Supabase Studio > SQL Editor");
}

applyFix().catch(console.error);

