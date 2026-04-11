export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/copro/assemblies/[assemblyId]/convocation-pdf?unit_id=X
 *
 * Retourne le HTML de la convocation pour un lot donné.
 * Le client convertit ensuite en PDF via html2pdf.js (côté client)
 * ou un job serveur via puppeteer (future enhancement).
 *
 * Si aucun unit_id fourni, retourne une convocation "modèle" sans destinataire.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAssemblyAccess } from "@/lib/helpers/syndic-auth";
import { generateConvocationHtml, type ConvocationPdfData } from "@/lib/pdf/syndic-templates";

interface RouteParams {
  params: { assemblyId: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const access = await requireAssemblyAccess(request, params.assemblyId);
  if (access instanceof NextResponse) return access;

  const { auth, assembly } = access;
  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unit_id");
  const format = searchParams.get("format") || "html"; // 'html' | 'json'

  try {
    // 1. Charger l'assemblée complète
    const { data: assemblyData, error: assemblyError } = await auth.serviceClient
      .from("copro_assemblies")
      .select("*")
      .eq("id", assembly.id)
      .single();

    if (assemblyError || !assemblyData) {
      return NextResponse.json({ error: "Assemblée introuvable" }, { status: 404 });
    }

    // 2. Charger le site
    const { data: site, error: siteError } = await auth.serviceClient
      .from("sites")
      .select(
        "name, address_line1, address_line2, postal_code, city, syndic_profile_id, syndic_company_name, syndic_address, syndic_email, syndic_phone"
      )
      .eq("id", (assemblyData as any).site_id)
      .single();

    if (siteError || !site) {
      return NextResponse.json({ error: "Site introuvable" }, { status: 404 });
    }

    // 3. Charger le profil syndic + syndic_profile (loi Hoguet)
    const siteAny = site as any;
    let syndicName = "Syndic";
    let syndicNumeroCartePro: string | undefined;

    if (siteAny.syndic_profile_id) {
      const { data: syndicProfile } = await auth.serviceClient
        .from("profiles")
        .select("prenom, nom")
        .eq("id", siteAny.syndic_profile_id)
        .maybeSingle();

      if (syndicProfile) {
        syndicName = `${(syndicProfile as any).prenom || ""} ${(syndicProfile as any).nom || ""}`.trim();
      }

      const { data: syndicPro } = await auth.serviceClient
        .from("syndic_profiles")
        .select("numero_carte_pro, raison_sociale")
        .eq("profile_id", siteAny.syndic_profile_id)
        .maybeSingle();

      if (syndicPro) {
        syndicNumeroCartePro = (syndicPro as any).numero_carte_pro || undefined;
      }
    }

    // 4. Charger les résolutions
    const { data: resolutions } = await auth.serviceClient
      .from("copro_resolutions")
      .select("*")
      .eq("assembly_id", assembly.id)
      .order("resolution_number", { ascending: true });

    // 5. Charger le destinataire (unit + owner) si unit_id fourni
    let recipientName = "Tous les copropriétaires";
    let recipientAddress: string | undefined;
    let unitNumber: string | undefined;
    let unitTantiemes: number | undefined;

    if (unitId) {
      const { data: unit } = await auth.serviceClient
        .from("copro_units")
        .select("lot_number, tantieme_general, owner_profile_id")
        .eq("id", unitId)
        .eq("site_id", (assemblyData as any).site_id)
        .maybeSingle();

      if (unit) {
        const u = unit as any;
        unitNumber = u.lot_number;
        unitTantiemes = u.tantieme_general;

        if (u.owner_profile_id) {
          const { data: owner } = await auth.serviceClient
            .from("profiles")
            .select("prenom, nom")
            .eq("id", u.owner_profile_id)
            .maybeSingle();

          if (owner) {
            recipientName = `${(owner as any).prenom || ""} ${(owner as any).nom || ""}`.trim() || `Lot ${u.lot_number}`;
          }
        } else {
          recipientName = `Lot ${u.lot_number} (non assigné)`;
        }
      }
    }

    // 6. Construire les données du template
    const pdfData: ConvocationPdfData = {
      site_name: siteAny.name,
      site_address: siteAny.address_line1 + (siteAny.address_line2 ? `, ${siteAny.address_line2}` : ""),
      site_city: siteAny.city,
      site_postal_code: siteAny.postal_code,
      syndic_name: syndicName,
      syndic_company: siteAny.syndic_company_name || undefined,
      syndic_address: siteAny.syndic_address || undefined,
      syndic_email: siteAny.syndic_email || undefined,
      syndic_phone: siteAny.syndic_phone || undefined,
      syndic_numero_carte_pro: syndicNumeroCartePro,
      assembly_reference: (assemblyData as any).reference_number || "",
      assembly_type: (assemblyData as any).assembly_type,
      assembly_title: (assemblyData as any).title,
      scheduled_at: (assemblyData as any).scheduled_at,
      location: (assemblyData as any).location || "",
      location_address: (assemblyData as any).location_address || undefined,
      online_meeting_url: (assemblyData as any).online_meeting_url || undefined,
      is_hybrid: (assemblyData as any).is_hybrid || false,
      fiscal_year: (assemblyData as any).fiscal_year || undefined,
      second_convocation_at: (assemblyData as any).second_convocation_at || undefined,
      recipient_name: recipientName,
      recipient_address: recipientAddress,
      unit_number: unitNumber,
      unit_tantiemes: unitTantiemes,
      resolutions: ((resolutions || []) as any[]).map((r) => ({
        resolution_number: r.resolution_number,
        title: r.title,
        description: r.description,
        category: r.category,
        majority_rule: r.majority_rule,
        estimated_amount_cents: r.estimated_amount_cents,
        contract_partner: r.contract_partner,
      })),
      generated_at: new Date().toISOString(),
    };

    // 7. Retourner selon le format demandé
    if (format === "json") {
      return NextResponse.json(pdfData);
    }

    const html = generateConvocationHtml(pdfData);

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="convocation-${(assemblyData as any).reference_number || assembly.id}.html"`,
      },
    });
  } catch (error) {
    console.error("[convocation-pdf:GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
