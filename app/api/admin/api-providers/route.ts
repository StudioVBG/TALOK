export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { requireAdmin } from "@/lib/helpers/auth-helper";
import { NextResponse } from "next/server";

/**
 * GET /api/admin/api-providers - Lister tous les providers API disponibles
 */
export async function GET(request: Request) {
  try {
    const { error: authError, supabase } = await requireAdmin(request);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

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
