export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { generateReceiptPDF } from "@/lib/services/receipt-generator";
import { ensureReceiptDocument } from "@/lib/services/final-documents.service";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * GET /api/invoices/[id]/receipt
 *
 * Génère et retourne la quittance PDF d'une facture payée.
 * Génération à la volée depuis les données de la facture — pas de document stocké requis.
 *
 * Conditions :
 * - Facture doit exister et être accessible par l'utilisateur
 * - Facture doit être payée (statut "paid" ou montant_paye >= montant_total)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const serviceClient = getServiceClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // 1. Récupérer la facture avec toutes les données nécessaires
    const { data: invoice, error: invoiceError } = await serviceClient
      .from("invoices")
      .select("id,statut,periode,montant_loyer,montant_charges,montant_total,date_paiement,lease_id,tenant_id,owner_id,issuer_nom,issuer_adresse,issuer_siret")
      .eq("id", id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
    }

    const inv = invoice as any;

    // 2. Vérifier les droits d'accès
    const isOwner = inv.owner_id === profile.id;
    const isTenant = inv.tenant_id === profile.id;
    const isAdmin = profile.role === "admin" || profile.role === "platform_admin";

    if (!isOwner && !isTenant && !isAdmin) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // 3. Vérifier que la facture est payée
    if (inv.statut !== "paid") {
      return NextResponse.json(
        { error: "La quittance n'est disponible que pour les factures payées" },
        { status: 400 }
      );
    }

    // 4. Récupérer les données liées en parallèle
    const [
      paymentsResult,
      ownerProfileResult,
      ownerResult,
      tenantResult,
      leaseResult,
    ] = await Promise.all([
      serviceClient
        .from("payments")
        .select("id, montant, moyen, date_paiement, statut")
        .eq("invoice_id", id)
        .in("statut", ["confirmed", "paid", "succeeded"])
        .order("date_paiement", { ascending: false })
        .limit(1),
      serviceClient
        .from("owner_profiles")
        .select("adresse_facturation, adresse_siege, siret, raison_sociale, type")
        .eq("profile_id", inv.owner_id)
        .maybeSingle(),
      serviceClient
        .from("profiles")
        .select("prenom, nom")
        .eq("id", inv.owner_id)
        .single(),
      serviceClient
        .from("profiles")
        .select("prenom, nom")
        .eq("id", inv.tenant_id)
        .maybeSingle(),
      serviceClient
        .from("leases")
        .select("property_id, unit_id")
        .eq("id", inv.lease_id)
        .single(),
    ]);

    const lastPayment = paymentsResult.data?.[0];
    const ownerProfile = ownerProfileResult.data;
    const ownerData = ownerResult.data as any;
    const tenantData = tenantResult.data as any;

    // Récupérer la propriété via le bail
    let propertyData: any = null;
    if (leaseResult.data?.property_id) {
      const { data: prop } = await serviceClient
        .from("properties")
        .select("adresse_complete, ville, code_postal")
        .eq("id", leaseResult.data.property_id)
        .single();
      propertyData = prop;
    }

    // Priorité : champs issuer déjà stockés sur la facture (snapshot au moment de l'émission)
    const ownerAddress = inv.issuer_adresse || ownerProfile?.adresse_facturation || ownerProfile?.adresse_siege || "";
    const isSociete = ownerProfile?.type === "societe" || ownerProfile?.type === "sci";
    const ownerName = inv.issuer_nom ||
      (isSociete && ownerProfile?.raison_sociale ? ownerProfile.raison_sociale : null) ||
      `${ownerData?.prenom || ""} ${ownerData?.nom || ""}`.trim() || "Propriétaire";

    const tenantName = `${tenantData?.prenom || ""} ${tenantData?.nom || ""}`.trim() || "Locataire";
    const propertyAddress = propertyData?.adresse_complete || "Adresse non renseignée";
    const propertyCity = propertyData?.ville || "";
    const propertyPostalCode = propertyData?.code_postal || "";

    // 6. Construire les dates de période ALUR
    let periodeDebut: string | undefined;
    let periodeFin: string | undefined;
    if (inv.periode) {
      const [year, month] = inv.periode.split("-").map(Number);
      const debut = new Date(year, month - 1, 1);
      const fin = new Date(year, month, 0); // dernier jour du mois
      periodeDebut = format(debut, "yyyy-MM-dd");
      periodeFin = format(fin, "yyyy-MM-dd");
    }

    const paymentDate = lastPayment?.date_paiement
      ? lastPayment.date_paiement.substring(0, 10)
      : inv.date_paiement?.substring(0, 10) || new Date().toISOString().substring(0, 10);

    // 7. Générer le PDF
    const pdfBytes = await generateReceiptPDF({
      ownerName,
      ownerAddress,
      ownerSiret: inv.issuer_siret || ownerProfile?.siret || undefined,
      tenantName,
      propertyAddress,
      propertyCity,
      propertyPostalCode,
      period: inv.periode || "",
      periodeDebut,
      periodeFin,
      rentAmount: inv.montant_loyer || 0,
      chargesAmount: inv.montant_charges || 0,
      totalAmount: inv.montant_total || (inv.montant_loyer || 0) + (inv.montant_charges || 0),
      paymentDate,
      paymentMethod: lastPayment?.moyen || "virement",
      invoiceId: id,
      paymentId: lastPayment?.id || id,
      leaseId: inv.lease_id || "",
      dateEmission: new Date().toISOString().substring(0, 10),
    });

    // 8. Persistance fire-and-forget : si la quittance n'est pas encore stockée
    //    en base (cas Bug 7 : facture marquée payée hors webhook Stripe), on
    //    déclenche la création du document via `ensureReceiptDocument` pour que
    //    la page /tenant/documents la voie. La réponse au client n'attend pas.
    if (lastPayment?.id) {
      void ensureReceiptDocument(serviceClient as any, lastPayment.id).catch(
        (err) =>
          console.error(
            "[Receipt] ensureReceiptDocument fire-and-forget failed:",
            err?.message ?? err
          )
      );
    }

    // 9. Retourner le PDF
    const filename = `quittance_${inv.periode || "loyer"}.pdf`;
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });

  } catch (error: unknown) {
    console.error("[Receipt] Erreur génération quittance:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération de la quittance" },
      { status: 500 }
    );
  }
}
