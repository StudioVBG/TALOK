// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getRateLimiterByUser, rateLimitPresets } from "@/lib/middleware/rate-limit";

/**
 * POST /api/edl/[id]/sign - Signer un EDL
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Rate limiting pour les signatures
    const limiter = getRateLimiterByUser(rateLimitPresets.api);
    const limitResult = limiter(user.id);
    if (!limitResult.allowed) {
      return NextResponse.json(
        {
          error: "Trop de requêtes. Veuillez réessayer plus tard.",
          resetAt: limitResult.resetAt,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitPresets.api.maxRequests.toString(),
            "X-RateLimit-Remaining": limitResult.remaining.toString(),
            "X-RateLimit-Reset": limitResult.resetAt.toString(),
          },
        }
      );
    }

    // Récupérer le profil pour déterminer le rôle
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id as any)
      .single();

    if (!profile || !("role" in profile)) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    const signerRole =
      (profile as any).role === "owner" ? "owner" : "tenant";

    // Créer la signature
    const { data: signature, error } = await supabase
      .from("edl_signatures")
      .insert({
        // @ts-ignore - Supabase typing issue
        edl_id: params.id,
        signer_user: user.id as any,
        signer_role: signerRole,
        signed_at: new Date().toISOString(),
        ip_inet: request.headers.get("x-forwarded-for") || null,
        user_agent: request.headers.get("user-agent") || null,
      } as any)
      .select()
      .single();

    if (error) throw error;

    // Vérifier si tous les signataires ont signé pour mettre à jour le statut
    const { data: allSignatures } = await supabase
      .from("edl_signatures")
      .select("signer_role")
      // @ts-ignore - Supabase typing issue
      .eq("edl_id", params.id as any);

    const hasOwner = allSignatures?.some((s: any) => s.signer_role === "owner");
    const hasTenant = allSignatures?.some((s: any) => s.signer_role === "tenant");

    if (hasOwner && hasTenant) {
      await supabase
        .from("edl")
        .update({ status: "signed" } as any)
        .eq("id", params.id as any);

      // Émettre un événement
      await supabase.from("outbox").insert({
        event_type: "Inspection.Signed",
        payload: {
          edl_id: params.id,
          all_signed: true,
        },
      } as any);
    }

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "edl_signed",
      entity_type: "edl",
      entity_id: params.id,
      metadata: { signer_role: signerRole },
    } as any);

    return NextResponse.json({ signature });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

