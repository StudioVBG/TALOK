#!/usr/bin/env npx tsx
/**
 * Script pour appliquer les migrations via l'API Management de Supabase
 * 
 * Exécution : npx tsx scripts/apply-migrations-api.ts
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const MANAGEMENT_API_TOKEN = process.env.SUPABASE_MANAGEMENT_API_TOKEN;

// Extraire le project ref de l'URL
const projectRef = SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectRef || !MANAGEMENT_API_TOKEN) {
  console.error("❌ Variables d'environnement manquantes");
  console.error("   SUPABASE_URL:", SUPABASE_URL);
  console.error("   PROJECT_REF:", projectRef);
  console.error("   TOKEN présent:", !!MANAGEMENT_API_TOKEN);
  process.exit(1);
}

console.log("\n🔑 Configuration:");
console.log(`   Project: ${projectRef}`);
console.log(`   Token: ${MANAGEMENT_API_TOKEN?.substring(0, 10)}...`);

// Migrations à appliquer
const MIGRATIONS = [
  "20251207231451_add_visite_virtuelle_url.sql",
  "20251208000000_fix_all_roles_complete.sql",
];

async function executeSql(sql: string, name: string): Promise<boolean> {
  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  
  try {
    console.log(`\n📄 Application de ${name}...`);
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MANAGEMENT_API_TOKEN}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`  ✅ Migration appliquée avec succès`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`  ❌ Erreur HTTP ${response.status}:`, errorText.substring(0, 200));
      return false;
    }
  } catch (error: any) {
    console.error(`  ❌ Exception:`, error.message);
    return false;
  }
}

async function main(): Promise<void> {
  console.log("\n" + "=".repeat(70));
  console.log("🚀 APPLICATION DES MIGRATIONS VIA API MANAGEMENT");
  console.log("=".repeat(70));

  let success = 0;
  let failed = 0;

  for (const migrationFile of MIGRATIONS) {
    const filepath = path.join(process.cwd(), "supabase", "migrations", migrationFile);
    
    if (!fs.existsSync(filepath)) {
      console.log(`\n⚠️  ${migrationFile} non trouvé`);
      failed++;
      continue;
    }

    const sql = fs.readFileSync(filepath, "utf-8");
    
    const result = await executeSql(sql, migrationFile);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(`📊 RÉSULTAT: ${success} succès, ${failed} échecs`);
  console.log("=".repeat(70) + "\n");

  if (failed > 0) {
    console.log("📋 MÉTHODE ALTERNATIVE:");
    console.log("1. Allez sur https://supabase.com/dashboard/project/" + projectRef + "/sql/new");
    console.log("2. Copiez le contenu des fichiers de migration:");
    for (const f of MIGRATIONS) {
      console.log(`   → supabase/migrations/${f}`);
    }
    console.log("3. Collez et exécutez dans le SQL Editor\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Erreur fatale:", error);
    process.exit(1);
  });
















































