import { Suspense } from "react";
export const runtime = "nodejs";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { redirect, notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { InspectionDetailClient } from "./InspectionDetailClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return {
    title: "Détails EDL | Talok",
    description: "Visualiser et compléter l'état des lieux",
  };
}

async function fetchInspectionDetail(edlId: string, profileId: string) {
  const supabase = await createClient();
  // Use service client for all queries that need to bypass RLS
  const serviceClient = getServiceClient();

  console.log("[fetchInspectionDetail] Fetching EDL:", edlId);

  // Fetch EDL with basic related data using service client to avoid RLS issues
  const { data: edl, error } = await serviceClient
    .from("edl")
    .select(`
      *,
      lease:leases(
        *,
        property:properties(
          *
        ),
        signers:lease_signers(
          *,
          profile:profiles(
            *,
            tenant_profile:tenant_profiles(*)
          )
        )
      ),
      property_details:properties(*)
    `)
    .eq("id", edlId)
    .single();

  if (error || !edl) {
    console.error("[fetchInspectionDetail] EDL not found or error:", error);
    return null;
  }

  // Fetch items and media separately to avoid heavy join
  const { data: edl_items } = await serviceClient.from("edl_items").select("*").eq("edl_id", edlId);
  const { data: edl_media } = await serviceClient.from("edl_media").select("*").eq("edl_id", edlId);

  // Fetch signatures
  const { data: signaturesRaw } = await serviceClient
    .from("edl_signatures")
    .select("*")
    .eq("edl_id", edlId);

  let edl_signatures = signaturesRaw || [];

  // Retrieve signer profiles using service client (bypasses RLS)
  if (edl_signatures.length > 0) {
    const signerProfileIds = edl_signatures
      .map((s: any) => s.signer_profile_id)
      .filter(Boolean);

    if (signerProfileIds.length > 0) {
      const { data: signerProfiles } = await serviceClient
        .from("profiles")
        .select("*")
        .in("id", signerProfileIds);

      if (signerProfiles && signerProfiles.length > 0) {
        console.log("[fetchInspectionDetail] Found signer profiles:", signerProfiles.map((p: any) => `${p.prenom} ${p.nom}`));

        // Attach profiles to signatures
        edl_signatures = edl_signatures.map((sig: any) => {
          const profile = signerProfiles.find((p: any) => p.id === sig.signer_profile_id);
          return { ...sig, profile };
        });
      }
    }
  }

  // Generate signed URLs for signature images (private bucket)
  for (const sig of edl_signatures) {
    if (sig.signature_image_path) {
      const { data: signedUrlData } = await serviceClient.storage
        .from("documents")
        .createSignedUrl(sig.signature_image_path, 3600);

      if (signedUrlData?.signedUrl) {
        (sig as any).signature_image_url = signedUrlData.signedUrl;
        console.log("[fetchInspectionDetail] Generated signed URL for signature:", sig.signer_role);
      }
    }
  }

  // Get the lease and property (from lease or directly)
  let lease = (edl as any).lease;
  let property = lease?.property || (edl as any).property_details;

  // AUTO-HEALING: If no signatures exist for this EDL, inject them from the lease
  // Use service client to bypass RLS (edl_signatures INSERT requires signer_user = auth.uid())
  if (edl_signatures.length === 0 && lease?.signers) {
    console.log("[fetchInspectionDetail] Injecting missing signers from lease to edl_signatures");
    const newSignatures = lease.signers.map((ls: any) => ({
      edl_id: edlId,
      signer_profile_id: ls.profile_id,
      signer_role: (ls.role === "proprietaire" || ls.role === "owner") ? "owner" : "tenant",
      invitation_token: crypto.randomUUID(),
    }));

    const { data: inserted, error: insertError } = await serviceClient
      .from("edl_signatures")
      .insert(newSignatures)
      .select("*");

    if (insertError) {
      console.error("[fetchInspectionDetail] Failed to inject signers:", insertError.message);
    } else if (inserted) {
      // Fetch profiles for the newly inserted signatures
      const newProfileIds = inserted.map((s: any) => s.signer_profile_id).filter(Boolean);
      if (newProfileIds.length > 0) {
        const { data: profiles } = await serviceClient
          .from("profiles")
          .select("*")
          .in("id", newProfileIds);
        edl_signatures = inserted.map((sig: any) => ({
          ...sig,
          profile: profiles?.find((p: any) => p.id === sig.signer_profile_id) || null,
        }));
      } else {
        edl_signatures = inserted;
      }
      console.log("[fetchInspectionDetail] Signers injected successfully");
    }
  }


  // If no lease linked but we have a property_id, search for active lease
  if (!lease && (property?.id || edl.property_id)) {
    const propId = property?.id || edl.property_id;
    console.log("[fetchInspectionDetail] No lease linked, searching for active lease on property:", propId);
    const { data: propertyLease } = await serviceClient
      .from("leases")
      .select(`
        *,
        property:properties(*),
        signers:lease_signers(*, profile:profiles(*))
      `)
      .eq("property_id", propId)
      .in("statut", ["active", "fully_signed", "partially_signed", "pending_signature"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (propertyLease) {
      lease = propertyLease;
      if (!property) property = propertyLease.property;
      console.log("[fetchInspectionDetail] Found lease via property:", lease.id, "with", lease.signers?.length || 0, "signers");
    }
  }

  // If lease exists but signers are missing, fetch them separately
  if (lease && (!lease.signers || lease.signers.length === 0)) {
    console.log("[fetchInspectionDetail] Signers missing, fetching separately for lease:", lease.id);
    const { data: signers } = await serviceClient
      .from("lease_signers")
      .select("*, profile:profiles(*)")
      .eq("lease_id", lease.id);
    if (signers && signers.length > 0) {
      lease = { ...lease, signers };
      console.log("[fetchInspectionDetail] Found", signers.length, "signers");
    }
  }

  // If property is still missing, try to find it via lease_id
  if (!property && edl.lease_id) {
    console.log("[fetchInspectionDetail] Property missing, fetching via lease_id:", edl.lease_id);
    const { data: leaseData } = await serviceClient
      .from("leases")
      .select(`
        *,
        property:properties(*),
        signers:lease_signers(*, profile:profiles(*))
      `)
      .eq("id", edl.lease_id)
      .single();

    if (leaseData?.property) {
      property = leaseData.property;
      lease = leaseData;
    }
  }

  // Final fallback: if we have lease but no signers yet
  if (lease && (!lease.signers || lease.signers.length === 0)) {
    const { data: signers } = await serviceClient
      .from("lease_signers")
      .select("*, profile:profiles(*)")
      .eq("lease_id", lease.id);
    if (signers && signers.length > 0) {
      lease = { ...lease, signers };
    }
  }

  // If signers have profile_id but no profile (RLS blocking), fetch profiles separately
  if (lease?.signers && lease.signers.length > 0) {
    const signersWithMissingProfiles = lease.signers.filter((s: any) => s.profile_id && !s.profile);

    if (signersWithMissingProfiles.length > 0) {
      console.log("[fetchInspectionDetail] Fetching missing profiles for signers:", signersWithMissingProfiles.length);

      const profileIds = signersWithMissingProfiles.map((s: any) => s.profile_id);
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("*")
        .in("id", profileIds);

      if (profiles && profiles.length > 0) {
        console.log("[fetchInspectionDetail] Found profiles:", profiles.length, profiles.map((p: any) => p.prenom));

        lease.signers = lease.signers.map((s: any) => {
          if (s.profile_id && !s.profile) {
            const matchedProfile = profiles.find((p: any) => p.id === s.profile_id);
            if (matchedProfile) {
              return { ...s, profile: matchedProfile };
            }
          }
          return s;
        });
      }
    }
  }

  if (!property) {
    console.error("[fetchInspectionDetail] CRITICAL: No property found for EDL", edl.id);
    if (edl.property_id) {
      const { data: propData } = await serviceClient.from("properties").select("*").eq("id", edl.property_id).single();
      if (propData) property = propData;
    }
  }

  if (!property) return null;

  // Check if user is the owner of the property
  if (property.owner_id !== profileId) {
    console.error("[fetchInspectionDetail] Ownership mismatch:", property.owner_id, "vs", profileId);
    return null;
  }

  // Fetch owner profile using service client
  const { data: ownerProfile } = await serviceClient
    .from("owner_profiles")
    .select(`
      *,
      profile:profiles(*)
    `)
    .eq("profile_id", profileId)
    .single();

  // Fetch meter readings (serviceClient already defined above)
  let meterReadings: any[] = [];
  let propertyMeters: any[] = [];
  try {
    const { data: readings, error: readingsError } = await serviceClient
      .from("edl_meter_readings")
      .select("id, edl_id, meter_id, reading_value, reading_unit, photo_path, ocr_value, ocr_confidence, is_validated, created_at, meter:meters(*)")
      .eq("edl_id", edlId);

    if (readingsError) {
      console.warn("[fetchInspectionDetail] edl_meter_readings fetch error:", readingsError.message);
    } else {
      meterReadings = readings || [];
      console.log(`[fetchInspectionDetail] Fetched ${meterReadings.length} meter readings`);
    }

    // Récupérer également tous les compteurs du bien
    const { data: meters, error: metersError } = await serviceClient
      .from("meters")
      .select("*")
      .eq("property_id", property.id);

    if (metersError) {
      console.warn("[fetchInspectionDetail] property meters fetch failed:", metersError);
    } else {
      // Filtrer en JS pour éviter les erreurs si la colonne is_active n'existe pas encore
      propertyMeters = meters?.filter(m => m.is_active !== false) || [];
    }
  } catch (e) {
    console.warn("[fetchInspectionDetail] meter data fetch failed", e);
  }

  // 🔧 FIX: Reconstruire la variable rooms manquante pour l'affichage
  const items = edl_items || [];
  const media = edl_media || [];
  
  const roomsMap = items.reduce((acc: any, item: any) => {
    const roomName = item.room_name || "Général";
    if (!acc[roomName]) acc[roomName] = [];
    
    // Attacher les médias de cet item
    const itemMedia = media.filter((m: any) => m.item_id === item.id);
    
    acc[roomName].push({
      ...item,
      media: itemMedia
    });
    return acc;
  }, {});

  const rooms = Object.entries(roomsMap).map(([name, items]: [string, any[]]) => {
    const completed = items.filter(i => i.condition).length;
    return {
      name,
      items,
      stats: {
        total: items.length,
        completed,
        bon: items.filter(i => i.condition === 'bon').length,
        moyen: items.filter(i => i.condition === 'moyen').length,
        mauvais: items.filter(i => i.condition === 'mauvais').length,
        tres_mauvais: items.filter(i => i.condition === 'tres_mauvais').length,
      }
    };
  });

  return {
    raw: {
      ...edl,
      lease: lease ? {
        ...lease,
        property,
      } : null,
      edl_items: items,
      edl_media: media,
      edl_signatures: edl_signatures || [],
    },
    meterReadings,
    propertyMeters,
    ownerProfile,
    rooms,
    stats: {
      totalItems: items.length,
      completedItems: items.filter((i: any) => i.condition).length,
      totalPhotos: media.length,
      signaturesCount: (edl_signatures || []).filter((s: any) => s.signature_image_path && s.signed_at).length,
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
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
      <DetailContent edlId={id} profileId={profile.id} />
    </Suspense>
  );
}

