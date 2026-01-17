/**
 * Script de vérification complète de la connexion Supabase
 * Usage: npx tsx scripts/verify-supabase-connection.ts
 */

import * as dotenv from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface CheckResult {
  name: string;
  status: "✅" | "❌" | "⚠️";
  message: string;
  details?: any;
}

async function verifyConnection() {
  console.log("🔍 VÉRIFICATION DE LA CONNEXION SUPABASE\n");
  console.log("=".repeat(80));

  const results: CheckResult[] = [];

  // 1. Vérifier les variables d'environnement
  console.log("\n1️⃣ VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT\n");

  if (!supabaseUrl) {
    results.push({
      name: "NEXT_PUBLIC_SUPABASE_URL",
      status: "❌",
      message: "Variable manquante",
    });
    console.log("   ❌ NEXT_PUBLIC_SUPABASE_URL: Variable manquante");
  } else {
    const isValidUrl = supabaseUrl.includes(".supabase.co") && !supabaseUrl.includes("dashboard");
    results.push({
      name: "NEXT_PUBLIC_SUPABASE_URL",
      status: isValidUrl ? "✅" : "❌",
      message: isValidUrl ? "Définie et valide" : "URL invalide",
      details: supabaseUrl.substring(0, 50) + "...",
    });
    console.log(`   ${isValidUrl ? "✅" : "❌"} NEXT_PUBLIC_SUPABASE_URL: ${isValidUrl ? "Définie et valide" : "URL invalide"}`);
    if (!isValidUrl) {
      console.log(`      ${supabaseUrl.substring(0, 50)}...`);
    }
  }

  if (!supabaseAnonKey) {
    results.push({
      name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      status: "❌",
      message: "Variable manquante",
    });
    console.log("   ❌ NEXT_PUBLIC_SUPABASE_ANON_KEY: Variable manquante");
  } else {
    results.push({
      name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      status: "✅",
      message: "Définie",
      details: supabaseAnonKey.substring(0, 20) + "...",
    });
    console.log(`   ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY: Définie`);
  }

  if (!supabaseServiceKey) {
    results.push({
      name: "SUPABASE_SERVICE_ROLE_KEY",
      status: "⚠️",
      message: "Variable manquante (optionnelle mais recommandée)",
    });
    console.log("   ⚠️  SUPABASE_SERVICE_ROLE_KEY: Variable manquante (optionnelle mais recommandée)");
  } else {
    results.push({
      name: "SUPABASE_SERVICE_ROLE_KEY",
      status: "✅",
      message: "Définie",
      details: supabaseServiceKey.substring(0, 20) + "...",
    });
    console.log(`   ✅ SUPABASE_SERVICE_ROLE_KEY: Définie`);
  }

  // Si les variables essentielles manquent, arrêter
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log("\n❌ Variables essentielles manquantes. Arrêt de la vérification.");
    console.log("\n📋 SOLUTION:");
    console.log("   1. Vérifier que .env.local existe");
    console.log("   2. Ajouter NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY");
    console.log("   3. Relancer ce script\n");
    return;
  }

  // 2. Vérifier la connexion avec la clé anonyme
  console.log("\n2️⃣ TEST DE CONNEXION (CLÉ ANONYME)\n");

  try {
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Test simple : compter les profils (table publique)
    const { count, error } = await anonClient
      .from("profiles")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.log(`   ❌ Erreur de connexion: ${error.message}`);
      results.push({
        name: "Connexion anon",
        status: "❌",
        message: error instanceof Error ? error.message : "Erreur",
      });
    } else {
      console.log(`   ✅ Connexion réussie`);
      console.log(`   📊 Profils en base: ${count || 0}`);
      results.push({
        name: "Connexion anon",
        status: "✅",
        message: `Connecté avec succès (${count || 0} profils)`,
      });
    }
  } catch (error: unknown) {
    console.log(`   ❌ Exception: ${error.message}`);
    results.push({
      name: "Connexion anon",
      status: "❌",
      message: error instanceof Error ? error.message : "Erreur",
    });
  }

  // 3. Vérifier la connexion avec la clé service_role
  if (supabaseServiceKey) {
    console.log("\n3️⃣ TEST DE CONNEXION (SERVICE ROLE)\n");

    try {
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Test : compter les propriétés
      const { count, error } = await serviceClient
        .from("properties")
        .select("*", { count: "exact", head: true });

      if (error) {
        console.log(`   ❌ Erreur: ${error.message}`);
        results.push({
          name: "Connexion service_role",
          status: "❌",
          message: error instanceof Error ? error.message : "Erreur",
        });
      } else {
        console.log(`   ✅ Connexion réussie`);
        console.log(`   📊 Propriétés en base: ${count || 0}`);
        results.push({
          name: "Connexion service_role",
          status: "✅",
          message: `Connecté avec succès (${count || 0} propriétés)`,
        });
      }
    } catch (error: unknown) {
      console.log(`   ❌ Exception: ${error.message}`);
      results.push({
        name: "Connexion service_role",
        status: "❌",
        message: error instanceof Error ? error.message : "Erreur",
      });
    }
  }

  // 4. Vérifier les fonctions RLS
  console.log("\n4️⃣ VÉRIFICATION DES FONCTIONS RLS\n");

  if (supabaseServiceKey) {
    try {
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Tester user_profile_id()
      const { data: profileId, error: rpcError } = await serviceClient.rpc("user_profile_id");

      if (rpcError) {
        console.log(`   ⚠️  user_profile_id() non disponible: ${rpcError.message}`);
        results.push({
          name: "user_profile_id()",
          status: "⚠️",
          message: rpcError.message,
        });
      } else {
        console.log(`   ✅ user_profile_id() disponible`);
        results.push({
          name: "user_profile_id()",
          status: "✅",
          message: "Fonction disponible",
        });
      }

      // Tester user_role()
      const { data: role, error: roleError } = await serviceClient.rpc("user_role");

      if (roleError) {
        console.log(`   ⚠️  user_role() non disponible: ${roleError.message}`);
        results.push({
          name: "user_role()",
          status: "⚠️",
          message: roleError.message,
        });
      } else {
        console.log(`   ✅ user_role() disponible`);
        results.push({
          name: "user_role()",
          status: "✅",
          message: "Fonction disponible",
        });
      }
    } catch (error: unknown) {
      console.log(`   ❌ Exception: ${error.message}`);
    }
  }

  // 5. Vérifier l'accès aux tables principales
  console.log("\n5️⃣ VÉRIFICATION DE L'ACCÈS AUX TABLES\n");

  if (supabaseServiceKey) {
    try {
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const tables = ["profiles", "properties", "units", "rooms", "leases"];

      for (const table of tables) {
        const { count, error } = await serviceClient
          .from(table)
          .select("*", { count: "exact", head: true });

        if (error) {
          console.log(`   ❌ ${table}: ${error.message}`);
          results.push({
            name: `Table ${table}`,
            status: "❌",
            message: error instanceof Error ? error.message : "Erreur",
          });
        } else {
          console.log(`   ✅ ${table}: ${count || 0} lignes`);
          results.push({
            name: `Table ${table}`,
            status: "✅",
            message: `${count || 0} lignes`,
          });
        }
      }
    } catch (error: unknown) {
      console.log(`   ❌ Exception: ${error.message}`);
    }
  }

  // Résumé final
  console.log("\n" + "=".repeat(80));
  console.log("📊 RÉSUMÉ FINAL\n");

  const success = results.filter((r) => r.status === "✅").length;
  const warnings = results.filter((r) => r.status === "⚠️").length;
  const errors = results.filter((r) => r.status === "❌").length;

  console.log(`   ✅ Succès: ${success}`);
  console.log(`   ⚠️  Avertissements: ${warnings}`);
  console.log(`   ❌ Erreurs: ${errors}\n`);

  if (errors === 0) {
    console.log("✅ La connexion Supabase est correctement configurée !\n");
  } else {
    console.log("❌ Des erreurs ont été détectées. Vérifiez la configuration.\n");
  }

  // Recommandations
  if (warnings > 0 || errors > 0) {
    console.log("📋 RECOMMANDATIONS:\n");
    if (!supabaseServiceKey) {
      console.log("   1. Ajoutez SUPABASE_SERVICE_ROLE_KEY dans .env.local");
      console.log("      → Disponible dans Supabase Dashboard → Settings → API\n");
    }
    if (errors > 0) {
      console.log("   2. Vérifiez que les migrations sont appliquées:");
      console.log("      → supabase db push\n");
      console.log("   3. Vérifiez l'URL Supabase:");
      console.log("      → Doit être au format: https://xxxxx.supabase.co\n");
    }
  }
}

verifyConnection().catch(console.error);

