export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Route: Gestion du cache des clés API
 * DELETE /api/admin/api-keys/cache - Vider le cache
 * GET /api/admin/api-keys/cache/status - Statut des providers
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiKeysService } from "@/lib/services/api-keys.service";

/**
 * DELETE /api/admin/api-keys/cache - Vider le cache des clés API
 * Utile après rotation d'une clé
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier que c'est un admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if ((profile as any)?.role !== "admin") {
      return NextResponse.json(
        { error: "Seul l'admin peut vider le cache" },
        { status: 403 }
      );
    }

    // Récupérer le provider à vider (optionnel)
    const url = new URL(request.url);
    const provider = url.searchParams.get("provider") as any;

    // Vider le cache
    apiKeysService.clearCache(provider || undefined);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/api-keys/cache - Statut des providers
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Vérifier que c'est un admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if ((profile as any)?.role !== "admin") {
      return NextResponse.json(
        { error: "Seul l'admin peut voir le statut" },
        { status: 403 }
      );
    }

    // Récupérer le statut de tous les providers
    const status = await apiKeysService.getProvidersStatus();

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

