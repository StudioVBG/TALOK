/**
 * Script pour vérifier si les tables de messagerie unifiée existent
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
});

async function checkTables() {
  console.log("🔍 Vérification des tables de messagerie unifiée...\n");

  // Tester l'existence des tables en essayant de faire un SELECT
  const tables = [
    "unified_conversations",
    "conversation_participants", 
    "unified_messages",
    "message_read_receipts"
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select("id")
        .limit(1);

      if (error) {
        if (error.message.includes("does not exist") || error.code === "42P01") {
          console.log(`❌ Table "${table}" n'existe PAS`);
        } else {
          console.log(`⚠️  Table "${table}": ${error.message}`);
        }
      } else {
        console.log(`✅ Table "${table}" existe (${data?.length || 0} enregistrements visibles)`);
      }
    } catch (err: any) {
      console.log(`❌ Table "${table}": ${err.message}`);
    }
  }

  // Vérifier les fonctions RPC
  console.log("\n🔍 Vérification des fonctions RPC...\n");
  
  const functions = [
    { name: "mark_conversation_as_read", params: { p_conversation_id: "00000000-0000-0000-0000-000000000000", p_profile_id: "00000000-0000-0000-0000-000000000000" } },
    { name: "get_total_unread_count", params: { p_profile_id: "00000000-0000-0000-0000-000000000000" } },
  ];

  for (const func of functions) {
    try {
      const { error } = await supabase.rpc(func.name, func.params);
      
      if (error) {
        if (error.message.includes("does not exist")) {
          console.log(`❌ Fonction "${func.name}" n'existe PAS`);
        } else {
          // La fonction existe mais peut avoir retourné une erreur (données invalides)
          console.log(`✅ Fonction "${func.name}" existe`);
        }
      } else {
        console.log(`✅ Fonction "${func.name}" existe et fonctionne`);
      }
    } catch (err: any) {
      console.log(`❌ Fonction "${func.name}": ${err.message}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📋 Si des tables ou fonctions manquent, exécutez le SQL manuellement:");
  console.log("   1. Allez sur https://supabase.com/dashboard");
  console.log("   2. Sélectionnez votre projet → SQL Editor");
  console.log("   3. Collez le contenu de:");
  console.log("      supabase/migrations/20251201300001_unified_messaging.sql");
  console.log("=".repeat(60));
}

checkTables();

