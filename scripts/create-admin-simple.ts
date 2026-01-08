/**
 * Script simple pour créer un compte admin
 * Utilise l'API normale puis met à jour le rôle via SQL
 * Usage: npx tsx scripts/create-admin-simple.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Charger les variables d'environnement depuis .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Variables d'environnement manquantes dans .env.local:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  console.error("   - NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createAdminUser() {
  const email = "support@talok.fr";
  const password = "Test12345!2025";

  try {
    console.log("🔐 Création du compte admin...");
    console.log(`   Email: ${email}`);

    // Créer l'utilisateur avec l'API normale
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      if (authError.message.includes("already registered") || authError.message.includes("already exists")) {
        console.log("⚠️  L'utilisateur existe déjà");
        console.log("💡 Utilisez le script SQL ci-dessous pour mettre à jour le rôle:");
        console.log("\n" + "=".repeat(60));
        console.log("-- Exécutez ce SQL dans Supabase SQL Editor:");
        console.log("=".repeat(60));
        console.log(`
UPDATE profiles 
SET role = 'admin' 
WHERE user_id = (
  SELECT id FROM auth.users 
  WHERE email = '${email}'
);
        `.trim());
        console.log("=".repeat(60) + "\n");
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
    // Attendre un peu pour que le trigger crée le profil
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ role: "admin" })
      .eq("user_id", authData.user.id);

    if (profileError) {
      console.log("⚠️  Erreur lors de la mise à jour du profil:");
      console.log(`   ${profileError.message}`);
      console.log("\n💡 Utilisez le script SQL ci-dessous pour mettre à jour le rôle:");
      console.log("\n" + "=".repeat(60));
      console.log("-- Exécutez ce SQL dans Supabase SQL Editor:");
      console.log("=".repeat(60));
      console.log(`
UPDATE profiles 
SET role = 'admin' 
WHERE user_id = '${authData.user.id}';
      `.trim());
      console.log("=".repeat(60) + "\n");
      return;
    }

    console.log("✅ Rôle admin assigné au profil");
    console.log("\n🎉 Compte admin créé avec succès !");
    console.log(`   Email: ${email}`);
    console.log(`   Mot de passe: ${password}`);
    console.log("\n💡 Vous pouvez maintenant vous connecter avec ces identifiants");
    console.log("⚠️  Note: Vous devrez confirmer votre email avant de pouvoir vous connecter");
  } catch (error: any) {
    console.error("❌ Erreur lors de la création du compte admin:");
    console.error(error.message);
    process.exit(1);
  }
}

createAdminUser();

