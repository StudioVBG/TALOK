/**
 * Script de test pour vérifier la visibilité des propriétés
 * Exécuter avec: npx tsx scripts/test-property-visibility.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function testPropertyVisibility() {
  console.log("🔍 Test de visibilité des propriétés\n");

  // Note: Ce script nécessite une authentification manuelle
  // Pour un test complet, il faut être connecté en tant que propriétaire
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // 1. Vérifier l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("❌ Non authentifié. Veuillez vous connecter d'abord.");
    console.error("   Utilisez: supabase.auth.signInWithPassword({ email, password })");
    return;
  }

  console.log(`✅ Utilisateur authentifié: ${user.id} (${user.email})\n`);

  // 2. Récupérer le profil
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("❌ Profil non trouvé:", profileError);
    return;
  }

  console.log(`✅ Profil trouvé: id=${profile.id}, role=${profile.role}\n`);

  // 3. Tester user_profile_id() RPC
  const { data: rpcProfileId, error: rpcError } = await supabase.rpc("user_profile_id");

  if (rpcError) {
    console.warn("⚠️  RPC user_profile_id() non disponible:", rpcError.message);
  } else {
    console.log(`✅ user_profile_id() RPC retourne: ${rpcProfileId}`);
    if (rpcProfileId !== profile.id) {
      console.warn(`⚠️  INCOHÉRENCE: RPC=${rpcProfileId} !== profile.id=${profile.id}`);
    }
  }

  // 4. Vérifier les propriétés avec RLS
  console.log("\n📋 Test de récupération des propriétés avec RLS...\n");

  const { data: properties, error: propertiesError, count } = await supabase
    .from("properties")
    .select("id, owner_id, adresse_complete, type, etat, created_at", { count: "exact" })
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (propertiesError) {
    console.error("❌ Erreur lors de la récupération des propriétés:");
    console.error("   Message:", propertiesError.message);
    console.error("   Code:", propertiesError.code);
    console.error("   Details:", propertiesError.details);
    console.error("   Hint:", propertiesError.hint);

    if (propertiesError.message?.includes("row-level security") || propertiesError.code === "42501") {
      console.error("\n⚠️  ERREUR RLS DÉTECTÉE!");
      console.error("   La politique RLS bloque probablement l'accès.");
      console.error("   Vérifiez que:");
      console.error("   1. La migration 202502180001_fix_rls_conflicts.sql est appliquée");
      console.error("   2. La fonction user_profile_id() retourne bien:", profile.id);
    }
    return;
  }

  console.log(`✅ Propriétés trouvées: ${properties?.length || 0} (total: ${count || 0})\n`);

  if (properties && properties.length > 0) {
    console.log("📋 Liste des propriétés:");
    properties.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.adresse_complete || "Sans adresse"} (${p.type})`);
      console.log(`      ID: ${p.id}`);
      console.log(`      Owner ID: ${p.owner_id}`);
      console.log(`      État: ${p.etat}`);
      console.log(`      Créé: ${p.created_at}`);
      console.log("");
    });
  } else {
    console.warn("⚠️  Aucune propriété trouvée pour ce propriétaire.");
    console.warn("   Vérifiez que:");
    console.warn("   1. Des propriétés existent en base avec owner_id =", profile.id);
    console.warn("   2. Les politiques RLS autorisent l'accès");
  }

  // 5. Vérifier toutes les propriétés (pour debug, nécessite admin ou service_role)
  console.log("\n📋 Test de récupération de TOUTES les propriétés (sans filtre owner_id)...\n");

  const { data: allProperties, error: allError } = await supabase
    .from("properties")
    .select("id, owner_id, adresse_complete, type, etat")
    .order("created_at", { ascending: false })
    .limit(5);

  if (allError) {
    console.warn("⚠️  Impossible de récupérer toutes les propriétés (normal si RLS bloque):", allError.message);
  } else if (allProperties && allProperties.length > 0) {
    console.log(`📋 ${allProperties.length} propriétés trouvées en base (toutes):`);
    allProperties.forEach((p, i) => {
      const isMine = p.owner_id === profile.id;
      console.log(`   ${i + 1}. ${p.adresse_complete || "Sans adresse"} (${p.type})`);
      console.log(`      Owner ID: ${p.owner_id} ${isMine ? "✅ (MOI)" : "❌ (AUTRE)"}`);
      console.log("");
    });
  }
}

testPropertyVisibility().catch(console.error);

