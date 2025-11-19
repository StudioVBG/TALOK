/**
 * Script de diagnostic pour la route /api/properties
 * 
 * Usage: npx tsx scripts/diagnose-properties-api.ts
 * 
 * Ce script teste la route API et identifie les problèmes potentiels
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

// Charger les variables d'environnement depuis .env.local
config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function runDiagnostic() {
  console.log("🔍 Diagnostic de la route /api/properties\n");
  console.log("=" .repeat(60));

  // 1. Vérifier les variables d'environnement
  console.log("\n1️⃣ Vérification des variables d'environnement:");
  console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL ? "✅ Défini" : "❌ Manquant"}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY ? "✅ Défini" : "❌ Manquant"}`);
  console.log(`   NEXT_PUBLIC_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY ? "✅ Défini" : "❌ Manquant"}`);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("\n❌ Variables d'environnement manquantes !");
    process.exit(1);
  }

  // 2. Tester la connexion Supabase
  console.log("\n2️⃣ Test de connexion Supabase:");
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data: healthCheck, error: healthError } = await supabase
    .from("profiles")
    .select("id")
    .limit(1);
  
  if (healthError) {
    console.error(`   ❌ Erreur de connexion: ${healthError.message}`);
    console.error(`   Code: ${healthError.code}`);
    console.error(`   Details: ${healthError.details}`);
    console.error(`   Hint: ${healthError.hint}`);
  } else {
    console.log("   ✅ Connexion Supabase réussie");
  }
} catch (error: any) {
  console.error(`   ❌ Erreur lors du test de connexion: ${error.message}`);
}

// 3. Vérifier la structure de la table properties
console.log("\n3️⃣ Vérification de la structure de la table 'properties':");
try {
  const { data, error } = await supabase
    .from("properties")
    .select("id, owner_id, type, type_bien, adresse_complete, code_postal, ville, surface, nb_pieces, loyer_base, created_at, etat")
    .limit(1);
  
  if (error) {
    console.error(`   ❌ Erreur lors de la requête: ${error.message}`);
    console.error(`   Code: ${error.code}`);
    console.error(`   Details: ${error.details}`);
    console.error(`   Hint: ${error.hint}`);
    
    // Vérifier si c'est une colonne manquante
    if (error.message?.includes("column") || error.message?.includes("does not exist")) {
      console.error("\n   💡 SUGGESTION: Une colonne est manquante dans la table 'properties'");
      console.error("   Vérifiez les migrations Supabase pour s'assurer que toutes les colonnes existent");
    }
  } else {
    console.log("   ✅ Structure de la table 'properties' valide");
    console.log(`   Colonnes testées: id, owner_id, type, type_bien, adresse_complete, code_postal, ville, surface, nb_pieces, loyer_base, created_at, etat`);
  }
} catch (error: any) {
  console.error(`   ❌ Erreur inattendue: ${error.message}`);
}

// 4. Vérifier la table profiles
console.log("\n4️⃣ Vérification de la table 'profiles':");
try {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, role")
    .limit(1);
  
  if (error) {
    console.error(`   ❌ Erreur lors de la requête: ${error.message}`);
    console.error(`   Code: ${error.code}`);
  } else {
    console.log("   ✅ Structure de la table 'profiles' valide");
  }
} catch (error: any) {
  console.error(`   ❌ Erreur inattendue: ${error.message}`);
}

// 5. Tester une requête complète (simuler ce que fait la route API)
console.log("\n5️⃣ Test d'une requête complète (simulation route API):");
try {
  // Récupérer un profil owner pour tester
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, user_id, role")
    .eq("role", "owner")
    .limit(1);
  
  if (profilesError) {
    console.error(`   ❌ Erreur lors de la récupération des profils: ${profilesError.message}`);
  } else if (!profiles || profiles.length === 0) {
    console.warn("   ⚠️ Aucun profil 'owner' trouvé pour tester");
  } else {
    const testOwnerId = profiles[0].id;
    console.log(`   Test avec owner_id: ${testOwnerId}`);
    
    const { data: properties, error: propertiesError } = await supabase
      .from("properties")
      .select("id, owner_id, type, type_bien, adresse_complete, code_postal, ville, surface, nb_pieces, loyer_base, created_at, etat")
      .eq("owner_id", testOwnerId)
      .order("created_at", { ascending: false })
      .limit(10);
    
    if (propertiesError) {
      console.error(`   ❌ Erreur lors de la récupération des propriétés: ${propertiesError.message}`);
      console.error(`   Code: ${propertiesError.code}`);
      console.error(`   Details: ${propertiesError.details}`);
      console.error(`   Hint: ${propertiesError.hint}`);
    } else {
      console.log(`   ✅ Requête réussie: ${properties?.length || 0} propriété(s) trouvée(s)`);
    }
  }
} catch (error: any) {
  console.error(`   ❌ Erreur inattendue: ${error.message}`);
  console.error(`   Stack: ${error.stack}`);
}

// 6. Vérifier les RLS (Row Level Security)
console.log("\n6️⃣ Vérification des politiques RLS:");
console.log("   ⚠️ Note: Les politiques RLS peuvent bloquer les requêtes");
console.log("   Vérifiez dans Supabase Dashboard > Authentication > Policies");

  console.log("\n" + "=".repeat(60));
  console.log("\n✅ Diagnostic terminé !");
  console.log("\n💡 Si des erreurs sont détectées, corrigez-les et relancez le script.");
  console.log("💡 Si aucune erreur n'est détectée, le problème peut venir de:");
  console.log("   - L'authentification côté client");
  console.log("   - Les headers de la requête HTTP");
  console.log("   - Un timeout de requête");
  console.log("   - Les politiques RLS qui bloquent l'accès");
}

// Exécuter le diagnostic
runDiagnostic().catch((error) => {
  console.error("\n❌ Erreur fatale lors du diagnostic:", error);
  process.exit(1);
});

