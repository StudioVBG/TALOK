/**
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

/**
 * GET /api/signatures/sessions/[sid] - Récupérer le statut d'une session de signature
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sid: string }> }
) {
  try {
    const { sid } = await params;
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // TODO: Récupérer la session depuis une table dédiée ou depuis les signatures
    // Pour l'instant, on simule
    const { data: signatures } = await supabaseClient
      .from("signatures")
      .select(`
        *,
        lease:leases(id, statut),
        signer:profiles!signatures_signer_profile_id_fkey(id, prenom, nom)
      `)
      .eq("id", sid as any)
      .maybeSingle();

    if (!signatures) {
      return NextResponse.json(
        { error: "Session non trouvée" },
        { status: 404 }
      );
    }

    const signatureData = signatures as any;

    // Vérifier les permissions
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    const hasAccess = signatureData.signer_profile_id === profileData?.id || 
      signatureData.lease?.property?.owner_id === profileData?.id;

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      session_id: sid,
      status: signatureData.signed_at ? "completed" : "pending",
      signature: signatureData,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





