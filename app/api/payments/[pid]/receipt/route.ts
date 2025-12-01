// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { generateReceiptPDF, type ReceiptData } from "@/lib/services/receipt-generator";

/**
 * GET /api/payments/[pid]/receipt - Télécharger la quittance PDF d'un paiement
 */
export async function GET(
  request: NextRequest,
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

    const paymentId = params.pid;

    // Récupérer le paiement avec toutes les informations nécessaires
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select(`
        *,
        invoice:invoices!inner(
          id,
          lease_id,
          periode,
          montant_total,
          montant_loyer,
          montant_charges,
          owner_id,
          tenant_id,
          lease:leases!inner(
            id,
            property:properties!inner(
              id,
              owner_id,
              adresse_complete,
              ville,
              code_postal
            )
          )
        )
      `)
      .eq("id", paymentId as any)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { error: "Paiement non trouvé" },
        { status: 404 }
      );
    }

    const paymentData = payment as any;

    // Récupérer le profil utilisateur
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileData = profile as any;

    // Vérifier les permissions
    const { data: roommate } = await supabase
      .from("roommates")
      .select("id")
      .eq("lease_id", paymentData.invoice.lease_id)
      .eq("user_id", user.id)
      .maybeSingle();

    const isOwner = paymentData.invoice.lease.property.owner_id === profileData.id;
    const isTenant = paymentData.invoice.tenant_id === profileData.id || !!roommate;
    const isAdmin = profileData.role === "admin";

    if (!isOwner && !isTenant && !isAdmin) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Vérifier si le paiement a réussi
    if (paymentData.statut !== "succeeded") {
      return NextResponse.json(
        { error: "Le paiement n'a pas réussi, impossible de générer une quittance" },
        { status: 400 }
      );
    }

    // Récupérer les informations du propriétaire
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("prenom, nom")
      .eq("id", paymentData.invoice.owner_id)
      .single();

    const { data: ownerDetails } = await supabase
      .from("owner_profiles")
      .select("siret, adresse_facturation")
      .eq("profile_id", paymentData.invoice.owner_id)
      .single();

    // Récupérer les informations du locataire
    const { data: tenantProfile } = await supabase
      .from("profiles")
      .select("prenom, nom")
      .eq("id", paymentData.invoice.tenant_id)
      .single();

    // Construire les données pour la quittance
    const receiptData: ReceiptData = {
      ownerName: ownerProfile 
        ? `${ownerProfile.prenom || ""} ${ownerProfile.nom || ""}`.trim() || "Propriétaire"
        : "Propriétaire",
      ownerAddress: ownerDetails?.adresse_facturation || "",
      ownerSiret: ownerDetails?.siret || undefined,
      tenantName: tenantProfile 
        ? `${tenantProfile.prenom || ""} ${tenantProfile.nom || ""}`.trim() || "Locataire"
        : "Locataire",
      propertyAddress: paymentData.invoice.lease.property.adresse_complete || "",
      propertyCity: paymentData.invoice.lease.property.ville || "",
      propertyPostalCode: paymentData.invoice.lease.property.code_postal || "",
      period: paymentData.invoice.periode,
      rentAmount: Number(paymentData.invoice.montant_loyer) || 0,
      chargesAmount: Number(paymentData.invoice.montant_charges) || 0,
      totalAmount: Number(paymentData.montant) || Number(paymentData.invoice.montant_total) || 0,
      paymentDate: paymentData.date_paiement || new Date().toISOString().split("T")[0],
      paymentMethod: paymentData.moyen || "cb",
      invoiceId: paymentData.invoice.id,
      paymentId: paymentData.id,
      leaseId: paymentData.invoice.lease_id,
    };

    // Générer le PDF
    const pdfBytes = await generateReceiptPDF(receiptData);

    // Retourner le PDF
    const filename = `quittance-${receiptData.period}-${paymentId.slice(0, 8)}.pdf`;
    
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBytes.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("[receipt] Erreur:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
