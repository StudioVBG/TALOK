/**
 * Service post-signature EDL — SOTA 2026
 *
 * Génère le document HTML signé de l'état des lieux et le stocke
 * dans Supabase Storage après que tous les signataires ont signé.
 *
 * Appelé par :
 *  - POST /api/edl/[id]/sign          (propriétaire signe via l'app)
 *  - POST /api/signature/edl/[token]/sign (locataire signe via token)
 *
 * Utilise getServiceClient() — aucune authentification utilisateur requise.
 */

import { getServiceClient } from "@/lib/supabase/service-client";
import { generateEDLHTML } from "@/lib/templates/edl";
import { mapDatabaseToEDLComplet } from "@/lib/mappers/edl-to-template";
import { resolveOwnerIdentity } from "@/lib/entities/resolveOwnerIdentity";

export interface EDLPostSignatureResult {
  htmlStored: boolean;
  storagePath: string | null;
}

export async function handleEDLFullySigned(edlId: string): Promise<EDLPostSignatureResult> {
  const serviceClient = getServiceClient();

  const result: EDLPostSignatureResult = {
    htmlStored: false,
    storagePath: null,
  };

  try {
    const { data: edl, error: edlError } = await serviceClient
      .from("edl")
      .select(`
        *,
        lease:leases(
          *,
          property:properties(*),
          signers:lease_signers(
            *,
            profile:profiles(*)
          )
        )
      `)
      .eq("id", edlId)
      .single();

    if (edlError || !edl) {
      console.warn("[edl-post-signature] EDL non trouvé:", edlId, edlError?.message);
      return result;
    }

    const { data: items } = await serviceClient
      .from("edl_items")
      .select("*")
      .eq("edl_id", edlId);

    const { data: mediaRaw } = await serviceClient
      .from("edl_media")
      .select("*")
      .eq("edl_id", edlId);

    let media = mediaRaw || [];

    if (media.length > 0) {
      for (const m of media) {
        if ((m as any).storage_path) {
          const { data: signedUrlData } = await serviceClient.storage
            .from("documents")
            .createSignedUrl((m as any).storage_path, 3600);

          if (signedUrlData?.signedUrl) {
            (m as any).signed_url = signedUrlData.signedUrl;
          }
        }
      }
    }

    const { data: signaturesRaw } = await serviceClient
      .from("edl_signatures")
      .select("*")
      .eq("edl_id", edlId);

    let signatures = signaturesRaw || [];

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
            .from("documents")
            .createSignedUrl((sig as any).signature_image_path, 3600);
          if (signedUrlData?.signedUrl) {
            (sig as any).signature_image_url = signedUrlData.signedUrl;
          }
        }
      }
    }

    const propertyOwnerId = (edl as any).lease?.property?.owner_id;
    const ownerIdentity = await resolveOwnerIdentity(serviceClient, {
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
      allMeters = meters?.filter((m: any) => m.is_active !== false) || [];
    }

    const validReadings = (meterReadings || []).filter(
      (r) => !!r && typeof r === "object" && !("code" in r)
    ) as Array<Record<string, any>>;
    const recordedMeterIds = new Set(validReadings.map((r) => r.meter_id));

    const finalMeterReadings: any[] = [];
    for (const reading of validReadings) {
      const hasValue = reading.reading_value !== null && reading.reading_value !== undefined;
      const readingDisplay = hasValue
        ? String(reading.reading_value)
        : reading.photo_path
          ? "À valider"
          : "Non relevé";

      let photoUrl = null;
      if (reading.photo_path) {
        const { data: signedUrlData } = await serviceClient.storage
          .from("documents")
          .createSignedUrl(reading.photo_path, 3600);
        photoUrl = signedUrlData?.signedUrl || null;
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
          reading: "Non relevé",
          reading_value: null,
          unit: m.unit || "kWh",
          photo_url: null,
        });
      }
    });

    const fullEdlData = mapDatabaseToEDLComplet(
      { ...edl, meter_readings: finalMeterReadings },
      ownerProfile,
      items || [],
      media || [],
      signatures
    );

    const edlHtml = generateEDLHTML(fullEdlData);
    const edlType = (edl as any).type === "entree" ? "d'entrée" : "de sortie";

    const sealedDate = new Date().toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const fullHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>État des lieux ${edlType} - Document Signé</title>
  <style>
    @page { size: A4; margin: 15mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .sealed-badge { position: absolute; }
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #000;
      max-width: 210mm;
      margin: 0 auto;
      padding: 15mm;
      background: white;
    }
    .sealed-badge {
      position: fixed;
      top: 10mm;
      right: 10mm;
      background: #059669;
      color: white;
      padding: 5px 15px;
      border-radius: 4px;
      font-size: 10pt;
      font-weight: bold;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <div class="sealed-badge">✓ EDL SIGNÉ</div>
  ${edlHtml}
  <footer style="margin-top: 20mm; padding-top: 8mm; border-top: 1px solid #ccc; font-size: 9pt; color: #666;">
    <p>Document scellé le ${sealedDate}</p>
    <p>Référence EDL : ${edlId.substring(0, 8).toUpperCase()}</p>
  </footer>
</body>
</html>`;

    const storagePath = `edl/${edlId}/signed_document.html`;
    const htmlBuffer = Buffer.from(fullHtml, "utf-8");

    const { error: uploadErr } = await serviceClient.storage
      .from("documents")
      .upload(storagePath, htmlBuffer, {
        contentType: "text/html; charset=utf-8",
        upsert: true,
        cacheControl: "31536000",
      });

    if (uploadErr) {
      console.warn("[edl-post-signature] Erreur upload HTML:", uploadErr.message);
      return result;
    }

    result.htmlStored = true;
    result.storagePath = storagePath;
    console.log("[edl-post-signature] HTML EDL signé stocké:", storagePath, "size:", htmlBuffer.length);

    // Mettre à jour le storage_path du document existant en DB
    await serviceClient
      .from("documents")
      .update({
        storage_path: storagePath,
        metadata: {
          edl_id: edlId,
          signed_at: new Date().toISOString(),
          all_signers_signed: true,
          final: true,
          content_type: "text/html",
          size_bytes: htmlBuffer.length,
        },
      } as any)
      .eq("metadata->>edl_id", edlId)
      .in("type", ["EDL_entree", "EDL_sortie"]);
  } catch (err) {
    console.warn("[edl-post-signature] Exception (non bloquant):", String(err));
  }

  return result;
}
