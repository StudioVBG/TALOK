/**
 * Generateur PDF definitif de l'etat des lieux signe (entree ou sortie).
 *
 * Remplace l'ancien signed_document.html. Source de verite : template HTML
 * Talok (lib/templates/edl/), rendu via Puppeteer avec injection typographique.
 *
 * Idempotent : si un document PDF existe deja pour ce edlId, retourne l'existant.
 */

import crypto from "node:crypto";
import { getServiceClient } from "@/lib/supabase/service-client";
import { generateEDLHTML } from "@/lib/templates/edl";
import { mapDatabaseToEDLComplet } from "@/lib/mappers/edl-to-template";
import { resolveOwnerIdentity } from "@/lib/entities/resolveOwnerIdentity";
import { renderHtmlToPdf } from "@/lib/pdf/html-to-pdf";
import { injectTypography, buildPdfFooter } from "@/lib/pdf/typography";

export interface GeneratedEdlPdf {
  documentId: string;
  storagePath: string;
  bytes: number;
  sha256: string;
  regenerated: boolean;
  kind: "entree" | "sortie";
}

const STORAGE_BUCKET = "documents";

function buildStoragePath(edlId: string, kind: "entree" | "sortie"): string {
  return `edl/${edlId}/${kind === "entree" ? "entree" : "sortie"}_final.pdf`;
}

