#!/usr/bin/env npx tsx
/**
 * Script pour diagnostiquer et réparer le compte admin support@talok.fr
 * Usage: npx tsx scripts/fix-admin-account.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Variables d'environnement manquantes:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✅" : "❌");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "✅" : "❌");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const ADMIN_EMAIL = "support@talok.fr";
const ADMIN_PASSWORD = "Test12345!2025";

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("🔍 DIAGNOSTIC DU COMPTE ADMIN");
  console.log("=".repeat(60));
  console.log(`\n📧 Email: ${ADMIN_EMAIL}`);

  try {
    // 1. Vérifier si l'utilisateur existe dans auth.users
    console.log("\n1️⃣  Vérification dans auth.users...");
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error("   ❌ Erreur listUsers:", listError.message);
      return;
    }

    const authUser = users.users.find((u) => u.email === ADMIN_EMAIL);

    if (authUser) {
      console.log("   ✅ Utilisateur trouvé dans auth.users");
      console.log(`      ID: ${authUser.id}`);
      console.log(`      Email confirmé: ${authUser.email_confirmed_at ? "✅" : "❌"}`);

      // Confirmer l'email et mettre à jour le mot de passe
      if (!authUser.email_confirmed_at) {
        console.log("\n   🔧 Confirmation de l'email...");
        const { error: updateError } = await supabase.auth.admin.updateUserById(authUser.id, {
          email_confirm: true,
          password: ADMIN_PASSWORD,
        });
        if (updateError) {
          console.error("   ❌ Erreur:", updateError.message);
        } else {
          console.log("   ✅ Email confirmé et mot de passe mis à jour");
        }
      }

      // 2. Vérifier le profil
      console.log("\n2️⃣  Vérification dans profiles...");
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", authUser.id)
        .single();

      if (profileError && profileError.code !== "PGRST116") {
        console.error("   ❌ Erreur requête profiles:", profileError.message);
      }

      if (profile) {
        console.log("   ✅ Profil trouvé");
        console.log(`      ID: ${profile.id}`);
        console.log(`      Rôle: ${profile.role}`);
        console.log(`      Email: ${profile.email || "(non défini)"}`);

        // Mettre à jour le rôle si nécessaire
        if (profile.role !== "admin") {
          console.log("\n   🔧 Mise à jour du rôle vers admin...");
          const { error: updateRoleError } = await supabase
            .from("profiles")
            .update({ role: "admin", email: ADMIN_EMAIL })
            .eq("id", profile.id);
          
          if (updateRoleError) {
            console.error("   ❌ Erreur:", updateRoleError.message);
          } else {
            console.log("   ✅ Rôle mis à jour vers admin");
          }
        }
      } else {
        console.log("   ❌ Profil NON trouvé - Création en cours...");
        
        const { data: newProfile, error: createError } = await supabase
          .from("profiles")
          .insert({
            user_id: authUser.id,
            role: "admin",
            email: ADMIN_EMAIL,
            prenom: "Thomas",
            nom: "Admin",
          })
          .select()
          .single();

        if (createError) {
          console.error("   ❌ Erreur création profil:", createError.message);
          console.error("   📋 Détails:", createError);
        } else {
          console.log("   ✅ Profil admin créé avec succès");
          console.log(`      ID: ${newProfile.id}`);
        }
      }

    } else {
      console.log("   ❌ Utilisateur NON trouvé - Création en cours...");

      // Créer l'utilisateur
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
      });

      if (createUserError) {
        console.error("   ❌ Erreur création utilisateur:", createUserError.message);
        return;
      }

      console.log("   ✅ Utilisateur créé");
      console.log(`      ID: ${newUser.user.id}`);

      // Attendre que le trigger crée le profil
      console.log("\n   ⏳ Attente création profil par trigger...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Vérifier/créer le profil
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", newUser.user.id)
        .single();

      if (profile) {
        console.log("   ✅ Profil créé par trigger");
        // Mettre à jour le rôle
        await supabase
          .from("profiles")
          .update({ role: "admin", email: ADMIN_EMAIL, prenom: "Thomas", nom: "Admin" })
          .eq("id", profile.id);
        console.log("   ✅ Rôle admin assigné");
      } else {
        // Créer manuellement
        const { error: createProfileError } = await supabase
          .from("profiles")
          .insert({
            user_id: newUser.user.id,
            role: "admin",
            email: ADMIN_EMAIL,
            prenom: "Thomas",
            nom: "Admin",
          });

        if (createProfileError) {
          console.error("   ❌ Erreur création profil:", createProfileError.message);
        } else {
          console.log("   ✅ Profil admin créé manuellement");
        }
      }
    }

    // 3. Test de connexion
    console.log("\n3️⃣  Test de connexion...");
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (signInError) {
      console.error("   ❌ Échec connexion:", signInError.message);
    } else {
      console.log("   ✅ Connexion réussie !");
      console.log(`      User ID: ${signInData.user.id}`);
    }

    // Résumé
    console.log("\n" + "=".repeat(60));
    console.log("📋 RÉSUMÉ");
    console.log("=".repeat(60));
    console.log(`\n🔑 Identifiants de connexion:`);
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Mot de passe: ${ADMIN_PASSWORD}`);
    console.log(`\n🔗 URL: https://talok.fr/auth/signin`);
    console.log("");

  } catch (error: any) {
    console.error("\n❌ Erreur fatale:", error.message);
  }
}

main();





