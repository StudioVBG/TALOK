/**
 * Script de debug pour tracer le flux complet de données
 * Exécuter avec: npx tsx scripts/debug-properties-flow.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function debugPropertiesFlow() {
  console.log("🔍 DEBUG FLUX PROPRIÉTÉS\n");

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // 1. Vérifier l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("❌ Non authentifié. Veuillez vous connecter d'abord.");
    return;
  }

  console.log(`✅ Utilisateur: ${user.id} (${user.email})\n`);

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

  console.log(`✅ Profil: id=${profile.id}, role=${profile.role}\n`);

  // 3. Tester user_profile_id() RPC
  const { data: rpcProfileId, error: rpcError } = await supabase.rpc("user_profile_id");
  console.log(`📋 user_profile_id() RPC: ${rpcProfileId || "NULL"} ${rpcError ? `(erreur: ${rpcError.message})` : ""}\n`);

  // 4. Vérifier les propriétés avec RLS (comme fetchProperties)
  console.log("📋 Test SELECT avec RLS (comme fetchProperties)...\n");
  
  const { data: properties, error: propertiesError, count } = await supabase
    .from("properties")
    .select("id, owner_id, type, adresse_complete, code_postal, ville, surface, nb_pieces, loyer_hc, created_at, etat", { count: "exact" })
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (propertiesError) {
    console.error("❌ Erreur SELECT:");
    console.error("   Message:", propertiesError.message);
    console.error("   Code:", propertiesError.code);
    console.error("   Details:", propertiesError.details);
    console.error("   Hint:", propertiesError.hint);
    
    if (propertiesError.message?.includes("row-level security") || propertiesError.code === "42501") {
      console.error("\n⚠️  ERREUR RLS DÉTECTÉE!");
      console.error(`   Profile ID: ${profile.id}`);
      console.error(`   RPC user_profile_id(): ${rpcProfileId || "NULL"}`);
      console.error(`   Match: ${rpcProfileId === profile.id ? "✅" : "❌"}`);
    }
    return;
  }

  console.log(`✅ SELECT réussi: ${properties?.length || 0} propriétés (total: ${count || 0})\n`);

  if (properties && properties.length > 0) {
    console.log("📋 Propriétés trouvées:");
    properties.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.adresse_complete || "Sans adresse"} (${p.type})`);
      console.log(`      ID: ${p.id}`);
      console.log(`      Owner ID: ${p.owner_id}`);
      console.log(`      État: ${p.etat}`);
      console.log(`      Match owner_id: ${p.owner_id === profile.id ? "✅" : "❌"}`);
      console.log("");
    });
  } else {
    console.warn("⚠️  Aucune propriété trouvée!");
    console.warn(`   Profile ID utilisé: ${profile.id}`);
    console.warn(`   RPC user_profile_id(): ${rpcProfileId || "NULL"}`);
    
    // Vérifier toutes les propriétés
    const { data: allProperties } = await supabase
      .from("properties")
      .select("id, owner_id, adresse_complete")
      .limit(5);
    
    if (allProperties && allProperties.length > 0) {
      console.warn("\n📋 Propriétés en base (toutes):");
      allProperties.forEach((p) => {
        const isMine = p.owner_id === profile.id;
        console.warn(`   - ${p.adresse_complete} (owner_id: ${p.owner_id}) ${isMine ? "✅ MOI" : "❌ AUTRE"}`);
      });
    }
  }
}

debugPropertiesFlow().catch(console.error);

