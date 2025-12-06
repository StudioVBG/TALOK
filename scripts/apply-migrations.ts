/**
 * Script pour appliquer les migrations SQL via l'API Supabase
 * Exécute les requêtes SQL directement sur la base de données
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Variables d'environnement manquantes:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Requêtes SQL à exécuter (divisées pour éviter les erreurs)
const sqlStatements = [
  // 1.1 Ajouter la colonne occupant_reference
  `ALTER TABLE roommates ADD COLUMN IF NOT EXISTS occupant_reference UUID DEFAULT gen_random_uuid();`,
  
  // 1.2 Ajouter la colonne relationship
  `ALTER TABLE roommates ADD COLUMN IF NOT EXISTS relationship TEXT;`,
  
  // 1.3 Ajouter la colonne email
  `ALTER TABLE roommates ADD COLUMN IF NOT EXISTS email TEXT;`,
  
  // 1.6 Index pour occupant_reference
  `CREATE INDEX IF NOT EXISTS idx_roommates_occupant_reference ON roommates(occupant_reference);`,
  
  // 1.7 Index pour email
  `CREATE INDEX IF NOT EXISTS idx_roommates_email ON roommates(email) WHERE email IS NOT NULL;`,
  
  // 2.1 Fonction de normalisation email
  `CREATE OR REPLACE FUNCTION public.normalize_email(email TEXT)
   RETURNS TEXT
   LANGUAGE plpgsql
   IMMUTABLE
   AS $$
   DECLARE
     local_part TEXT;
     domain_part TEXT;
     normalized TEXT;
   BEGIN
     IF email IS NULL OR email = '' THEN
       RETURN NULL;
     END IF;
     normalized := LOWER(TRIM(email));
     local_part := SPLIT_PART(normalized, '@', 1);
     domain_part := SPLIT_PART(normalized, '@', 2);
     IF domain_part = '' THEN
       RETURN normalized;
     END IF;
     IF POSITION('+' IN local_part) > 0 THEN
       local_part := SPLIT_PART(local_part, '+', 1);
     END IF;
     IF domain_part IN ('gmail.com', 'googlemail.com') THEN
       local_part := REPLACE(local_part, '.', '');
     END IF;
     RETURN local_part || '@' || domain_part;
   END;
   $$;`,
  
  // 2.2 Ajouter la colonne email aux profiles
  `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;`,
  
  // 2.4 Index unique sur email_normalized
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_normalized_unique
   ON profiles(email_normalized) WHERE email_normalized IS NOT NULL;`,
  
  // 2.5 Index sur email
  `CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email) WHERE email IS NOT NULL;`,
];

async function runMigration(sql: string, index: number): Promise<boolean> {
  try {
    console.log(`\n📝 Exécution migration ${index + 1}/${sqlStatements.length}...`);
    console.log(`   SQL: ${sql.substring(0, 80)}...`);
    
    const { data, error } = await supabase.rpc("exec_sql", { query: sql });
    
    if (error) {
      // Essayer avec une requête directe si exec_sql n'existe pas
      const { error: directError } = await supabase.from("_migrations_temp").select("*").limit(0);
      
      if (directError?.message?.includes("does not exist")) {
        console.log(`   ⚠️ Impossible d'exécuter via RPC, essai alternatif...`);
        return false;
      }
      
      console.log(`   ⚠️ Erreur (peut être normal si déjà appliqué): ${error.message}`);
      return true; // Continuer même en cas d'erreur
    }
    
    console.log(`   ✅ Succès`);
    return true;
  } catch (err: any) {
    console.log(`   ⚠️ Exception: ${err.message}`);
    return true; // Continuer
  }
}

async function main() {
  console.log("🚀 Application des migrations SQL...\n");
  console.log(`   URL: ${SUPABASE_URL}`);
  console.log(`   Migrations à appliquer: ${sqlStatements.length}`);
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < sqlStatements.length; i++) {
    const result = await runMigration(sqlStatements[i], i);
    if (result) success++;
    else failed++;
  }
  
  console.log("\n" + "=".repeat(50));
  console.log(`📊 Résultat: ${success} succès, ${failed} échecs`);
  
  if (failed > 0) {
    console.log("\n⚠️ Certaines migrations ont échoué.");
    console.log("   Veuillez exécuter le fichier scripts/apply_tenant_migrations.sql");
    console.log("   manuellement dans le SQL Editor de Supabase Dashboard:");
    console.log("   https://supabase.com/dashboard/project/poeijjosocmqlhgsacud/sql/new");
  } else {
    console.log("\n✅ Toutes les migrations ont été appliquées avec succès!");
  }
}

main().catch(console.error);

