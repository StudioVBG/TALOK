/**
 * Generateur PDF definitif du bail signe.
 *
 * Remplace l'ancien signed_final.html. Source de verite : template HTML Talok
 * (lib/templates/bail/), rendu via Puppeteer apres injection typographique.
 *
 * Idempotent : si un document bail PDF existe deja pour ce leaseId, retourne
 * l'existant sans regenerer. Le storage_path est stable : bails/{leaseId}/signed_final.pdf.
 */

import crypto from "node:crypto";
import { getServiceClient } from "@/lib/supabase/service-client";
import { LeaseTemplateService } from "@/lib/templates/bail";
import { buildBailData, normalizeTypeBail } from "@/lib/builders/bail-data.builder";
import { renderHtmlToPdf } from "@/lib/pdf/html-to-pdf";
import { injectTypography, buildPdfFooter } from "@/lib/pdf/typography";

export interface GeneratedLeasePdf {
  documentId: string;
  storagePath: string;
  bytes: number;
  sha256: string;
  regenerated: boolean;
}

const STORAGE_BUCKET = "documents";
const LEASE_PDF_TYPE = "bail";

function buildStoragePath(leaseId: string): string {
  return `bails/${leaseId}/signed_final.pdf`;
}

function sha256Of(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Rend le HTML enrichi du bail signe : template + cachet + footer de scellement.
 */
function buildSealedHtml(rawHtml: string, leaseId: string, sealedAt: Date): string {
  const sealedDateLabel = sealedAt.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let html = rawHtml;

  // Cachet "DOCUMENT SIGNE ET CERTIFIE" - pur HTML/CSS, zero JavaScript
  const sealBadge = `<div class="talok-seal" aria-label="Document signe et certifie">Document signe et certifie</div>`;
  html = html.replace(/<body([^>]*)>/, `<body$1>${sealBadge}`);

  // Footer de scellement (reference + date)
  const sealFooter = `
    <div style="margin-top:18mm;padding-top:6mm;border-top:1px solid #E5E7EB;font-family:Manrope,sans-serif;font-size:9pt;color:#6B7280;">
      <p style="text-align:left;margin:0;">Document scelle electroniquement le ${sealedDateLabel}.</p>
      <p style="text-align:left;margin:4px 0 0 0;">Reference : ${leaseId.slice(0, 8).toUpperCase()}</p>
    </div>
  `;
  html = html.replace("</body>", `${sealFooter}</body>`);

  return injectTypography(html);
}

/**
 * Genere (ou retourne si existant) le PDF definitif du bail signe.
 *
 * @param leaseId UUID du bail
 * @param options.force  Si true, regenere meme si un PDF existe deja en storage/DB.
 */
export async function generateSignedLeasePdf(
  leaseId: string,
  options: { force?: boolean } = {}
): Promise<GeneratedLeasePdf> {
  const serviceClient = getServiceClient();
  const storagePath = buildStoragePath(leaseId);
  const force = options.force ?? false;

  // 1. Idempotence : si un document PDF existe deja pour ce leaseId -> short-circuit.
  if (!force) {
    const { data: existingRaw } = await serviceClient
      .from("documents")
      .select("id, storage_path")
      .eq("lease_id", leaseId)
      .eq("type", LEASE_PDF_TYPE as any)
      .eq("is_generated", true)
      .eq("mime_type", "application/pdf")
      .maybeSingle();

    const existing = existingRaw as Record<string, any> | null;
    if (existing?.id) {
      return {
        documentId: existing.id,
        storagePath: existing.storage_path ?? storagePath,
        bytes: existing.file_size ?? 0,
        sha256: existing.sha256 ?? "",
        regenerated: false,
      };
    }
  }

  // 2. Construction des donnees bail (reuse builder canonique).
  const { bailData, typeBail, property, lease } = await buildBailData(
    serviceClient as any,
    leaseId,
    { includeSignatures: true, includeDiagnostics: true }
  );

  // 3. Generation HTML.
  const rawHtml = LeaseTemplateService.generateHTML(normalizeTypeBail(typeBail), bailData);
  const sealedAt = new Date();
  const sealedHtml = buildSealedHtml(rawHtml, leaseId, sealedAt);

  // 4. Rendu PDF via Puppeteer.
  const pdfBuffer = await renderHtmlToPdf(sealedHtml, {
    displayHeaderFooter: true,
    footerTemplate: buildPdfFooter(
      `Contrat de bail ${leaseId.slice(0, 8).toUpperCase()}`,
      property?.ville ?? undefined
    ),
  });

  const sha256 = sha256Of(pdfBuffer);

  // 5. Upload Storage (upsert pour remplacer le .html legacy si present).
  const { error: uploadError } = await serviceClient.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
      cacheControl: "31536000",
    });

  if (uploadError) {
    throw new Error(`[lease-signed-pdf] Upload echoue : ${uploadError.message}`);
  }

  // 6. Resoudre proprio / locataire pour peupler les FK.
  const signers: any[] = (lease?.signers as any[]) ?? [];
  const tenantSigner = signers.find((s) => {
    const role = String(s?.role ?? "").toLowerCase();
    return ["locataire_principal", "locataire", "tenant", "principal"].includes(role);
  });
  const tenantProfileId = (tenantSigner?.profile?.id ?? tenantSigner?.profile_id) || null;

  const title = `Contrat de bail signe${property?.adresse_complete ? ` - ${property.adresse_complete}` : ""}`;
  const originalFilename = `bail-signe-${leaseId.slice(0, 8)}.pdf`;

  // 7. INSERT ou UPDATE documents (replace tout document legacy HTML sur ce lease).
  const { data: legacyDoc } = await serviceClient
    .from("documents")
    .select("id")
    .eq("lease_id", leaseId)
    .in("type", [LEASE_PDF_TYPE, "bail_signe", "bail_signe_locataire", "bail_signe_proprietaire"] as any)
    .eq("is_generated", true)
    .maybeSingle();

  const metadata = {
    generator: "pdf/lease-signed-pdf",
    generated_at: sealedAt.toISOString(),
    sealed_at: sealedAt.toISOString(),
    type_bail: typeBail,
    final: true,
    content_type: "application/pdf",
  };

  let documentId: string;
  if (legacyDoc?.id) {
    const { data: updated, error: updErr } = await serviceClient
      .from("documents")
      .update({
        type: LEASE_PDF_TYPE,
        storage_path: storagePath,
        mime_type: "application/pdf",
        file_size: pdfBuffer.length,
        sha256,
        content_hash: sha256,
        title,
        original_filename: originalFilename,
        is_generated: true,
        visible_tenant: true,
        metadata,
        updated_at: sealedAt.toISOString(),
      } as any)
      .eq("id", legacyDoc.id)
      .select("id")
      .single();
    if (updErr) throw new Error(`[lease-signed-pdf] Update echoue : ${updErr.message}`);
    documentId = (updated as any).id;
  } else {
    const { data: inserted, error: insErr } = await serviceClient
      .from("documents")
      .insert({
        type: LEASE_PDF_TYPE,
        category: "contrat",
        title,
        original_filename: originalFilename,
        storage_path: storagePath,
        mime_type: "application/pdf",
        file_size: pdfBuffer.length,
        sha256,
        content_hash: sha256,
        owner_id: property?.owner_id ?? null,
        tenant_id: tenantProfileId,
        property_id: property?.id ?? null,
        lease_id: leaseId,
        is_generated: true,
        generation_source: "pdf/lease-signed-pdf",
        ged_status: "active",
        visible_tenant: true,
        version: 1,
        is_current_version: true,
        metadata,
      } as any)
      .select("id")
      .single();
    if (insErr) throw new Error(`[lease-signed-pdf] Insert echoue : ${insErr.message}`);
    documentId = (inserted as any).id;
  }

  // 8. Mise a jour du bail (signed_pdf_path + signed_pdf_generated).
  await serviceClient
    .from("leases")
    .update({
      signed_pdf_path: storagePath,
      signed_pdf_generated: true,
    } as any)
    .eq("id", leaseId);

  return {
    documentId,
    storagePath,
    bytes: pdfBuffer.length,
    sha256,
    regenerated: true,
  };
}
