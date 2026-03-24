export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { generateInvoicePDF, type InvoiceData } from "@/lib/services/invoice-pdf-generator";

/**
 * GET /api/invoices/[id]/pdf
 *
 * Generates and returns a professional PDF for the specified invoice.
 * Accessible by the owner or tenant linked to the invoice.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invoiceId } = await params;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const serviceClient = getServiceClient();

    // Fetch invoice with related data
    const { data: invoice, error: invoiceError } = await serviceClient
      .from("invoices")
      .select(`
        id,
        lease_id,
        owner_id,
        tenant_id,
        periode,
        montant_loyer,
        montant_charges,
        montant_total,
        statut,
        invoice_number,
        period_start,
        period_end,
        due_date,
        date_echeance,
        generated_at,
        created_at,
        type,
        metadata
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
    }

    const inv = invoice as any;

    // Authorization: user must be owner or tenant
    if (profile.id !== inv.owner_id && profile.id !== inv.tenant_id) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Fetch owner profile
    const { data: ownerProfile } = await serviceClient
      .from("profiles")
      .select("full_name, email, adresse")
      .eq("id", inv.owner_id)
      .single();

    // Fetch tenant profile
    const { data: tenantProfile } = await serviceClient
      .from("profiles")
      .select("full_name, email")
      .eq("id", inv.tenant_id)
      .single();

    // Fetch property via lease
    const { data: lease } = await serviceClient
      .from("leases")
      .select("property:properties!leases_property_id_fkey(adresse_complete, ville, code_postal)")
      .eq("id", inv.lease_id)
      .single();

    const property = (lease as any)?.property;
    const owner = ownerProfile as any;
    const tenant = tenantProfile as any;

    const metadata = inv.metadata ?? {};
    const isInitialInvoice =
      inv.type === "initial_invoice" || metadata.type === "initial_invoice";

    const invoiceData: InvoiceData = {
      ownerName: owner?.full_name || "Propriétaire",
      ownerAddress: owner?.adresse || "",
      tenantName: tenant?.full_name || "Locataire",
      propertyAddress: property?.adresse_complete || "",
      propertyCity: property?.ville || "",
      propertyPostalCode: property?.code_postal || "",
      invoiceNumber: inv.invoice_number || `FAC-${invoiceId.slice(0, 8).toUpperCase()}`,
      invoiceDate: inv.generated_at || inv.created_at || new Date().toISOString(),
      dueDate: inv.due_date || inv.date_echeance || new Date().toISOString(),
      periodStart: inv.period_start || inv.periode + "-01",
      periodEnd:
        inv.period_end ||
        new Date(
          new Date(inv.periode + "-01").getFullYear(),
          new Date(inv.periode + "-01").getMonth() + 1,
          0
        )
          .toISOString()
          .split("T")[0],
      montantLoyer: Number(inv.montant_loyer) || 0,
      montantCharges: Number(inv.montant_charges) || 0,
      depotDeGarantie: Number(metadata.deposit_amount) || 0,
      montantTotal: Number(inv.montant_total) || 0,
      isProrated: Boolean(metadata.is_prorated),
      prorataDays: metadata.prorata_days ? Number(metadata.prorata_days) : undefined,
      totalDaysInMonth: metadata.total_days ? Number(metadata.total_days) : undefined,
      isInitialInvoice,
      leaseId: inv.lease_id,
      invoiceId: inv.id,
      statut: inv.statut || "sent",
    };

    const pdfBytes = await generateInvoicePDF(invoiceData);

    const filename = `facture-${invoiceData.invoiceNumber}.pdf`;

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBytes.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[invoice-pdf] Error:", String(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
