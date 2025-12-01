/**
 * Script pour exécuter la migration SQL via l'API Supabase Management
 */

const https = require('https');

const SUPABASE_PROJECT_REF = 'poeijjosocmqlhgsacud';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || 'sbp_df8531fa452fb7e02e0de86f70deb36d24608d1c';

const migrationSQL = `
-- Migration: Ajouter les colonnes manquantes à la table properties

-- Colonnes de base V3
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS surface_habitable_m2 NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS nb_chambres INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyer_hc NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyer_base NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS type_bien TEXT,
  ADD COLUMN IF NOT EXISTS meuble BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS encadrement_loyers BOOLEAN DEFAULT false;

-- Colonnes chauffage
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS chauffage_type TEXT,
  ADD COLUMN IF NOT EXISTS chauffage_energie TEXT,
  ADD COLUMN IF NOT EXISTS eau_chaude_type TEXT,
  ADD COLUMN IF NOT EXISTS clim_presence TEXT,
  ADD COLUMN IF NOT EXISTS clim_type TEXT;

-- Colonnes géolocalisation
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Colonnes charges et financier
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS charges_mensuelles NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS depot_garantie NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS zone_encadrement BOOLEAN DEFAULT false;

-- Synchroniser type_bien avec type pour les propriétés existantes
UPDATE properties 
SET type_bien = type 
WHERE type_bien IS NULL AND type IS NOT NULL;

-- Synchroniser surface_habitable_m2 avec surface pour les propriétés existantes
UPDATE properties 
SET surface_habitable_m2 = surface 
WHERE surface_habitable_m2 IS NULL AND surface IS NOT NULL AND surface > 0;

-- Synchroniser loyer_hc avec loyer_base si loyer_hc est vide
UPDATE properties 
SET loyer_hc = COALESCE(loyer_base, 0) 
WHERE loyer_hc IS NULL OR loyer_hc = 0;
`;

async function runMigration() {
  console.log('🚀 Exécution de la migration...\n');
  
  const options = {
    hostname: 'api.supabase.com',
    port: 443,
    path: `/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ Migration exécutée avec succès!');
          console.log('Réponse:', data);
          resolve(data);
        } else {
          console.log('❌ Erreur:', data);
          reject(new Error(data));
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ Erreur de connexion:', e.message);
      reject(e);
    });

    req.write(JSON.stringify({ query: migrationSQL }));
    req.end();
  });
}

runMigration()
  .then(() => {
    console.log('\n✅ Migration terminée!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Échec de la migration:', err.message);
    console.log('\n📋 Veuillez exécuter la migration manuellement dans le Dashboard Supabase:');
    console.log('1. Allez sur https://supabase.com/dashboard');
    console.log('2. Sélectionnez votre projet');
    console.log('3. Allez dans SQL Editor');
    console.log('4. Copiez-collez le SQL et exécutez-le');
    process.exit(1);
  });

