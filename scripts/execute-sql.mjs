#!/usr/bin/env node
/**
 * Script pour exécuter le SQL de notifications via l'API Supabase
 */

import { readFileSync } from 'fs';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger .env.local
config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Variables manquantes:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', SERVICE_ROLE_KEY ? '✅' : '❌');
  process.exit(1);
}

// Lire le fichier SQL
const sqlPath = join(__dirname, '..', 'APPLY_NOTIFICATIONS.sql');
const sql = readFileSync(sqlPath, 'utf-8');

// Séparer en statements
const statements = sql
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`\n🔧 Exécution de ${statements.length} statements SQL...\n`);

async function executeSQL(statement) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql_query: statement }),
  });

  if (!response.ok) {
    // Essayer via pg_catalog
    return null;
  }
  return await response.json();
}

async function main() {
  let success = 0;
  let skipped = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 60).replace(/\n/g, ' ').trim();
    
    // Ignorer les SELECT de vérification
    if (stmt.toUpperCase().startsWith('SELECT')) {
      console.log(`⏭️  [${i + 1}/${statements.length}] ${preview}... (skipped)`);
      skipped++;
      continue;
    }

    try {
      const result = await executeSQL(stmt + ';');
      if (result !== null) {
        console.log(`✅ [${i + 1}/${statements.length}] ${preview}...`);
        success++;
      } else {
        console.log(`⚠️  [${i + 1}/${statements.length}] ${preview}... (needs manual)`);
      }
    } catch (err) {
      console.log(`❌ [${i + 1}/${statements.length}] ${preview}...`);
      console.log(`   Error: ${err.message}`);
    }
  }

  console.log(`\n📊 Résultat: ${success} exécutés, ${skipped} ignorés`);
  console.log('\n💡 Si certains statements ont échoué, exécutez le SQL manuellement:');
  console.log('   1. https://supabase.com/dashboard > SQL Editor');
  console.log('   2. Collez le contenu de APPLY_NOTIFICATIONS.sql');
  console.log('   3. Cliquez sur Run\n');
}

main().catch(console.error);

