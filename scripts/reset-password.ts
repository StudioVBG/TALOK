/**
 * Script pour réinitialiser le mot de passe d'un utilisateur
 * Usage: tsx scripts/reset-password.ts <email> <nouveau_mot_de_passe>
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Variables d'environnement manquantes");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function resetPassword(email: string, newPassword: string) {
  console.log(`\n🔐 Réinitialisation du mot de passe pour: ${email}\n`);

  try {
    // 1. Vérifier si l'utilisateur existe
    console.log("1️⃣ Vérification du compte...");
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error("❌ Erreur:", usersError);
      return;
    }

    const user = users.users.find((u) => u.email === email);

    if (!user) {
      console.log("❌ Utilisateur non trouvé");
      console.log("\n💡 Le compte n'existe pas. Créez-le d'abord.");
      return;
    }

    console.log("✅ Utilisateur trouvé");
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);

    // 2. Réinitialiser le mot de passe
    console.log("\n2️⃣ Réinitialisation du mot de passe...");
    const { data, error } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (error) {
      console.error("❌ Erreur lors de la réinitialisation:", error);
      return;
    }

    console.log("✅ Mot de passe réinitialisé avec succès !");
    console.log(`\n📋 Informations de connexion:`);
    console.log(`   Email: ${email}`);
    console.log(`   Mot de passe: ${newPassword}`);
    console.log(`\n💡 Vous pouvez maintenant vous connecter avec ces identifiants.`);

  } catch (error: unknown) {
    console.error("❌ Erreur inattendue:", error);
  }
}

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error("❌ Usage: tsx scripts/reset-password.ts <email> <nouveau_mot_de_passe>");
  console.error("\nExemple:");
  console.error('  tsx scripts/reset-password.ts contact.explore.mq@gmail.com "Test12345!2025"');
  process.exit(1);
}

resetPassword(email, newPassword).then(() => {
  process.exit(0);
});

