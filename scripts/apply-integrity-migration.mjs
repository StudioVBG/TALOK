#!/usr/bin/env node
/**
 * Script pour appliquer la migration d'intégrité relationnelle
 *
 * Usage:
 *   node scripts/apply-integrity-migration.mjs
 *
 * Prérequis:
 *   - .env.local avec NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from 'fs';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Variables manquantes dans .env.local:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', SERVICE_ROLE_KEY ? '✅' : '❌');
  console.error('\n💡 Copiez .env.example vers .env.local et renseignez vos clés.');
  process.exit(1);
}

const MIGRATION_FILE = '20260217000000_data_integrity_audit_repair.sql';
const migrationPath = join(__dirname, '..', 'supabase', 'migrations', MIGRATION_FILE);

let sql;
try {
  sql = readFileSync(migrationPath, 'utf-8');
} catch {
  console.error(`❌ Fichier non trouvé: ${migrationPath}`);
  process.exit(1);
}

console.log(`\n${'='.repeat(70)}`);
console.log(`🔧 APPLICATION MIGRATION: ${MIGRATION_FILE}`);
console.log(`${'='.repeat(70)}\n`);

// Extraire les blocs SQL exécutables
// La migration utilise BEGIN/COMMIT, DO $$ ... $$, CREATE OR REPLACE, ALTER TABLE, etc.
// On va l'exécuter en un seul bloc via exec_sql si disponible

async function tryExecSQL(sqlQuery) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql_query: sqlQuery }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return await response.json();
}

// Essayer via la Management API
async function tryManagementAPI(sqlQuery) {
  const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
  const mgmtToken = process.env.SUPABASE_MANAGEMENT_API_TOKEN;

  if (!mgmtToken) return null;

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mgmtToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sqlQuery }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Management API ${response.status}: ${text}`);
  }
  return await response.json();
}

async function main() {
  // Méthode 1: Essayer exec_sql RPC
  console.log('📡 Tentative 1: exec_sql RPC...');
  try {
    const result = await tryExecSQL(sql);
    console.log('✅ Migration appliquée avec succès via exec_sql!');
    console.log(JSON.stringify(result, null, 2));
    return;
  } catch (err) {
    console.log(`⚠️  exec_sql non disponible: ${err.message.substring(0, 100)}`);
  }

  // Méthode 2: Essayer Management API
  console.log('\n📡 Tentative 2: Management API...');
  try {
    const result = await tryManagementAPI(sql);
    if (result) {
      console.log('✅ Migration appliquée avec succès via Management API!');
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log('⚠️  SUPABASE_MANAGEMENT_API_TOKEN non configuré');
  } catch (err) {
    console.log(`⚠️  Management API échouée: ${err.message.substring(0, 100)}`);
  }

  // Méthode 3: Instructions manuelles
  console.log(`\n${'='.repeat(70)}`);
  console.log('📋 APPLICATION MANUELLE REQUISE');
  console.log(`${'='.repeat(70)}`);
  console.log('\n1. Ouvrez le Supabase Dashboard:');

  const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
  console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql`);

  console.log('\n2. Copiez-collez le contenu du fichier:');
  console.log(`   supabase/migrations/${MIGRATION_FILE}`);

  console.log('\n3. Cliquez sur "Run" pour exécuter');

  console.log('\n4. Vérifiez les résultats avec:');
  console.log('   SELECT * FROM check_data_integrity();');
  console.log('   SELECT * FROM _repair_log ORDER BY repair_date DESC;');

  console.log(`\n${'='.repeat(70)}\n`);
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err.message);
  process.exit(1);
});
