export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Route: Gestion du cache des clés API
 * DELETE /api/admin/api-keys/cache - Vider le cache
 * GET /api/admin/api-keys/cache/status - Statut des providers
 */

import { requireAdmin } from "@/lib/helpers/auth-helper";
import { NextResponse } from "next/server";
import { apiKeysService } from "@/lib/services/api-keys.service";

/**
 * DELETE /api/admin/api-keys/cache - Vider le cache des clés API
 * Utile après rotation d'une clé
 */
export async function DELETE(request: Request) {
  try {
    const { error: authError, user, supabase } = await requireAdmin(request);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

    // Récupérer le provider à vider (optionnel)
    const url = new URL(request.url);
    const provider = url.searchParams.get("provider") as any;

    // Vider le cache
    apiKeysService.clearCache(provider || undefined);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user!.id,
      action: "api_keys_cache_cleared",
      entity_type: "api_credential",
      metadata: { provider: provider || "all" },
    });

    return NextResponse.json({
      success: true,
      message: provider
        ? `Cache vidé pour ${provider}`
        : "Cache entièrement vidé",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/api-keys/cache - Statut des providers
 */
export async function GET(request: Request) {
  try {
    const { error: authError } = await requireAdmin(request);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }

    // Récupérer le statut de tous les providers
    const status = await apiKeysService.getProvidersStatus();

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
