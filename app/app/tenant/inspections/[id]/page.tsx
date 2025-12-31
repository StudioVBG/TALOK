// @ts-nocheck
export const dynamic = "force-dynamic";

import { Suspense } from "react";
export const runtime = "nodejs";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import TenantEDLDetailClient from "./TenantEDLDetailClient";

export async function generateMetadata({ params }: { params: { id: string } }) {
  return {
    title: "État des lieux | Gestion Locative",
    description: "Consulter et signer l'état des lieux",
  };
}

async function fetchTenantEDL(edlId: string, profileId: string) {
  const supabase = await createClient();

  // Vérifier que le locataire est bien signataire de cet EDL
  const { data: mySignature, error: sigError } = await supabase
    .from("edl_signatures")
    .select("*")
    .eq("edl_id", edlId)
    .eq("signer_profile_id", profileId)
    .single();

  if (sigError || !mySignature) {
    console.error("[fetchTenantEDL] Not a signer:", sigError);
    return null;
  }

  // Récupérer l'EDL complet
  const { data: edl, error } = await supabase
    .from("edl")
    .select(
      `
      *,
      lease:lease_id(
        *,
        property:properties(*)
      ),
      property_details:property_id(*)
    `
    )
    .eq("id", edlId)
    .single();

  if (error || !edl) {
    console.error("[fetchTenantEDL] EDL not found:", error);
    return null;
  }

  const property = edl.lease?.property || edl.property_details;
  if (!property) {
    console.error("[fetchTenantEDL] Property not found");
    return null;
  }

  // Récupérer les items, médias et signatures
  const [{ data: edl_items }, { data: edl_media }, { data: signaturesRaw }] =
    await Promise.all([
      supabase.from("edl_items").select("*").eq("edl_id", edlId),
      supabase.from("edl_media").select("*").eq("edl_id", edlId),
      supabase
        .from("edl_signatures")
        .select("*, profile:signer_profile_id(*)")
        .eq("edl_id", edlId),
    ]);

  let edl_signatures = signaturesRaw || [];

  // Générer des URLs signées pour les images de signature
  for (const sig of edl_signatures) {
    if (sig.signature_image_path) {
      const { data: signedUrlData } = await supabase.storage
        .from("documents")
        .createSignedUrl(sig.signature_image_path, 3600);
      if (signedUrlData?.signedUrl) {
        (sig as any).signature_image_url = signedUrlData.signedUrl;
      }
    }
  }

  // Récupérer les relevés de compteurs
  let meterReadings: any[] = [];
  try {
    const { data: readings } = await supabase
      .from("edl_meter_readings")
      .select("*, meter:meters(*)")
      .eq("edl_id", edlId);
    meterReadings = readings || [];
  } catch (e) {
    console.warn("[fetchTenantEDL] edl_meter_readings fetch failed");
  }

  // Récupérer le profil du bailleur
  const { data: ownerProfile } = await supabase
    .from("owner_profiles")
    .select("*, profile:profiles(*)")
    .eq("profile_id", property.owner_id)
    .single();

  // Group items by room
  const roomsMap: Record<string, any[]> = {};
  for (const item of edl_items || []) {
    if (!roomsMap[item.room_name]) {
      roomsMap[item.room_name] = [];
    }
    const itemMedia = (edl_media || []).filter((m: any) => m.item_id === item.id);
    roomsMap[item.room_name].push({ ...item, media: itemMedia });
  }

  const rooms = Object.entries(roomsMap).map(([name, items]) => ({
    name,
    items,
    stats: {
      total: items.length,
      completed: items.filter((i: any) => i.condition).length,
      bon: items.filter((i: any) => i.condition === "bon").length,
      moyen: items.filter((i: any) => i.condition === "moyen").length,
      mauvais: items.filter((i: any) => i.condition === "mauvais").length,
      tres_mauvais: items.filter((i: any) => i.condition === "tres_mauvais").length,
    },
  }));

  return {
    raw: {
      ...edl,
      lease: edl.lease ? { ...edl.lease, property } : { property },
      edl_items: edl_items || [],
      edl_media: edl_media || [],
      edl_signatures: edl_signatures || [],
    },
    mySignature: {
      ...mySignature,
      signature_image_url: edl_signatures.find(
        (s: any) => s.id === mySignature.id
      )?.signature_image_url,
    },
    meterReadings,
    ownerProfile,
    rooms,
    stats: {
      totalItems: (edl_items || []).length,
      completedItems: (edl_items || []).filter((i: any) => i.condition).length,
      totalPhotos: (edl_media || []).length,
      signaturesCount: (edl_signatures || []).filter(
        (s: any) => s.signature_image_path && s.signed_at
      ).length,
    },
  };
}

function DetailSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

async function DetailContent({
  edlId,
  profileId,
}: {
  edlId: string;
  profileId: string;
}) {
  const data = await fetchTenantEDL(edlId, profileId);

  if (!data) {
    notFound();
  }

  return <TenantEDLDetailClient data={data} profileId={profileId} />;
}

export default async function TenantEDLDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "tenant") redirect("/dashboard");

  return (
    <Suspense fallback={<DetailSkeleton />}>
      <DetailContent edlId={params.id} profileId={profile.id} />
    </Suspense>
  );
}



