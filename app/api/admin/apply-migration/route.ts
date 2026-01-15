export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Route API pour appliquer la migration lease_signers
 * Accessible uniquement en développement ou avec un secret
 */

export async function POST(request: Request) {
  // Vérifier l'environnement ou le secret
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  
  const expectedSecret = process.env.MIGRATION_SECRET;

  // SECURITY: Ne jamais autoriser sans secret en production
  if (!expectedSecret) {
    console.error("[apply-migration] MIGRATION_SECRET non configuré");
    return NextResponse.json(
      { error: "Configuration manquante - MIGRATION_SECRET requis" },
      { status: 500 }
    );
  }

  if (process.env.NODE_ENV !== "development" && secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Configuration Supabase manquante" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const results: { step: string; success: boolean; error?: string }[] = [];

  // Migration 1: Vérifier si profile_id est nullable
  try {
    // On ne peut pas faire ALTER TABLE directement via le client Supabase
    // Mais on peut vérifier si les colonnes existent et tester les insertions
    
    // Test: essayer d'insérer sans profile_id pour voir si ça marche
    const { error: testError } = await supabase
      .from("lease_signers")
      .select("id, invited_email")
      .limit(1);

    if (testError) {
      results.push({ 
        step: "Vérification structure", 
        success: false, 
        error: testError.message 
      });
    } else {
      results.push({ step: "Vérification structure", success: true });
    }
  } catch (err: any) {
    results.push({ step: "Vérification structure", success: false, error: err.message });
  }

  // Retourner les résultats avec le SQL à exécuter manuellement
  const migrationSQL = `
-- =====================================================
-- MIGRATION: Correction lease_signers pour invitations
-- =====================================================

-- 1. Rendre profile_id nullable
ALTER TABLE lease_signers 
ALTER COLUMN profile_id DROP NOT NULL;

-- 2. Ajouter invited_email
ALTER TABLE lease_signers 
ADD COLUMN IF NOT EXISTS invited_email VARCHAR(255);

-- 3. Ajouter invited_at  
ALTER TABLE lease_signers 
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Ajouter invited_name
ALTER TABLE lease_signers 
ADD COLUMN IF NOT EXISTS invited_name VARCHAR(255);

-- 5. Index
CREATE INDEX IF NOT EXISTS idx_lease_signers_invited_email 
ON lease_signers(invited_email) 
WHERE invited_email IS NOT NULL;

-- Vérification
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'lease_signers'
ORDER BY ordinal_position;
`;

  return NextResponse.json({
    message: "Migration SQL prête",
    results,
    instructions: [
      "1. Ouvrez https://supabase.com/dashboard",
      "2. Sélectionnez votre projet",
      "3. Allez dans SQL Editor",
      "4. Créez une nouvelle requête",
      "5. Collez le SQL ci-dessous",
      "6. Cliquez sur Run",
    ],
    sql: migrationSQL,
    dashboardUrl: `https://supabase.com/dashboard/project/${supabaseUrl?.replace("https://", "").replace(".supabase.co", "")}/sql/new`,
  });
}

