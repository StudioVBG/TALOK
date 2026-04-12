export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";
import { handleLeaseFullySigned } from "@/lib/services/lease-post-signature.service";

/**
 * @maintenance Route utilitaire admin — usage ponctuel
 * @description Re-génère le document HTML signé d'un bail déjà scellé (mode force).
 * Réservé aux admins. Utilise le mode force de handleLeaseFullySigned
 * pour bypasser la garde d'idempotence et re-générer proprement.
 */
export async function POST(request: Request) {
  const { error: authError, user, supabase } = await requireAdmin(request);

  if (authError || !supabase) {
    return NextResponse.json(
      { error: authError?.message || "Accès non autorisé" },
      { status: authError?.status || 403 }
    );
  }

  try {
    const body = await request.json();
    const { lease_id } = body;

    if (!lease_id || typeof lease_id !== "string") {
      return NextResponse.json({ error: "lease_id requis" }, { status: 400 });
    }

    const { data: lease } = await supabase
      .from("leases")
      .select("id, statut, sealed_at, signed_pdf_path")
      .eq("id", lease_id)
      .single();

    if (!lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    const result = await handleLeaseFullySigned(lease_id, { force: true });

    try {
      await supabase.from("audit_log").insert({
        user_id: user!.id,
        action: "admin_reseal_lease",
        entity_type: "lease",
        entity_id: lease_id,
        metadata: {
          previous_sealed_at: lease.sealed_at,
          previous_signed_pdf_path: lease.signed_pdf_path,
          new_pdf_path: result.pdfPath,
          new_sealed_at: result.sealedAt,
          pdf_stored: result.pdfStored,
          sealed: result.sealed,
        },
      } as any);
    } catch {
      // audit non bloquant
    }

    return NextResponse.json({
      success: result.pdfStored && result.sealed,
      message: result.pdfStored && result.sealed
        ? "Document re-généré et bail re-scellé avec succès"
        : "Re-génération partielle — vérifier les logs",
      result,
    });
  } catch (error: unknown) {
    console.error("[admin/reseal-lease] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
