// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import EDLSignatureClient from "./EDLSignatureClient";

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

  // 3. Récupérer les données liées pour l'aperçu complet
  const [
    { data: edl_items },
    { data: edl_media },
    { data: meterReadings },
    { data: signaturesRaw },
    { data: ownerProfile }
  ] = await Promise.all([
    serviceClient.from("edl_items").select("*").eq("edl_id", edl.id),
    serviceClient.from("edl_media").select("*").eq("edl_id", edl.id),
    serviceClient.from("edl_meter_readings").select("*, meter:meters(*)").eq("edl_id", edl.id),
    serviceClient.from("edl_signatures").select("*, profile:profiles(*)").eq("edl_id", edl.id),
    serviceClient.from("owner_profiles").select("*, profile:profiles(*)").eq("profile_id", property.owner_id).single()
  ]);

  return {
    signature: signatureEntry,
    edl,
    property,
    alreadySigned: false,
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
        fullData={data.edlFullData}
      />
    </div>
  );
}

