/**
 * Vérification directe des tables via requête SQL
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Variables d'environnement manquantes");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' }
});

async function verify() {
  console.log("🔍 Vérification des tables (méthode directe)...\n");

  // Essayer d'insérer puis supprimer un enregistrement de test
  try {
    // Test unified_conversations
    const { data: convTest, error: convError } = await supabase
      .from("unified_conversations")
      .insert({
        type: "group",
        subject: "TEST - À SUPPRIMER"
      })
      .select()
      .single();

    if (convError) {
      console.log("❌ unified_conversations:", convError.message);
    } else {
      console.log("✅ unified_conversations: Table créée et fonctionnelle !");
      // Supprimer le test
      await supabase.from("unified_conversations").delete().eq("id", convTest.id);
    }
  } catch (e: any) {
    console.log("❌ unified_conversations:", e.message);
  }

  // Vérifier la table conversations existante (ancien système)
  try {
    const { count, error } = await supabase
      .from("conversations")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.log("⚠️  conversations (ancien système):", error.message);
    } else {
      console.log(`✅ conversations (ancien système): ${count || 0} conversations existantes`);
    }
  } catch (e: any) {
    console.log("⚠️  conversations:", e.message);
  }

  // Vérifier les messages existants
  try {
    const { count, error } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.log("⚠️  messages (ancien système):", error.message);
    } else {
      console.log(`✅ messages (ancien système): ${count || 0} messages existants`);
    }
  } catch (e: any) {
    console.log("⚠️  messages:", e.message);
  }

  console.log("\n" + "=".repeat(50));
  console.log("💡 Note: Si les nouvelles tables n'apparaissent pas,");
  console.log("   le cache Supabase peut prendre quelques minutes à se mettre à jour.");
  console.log("   Vous pouvez aussi redémarrer votre serveur Next.js.");
  console.log("=".repeat(50));
}

verify();

