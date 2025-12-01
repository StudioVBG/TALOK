// @ts-nocheck
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { InspectionDetailClient } from "./InspectionDetailClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  return {
    title: "Détails EDL | Gestion Locative",
    description: "Visualiser et compléter l'état des lieux",
  };
}

async function fetchInspectionDetail(edlId: string, profileId: string) {
  const supabase = await createClient();

  // Fetch EDL with all related data
  const { data: edl, error } = await supabase
    .from("edl")
    .select(`
      *,
      leases!inner(
        id,
        loyer,
        type_bail,
        properties!inner(
          id,
          adresse_complete,
          ville,
          code_postal,
          owner_id
        ),
        lease_signers(
          role,
          profile_id,
          profiles(id, prenom, nom, email, avatar_url)
        )
      ),
      edl_items(
        id,
        room_name,
        item_name,
        condition,
        notes,
        created_at
      ),
      edl_media(
        id,
        item_id,
        storage_path,
        media_type,
        thumbnail_path,
        taken_at,
        created_at
      ),
      edl_signatures(
        id,
        signer_user,
        signer_role,
        signed_at,
        signature_image_path,
        ip_inet
      )
    `)
    .eq("id", edlId)
    .single();

  if (error || !edl) {
    console.error("[fetchInspectionDetail] Error:", error);
    return null;
  }

  // Check if user is the owner of the property
  const property = (edl.leases as any)?.properties;
  if (property?.owner_id !== profileId) {
    return null; // User doesn't have access
  }

  // Group items by room
  const roomsMap: Record<string, any[]> = {};
  for (const item of edl.edl_items || []) {
    if (!roomsMap[item.room_name]) {
      roomsMap[item.room_name] = [];
    }
    // Attach media to items
    const itemMedia = (edl.edl_media || []).filter(
      (m: any) => m.item_id === item.id
    );
    roomsMap[item.room_name].push({
      ...item,
      media: itemMedia,
    });
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

  // Get tenant info
  const tenantSigner = (edl.leases as any)?.lease_signers?.find(
    (s: any) => s.role === "locataire_principal" || s.role === "colocataire"
  );

  return {
    id: edl.id,
    type: edl.type,
    status: edl.status,
    scheduled_date: edl.scheduled_date,
    completed_date: edl.completed_date,
    created_at: edl.created_at,
    property: {
      id: property?.id,
      adresse_complete: property?.adresse_complete || "",
      ville: property?.ville || "",
      code_postal: property?.code_postal || "",
    },
    tenant: tenantSigner?.profiles
      ? {
          id: tenantSigner.profiles.id,
          prenom: tenantSigner.profiles.prenom,
          nom: tenantSigner.profiles.nom,
          email: tenantSigner.profiles.email,
          avatar_url: tenantSigner.profiles.avatar_url,
        }
      : null,
    rooms,
    signatures: edl.edl_signatures || [],
    generalMedia: (edl.edl_media || []).filter((m: any) => !m.item_id),
    stats: {
      totalItems: (edl.edl_items || []).length,
      completedItems: (edl.edl_items || []).filter((i: any) => i.condition).length,
      totalPhotos: (edl.edl_media || []).length,
      signaturesCount: (edl.edl_signatures || []).length,
    },
  };
}

function DetailSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

async function DetailContent({ edlId, profileId }: { edlId: string; profileId: string }) {
  const data = await fetchInspectionDetail(edlId, profileId);

  if (!data) {
    notFound();
  }

  return <InspectionDetailClient data={data} />;
}

export default async function InspectionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") redirect("/dashboard");

  return (
    <Suspense fallback={<DetailSkeleton />}>
      <DetailContent edlId={params.id} profileId={profile.id} />
    </Suspense>
  );
}

