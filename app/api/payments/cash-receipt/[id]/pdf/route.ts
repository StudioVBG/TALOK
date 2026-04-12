export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/payments/cash-receipt/[id]/pdf
 *
 * Génère l'attestation PDF d'un reçu de paiement en espèces.
 * Accessible au propriétaire, au locataire et à l'admin. L'attestation
 * n'est disponible qu'une fois les deux signatures collectées (status =
 * 'signed' | 'sent' | 'archived') — avant ça, on renvoie 409 avec un
 * message explicite.
 *
 * Conformité : art. 21 loi n°89-462 du 6 juillet 1989 et décret n°2015-587
 * du 6 mai 2015.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { buildCashReceiptAttestationPDF } from "@/lib/documents/cash-receipt-attestation-pdf";

const AVAILABLE_STATUSES = new Set(["signed", "sent", "archived"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const { data: receipt, error } = await serviceClient
      .from("cash_receipts")
      .select(
        `
        id,
        receipt_number,
        amount,
        amount_words,
        periode,
        status,
        owner_id,
        tenant_id,
        owner_signature,
        tenant_signature,
        owner_signed_at,
        tenant_signed_at,
        notes,
        owner:profiles!cash_receipts_owner_id_fkey(id, prenom, nom),
        tenant:profiles!cash_receipts_tenant_id_fkey(id, prenom, nom),
        property:properties(id, adresse_complete)
      `,
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[cash-receipt PDF] Erreur lecture reçu:", error);
      return NextResponse.json(
        { error: "Erreur lors de la récupération du reçu" },
        { status: 500 },
      );
    }

    if (!receipt) {
      return NextResponse.json({ error: "Reçu non trouvé" }, { status: 404 });
    }

    // Autorisation : owner, tenant ou admin
    const receiptAny = receipt as any;
    const isOwner = receiptAny.owner_id === profile.id;
    const isTenant = receiptAny.tenant_id === profile.id;
    const isAdmin = profile.role === "admin";

    if (!isOwner && !isTenant && !isAdmin) {
      return NextResponse.json(
        { error: "Accès refusé à ce reçu" },
        { status: 403 },
      );
    }

    // L'attestation n'est délivrable qu'après les deux signatures
    if (!AVAILABLE_STATUSES.has(receiptAny.status)) {
      return NextResponse.json(
        {
          error:
            "L'attestation n'est disponible qu'une fois les deux signatures enregistrées.",
          status: receiptAny.status,
        },
        { status: 409 },
      );
    }

    const ownerName = formatPersonName(receiptAny.owner);
    const tenantName = formatPersonName(receiptAny.tenant);
    const propertyAddress =
      receiptAny.property?.adresse_complete ?? "Adresse non renseignée";

    const pdfBytes = await buildCashReceiptAttestationPDF({
      receiptNumber: receiptAny.receipt_number ?? "—",
      amount: Number(receiptAny.amount ?? 0),
      amountWords: receiptAny.amount_words ?? null,
      periode: receiptAny.periode ?? "",
      propertyAddress,
      ownerName,
      tenantName,
      ownerSignatureBase64: receiptAny.owner_signature ?? null,
      tenantSignatureBase64: receiptAny.tenant_signature ?? null,
      ownerSignedAt: receiptAny.owner_signed_at ?? null,
      tenantSignedAt: receiptAny.tenant_signed_at ?? null,
      notes: receiptAny.notes ?? null,
    });

    const filename = `attestation-paiement-especes-${
      receiptAny.receipt_number ?? receiptAny.id
    }.pdf`;

    return new NextResponse(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err: unknown) {
    console.error("[cash-receipt PDF] Erreur génération:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Erreur lors de la génération du PDF",
      },
      { status: 500 },
    );
  }
}

function formatPersonName(row: { prenom?: string | null; nom?: string | null } | null | undefined): string {
  if (!row) return "—";
  const full = `${row.prenom ?? ""} ${row.nom ?? ""}`.trim();
  return full || "—";
}
