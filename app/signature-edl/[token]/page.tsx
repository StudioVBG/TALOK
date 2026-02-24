// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getServiceClient } from "@/lib/supabase/service-client";
import { redirect } from "next/navigation";
import EDLSignatureClient from "./EDLSignatureClient";
import { generateEDLHTML } from "@/lib/templates/edl";
import { mapDatabaseToEDLComplet } from "@/lib/mappers/edl-to-template";

export async function generateMetadata({ params }: { params: { token: string } }) {
  return {
    title: "Signer l'état des lieux | Talok",
    description: "Signature électronique de l'état des lieux",
  };
}

async function fetchEDLByToken(token: string) {
  const serviceClient = getServiceClient();

  // 1. Trouver la signature par token
  const { data: signatureEntry, error: sigError } = await serviceClient
    .from("edl_signatures")
    .select("*, profile:profiles(*), edl:edl_id(*, property:property_id(*), lease:lease_id(*, property:properties(*)))")
    .eq("invitation_token", token)
    .single();

  if (sigError || !signatureEntry) {
    console.error("[fetchEDLByToken] Token non trouvé:", sigError);
    return null;
  }

  // 2. Vérifier si déjà signé - on vérifie signature_image_path car signed_at peut avoir une valeur par défaut
  if (signatureEntry.signature_image_path) {
    return { alreadySigned: true, edlId: signatureEntry.edl_id };
  }

  const edl = signatureEntry.edl;
  const property = edl.lease?.property || edl.property;
  const leaseId = edl.lease_id || edl.lease?.id || null;
  const tenantProfileId = signatureEntry.signer_profile_id || null;

  // 3. Récupérer les données liées pour l'aperçu complet + vérification identité (CNI)
  const [
    { data: edl_items },
    { data: edl_media },
    { data: meterReadings },
    { data: signaturesRaw },
    { data: ownerProfile },
    { data: tenantProfile },
    { data: cniDocs }
  ] = await Promise.all([
    serviceClient.from("edl_items").select("*").eq("edl_id", edl.id),
    serviceClient.from("edl_media").select("*").eq("edl_id", edl.id),
    serviceClient.from("edl_meter_readings").select("*, meter:meters(*)").eq("edl_id", edl.id),
    serviceClient.from("edl_signatures").select("*, profile:profiles(*)").eq("edl_id", edl.id),
    serviceClient.from("owner_profiles").select("*, profile:profiles(*)").eq("profile_id", property.owner_id).single(),
    tenantProfileId
      ? serviceClient.from("tenant_profiles").select("cni_number, cni_recto_path, cni_verso_path").eq("profile_id", tenantProfileId).maybeSingle()
      : Promise.resolve({ data: null }),
    leaseId && tenantProfileId
      ? serviceClient
          .from("documents")
          .select("type")
          .eq("tenant_id", tenantProfileId)
          .eq("lease_id", leaseId)
          .in("type", ["cni_recto", "cni_verso"])
          .eq("is_archived", false)
      : Promise.resolve({ data: [] })
  ]);

  const tp = tenantProfile as { cni_number?: string | null; cni_recto_path?: string | null; cni_verso_path?: string | null } | null;
  const hasCniNumber = !!(tp?.cni_number?.trim?.());
  const hasRectoPath = !!(tp?.cni_recto_path?.trim?.());
  const hasVersoPath = !!(tp?.cni_verso_path?.trim?.());
  const identityComplete = hasCniNumber && hasRectoPath && hasVersoPath;

  // Générer l'aperçu HTML côté serveur (évite un second fetch côté client)
  const signaturesWithUrls = (signaturesRaw || []).slice();
  for (const sig of signaturesWithUrls) {
    if (sig.signature_image_path) {
      const { data: signedUrlData } = await serviceClient.storage
        .from("documents")
        .createSignedUrl(sig.signature_image_path, 3600);
      if (signedUrlData?.signedUrl) sig.signature_image_url = signedUrlData.signedUrl;
    }
  }
  const fullEdlData = mapDatabaseToEDLComplet(
    edl,
    ownerProfile,
    edl_items || [],
    edl_media || [],
    signaturesWithUrls
  );
  const previewHtml = generateEDLHTML(fullEdlData);

  return {
    signature: signatureEntry,
    edl,
    property,
    leaseId,
    identityComplete,
    alreadySigned: false,
    previewHtml,
    edlFullData: {
      raw: edl,
      ownerProfile,
      items: edl_items || [],
      media: edl_media || [],
      meterReadings: meterReadings || [],
      signatures: signaturesRaw || []
    }
  };
}

export default async function EDLSignaturePage({ params }: { params: { token: string } }) {
  const { token } = await params;
  const data = await fetchEDLByToken(token);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center p-8 max-w-md bg-white rounded-2xl shadow-xl">
          <div className="text-6xl mb-4">🔗</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Lien invalide</h1>
          <p className="text-muted-foreground">
            Ce lien d'invitation n'existe pas ou a expiré. 
            Veuillez contacter votre propriétaire.
          </p>
        </div>
      </div>
    );
  }

  if (data.alreadySigned) {
    redirect(`/tenant/inspections/${data.edlId}`);
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <EDLSignatureClient
        token={token}
        edl={data.edl}
        property={data.property}
        signatureId={data.signature.id}
        identityComplete={data.identityComplete}
        leaseId={data.leaseId ?? ""}
        previewHtml={data.previewHtml ?? ""}
      />
    </div>
  );
}

