export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";

/**
 * API Route pour appliquer les corrections RLS admin
 * POST /api/admin/fix-rls
 * 
 * Cette route appelle la fonction RPC apply_admin_rls_fixes()
 */

export async function POST(request: Request) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.compliance.write"], {
      rateLimit: "adminCritical",
      auditAction: "fix-rls",
    });
    if (isAdminAuthError(auth)) return auth;

    const supabase = await createClient();

    // Appeler la fonction RPC qui applique les corrections
    // Cette fonction vérifie elle-même que l'utilisateur est admin
    const { data, error } = await supabase.rpc("apply_admin_rls_fixes");

    if (error) {
      console.error("Erreur RPC apply_admin_rls_fixes:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Erreur lors de l'application des corrections" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Erreur fix-rls:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

