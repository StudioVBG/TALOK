import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function check() {
  console.log("🔍 Vérification finale...\n");

  // Test direct avec RPC qui existe déjà
  const { data, error } = await supabase.rpc("get_total_unread_count", {
    p_profile_id: "00000000-0000-0000-0000-000000000000"
  });

  if (error) {
    console.log("❌ Fonction RPC:", error.message);
  } else {
    console.log("✅ Fonction get_total_unread_count fonctionne ! Résultat:", data);
  }

  // Vérifier si on peut créer une conversation test
  console.log("\n📝 Test de création de conversation...");
  
  const { data: conv, error: convErr } = await supabase
    .from("unified_conversations")
    .insert({ type: "group", subject: "TEST" })
    .select()
    .single();

  if (convErr) {
    if (convErr.message.includes("schema cache")) {
      console.log("⏳ Le cache Supabase n'est pas encore mis à jour.");
      console.log("   Attendez 1-2 minutes et relancez ce script.");
      console.log("   Ou rechargez le schéma dans Supabase Dashboard:");
      console.log("   Settings > API > Reload Schema Cache");
    } else {
      console.log("❌ Erreur:", convErr.message);
    }
  } else {
    console.log("✅ Conversation créée avec succès ! ID:", conv.id);
    // Supprimer le test
    await supabase.from("unified_conversations").delete().eq("id", conv.id);
    console.log("🧹 Test supprimé");
    console.log("\n🎉 TOUT FONCTIONNE ! La messagerie unifiée est prête.");
  }
}

check();

