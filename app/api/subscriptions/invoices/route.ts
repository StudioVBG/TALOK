export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/subscriptions/invoices
 * Récupère les factures de l'utilisateur
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "12");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Récupérer les factures
    const { data: invoices, error, count } = await supabase
      .from("subscription_invoices")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      invoices: invoices || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    // Détecter les erreurs d'authentification (AuthApiError de Supabase)
    if (error && typeof error === 'object' && 'name' in error && (error as any).name === 'AuthApiError') {
      console.error("[Invoices GET] Auth error:", (error as Error).message);
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    console.error("[Invoices GET]", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

