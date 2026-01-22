export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getServiceRoleClient } from "@/lib/server/service-role-client";
import { PROPERTY_SHARE_SELECT } from "@/lib/server/share-tokens";

/**
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { client } = getServiceRoleClient();

    const { data: share, error: shareError } = await client
      .from("property_share_tokens")
      .select("property_id, expires_at, revoked_at, created_at")
      .eq("token", token)
      .single();

    if (shareError || !share) {
      return NextResponse.json({ error: "Lien invalide." }, { status: 404 });
    }

    if (share.revoked_at) {
      return NextResponse.json({ error: "Lien révoqué." }, { status: 410 });
    }

    if (new Date(share.expires_at) < new Date()) {
      return NextResponse.json({ error: "Lien expiré." }, { status: 410 });
    }

    const { data: property, error: propertyError } = await client
      .from("properties")
      .select(PROPERTY_SHARE_SELECT)
      .eq("id", share.property_id)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ error: "Logement introuvable." }, { status: 404 });
    }

    const propertyData = property as any;
    const pdfBytes = await buildPropertyPdf(token, share, propertyData);

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="gl-logement-${propertyData.id}.pdf"`,
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/properties/share/[token]/pdf error", error);
    return NextResponse.json(
      { error: error?.message ?? "Impossible de générer le PDF." },
      { status: 500 }
    );
  }
}

async function buildPropertyPdf(
  token: string,
  share: { expires_at: string; created_at: string },
  property: Record<string, any>
) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 780;

  const drawHeading = (text: string, size = 16) => {
    page.drawText(text, { x: 50, y, size, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    y -= size + 8;
  };

  const drawLine = (label: string, value: string) => {
    if (y < 60) {
      page.moveTo(50, 780);
      y = 780;
    }
    page.drawText(`${label}:`, { x: 50, y, size: 11, font: fontBold, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(value, { x: 180, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
    y -= 18;
  };

  const type = property.type_bien ?? property.type ?? "Logement";
  const address = `${property.adresse_complete ?? ""} ${property.code_postal ?? ""} ${property.ville ?? ""}`.trim();
  const loyer = Number(property.loyer_hc ?? 0);
  const charges = Number(property.charges_mensuelles ?? 0);
  const depot = Number(property.depot_garantie ?? 0);

  drawHeading("Résumé logement");
  drawLine("Lien token", token);
  drawLine("Créé le", new Date(share.created_at).toLocaleString("fr-FR"));
  drawLine("Expire le", new Date(share.expires_at).toLocaleString("fr-FR"));

  y -= 6;
  drawHeading("Informations principales", 14);
  drawLine("Type", capitalize(type));
  drawLine("Adresse", address || "Non renseignée");
  drawLine("Usage", capitalize(property.usage_principal ?? "habitation"));
  drawLine("Surface", `${property.surface_habitable_m2 ?? property.surface ?? "—"} m²`);
  drawLine("Pièces / Chambres", `${property.nb_pieces ?? "—"} / ${property.nb_chambres ?? "—"}`);
  drawLine("Étage / Ascenseur", `${property.etage ?? "—"} / ${property.ascenseur ? "Oui" : "Non"}`);

  y -= 6;
  drawHeading("Conditions financières", 14);
  drawLine("Loyer hors charges", formatCurrency(loyer));
  drawLine("Charges mensuelles", formatCurrency(charges));
  drawLine("Total mensuel", formatCurrency(loyer + charges));
  drawLine("Dépôt de garantie", formatCurrency(depot));

  if (property.type_bien === "parking" || property.type === "parking") {
    y -= 6;
    drawHeading("Stationnement", 14);
    drawLine("Type", capitalize(property.parking_details?.placement_type ?? property.gabarit ?? "N/A"));
    drawLine("Niveau", property.niveau ?? "—");
    drawLine("Numéro / repère", property.numero_place ?? "—");
  }

  return doc.save();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function capitalize(value: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}


