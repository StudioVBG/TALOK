/**
 * Test de connexion locataire
 * Usage: npx tsx scripts/test-login.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function testLogin() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const email = "volberg.thomas@hotmail.fr";
  const password = "Test12345!2025";

  console.log("🔐 Test de connexion...");
  console.log("📧 Email:", email);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("❌ Erreur:", error.message);
    return;
  }

  console.log("✅ Connexion réussie !");
  console.log("👤 User ID:", data.user?.id);
  console.log("📧 Email confirmé:", data.user?.email_confirmed_at ? "Oui" : "Non");
  
  // Récupérer le profil
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, first_name, last_name")
    .eq("user_id", data.user?.id)
    .single();
    
  if (profile) {
    console.log("👤 Profil:", JSON.stringify(profile, null, 2));
    console.log("\n═══════════════════════════════════════════");
    console.log("🔗 Après connexion, le locataire sera redirigé vers:");
    console.log("   /tenant/dashboard");
    console.log("");
    console.log("🔗 URL de signature du bail:");
    console.log("   http://localhost:3000/signature/1fe555d5-033c-437d-bcc4-45f8edd4b771");
    console.log("═══════════════════════════════════════════");
  }
}

testLogin();

