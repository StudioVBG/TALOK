/**
 * Script pour exécuter une migration SQL via Supabase Service Role
 * Usage: npx ts-node scripts/run-sql-migration.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  const sqlPath = path.join(__dirname, 'apply_notifications.sql');
  
  if (!fs.existsSync(sqlPath)) {
    console.error('❌ Fichier SQL non trouvé:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf-8');
  
  // Séparer les statements par les points-virgules en fin de ligne
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && s.length > 10);

  console.log(`\n📝 Exécution de ${statements.length} statements SQL...\n`);

  let success = 0;
  let errors = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    const preview = statement.substring(0, 80).replace(/\n/g, ' ');
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
      
      if (error) {
        // Essayer avec une requête directe via l'API management
        console.log(`⚠️  Statement ${i + 1}: ${preview}...`);
        console.log(`   Erreur: ${error.message}`);
        errors++;
      } else {
        console.log(`✅ Statement ${i + 1}: ${preview}...`);
        success++;
      }
    } catch (err: any) {
      console.log(`⚠️  Statement ${i + 1}: ${preview}...`);
      console.log(`   Exception: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n📊 Résultat: ${success} succès, ${errors} erreurs`);
  
  if (errors > 0) {
    console.log('\n💡 Si des erreurs persistent, exécutez le SQL manuellement:');
    console.log('   1. Allez sur https://supabase.com/dashboard');
    console.log('   2. Ouvrez votre projet > SQL Editor');
    console.log('   3. Copiez le contenu de scripts/apply_notifications.sql');
    console.log('   4. Exécutez le script');
  }
}

runMigration().catch(console.error);