function sha256Of(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function buildSealedHtml(rawHtml: string, edlId: string, kind: "entree" | "sortie"): string {
  const now = new Date();
  const sealedDateLabel = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const label = kind === "entree" ? "d'entree" : "de sortie";

  let html = rawHtml;
  const sealBadge = `<div class="talok-seal">EDL ${kind === "entree" ? "ENTREE" : "SORTIE"} signe</div>`;
  html = html.replace(/<body([^>]*)>/, `<body$1>${sealBadge}`);

  const sealFooter = `
    <div style="margin-top:14mm;padding-top:4mm;border-top:1px solid #E5E7EB;font-family:Manrope,sans-serif;font-size:9pt;color:#6B7280;">
      <p style="text-align:left;margin:0;">Etat des lieux ${label} scelle le ${sealedDateLabel}.</p>
      <p style="text-align:left;margin:4px 0 0 0;">Reference EDL : ${edlId.slice(0, 8).toUpperCase()}</p>
    </div>
  `;
  html = html.replace("</body>", `${sealFooter}</body>`);

  return injectTypography(html);
}

/**
 * Charge les signatures + URLs signees photos pour le rendu PDF.
 */
async function loadEdlContext(serviceClient: ReturnType<typeof getServiceClient>, edlId: string) {
  const { data: edl, error } = await serviceClient
    .from("edl")
    .select(`
      *,
      lease:leases(
        *,
        property:properties(*),
        signers:lease_signers(*, profile:profiles(*))
      )
    `)
    .eq("id", edlId)
    .single();

  if (error || !edl) {
    throw new Error(`[edl-signed-pdf] EDL non trouve : ${error?.message ?? "introuvable"}`);
  }

  const { data: items } = await serviceClient.from("edl_items").select("*").eq("edl_id", edlId);

  const { data: mediaRaw } = await serviceClient
    .from("edl_media")
    .select("*")
    .eq("edl_id", edlId);

  const media: any[] = mediaRaw ?? [];
  for (const m of media) {
    if ((m as any).storage_path) {
      const { data: signedUrlData } = await serviceClient.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl((m as any).storage_path, 3600);
      if (signedUrlData?.signedUrl) (m as any).signed_url = signedUrlData.signedUrl;
    }
  }

  const { data: signaturesRaw } = await serviceClient
    .from("edl_signatures")
    .select("*")
    .eq("edl_id", edlId);

  let signatures: any[] = signaturesRaw ?? [];
  if (signatures.length > 0) {
    const profileIds = signatures.map((s: any) => s.signer_profile_id).filter(Boolean);
    if (profileIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("*")
        .in("id", profileIds);
      if (profiles) {
        signatures = signatures.map((sig: any) => ({
          ...sig,
          profile: profiles.find((p: any) => p.id === sig.signer_profile_id),
        }));
      }
    }

    for (const sig of signatures) {
      if ((sig as any).signature_image_path) {
        const { data: signedUrlData } = await serviceClient.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl((sig as any).signature_image_path, 3600);
        if (signedUrlData?.signedUrl) (sig as any).signature_image_url = signedUrlData.signedUrl;
      }
    }
  }

  const propertyOwnerId = (edl as any).lease?.property?.owner_id;
  const ownerIdentity = await resolveOwnerIdentity(serviceClient as any, {
    leaseId: (edl as any).lease_id,
    propertyId: (edl as any).property_id || (edl as any).lease?.property?.id,
    profileId: propertyOwnerId,
  });
  const ownerProfile = {
    type: ownerIdentity.entityType === "company" ? "societe" : "particulier",
    raison_sociale: ownerIdentity.companyName,
    representant_nom: ownerIdentity.representative
      ? `${ownerIdentity.representative.firstName} ${ownerIdentity.representative.lastName}`.trim()
      : null,
    adresse_facturation: ownerIdentity.billingAddress || ownerIdentity.address.street,
    profile: {
      prenom: ownerIdentity.firstName,
      nom: ownerIdentity.lastName,
      telephone: ownerIdentity.phone,
      email: ownerIdentity.email,
    },
  };

  const { data: meterReadings } = await serviceClient
    .from("edl_meter_readings")
    .select("*, meter:meters(*)")
    .eq("edl_id", edlId);

  const propertyId =
    (edl as any).property_id ||
    (edl as any).lease?.property_id ||
    (edl as any).lease?.property?.id;

  let allMeters: any[] = [];
  if (propertyId) {
    const { data: meters } = await serviceClient
      .from("meters")
      .select("*")
      .eq("property_id", propertyId);
    allMeters = meters?.filter((m: any) => m.is_active !== false) ?? [];
  }

  const validReadings = (meterReadings ?? []).filter(
    (r) => !!r && typeof r === "object" && !("code" in r)
  ) as Array<Record<string, any>>;
  const recordedMeterIds = new Set(validReadings.map((r) => r.meter_id));

  const finalMeterReadings: any[] = [];
  for (const reading of validReadings) {
    const hasValue = reading.reading_value !== null && reading.reading_value !== undefined;
    const readingDisplay = hasValue
      ? String(reading.reading_value)
      : reading.photo_path
        ? "A valider"
        : "Non releve";

    let photoUrl: string | null = null;
    if (reading.photo_path) {
      const { data: signedUrlData } = await serviceClient.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(reading.photo_path, 3600);
      photoUrl = signedUrlData?.signedUrl ?? null;
    }

    const meter = reading.meter as Record<string, any> | null;
    finalMeterReadings.push({
      type: meter?.type || "electricity",
      meter_number: meter?.meter_number || meter?.serial_number,
      reading: readingDisplay,
      reading_value: reading.reading_value,
      unit: reading.reading_unit || meter?.unit || "kWh",
      photo_url: photoUrl,
    });
  }
  allMeters.forEach((m: any) => {
    if (!recordedMeterIds.has(m.id)) {
      finalMeterReadings.push({
        type: m.type || "electricity",
        meter_number: m.meter_number || m.serial_number,
        reading: "Non releve",
        reading_value: null,
        unit: m.unit || "kWh",
        photo_url: null,
      });
    }
  });

  return {
    edl,
    items: items ?? [],
    media,
    signatures,
    ownerProfile,
    finalMeterReadings,
    propertyId,
  };
}

/**
 * Genere le PDF signe d'un EDL (entree ou sortie). Idempotent.
 */
export async function generateSignedEdlPdf(
  edlId: string,
  options: { force?: boolean } = {}
): Promise<GeneratedEdlPdf> {
  const serviceClient = getServiceClient();
  const force = options.force ?? false;

  // 1. Determiner le kind (entree/sortie).
  const { data: edlHeader } = await serviceClient
    .from("edl")
    .select("id, type, lease_id, property_id")
    .eq("id", edlId)
    .single();

  if (!edlHeader) {
    throw new Error(`[edl-signed-pdf] EDL ${edlId} introuvable`);
  }

  const kind: "entree" | "sortie" = (edlHeader as any).type === "sortie" ? "sortie" : "entree";
  const documentType = kind === "entree" ? "EDL_entree" : "EDL_sortie";
  const storagePath = buildStoragePath(edlId, kind);

  // 2. Idempotence.
  if (!force) {
    const { data: existingRaw } = await serviceClient
      .from("documents")
      .select("id, storage_path")
      .eq("type", documentType as any)
      .eq("mime_type", "application/pdf")
      .eq("metadata->>edl_id", edlId)
      .maybeSingle();

    const existing = existingRaw as Record<string, any> | null;
    if (existing?.id) {
      return {
        documentId: existing.id,
        storagePath: existing.storage_path ?? storagePath,
        bytes: existing.file_size ?? 0,
        sha256: existing.sha256 ?? "",
        regenerated: false,
        kind,
      };
    }
  }

  // 3. Charger le contexte complet et generer le HTML.
  const {
    edl,
    items,
    media,
    signatures,
    ownerProfile,
    finalMeterReadings,
  } = await loadEdlContext(serviceClient, edlId);

  const fullEdlData = mapDatabaseToEDLComplet(
    { ...edl, meter_readings: finalMeterReadings },
    ownerProfile,
    items,
    media,
    signatures
  );

  const rawHtml = generateEDLHTML(fullEdlData);
  const sealedHtml = buildSealedHtml(rawHtml, edlId, kind);

  // 4. Rendu PDF.
  const pdfBuffer = await renderHtmlToPdf(sealedHtml, {
    displayHeaderFooter: true,
    footerTemplate: buildPdfFooter(
      `Etat des lieux ${kind === "entree" ? "d'entree" : "de sortie"} ${edlId.slice(0, 8).toUpperCase()}`
    ),
  });

  const sha256 = sha256Of(pdfBuffer);

  // 5. Upload.
  const { error: uploadError } = await serviceClient.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
      cacheControl: "31536000",
    });

  if (uploadError) {
    throw new Error(`[edl-signed-pdf] Upload echoue : ${uploadError.message}`);
  }

  // 6. Resoudre FK pour INSERT.
  const propertyInfo = (edl as any).lease?.property ?? null;
  const tenantSigner = (edl as any).lease?.signers?.find((s: any) => {
    const role = String(s?.role ?? "").toLowerCase();
    return ["locataire_principal", "locataire", "tenant", "principal"].includes(role);
  });
  const tenantProfileId = tenantSigner?.profile?.id ?? tenantSigner?.profile_id ?? null;

  const title = `Etat des lieux ${kind === "entree" ? "d'entree" : "de sortie"} - Signe`;
  const originalFilename = `edl-${kind}-${edlId.slice(0, 8)}.pdf`;

  const now = new Date();
  const metadata = {
    generator: "pdf/edl-signed-pdf",
    generated_at: now.toISOString(),
    signed_at: now.toISOString(),
    all_signers_signed: true,
    final: true,
    content_type: "application/pdf",
    edl_id: edlId,
  };

  // Upsert : remplace l'entree legacy HTML si presente.
  const { data: legacyDoc } = await serviceClient
    .from("documents")
    .select("id")
    .in("type", ["EDL_entree", "EDL_sortie"] as any)
    .eq("metadata->>edl_id", edlId)
    .maybeSingle();

  let documentId: string;
  if (legacyDoc?.id) {
    const { data: updated, error: updErr } = await serviceClient
      .from("documents")
      .update({
        type: documentType,
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
        updated_at: now.toISOString(),
      } as any)
      .eq("id", legacyDoc.id)
      .select("id")
      .single();
    if (updErr) throw new Error(`[edl-signed-pdf] Update echoue : ${updErr.message}`);
    documentId = (updated as any).id;
  } else {
    const { data: inserted, error: insErr } = await serviceClient
      .from("documents")
      .insert({
        type: documentType,
        category: "edl",
        title,
        original_filename: originalFilename,
        storage_path: storagePath,
        mime_type: "application/pdf",
        file_size: pdfBuffer.length,
        sha256,
        content_hash: sha256,
        owner_id: propertyInfo?.owner_id ?? null,
        tenant_id: tenantProfileId,
        property_id: propertyInfo?.id ?? (edl as any).property_id ?? null,
        lease_id: (edl as any).lease_id ?? null,
        is_generated: true,
        generation_source: "pdf/edl-signed-pdf",
        ged_status: "active",
        visible_tenant: true,
        version: 1,
        is_current_version: true,
        metadata,
      } as any)
      .select("id")
      .single();
    if (insErr) throw new Error(`[edl-signed-pdf] Insert echoue : ${insErr.message}`);
    documentId = (inserted as any).id;
  }

  return {
    documentId,
    storagePath,
    bytes: pdfBuffer.length,
    sha256,
    regenerated: true,
    kind,
  };
}
