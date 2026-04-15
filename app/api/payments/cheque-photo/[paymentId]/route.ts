export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { STORAGE_BUCKETS } from "@/lib/config/storage-buckets";

/**
 * GET /api/payments/cheque-photo/[paymentId]
 *   ?redirect=1 → 302 vers la signed URL (cas clic vignette)
 *   (par défaut) → JSON { url } (cas affichage thumbnail <img>)
 *
 * Génère une URL signée (15 min) pour la photo de chèque attachée au
 * paiement. Autorise :
 *   - l'admin
 *   - le propriétaire (owner_id de la facture liée)
 *   - le locataire de la facture (peut avoir besoin de prouver un
 *     paiement lors d'un contentieux)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: payment } = await serviceClient
      .from("payments")
      .select("id, invoice_id, cheque_photo_path")
      .eq("id", paymentId)
      .maybeSingle();

    const paymentData = payment as
      | { id: string; invoice_id: string; cheque_photo_path: string | null }
      | null;

    if (!paymentData) {
      return NextResponse.json(
        { error: "Paiement non trouvé" },
        { status: 404 }
      );
    }

    if (!paymentData.cheque_photo_path) {
      return NextResponse.json(
        { error: "Aucune photo attachée à ce paiement" },
        { status: 404 }
      );
    }

    const { data: invoice } = await serviceClient
      .from("invoices")
      .select("id, owner_id, tenant_id")
      .eq("id", paymentData.invoice_id)
      .maybeSingle();

    const invoiceData = invoice as
      | { id: string; owner_id: string | null; tenant_id: string | null }
      | null;

    if (!invoiceData) {
      return NextResponse.json(
        { error: "Facture non trouvée" },
        { status: 404 }
      );
    }

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const profileData = profile as { id: string; role: string } | null;

    const isAdmin = profileData?.role === "admin";
    const isOwner = !!profileData?.id && profileData.id === invoiceData.owner_id;
    const isTenant = !!profileData?.id && profileData.id === invoiceData.tenant_id;

    if (!isAdmin && !isOwner && !isTenant) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const { data: signed, error: signedError } = await serviceClient.storage
      .from(STORAGE_BUCKETS.PAYMENT_PROOFS)
      .createSignedUrl(paymentData.cheque_photo_path, 900); // 15 min

    if (signedError || !signed?.signedUrl) {
      console.error("[cheque-photo:get] createSignedUrl error:", signedError);
      return NextResponse.json(
        { error: "Impossible de générer l'URL d'accès" },
        { status: 500 }
      );
    }

    const url = new URL(request.url);
    if (url.searchParams.get("redirect") === "1") {
      return NextResponse.redirect(signed.signedUrl);
    }

    return NextResponse.json({ url: signed.signedUrl });
  } catch (error: unknown) {
    console.error("[cheque-photo:get] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
