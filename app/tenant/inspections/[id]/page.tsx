export const dynamic = "force-dynamic";

import { Suspense } from "react";
export const runtime = "nodejs";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { redirect, notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import TenantEDLDetailClient from "./TenantEDLDetailClient";

export async function generateMetadata({ params }: { params: { id: string } }) {
  return {
    title: "État des lieux | Talok",
    description: "Consulter et signer l'état des lieux",
  };
}

async function fetchTenantEDL(edlId: string, profileId: string) {
  const supabase = await createClient();
  const serviceClient = getServiceClient(); // Pour bypass RLS sur certaines requêtes

  console.log(`[fetchTenantEDL] Starting fetch for edlId: ${edlId}, profileId: ${profileId}`);

  // Récupérer le user_id du profil pour la recherche
  const { data: profileData } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("id", profileId)
    .single();
  
  const userId = profileData?.user_id;
  console.log(`[fetchTenantEDL] User ID: ${userId}`);

  // Vérifier que le locataire est bien signataire de cet EDL
  // Recherche par signer_profile_id OU signer_user_id
  let mySignature = null;
  
  // Essai 1: par signer_profile_id
  const { data: sigByProfile } = await supabase
    .from("edl_signatures")
    .select("*")
    .eq("edl_id", edlId)
    .eq("signer_profile_id", profileId)
    .maybeSingle();
  
  if (sigByProfile) {
    mySignature = sigByProfile;
    console.log(`[fetchTenantEDL] Found signature by profile_id`);
  } else if (userId) {
    // Essai 2: par signer_user_id
    const { data: sigByUser } = await supabase
      .from("edl_signatures")
      .select("*")
      .eq("edl_id", edlId)
      .eq("signer_user_id", userId)
      .maybeSingle();
    
    if (sigByUser) {
      mySignature = sigByUser;
      console.log(`[fetchTenantEDL] Found signature by user_id`);
    }
  }

  // Essai 3: Vérifier si le locataire est signataire du bail associé à l'EDL
  if (!mySignature) {
    console.log(`[fetchTenantEDL] No direct signature found, checking lease signers...`);
    
    // Récupérer l'EDL pour avoir le lease_id
    const { data: edlForLease } = await supabase
      .from("edl")
      .select("lease_id")
      .eq("id", edlId)
      .single();
    
    if (edlForLease?.lease_id) {
      // Vérifier si le locataire est signataire du bail
      const { data: leaseSigner } = await supabase
        .from("lease_signers")
        .select("*")
        .eq("lease_id", edlForLease.lease_id)
        .eq("profile_id", profileId)
        .maybeSingle();
      
      if (leaseSigner) {
        console.log(`[fetchTenantEDL] Found as lease signer, allowing access`);
        // Créer une signature virtuelle pour permettre l'accès
        mySignature = { id: 'virtual', signer_role: 'tenant', edl_id: edlId };
      }
    }
  }

  if (!mySignature) {
    console.error("[fetchTenantEDL] Not a signer - access denied");
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
      )
    `
    )
    .eq("id", edlId)
    .single();

  if (error || !edl) {
    console.error("[fetchTenantEDL] EDL not found or error:", error);
    return null;
  }

  console.log(`[fetchTenantEDL] EDL loaded, lease_id: ${edl.lease_id}, property_id: ${edl.property_id}`);

  let finalProperty = edl.lease?.property;
  
  // Si la propriété n'est pas récupérée via la relation, essayer avec le service client (bypass RLS)
  if (!finalProperty) {
    console.log("[fetchTenantEDL] Property not found via lease relation, trying with service client...");
    
    // Essai 1: Via property_id direct de l'EDL
    if (edl.property_id) {
      const { data: propDirect } = await serviceClient
        .from("properties")
        .select("*")
        .eq("id", edl.property_id)
        .single();
      if (propDirect) {
        finalProperty = propDirect;
        console.log("[fetchTenantEDL] Found property via property_id (service client)");
      }
    }
    
    // Essai 2: Via le bail
    if (!finalProperty && edl.lease_id) {
      const { data: leaseData } = await serviceClient
        .from("leases")
        .select("property_id")
        .eq("id", edl.lease_id)
        .single();
      
      if (leaseData?.property_id) {
        const { data: propViaLease } = await serviceClient
          .from("properties")
          .select("*")
          .eq("id", leaseData.property_id)
          .single();
        if (propViaLease) {
          finalProperty = propViaLease;
          console.log("[fetchTenantEDL] Found property via lease.property_id (service client)");
        }
      }
    }
  }
  
  if (!finalProperty) {
    console.error("[fetchTenantEDL] Property definitively not found");
    return null;
  }
  
  console.log(`[fetchTenantEDL] Property found: ${finalProperty.adresse_complete}`);
  
  // Mettre à jour l'EDL avec la propriété trouvée
  if (!edl.lease) {
    (edl as any).lease = { property: finalProperty };
  } else if (!edl.lease.property) {
    (edl as any).lease.property = finalProperty;
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

  // Générer des URLs signées pour les images de signature (bypass RLS via serviceClient)
  for (const sig of edl_signatures) {
    if (sig.signature_image_path) {
      try {
        const { data: signedUrlData } = await serviceClient.storage
          .from("documents")
          .createSignedUrl(sig.signature_image_path, 3600);
        if (signedUrlData?.signedUrl) {
          (sig as any).signature_image_url = signedUrlData.signedUrl;
          console.log(`[fetchTenantEDL] ✅ Signed URL generated for ${sig.signer_role}`);
        }
      } catch (err) {
        console.warn("[fetchTenantEDL] Failed to sign URL for signature image", sig.signature_image_path);
      }
    } else if (sig.signer_role === 'tenant' && sig.signed_at) {
      // 🔧 FALLBACK: Utiliser l'image du bail si manquante dans l'EDL
      const leaseId = edl.lease_id;
      const userId = sig.signer_user;
      
      if (leaseId && userId) {
        const { data: leaseFiles } = await serviceClient.storage
          .from("documents")
          .list(`signatures/${leaseId}`);
        
        const tenantLeaseFile = leaseFiles?.find(f => f.name.startsWith(userId));
        if (tenantLeaseFile) {
          try {
            const fallbackPath = `signatures/${leaseId}/${tenantLeaseFile.name}`;
            const { data: signedUrlData } = await serviceClient.storage
              .from("documents")
              .createSignedUrl(fallbackPath, 3600);
            
            if (signedUrlData?.signedUrl) {
              (sig as any).signature_image_url = signedUrlData.signedUrl;
              console.log("[fetchTenantEDL] ✅ Generated FALLBACK signed URL for tenant signature from lease");
            }
          } catch (e) {}
        }
      }
    }
  }

  // Générer des URLs signées pour les photos des pièces
  for (const m of (edl_media || [])) {
    if (m.storage_path) {
      try {
        const { data: signedUrlData } = await serviceClient.storage
          .from("documents")
          .createSignedUrl(m.storage_path, 3600);
        if (signedUrlData?.signedUrl) {
          (m as any).signed_url = signedUrlData.signedUrl;
        }
      } catch (err) {
        console.warn("[fetchTenantEDL] Failed to sign URL for photo", m.storage_path);
      }
    }
  }

  // Récupérer les relevés de compteurs (serviceClient pour bypass RLS et garantir meter_id)
  let meterReadings: any[] = [];
  try {
    const { data: readings, error: readingsError } = await serviceClient
      .from("edl_meter_readings")
      .select("id, edl_id, meter_id, reading_value, reading_unit, photo_path, ocr_value, ocr_confidence, is_validated, created_at, meter:meters(*)")
      .eq("edl_id", edlId);

    if (readingsError) {
      console.warn("[fetchTenantEDL] edl_meter_readings fetch error:", readingsError.message);
    } else {
      meterReadings = readings || [];
      console.log(`[fetchTenantEDL] Fetched ${meterReadings.length} meter readings`);
    }
  } catch (e) {
    console.warn("[fetchTenantEDL] edl_meter_readings fetch failed:", e);
  }

  // 🔧 NOUVEAU: Récupérer tous les compteurs actifs du logement pour le locataire
  let allPropertyMeters: any[] = [];
  const propertyId = edl.property_id || edl.lease?.property_id;
  if (propertyId) {
    try {
      const { data: meters } = await serviceClient
        .from("meters")
        .select("id, type, meter_number, serial_number, location, unit")
        .eq("property_id", propertyId)
        .eq("is_active", true);
      allPropertyMeters = meters || [];
    } catch (e) {
      console.warn("[fetchTenantEDL] Failed to fetch all property meters:", e);
    }
  }

  // Récupérer le profil du bailleur (via serviceClient pour bypass RLS)
  const { data: ownerProfile } = await serviceClient
    .from("owner_profiles")
    .select("*, profile:profiles(*)")
    .eq("profile_id", finalProperty.owner_id)
    .single();

  console.log(`[fetchTenantEDL] Owner profile found: ${ownerProfile?.profile?.prenom} ${ownerProfile?.profile?.nom}`);

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
      lease: edl.lease ? { ...edl.lease, property: finalProperty } : { property: finalProperty },
      edl_items: edl_items || [],
      edl_media: edl_media || [],
      edl_signatures: edl_signatures || [],
    },
    mySignature: mySignature ? {
      ...mySignature,
      signature_image_url: edl_signatures.find(
        (s: any) => s.id === mySignature.id
      )?.signature_image_url,
    } : null,
    meterReadings,
    allPropertyMeters, // On passe tous les compteurs
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



