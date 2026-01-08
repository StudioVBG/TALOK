/**
 * Script pour créer un compte admin
 * Usage: npx tsx scripts/create-admin.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Charger les variables d'environnement depuis .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Variables d'environnement manquantes:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY");
  console.error("\n💡 Ajoutez SUPABASE_SERVICE_ROLE_KEY dans .env.local");
  process.exit(1);
}

// Client avec service role key (permissions admin)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createAdminUser() {
  const email = "support@talok.fr";
  const password = "Test12345!2025";

  try {
    console.log("🔐 Création du compte admin...");
    console.log(`   Email: ${email}`);

    // Créer l'utilisateur avec l'API Admin
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirmer l'email automatiquement
    });

    if (authError) {
      if (authError.message.includes("already") && authError.message.includes("registered")) {
        console.log("⚠️  L'utilisateur existe déjà, mise à jour du compte...");
        
        // Récupérer l'utilisateur existant
        const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;
        
        const user = users.users.find((u) => u.email === email);
        if (!user) {
          throw new Error("Utilisateur trouvé mais impossible de récupérer les détails");
        }

        // Confirmer l'email et mettre à jour le mot de passe si nécessaire
        const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(
          user.id,
          { 
            email_confirm: true,
            password: password 
          }
        );
        if (updateUserError) {
          console.log("⚠️  Erreur confirmation email:", updateUserError.message);
        } else {
          console.log("✅ Email confirmé !");
        }

        // Mettre à jour le profil
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({ role: "admin" })
          .eq("user_id", user.id);

        if (profileError) throw profileError;

        console.log("✅ Profil mis à jour avec le rôle admin");
        console.log(`   User ID: ${user.id}`);
        console.log("\n🎉 Compte admin prêt !");
        console.log(`   Email: ${email}`);
        console.log(`   Mot de passe: ${password}`);
        return;
      }
      throw authError;
    }

    if (!authData.user) {
      throw new Error("Échec de la création de l'utilisateur");
    }

    console.log("✅ Utilisateur créé");
    console.log(`   User ID: ${authData.user.id}`);

    // Mettre à jour le profil avec le rôle admin
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ role: "admin" })
      .eq("user_id", authData.user.id);

    if (profileError) {
      // Si le profil n'existe pas encore (le trigger devrait le créer)
      // Attendre un peu et réessayer
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const { error: retryError } = await supabaseAdmin
        .from("profiles")
        .update({ role: "admin" })
        .eq("user_id", authData.user.id);

      if (retryError) {
        // Créer le profil manuellement si nécessaire
        const { error: createError } = await supabaseAdmin
          .from("profiles")
          .insert({
            user_id: authData.user.id,
            role: "admin",
          });

        if (createError) throw createError;
      }
    }

    console.log("✅ Rôle admin assigné au profil");
    console.log("\n🎉 Compte admin créé avec succès !");
    console.log(`   Email: ${email}`);
    console.log(`   Mot de passe: ${password}`);
    console.log("\n💡 Vous pouvez maintenant vous connecter avec ces identifiants");
  } catch (error: any) {
    console.error("❌ Erreur lors de la création du compte admin:");
    console.error(error.message);
    process.exit(1);
  }
}

createAdminUser();

