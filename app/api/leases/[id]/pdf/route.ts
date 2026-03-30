export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { LeaseTemplateService } from "@/lib/templates/bail";
import { buildBailData } from "@/lib/builders/bail-data.builder";
import crypto from "crypto";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/leases/[id]/pdf — Generation et telechargement du PDF
 * SOTA 2026: Utilise buildBailData() comme unique source de donnees
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: leaseId } = await params;
    if (!leaseId) return NextResponse.json({ error: "ID du bail requis" }, { status: 400 });

    const supabase = await createClient();
    const serviceClient = getServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { data: profile } = await serviceClient.from("profiles").select("id, role").eq("user_id", user.id).single();
    if (!profile) return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });

    // Quick lease check for permissions + sealed status
    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .select("sealed_at, signed_pdf_path, statut, updated_at, type_bail, loyer, charges_forfaitaires, depot_de_garantie, date_debut, date_fin, property:properties(id, owner_id, ville, adresse_complete), signers:lease_signers(id, profile_id)")
      .eq("id", leaseId)
      .single();

    if (leaseError || !lease) return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });

    const property = lease.property as any;
    const isOwner = property?.owner_id === profile.id;
    const isAdmin = profile.role === "admin";
    const isSigner = (lease.signers as any[])?.some((s: any) => s.profile_id === profile.id);
    if (!isOwner && !isAdmin && !isSigner) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    // Sealed bail: return stored PDF
    if (lease.sealed_at && lease.signed_pdf_path && !lease.signed_pdf_path.startsWith("pending_generation_")) {
      const { data: signedUrl, error: urlError } = await serviceClient.storage.from("documents").createSignedUrl(lease.signed_pdf_path, 3600);
      if (!urlError && signedUrl?.signedUrl) {
        await serviceClient.from("audit_log").insert({ user_id: user.id, action: "read", entity_type: "document", entity_id: leaseId, metadata: { type: "bail_signe", sealed: true } } as any);
        return NextResponse.redirect(signedUrl.signedUrl);
      }
    }

    // Hash for caching
    const dataHash = crypto
      .createHash("sha256")
      .update(JSON.stringify({ lease_id: leaseId, statut: lease.statut, updated_at: lease.updated_at, signers_count: (lease.signers as any[])?.length || 0 }))
      .digest("hex")
      .slice(0, 16);

    // Check cache
    const { data: existingDoc } = await serviceClient
      .from("documents")
      .select("id, storage_path, metadata")
      .eq("type", "bail")
      .eq("lease_id", leaseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingDoc?.storage_path && (existingDoc.metadata as any)?.hash === dataHash) {
      const { data: signedUrl, error: urlError } = await serviceClient.storage.from("documents").createSignedUrl(existingDoc.storage_path, 3600);
      if (!urlError && signedUrl?.signedUrl) {
        return NextResponse.redirect(signedUrl.signedUrl);
      }
    }

    // Build bail data via unified builder
    const { bailData, typeBail } = await buildBailData(serviceClient, leaseId, {
      includeSignatures: false,
      includeDiagnostics: true,
    });

    const html = LeaseTemplateService.generateHTML(typeBail, bailData);
    const pdfBuffer = await generatePDF(html);

    // Store PDF
    const storagePath = `bails/${leaseId}/${dataHash}.pdf`;
    const { error: uploadError } = await serviceClient.storage.from("documents").upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true, cacheControl: "31536000" });

    if (!uploadError) {
      const docPayload = {
        type: "bail",
        title: `Bail - ${property?.adresse_complete || property?.ville || leaseId.slice(0, 8)}`,
        storage_path: storagePath,
        visible_tenant: true,
        metadata: { hash: dataHash, type_bail: typeBail, generated_at: new Date().toISOString() },
      };

      if (existingDoc) {
        await serviceClient.from("documents").update({ ...docPayload, updated_at: new Date().toISOString() } as any).eq("id", existingDoc.id);
      } else {
        await serviceClient.from("documents").insert({ ...docPayload, owner_id: property.owner_id, property_id: property.id, lease_id: leaseId } as any);
      }

      const { data: signedUrl } = await serviceClient.storage.from("documents").createSignedUrl(storagePath, 3600);
      if (signedUrl?.signedUrl) return NextResponse.redirect(signedUrl.signedUrl);
    }

    // Fallback: direct response
    const fileName = `Bail_${typeBail}_${property?.ville || "location"}_${new Date().toISOString().split("T")[0]}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${fileName}"`, "Content-Length": String(pdfBuffer.length) },
    });
  } catch (error: unknown) {
    console.error("Erreur génération PDF bail:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

async function generatePDF(html: string): Promise<Buffer> {
  try {
    const edgeFunctionUrl = process.env.SUPABASE_FUNCTIONS_URL;
    if (edgeFunctionUrl) {
      const response = await fetch(`${edgeFunctionUrl}/html-to-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ html }),
      });
      if (response.ok) return Buffer.from(await response.arrayBuffer());
    }
  } catch { /* fallback */ }

  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page1 = pdfDoc.addPage([595, 842]);
  let y = page1.getSize().height - 50;

  page1.drawText("CONTRAT DE LOCATION", { x: 50, y, size: 20, font: fontBold, color: rgb(0, 0, 0.5) });
  y -= 30;
  page1.drawText("Conforme à la loi ALUR du 24 mars 2014", { x: 50, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 50;
  page1.drawText("Ce document est une version prévisualisation.", { x: 50, y, size: 12, font });
  y -= 20;
  page1.drawText("Le PDF complet sera généré lors de l'activation du bail.", { x: 50, y, size: 12, font });
  y -= 40;
  page1.drawText("Utilisez l'aperçu HTML pour imprimer en PDF (Cmd/Ctrl+P).", { x: 50, y, size: 11, font: fontBold });
  y -= 40;
  page1.drawText(`Document généré le ${new Date().toLocaleDateString("fr-FR")}`, { x: 50, y: 30, size: 9, font, color: rgb(0.5, 0.5, 0.5) });

  return Buffer.from(await pdfDoc.save());
}
