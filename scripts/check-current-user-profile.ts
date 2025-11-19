/**
 * Script pour vérifier quel profil est utilisé par l'utilisateur connecté
 * Usage: npx tsx scripts/check-current-user-profile.ts <user_id>
 */

import * as dotenv from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Variables d'environnement manquantes");
  process.exit(1);
}

async function checkCurrentUserProfile() {
  console.log("\n🔍 VÉRIFICATION DU PROFIL UTILISATEUR\n");

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Récupérer tous les utilisateurs et leurs profils
  const { data: profiles } = await serviceClient
    .from("profiles")
    .select("id, user_id, role, prenom, nom, email")
    .in("role", ["owner", "admin"]);

  if (!profiles || profiles.length === 0) {
    console.log("⚠️ Aucun profil trouvé");
    return;
  }

  console.log("📋 PROFILS DISPONIBLES:\n");
  profiles.forEach((profile, index) => {
    console.log(`${index + 1}. Profil ID: ${profile.id}`);
    console.log(`   User ID: ${profile.user_id}`);
    console.log(`   Role: ${profile.role}`);
    console.log(`   Nom: ${profile.prenom || ""} ${profile.nom || ""}`.trim() || "N/A");
    console.log(`   Email: ${profile.email || "N/A"}`);
    
    // Vérifier les propriétés
    serviceClient
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .then(({ count }) => {
        console.log(`   Propriétés: ${count || 0}`);
      });
    
    console.log("");
  });

  // Vérifier quel profil a des propriétés
  console.log("📊 RÉSUMÉ:\n");
  for (const profile of profiles) {
    const { count } = await serviceClient
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", profile.id);
    
    console.log(`   Profil ${profile.id}: ${count || 0} propriété(s)`);
  }

  console.log("\n💡 POUR TROUVER VOTRE PROFIL:");
  console.log("   1. Ouvrez les DevTools du navigateur");
  console.log("   2. Allez dans Application > Cookies");
  console.log("   3. Cherchez le cookie 'sb-<project>-auth-token'");
  console.log("   4. Décodez le JWT pour trouver le user_id");
  console.log("   5. Comparez avec les user_id ci-dessus");
  console.log("\n✅ Diagnostic terminé\n");
}

checkCurrentUserProfile().catch(console.error);

