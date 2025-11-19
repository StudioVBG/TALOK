/**
 * Script de test pour vérifier pourquoi les propriétés ne s'affichent pas
 * À exécuter avec: npx tsx scripts/test-properties-visibility.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Variables d'environnement manquantes");
  process.exit(1);
}

async function testPropertiesVisibility() {
  console.log("🔍 Test de visibilité des propriétés\n");

  // Créer un client Supabase (simuler un utilisateur connecté)
  // Note: En production, il faudrait utiliser les cookies de session
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // 1. Vérifier l'authentification
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.log("⚠️  Pas d'utilisateur authentifié (normal pour ce script)");
    console.log("   Ce script nécessite une session active pour tester RLS\n");
    return;
  }

  console.log(`✅ Utilisateur authentifié: ${user.id}\n`);

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
    console.warn("⚠️  user_profile_id() RPC non disponible:", rpcError.message);
  } else {
    console.log(`✅ user_profile_id() retourne: ${rpcProfileId}`);
    if (rpcProfileId !== profile.id) {
      console.error(`❌ INCOHÉRENCE: user_profile_id()=${rpcProfileId} !== profile.id=${profile.id}`);
    } else {
      console.log("✅ user_profile_id() correspond à profile.id\n");
    }
  }

  // 4. Tester la requête SELECT avec RLS
  console.log("🔍 Test de la requête SELECT avec RLS...");
  const { data: properties, error: selectError, count } = await supabase
    .from("properties")
    .select("id, owner_id, type, adresse_complete, etat, created_at", { count: "exact" })
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false });

  if (selectError) {
    console.error("❌ Erreur lors du SELECT:", {
      message: selectError.message,
      code: selectError.code,
      details: selectError.details,
      hint: selectError.hint,
    });
    
    if (selectError.message?.includes("row-level security") || selectError.code === "42501") {
      console.error("\n⚠️  ERREUR RLS DÉTECTÉE");
      console.error("   La politique RLS bloque l'accès aux propriétés");
      console.error(`   Vérifiez que user_profile_id() retourne bien: ${profile.id}`);
    }
  } else {
    console.log(`✅ SELECT réussi: ${properties?.length || 0} propriétés trouvées (total: ${count})`);
    
    if (properties && properties.length > 0) {
      console.log("\n📋 Propriétés trouvées:");
      properties.forEach((p, i) => {
        console.log(`   ${i + 1}. ID: ${p.id}`);
        console.log(`      Owner ID: ${p.owner_id}`);
        console.log(`      Type: ${p.type}`);
        console.log(`      Adresse: ${p.adresse_complete}`);
        console.log(`      État: ${p.etat}`);
        console.log(`      Créé: ${p.created_at}`);
        console.log("");
      });
    } else {
      console.warn("\n⚠️  AUCUNE PROPRIÉTÉ TROUVÉE");
      console.log("   Vérifiez que des propriétés existent avec owner_id =", profile.id);
    }
  }

  // 5. Vérifier les propriétés sans filtre owner_id (pour debug)
  console.log("\n🔍 Test sans filtre owner_id (pour debug)...");
  const { data: allProperties, error: allError } = await supabase
    .from("properties")
    .select("id, owner_id")
    .limit(5);

  if (!allError && allProperties) {
    console.log(`✅ ${allProperties.length} propriétés trouvées en base (sans filtre)`);
    console.log("   Exemples:", allProperties.map(p => ({ id: p.id, owner_id: p.owner_id })));
  }
}

testPropertiesVisibility().catch(console.error);

