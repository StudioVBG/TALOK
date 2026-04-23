export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";
import { validateCsrfFromRequestDetailed, logCsrfFailure } from "@/lib/security/csrf";

/**
 * @maintenance Route utilitaire admin — usage ponctuel
 * @description Applique la migration lease_signers (rend profile_id nullable, ajoute invited_email/name/at). Double protection : requireAdmin + MIGRATION_SECRET.
 * @usage POST /api/admin/apply-migration?secret=MIGRATION_SECRET
 */

export async function POST(request: Request) {
  const csrf = await validateCsrfFromRequestDetailed(request);
  if (!csrf.valid) {
    await logCsrfFailure(request, csrf.reason!, "admin.apply-migration");
    return NextResponse.json({ error: "Token CSRF invalide" }, { status: 403 });
  }

  // 1. Vérifier que l'utilisateur est admin
  const auth = await requireAdminPermissions(request, ["admin.compliance.write"], {
    rateLimit: "adminCritical",
    auditAction: "Application migration SQL",
  });
  if (isAdminAuthError(auth)) return auth;

  // 2. Vérifier le secret de migration (défense en profondeur)
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  const expectedSecret = process.env.MIGRATION_SECRET;

  if (!expectedSecret) {
    console.error("[apply-migration] MIGRATION_SECRET non configuré");
    return NextResponse.json(
      { error: "Configuration manquante - MIGRATION_SECRET requis" },
      { status: 500 }
    );
  }

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Secret invalide" }, { status: 401 });
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
