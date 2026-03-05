export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { requireAdmin } from "@/lib/helpers/auth-helper";
import { NextResponse } from "next/server";

/**
 * POST /api/admin/providers/[id]/disable - Désactiver un fournisseur API
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error: authError, user, supabase } = await requireAdmin(request);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

    // Désactiver le provider
    const { data: provider, error } = await supabase
      .from("api_providers")
      .update({
        is_active: false,
        disabled_at: new Date().toISOString(),
        disabled_by: user!.id,
      } as any)
      .eq("id", id as any)
      .select()
      .single();

    if (error) throw error;

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user!.id,
      action: "provider_disabled",
      entity_type: "api_provider",
      entity_id: id,
    } as any);

    return NextResponse.json({ provider });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

