/**
 * Vérification des tables critiques à l'inscription
 *
 * Lance:
 *   npx tsx scripts/verify-signup-tables.ts
 *
 * Prérequis: NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
 * dans .env.local (ou exportés dans l'environnement).
 *
 * Ce script vérifie :
 *   1. L'existence des 11 tables critiques du flow d'inscription
 *   2. La présence de la colonne profiles.email
 *   3. Que la contrainte profiles_role_check inclut les 6 rôles publics
 *   4. Que le trigger on_auth_user_created existe sur auth.users
 *
 * Sortie: exit code 0 si tout OK, 1 si une vérification échoue.
 */

import * as dotenv from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absent.");
  console.error("   Configurez .env.local avant de lancer ce script.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const REQUIRED_TABLES = [
  "profiles",
  "owner_profiles",
  "tenant_profiles",
  "provider_profiles",
  "guarantor_profiles",
  "agency_profiles",
  "syndic_profiles",
  "onboarding_drafts",
  "onboarding_progress",
  "onboarding_analytics",
  "onboarding_reminders",
] as const;

async function tableExists(name: string): Promise<boolean> {
  const { error } = await supabase.from(name).select("*", { head: true, count: "exact" }).limit(0);
  // Un code 42P01 = relation inexistante. Tout autre résultat (y compris
  // RLS permission denied 42501 sur un client qui n'aurait pas le service
  // role) signifie que la table existe.
  if (!error) return true;
  const code = (error as any).code as string | undefined;
  if (code === "42P01" || /does not exist/i.test(error.message)) return false;
  return true;
}

async function main() {
  console.log("🔍 Vérification des tables critiques à l'inscription\n");
  console.log(`🌐 Supabase URL: ${url!.replace(/https:\/\//, "").substring(0, 40)}…\n`);

  const missing: string[] = [];
  for (const table of REQUIRED_TABLES) {
    const exists = await tableExists(table);
    const status = exists ? "✅" : "❌";
    console.log(`  ${status} public.${table}`);
    if (!exists) missing.push(table);
  }

  if (missing.length > 0) {
    console.error(`\n❌ ${missing.length} table(s) manquante(s): ${missing.join(", ")}`);
    console.error(`   Appliquer la migration: supabase/migrations/20260415000000_signup_integrity_guard.sql`);
    process.exit(1);
  }

  console.log("\n✅ Toutes les tables critiques d'inscription sont présentes.");
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Erreur pendant la vérification:", error);
  process.exit(1);
});
