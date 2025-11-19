/**
 * Script de test SERVEUR pour fetchProperties
 * Simule exactement ce que fait OwnerLayout
 * Exécuter avec: npx tsx scripts/test-fetch-properties-server.ts
 */

import { createClient } from "@/lib/supabase/server";
import { fetchProperties } from "../app/app/owner/_data/fetchProperties";

async function testFetchPropertiesServer() {
  console.log("🧪 TEST SERVEUR DE fetchProperties\n");
  console.log("=" .repeat(60));

  try {
    // 1. Simuler getOwnerProfile
    const supabase = await createClient();
    
    console.log("\n📋 Étape 1: Vérification authentification...");
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("❌ Erreur auth:", authError);
      return;
    }

    console.log(`✅ Utilisateur: ${user.id} (${user.email || "pas d'email"})`);

    console.log("\n📋 Étape 2: Récupération du profil...");
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("❌ Erreur profil:", profileError);
      return;
    }

    console.log(`✅ Profil: id=${profile.id}, role=${profile.role}`);

    // 2. Tester user_profile_id() RPC
    console.log("\n📋 Étape 3: Test user_profile_id() RPC...");
    const { data: rpcProfileId, error: rpcError } = await supabase.rpc("user_profile_id");
    
    if (rpcError) {
      console.warn(`⚠️  RPC erreur: ${rpcError.message}`);
    } else {
      console.log(`✅ RPC user_profile_id(): ${rpcProfileId || "NULL"}`);
      if (rpcProfileId !== profile.id) {
        console.warn(`⚠️  INCOHÉRENCE: RPC=${rpcProfileId} !== profile.id=${profile.id}`);
      } else {
        console.log(`✅ Match parfait: RPC = profile.id`);
      }
    }

    // 3. Test direct de la requête SQL (comme dans fetchProperties)
    console.log("\n📋 Étape 4: Test requête SQL directe...");
    const { data: directProperties, error: directError, count } = await supabase
      .from("properties")
      .select("id, owner_id, type, adresse_complete, code_postal, ville, surface, nb_pieces, loyer_hc, created_at, etat", { count: "exact" })
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (directError) {
      console.error("❌ Erreur requête directe:");
      console.error("   Message:", directError.message);
      console.error("   Code:", directError.code);
      console.error("   Details:", directError.details);
      console.error("   Hint:", directError.hint);
      
      if (directError.message?.includes("row-level security") || directError.code === "42501") {
        console.error("\n⚠️  ERREUR RLS DÉTECTÉE!");
        console.error(`   Profile ID utilisé: ${profile.id}`);
        console.error(`   RPC user_profile_id(): ${rpcProfileId || "NULL"}`);
      }
    } else {
      console.log(`✅ Requête directe réussie: ${directProperties?.length || 0} propriétés (total: ${count || 0})`);
      
      if (directProperties && directProperties.length > 0) {
        console.log("\n📋 Propriétés trouvées:");
        directProperties.forEach((p, i) => {
          console.log(`   ${i + 1}. ${p.adresse_complete || "Sans adresse"} (${p.type})`);
          console.log(`      ID: ${p.id}`);
          console.log(`      Owner ID: ${p.owner_id}`);
          console.log(`      État: ${p.etat}`);
        });
      } else {
        console.warn("\n⚠️  Aucune propriété trouvée avec la requête directe!");
      }
    }

    // 4. Test de fetchProperties (comme dans le layout)
    console.log("\n📋 Étape 5: Test fetchProperties()...");
    console.log("=" .repeat(60));
    
    const result = await fetchProperties(profile.id, { limit: 50 });

    console.log("\n✅ Résultat fetchProperties:");
    console.log(`   - Nombre de propriétés: ${result.properties.length}`);
    console.log(`   - Total: ${result.total || result.properties.length}`);

    if (result.properties.length > 0) {
      console.log("\n📋 Propriétés retournées par fetchProperties:");
      result.properties.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.adresse_complete || "Sans adresse"} (${p.type})`);
        console.log(`      ID: ${p.id}`);
        console.log(`      Owner ID: ${p.owner_id}`);
        console.log(`      État: ${(p as any).etat || "N/A"}`);
      });
    } else {
      console.warn("\n⚠️  fetchProperties retourne 0 propriétés!");
      console.warn(`   Profile ID utilisé: ${profile.id}`);
    }

    console.log("\n" + "=" .repeat(60));
    console.log("✅ TEST TERMINÉ");

  } catch (error: any) {
    console.error("\n❌ ERREUR LORS DU TEST:");
    console.error("   Message:", error.message);
    console.error("   Stack:", error.stack);
  }
}

testFetchPropertiesServer();

