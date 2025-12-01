/**
 * Script pour corriger les owner_id des propriétés
 * Assigne toutes les propriétés à un propriétaire spécifique
 * 
 * Usage:
 *   npx tsx scripts/fix-owner-ids.ts [owner_email]
 * 
 * Exemple:
 *   npx tsx scripts/fix-owner-ids.ts owner.test@gestion-locative.test
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Charger .env.local
config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Variables d'environnement manquantes");
  console.log("   NEXT_PUBLIC_SUPABASE_URL:", !!supabaseUrl);
  console.log("   SUPABASE_SERVICE_ROLE_KEY:", !!serviceRoleKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  const targetEmail = process.argv[2];
  
  console.log("\n🔧 Correction des owner_id des propriétés");
  console.log("==========================================\n");

  // 1. Lister tous les propriétaires
  console.log("📋 Liste des propriétaires disponibles :\n");
  
  const { data: owners, error: ownersError } = await supabase
    .from("profiles")
    .select("id, prenom, nom, role")
    .eq("role", "owner");

  if (ownersError) {
    console.error("❌ Erreur récupération propriétaires:", ownersError.message);
    process.exit(1);
  }

  // Récupérer aussi les admins
  const { data: admins } = await supabase
    .from("profiles")
    .select("id, prenom, nom, role")
    .eq("role", "admin");

  const allUsers = [...(owners || []), ...(admins || [])];

  for (const owner of allUsers) {
    // Compter les propriétés de ce propriétaire
    const { count } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", owner.id);

    console.log(`   ${owner.role === "admin" ? "👑" : "🏠"} ${owner.prenom} ${owner.nom}`);
    console.log(`      ID: ${owner.id}`);
    console.log(`      Rôle: ${owner.role}`);
    console.log(`      Propriétés: ${count || 0}`);
    console.log();
  }

  // 2. Lister les propriétés et leurs owner_id actuels
  console.log("\n📦 Propriétés existantes :\n");

  const { data: properties, error: propsError } = await supabase
    .from("properties")
    .select("id, adresse_complete, ville, owner_id");

  if (propsError) {
    console.error("❌ Erreur récupération propriétés:", propsError.message);
    process.exit(1);
  }

  for (const prop of properties || []) {
    const owner = allUsers.find(o => o.id === prop.owner_id);
    console.log(`   🏡 ${prop.adresse_complete || "Sans adresse"}, ${prop.ville || ""}`);
    console.log(`      ID: ${prop.id}`);
    console.log(`      Owner: ${owner ? `${owner.prenom} ${owner.nom}` : "❌ Aucun ou invalide"} (${prop.owner_id || "null"})`);
    console.log();
  }

  // 3. Si un email cible est fourni, corriger les owner_id
  if (targetEmail) {
    console.log(`\n🎯 Recherche du propriétaire cible: ${targetEmail}\n`);

    // Trouver l'utilisateur par email
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error("❌ Erreur recherche utilisateurs:", authError.message);
      process.exit(1);
    }

    const targetUser = authUsers.users.find(u => u.email === targetEmail);
    
    if (!targetUser) {
      console.error(`❌ Utilisateur non trouvé: ${targetEmail}`);
      console.log("\n   Utilisateurs disponibles:");
      authUsers.users.slice(0, 10).forEach(u => console.log(`   - ${u.email}`));
      process.exit(1);
    }

    // Trouver le profil correspondant
    const { data: targetProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, prenom, nom, role")
      .eq("user_id", targetUser.id)
      .single();

    if (profileError || !targetProfile) {
      console.error("❌ Profil non trouvé pour cet utilisateur");
      process.exit(1);
    }

    console.log(`✅ Propriétaire cible trouvé:`);
    console.log(`   Nom: ${targetProfile.prenom} ${targetProfile.nom}`);
    console.log(`   Profile ID: ${targetProfile.id}`);
    console.log(`   Rôle: ${targetProfile.role}`);

    // Mettre à jour toutes les propriétés
    console.log(`\n🔄 Mise à jour des propriétés...\n`);

    const { data: updated, error: updateError } = await supabase
      .from("properties")
      .update({ owner_id: targetProfile.id })
      .neq("owner_id", targetProfile.id)
      .select("id, adresse_complete");

    if (updateError) {
      console.error("❌ Erreur mise à jour:", updateError.message);
      process.exit(1);
    }

    if (updated && updated.length > 0) {
      console.log(`✅ ${updated.length} propriété(s) mise(s) à jour:`);
      updated.forEach(p => console.log(`   - ${p.adresse_complete || p.id}`));
    } else {
      console.log("ℹ️  Toutes les propriétés appartiennent déjà à ce propriétaire.");
    }

    // Vérification finale
    console.log("\n📊 Vérification finale:\n");
    
    const { count: finalCount } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", targetProfile.id);

    console.log(`   ${targetProfile.prenom} ${targetProfile.nom} possède maintenant ${finalCount} propriété(s).`);
  } else {
    console.log("\n💡 Pour corriger les owner_id, exécutez:");
    console.log("   npx tsx scripts/fix-owner-ids.ts <email_proprietaire>\n");
    console.log("   Exemple:");
    console.log("   npx tsx scripts/fix-owner-ids.ts owner.test@gestion-locative.test\n");
  }

  console.log("\n✅ Terminé!\n");
}

main().catch(console.error);

