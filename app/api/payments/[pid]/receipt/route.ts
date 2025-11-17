import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/payments/[pid]/receipt - Télécharger la quittance PDF d'un paiement
 */
export async function GET(
  request: Request,
  { params }: { params: { pid: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le paiement
    const { data: payment } = await supabase
      .from("payments")
      .select(`
        *,
        invoice:invoices!inner(
          id,
          lease_id,
          periode,
          montant_total,
          lease:leases!inner(
            id,
            property:properties!inner(owner_id)
          )
        )
      `)
      .eq("id", params.pid as any)
      .single();

    if (!payment) {
      return NextResponse.json(
        { error: "Paiement non trouvé" },
        { status: 404 }
      );
    }

    const paymentData = payment as any;

    // Vérifier les permissions
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;

    const { data: roommate } = await supabase
      .from("roommates")
      .select("id")
      .eq("lease_id", paymentData.invoice.lease_id)
      .eq("user_id", user.id as any)
      .maybeSingle();

    const hasAccess = roommate || paymentData.invoice.lease.property.owner_id === profileData?.id;

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Vérifier si le paiement a réussi
    if (paymentData.statut !== "succeeded") {
      return NextResponse.json(
        { error: "Le paiement n'a pas réussi" },
        { status: 400 }
      );
    }

    // Récupérer ou générer la quittance
    const { data: receipt } = await supabase
      .from("documents")
      .select("*")
      .eq("type", "quittance" as any)
      .eq("lease_id", paymentData.invoice.lease_id)
      .eq("metadata->>invoice_id", paymentData.invoice.id)
      .maybeSingle();

    if (receipt) {
      const receiptData = receipt as any;
      // Générer une URL signée
      const { data: signedUrl } = await supabase.storage
        .from("documents")
        .createSignedUrl(receiptData.storage_path, 3600);

      return NextResponse.json({ url: signedUrl?.signedUrl, receipt: receiptData });
    }

    // Générer la quittance si elle n'existe pas
    // TODO: Appeler l'Edge Function generate-pdf
    const receiptUrl = await generateReceiptPDF(supabase, paymentData);

    return NextResponse.json({ url: receiptUrl });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

async function generateReceiptPDF(supabase: any, payment: any): Promise<string> {
  // TODO: Appeler l'Edge Function generate-pdf
  // Pour l'instant, retourner une URL mock
  return "https://mock-receipt-url.com";
}





