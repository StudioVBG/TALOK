/**
 * Script pour exécuter la migration du système de messagerie unifié
 * Usage: npx tsx scripts/run-unified-messaging-migration.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Charger les variables d'environnement
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Variables d'environnement manquantes:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY:", serviceRoleKey ? "✓" : "✗");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function runMigration() {
  console.log("🚀 Démarrage de la migration du système de messagerie unifié...\n");

  try {
    // Lire le fichier SQL
    const migrationPath = path.join(
      __dirname,
      "../supabase/migrations/20251201300001_unified_messaging.sql"
    );
    
    if (!fs.existsSync(migrationPath)) {
      console.error("❌ Fichier de migration non trouvé:", migrationPath);
      process.exit(1);
    }

    const sqlContent = fs.readFileSync(migrationPath, "utf-8");
    
    // Diviser le SQL en instructions individuelles
    // On va exécuter par blocs pour mieux gérer les erreurs
    const statements = sqlContent
      .split(/;(?=\s*(?:--|CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|DO|COMMENT))/gi)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("--"));

    console.log(`📝 ${statements.length} instructions SQL à exécuter\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.substring(0, 80).replace(/\n/g, " ");
      
      try {
        // Utiliser rpc pour exécuter le SQL brut
        const { error } = await supabase.rpc("exec_sql", { sql: stmt + ";" });
        
        if (error) {
          // Vérifier si c'est une erreur "already exists"
          if (error.message?.includes("already exists") || 
              error.message?.includes("duplicate") ||
              error.message?.includes("relation") && error.message?.includes("exists")) {
            console.log(`⏭️  [${i + 1}/${statements.length}] Déjà existant: ${preview}...`);
            skipCount++;
          } else {
            console.error(`❌ [${i + 1}/${statements.length}] Erreur: ${preview}...`);
            console.error(`   ${error.message}`);
            errorCount++;
          }
        } else {
          console.log(`✅ [${i + 1}/${statements.length}] ${preview}...`);
          successCount++;
        }
      } catch (err: any) {
        // Si rpc n'existe pas, essayer une approche alternative
        if (err.message?.includes("function") && err.message?.includes("does not exist")) {
          console.log("⚠️  La fonction exec_sql n'existe pas. Utilisation de l'approche alternative...");
          break;
        }
        console.error(`❌ [${i + 1}/${statements.length}] Exception: ${err.message}`);
        errorCount++;
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 Résumé de la migration:");
    console.log(`   ✅ Succès: ${successCount}`);
    console.log(`   ⏭️  Ignorés (déjà existants): ${skipCount}`);
    console.log(`   ❌ Erreurs: ${errorCount}`);
    console.log("=".repeat(60));

    if (errorCount > 0) {
      console.log("\n⚠️  Certaines instructions ont échoué.");
      console.log("   Vous devrez peut-être exécuter le SQL manuellement via:");
      console.log("   1. Supabase Dashboard > SQL Editor");
      console.log("   2. Coller le contenu de: supabase/migrations/20251201300001_unified_messaging.sql");
    } else {
      console.log("\n✨ Migration terminée avec succès !");
    }

  } catch (error: unknown) {
    console.error("❌ Erreur fatale:", error.message);
    process.exit(1);
  }
}

// Approche alternative: créer les tables une par une via l'API Supabase
async function runMigrationAlternative() {
  console.log("\n🔄 Tentative avec l'approche alternative (création directe)...\n");

  // Vérifier si les tables existent déjà
  const { data: existingTables, error: tablesError } = await supabase
    .from("information_schema.tables" as any)
    .select("table_name")
    .eq("table_schema", "public")
    .in("table_name", ["unified_conversations", "conversation_participants", "unified_messages"]);

  if (tablesError) {
    console.log("⚠️  Impossible de vérifier les tables existantes via l'API.");
    console.log("\n📋 Instructions pour exécuter la migration manuellement:");
    console.log("=".repeat(60));
    console.log("1. Allez sur https://supabase.com/dashboard");
    console.log("2. Sélectionnez votre projet");
    console.log("3. Allez dans 'SQL Editor'");
    console.log("4. Copiez-collez le contenu du fichier:");
    console.log("   supabase/migrations/20251201300001_unified_messaging.sql");
    console.log("5. Cliquez sur 'Run' pour exécuter");
    console.log("=".repeat(60));
    return;
  }

  const existingTableNames = (existingTables || []).map((t: any) => t.table_name);
  
  if (existingTableNames.includes("unified_conversations")) {
    console.log("✅ La table unified_conversations existe déjà");
  }
  if (existingTableNames.includes("conversation_participants")) {
    console.log("✅ La table conversation_participants existe déjà");
  }
  if (existingTableNames.includes("unified_messages")) {
    console.log("✅ La table unified_messages existe déjà");
  }

  if (existingTableNames.length >= 3) {
    console.log("\n✨ Toutes les tables de messagerie unifiée sont déjà créées !");
    return;
  }

  console.log("\n📋 Certaines tables doivent être créées manuellement:");
  console.log("=".repeat(60));
  console.log("1. Allez sur https://supabase.com/dashboard");
  console.log("2. Sélectionnez votre projet");
  console.log("3. Allez dans 'SQL Editor'");
  console.log("4. Copiez-collez le contenu du fichier:");
  console.log("   supabase/migrations/20251201300001_unified_messaging.sql");
  console.log("5. Cliquez sur 'Run' pour exécuter");
  console.log("=".repeat(60));
}

// Exécuter
runMigration().then(() => {
  runMigrationAlternative();
});

