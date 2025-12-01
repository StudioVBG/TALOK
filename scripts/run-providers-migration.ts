import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

// Charger explicitement .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Variables d'environnement manquantes");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runMigration() {
  console.log("🚀 Exécution de la migration des providers API...\n");

  // 1. Vérifier si Resend existe déjà
  const { data: existingResend } = await supabase
    .from("api_providers")
    .select("id")
    .eq("name", "Resend")
    .single();

  if (existingResend) {
    console.log("✅ Resend existe déjà dans api_providers");
  } else {
    // Ajouter les nouveaux providers
    const providers = [
      {
        name: "Resend",
        category: "email",
        pricing_model: "tiered",
        status: "active",
        metadata: {
          free_quota: 3000,
          daily_limit: 100,
          docs: "https://resend.com/docs",
          test_address: "onboarding@resend.dev",
        },
      },
      {
        name: "SendGrid",
        category: "email",
        pricing_model: "tiered",
        status: "inactive",
        metadata: {
          free_quota: 100,
          docs: "https://docs.sendgrid.com",
        },
      },
      {
        name: "Google Maps",
        category: "maps",
        pricing_model: "per_request",
        status: "inactive",
        metadata: {
          docs: "https://developers.google.com/maps",
        },
      },
      {
        name: "France Identité",
        category: "kyc",
        pricing_model: "free",
        status: "inactive",
        metadata: {
          docs: "https://franceconnect.gouv.fr",
        },
      },
    ];

    for (const provider of providers) {
      const { error } = await supabase.from("api_providers").upsert(provider, {
        onConflict: "name",
      });

      if (error) {
        console.error(`❌ Erreur ajout ${provider.name}:`, error.message);
      } else {
        console.log(`✅ Provider ajouté: ${provider.name}`);
      }
    }
  }

  // 2. Lister tous les providers
  const { data: allProviders, error: listError } = await supabase
    .from("api_providers")
    .select("id, name, category, status")
    .order("category");

  if (listError) {
    console.error("❌ Erreur liste providers:", listError.message);
  } else {
    console.log("\n📋 Providers disponibles:");
    console.table(allProviders);
  }

  // 3. Vérifier les colonnes de api_credentials
  const { data: credentials, error: credError } = await supabase
    .from("api_credentials")
    .select("*")
    .limit(1);

  if (credError) {
    console.error("\n⚠️ Table api_credentials:", credError.message);
    console.log("\n📝 Exécutez cette requête dans Supabase Dashboard > SQL Editor:");
    console.log(`
-- Ajouter les colonnes manquantes
ALTER TABLE api_credentials ADD COLUMN IF NOT EXISTS external_key_encrypted TEXT;
ALTER TABLE api_credentials ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE api_credentials ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';
ALTER TABLE api_credentials ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE api_credentials ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE api_credentials ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ;
ALTER TABLE api_credentials ADD COLUMN IF NOT EXISTS key_hash TEXT;
ALTER TABLE api_credentials ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';
    `);
  } else {
    console.log("\n✅ Table api_credentials accessible");
    
    // Vérifier si les colonnes existent
    const sample = credentials?.[0] || {};
    const requiredColumns = ["external_key_encrypted", "name", "config", "is_active"];
    const missingColumns = requiredColumns.filter((col) => !(col in sample));
    
    if (missingColumns.length > 0 && credentials?.length === 0) {
      console.log("ℹ️ Aucune credential existante, colonnes à vérifier manuellement");
    } else if (missingColumns.length > 0) {
      console.log(`⚠️ Colonnes manquantes: ${missingColumns.join(", ")}`);
    }
  }

  console.log("\n✅ Migration terminée !");
}

runMigration().catch(console.error);

