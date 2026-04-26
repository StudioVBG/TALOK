export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { generateWorkOrderInvoicePdf } from "@/lib/pdf/work-order-invoice-pdf";
import { resolveWorkOrderTVA } from "@/lib/work-orders/tva-travaux";

/**
 * GET /api/work-orders/[id]/invoice-pdf
 *
 * Génère et retourne la facture PDF d'une intervention. Lecture pour
 * propriétaire (concerné) et prestataire (émetteur).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError) throw new ApiError(authError.status || 401, authError.message);
    if (!user) throw new ApiError(401, "Non authentifié");

    const { id: workOrderId } = await context.params;
    const serviceClient = getServiceClient();

    // 1. Profil + role
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) throw new ApiError(404, "Profil non trouvé");
    const profileRow = profile as { id: string; role: string };

    // 2. Charger work order + relations nécessaires
    const { data: wo } = await serviceClient
      .from("work_orders")
      .select(
        "id, property_id, provider_id, accepted_quote_id, completed_at, title, description",
      )
      .eq("id", workOrderId)
      .maybeSingle();
    if (!wo) throw new ApiError(404, "Intervention introuvable");
    const workOrder = wo as {
      id: string;
      property_id: string;
      provider_id: string | null;
      accepted_quote_id: string | null;
      completed_at: string | null;
      title: string | null;
      description: string | null;
    };

    // 3. Vérifier accès (owner du bien OU le prestataire OU admin)
    const { data: property } = await serviceClient
      .from("properties")
      .select("id, owner_id, adresse_complete, ville, code_postal, annee_construction")
      .eq("id", workOrder.property_id)
      .maybeSingle();
    const propertyRow = property as {
      id: string;
      owner_id: string;
      adresse_complete: string;
      ville: string;
      code_postal: string;
      annee_construction: number | null;
    } | null;
    if (!propertyRow) throw new ApiError(404, "Bien introuvable");

    const isOwner = propertyRow.owner_id === profileRow.id;
    const isProvider = workOrder.provider_id === profileRow.id;
    const isAdmin = profileRow.role === "admin";
    if (!isOwner && !isProvider && !isAdmin) {
      throw new ApiError(403, "Non autorisé");
    }

    // 4. Charger devis accepté + lignes
    if (!workOrder.accepted_quote_id) {
      throw new ApiError(409, "Pas de devis accepté pour cette intervention");
    }
    const { data: quote } = await serviceClient
      .from("provider_quotes")
      .select(
        "id, reference, total_amount, tax_rate, terms_and_conditions, valid_until, created_at",
      )
      .eq("id", workOrder.accepted_quote_id)
      .maybeSingle();
    if (!quote) throw new ApiError(404, "Devis introuvable");

    const { data: items } = await serviceClient
      .from("provider_quote_items")
      .select("description, quantity, unit, unit_price, tax_rate, sort_order")
      .eq("quote_id", workOrder.accepted_quote_id)
      .order("sort_order", { ascending: true });

    const quoteRow = quote as {
      id: string;
      reference: string | null;
      total_amount: number | string;
      tax_rate: number | string | null;
      terms_and_conditions: string | null;
      valid_until: string | null;
      created_at: string;
    };

    // 5. Charger prestataire (companies / profiles)
    const { data: providerProfile } = await serviceClient
      .from("profiles")
      .select("id, prenom, nom, email, telephone")
      .eq("id", workOrder.provider_id ?? "")
      .maybeSingle();
    const { data: providerEntity } = await serviceClient
      .from("provider_profiles")
      .select(
        "company_name, siret, vat_number, address, city, postal_code, vat_exempt",
      )
      .eq("profile_id", workOrder.provider_id ?? "")
      .maybeSingle();
    const provP = providerProfile as
      | { prenom: string | null; nom: string | null; email: string | null; telephone: string | null }
      | null;
    const provE = providerEntity as
      | {
          company_name: string | null;
          siret: string | null;
          vat_number: string | null;
          address: string | null;
          city: string | null;
          postal_code: string | null;
          vat_exempt: boolean | null;
        }
      | null;

    // 6. Charger client (owner)
    const { data: ownerProfile } = await serviceClient
      .from("profiles")
      .select("prenom, nom, email")
      .eq("id", propertyRow.owner_id)
      .maybeSingle();
    const ownerRow = ownerProfile as
      | { prenom: string | null; nom: string | null; email: string | null }
      | null;

    // 7. Référence légale TVA pour le footer
    const tva = resolveWorkOrderTVA({
      codePostal: propertyRow.code_postal,
      propertyBuildYear: propertyRow.annee_construction,
      workType: "entretien",
      isCommercial: false,
    });

    const invoiceNumber = `${quoteRow.reference || `WO-${workOrder.id.slice(0, 8).toUpperCase()}`}`;
    const invoiceDate = workOrder.completed_at?.split("T")[0] || new Date().toISOString().split("T")[0];

    const itemsList = (items || []).map((it: any) => ({
      description: it.description,
      quantity: Number(it.quantity),
      unit: it.unit,
      unitPriceCents: Math.round(Number(it.unit_price) * 100),
      taxRate: Number(it.tax_rate) / (Number(it.tax_rate) > 1 ? 100 : 1), // si 20 → 0.20, si 0.20 → 0.20
    }));

    const pdfBuffer = await generateWorkOrderInvoicePdf({
      invoiceNumber,
      invoiceDate,
      provider: {
        companyName:
          provE?.company_name ||
          [provP?.prenom, provP?.nom].filter(Boolean).join(" ") ||
          "Prestataire",
        contactName: [provP?.prenom, provP?.nom].filter(Boolean).join(" ") || null,
        address: provE?.address ?? null,
        city: provE?.city ?? null,
        postalCode: provE?.postal_code ?? null,
        siret: provE?.siret ?? null,
        vatNumber: provE?.vat_number ?? null,
        email: provP?.email ?? null,
        phone: provP?.telephone ?? null,
        isVatExempt: Boolean(provE?.vat_exempt),
      },
      client: {
        name: [ownerRow?.prenom, ownerRow?.nom].filter(Boolean).join(" ") || "Client",
      },
      property: {
        address: propertyRow.adresse_complete,
        city: propertyRow.ville,
        postalCode: propertyRow.code_postal,
      },
      items: itemsList,
      tvaReference: tva.reference,
      notes: quoteRow.terms_and_conditions,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="facture-${invoiceNumber}.pdf"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
