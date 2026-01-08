/**
 * Script pour réinitialiser le mot de passe admin via l'API Admin Supabase
 * Usage: npx tsx scripts/reset-admin-password.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function resetAdminPassword() {
  const adminEmail = "support@talok.fr";
  const newPassword = "Admin2025!";

  console.log("🔑 Réinitialisation du mot de passe admin...\n");
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Nouveau mot de passe: ${newPassword}`);

  try {
    // Récupérer l'utilisateur par email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error("❌ Erreur listUsers:", listError.message);
      return;
    }

    const adminUser = users.users.find(u => u.email === adminEmail);
    
    if (!adminUser) {
      console.error("❌ Utilisateur admin non trouvé");
      return;
    }

    console.log(`\n   User ID trouvé: ${adminUser.id}`);

    // Mettre à jour le mot de passe
    const { data, error } = await supabase.auth.admin.updateUserById(adminUser.id, {
      password: newPassword,
      email_confirm: true, // Confirmer l'email au passage
    });

    if (error) {
      console.error("❌ Erreur updateUser:", error.message);
      return;
    }

    console.log("\n✅ Mot de passe réinitialisé avec succès!");
    console.log("\n📋 Identifiants de connexion:");
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Mot de passe: ${newPassword}`);
    console.log("\n🔗 URL de connexion: http://localhost:3000/auth/signin");

  } catch (error: any) {
    console.error("❌ Erreur:", error.message);
  }
}

resetAdminPassword();

