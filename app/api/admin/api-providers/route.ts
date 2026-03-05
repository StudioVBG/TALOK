export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireAdminPermissions, isAdminAuthError } from "@/lib/middleware/admin-rbac";

/**
 * GET /api/admin/api-providers - Lister tous les providers API disponibles
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAdminPermissions(request, ["admin.integrations.read"], {
      rateLimit: "adminStandard",
    });
    if (isAdminAuthError(auth)) return auth;

    const supabase = await createClient();

    const { data: providers, error } = await supabase
      .from("api_providers")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ providers: providers || [] });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





