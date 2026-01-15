export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { pdfService } from "@/lib/services/pdf.service";

async function generateReceiptPDF(receipt: any): Promise<string | null> {
  try {
    // Récupérer les informations nécessaires pour le PDF
    const supabase = await createClient();
    const { data: invoice } = await supabase
      .from("invoices")
      .select(`
        *,
        lease:leases(
          property:properties(adresse_complete),
          tenant:lease_signers!inner(
            profile:profiles(prenom, nom)
          )
        )
      `)
      .eq("id", receipt.id as any)
      .single();

    if (!invoice) return null;

    const invoiceData = invoice as any;
    const tenantName = invoiceData?.lease?.tenant?.[0]?.profile
      ? `${invoiceData.lease.tenant[0].profile.prenom} ${invoiceData.lease.tenant[0].profile.nom}`
      : "Locataire";

    const pdf = await pdfService.generateReceiptPDF({
      invoiceId: receipt.id,
      periode: receipt.periode,
      montant_total: receipt.montant_total,
      montant_loyer: receipt.montant_loyer,
      montant_charges: receipt.montant_charges,
      tenantName,
      propertyAddress: invoiceData?.lease?.property?.adresse_complete || "",
      ownerName: "Propriétaire", // À récupérer depuis la DB
      ownerAddress: "", // À récupérer depuis la DB
      paidAt: receipt.payments?.[0]?.date_paiement || receipt.updated_at,
      paymentMethod: receipt.payments?.[0]?.moyen || "Non spécifié",
    });

    return pdf.url;
  } catch (error) {
    console.error("Erreur génération PDF quittance:", error);
    return null;
  }
}

/**
 * GET /api/leases/[id]/receipts - Récupérer les quittances d'un bail
 */
export async function GET(
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

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    // Vérifier que l'utilisateur est locataire du bail
    const { data: roommate } = await supabase
      .from("roommates")
      .select("id")
      .eq("lease_id", params.id as any)
      .eq("user_id", user.id as any)
      .is("left_on", null)
      .single();

    if (!roommate) {
      // Vérifier via lease_signers
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id as any)
        .single();

      if (profile) {
        const { data: signer } = await supabase
          .from("lease_signers")
          .select("id")
          .eq("lease_id", params.id as any)
          .eq("profile_id", (profile as any).id as any)
          .single();

        if (!signer) {
          return NextResponse.json(
            { error: "Non autorisé" },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "Non autorisé" },
          { status: 403 }
        );
      }
    }

    // Récupérer les factures payées (quittances)
    let query = supabase
      .from("invoices")
      .select(
        `
        *,
        payments:payments(*)
      `
      )
      .eq("lease_id", params.id as any)
      .eq("statut", "paid" as any)
      .order("periode", { ascending: false });

    if (month) {
      query = query.eq("periode", month as any);
    }

    const { data: receipts, error } = await query;

    if (error) throw error;

    // Formater les quittances
    const formattedReceipts = await Promise.all(
      (receipts || []).map(async (receipt: any) => ({
        id: receipt.id,
        periode: receipt.periode,
        montant_total: receipt.montant_total,
        montant_loyer: receipt.montant_loyer,
        montant_charges: receipt.montant_charges,
        paid_at: receipt.payments?.[0]?.date_paiement || receipt.updated_at,
        payment_method: receipt.payments?.[0]?.moyen,
        pdf_url: await generateReceiptPDF(receipt).catch(() => null), // Générer le PDF de quittance
      }))
    );

    return NextResponse.json({ receipts: formattedReceipts });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

