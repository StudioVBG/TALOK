/**
 * Exécute la migration via l'API de gestion Supabase
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SUPABASE_PROJECT_REF = "poeijjosocmqlhgsacud";
const MANAGEMENT_API_TOKEN = process.env.SUPABASE_MANAGEMENT_API_TOKEN;

if (!MANAGEMENT_API_TOKEN) {
  console.error("❌ SUPABASE_MANAGEMENT_API_TOKEN manquant");
  process.exit(1);
}

async function executeMigration() {
  console.log("🚀 Exécution de la migration via l'API Supabase...\n");

  // Lire le fichier SQL
  const sqlPath = path.join(__dirname, "../supabase/migrations/20251201300001_unified_messaging.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  console.log(`📄 Fichier SQL chargé (${sql.length} caractères)`);

  try {
    // Exécuter via l'API de gestion Supabase
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${MANAGEMENT_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erreur API (${response.status}):`, errorText);
      
      if (response.status === 401) {
        console.log("\n⚠️  Token d'API invalide ou expiré.");
        console.log("   Créez un nouveau token sur: https://supabase.com/dashboard/account/tokens");
      }
      return;
    }

    const result = await response.json();
    console.log("✅ Migration exécutée avec succès !");
    console.log("📊 Résultat:", JSON.stringify(result, null, 2));

  } catch (error: unknown) {
    console.error("❌ Erreur:", error.message);
  }
}

executeMigration();
