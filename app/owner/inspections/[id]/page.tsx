import { Suspense } from "react";
export const runtime = "nodejs";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { redirect, notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { InspectionDetailClient } from "./InspectionDetailClient";

export const dynamic = "force-dynamic";

// ─── Types ──────────────────────────────────────────────────────────────────

interface EDLProfile {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  avatar_url?: string;
  user_id?: string;
}

interface EDLSignature {
  id: string;
  edl_id: string;
  signer_user: string | null;
  signer_profile_id: string | null;
  signer_role: string;
  signer_name: string | null;
  signer_email: string | null;
  signed_at: string | null;
  signature_image_path: string | null;
  signature_image_url?: string;
  invitation_token: string | null;
  invitation_sent_at: string | null;
  ip_inet: string | null;
  proof_id: string | null;
  document_hash: string | null;
  profile?: EDLProfile | null;
}

interface EDLItem {
  id: string;
  edl_id: string;
  room_name: string;
  item_name: string;
  condition: string | null;
  notes: string | null;
  created_at: string;
}

interface EDLMedia {
  id: string;
  edl_id: string;
  item_id: string | null;
  storage_path: string;
  media_type: string;
  section: string | null;
  thumbnail_path: string | null;
  taken_at: string;
}

interface LeaseSigner {
  id: string;
  profile_id: string | null;
  role: string;
  signed_at: string | null;
  invited_email: string | null;
  invited_name: string | null;
  profile: EDLProfile | null;
}

interface Property {
  id: string;
  owner_id: string;
  adresse_complete: string;
  ville: string;
  code_postal: string;
  [key: string]: unknown;
}

interface Lease {
  id: string;
  property_id: string;
  property: Property | null;
  signers: LeaseSigner[];
  [key: string]: unknown;
}

interface MeterReading {
  id: string;
  edl_id: string;
  meter_id: string;
  reading_value: number | null;
  reading_unit: string | null;
  photo_path: string | null;
  ocr_value: number | null;
  ocr_confidence: number | null;
  is_validated: boolean;
  created_at: string;
  meter: {
    id: string;
    type: string;
    meter_number: string | null;
    serial_number: string | null;
    unit: string;
    location: string | null;
    [key: string]: unknown;
  } | null;
}

interface PropertyMeter {
  id: string;
  type: string;
  meter_number: string | null;
  serial_number: string | null;
  unit: string;
  location: string | null;
  is_active?: boolean;
  [key: string]: unknown;
}

interface RoomStats {
  total: number;
  completed: number;
  neuf: number;
  bon: number;
  moyen: number;
  mauvais: number;
  tres_mauvais: number;
}

interface Room {
  name: string;
  items: Array<EDLItem & { media: EDLMedia[] }>;
  stats: RoomStats;
}

// ─── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return {
    title: "Détails EDL | Talok",
    description: "Visualiser et compléter l'état des lieux",
  };
}

// ─── Data Fetching ──────────────────────────────────────────────────────────

async function fetchInspectionDetail(edlId: string, profileId: string) {
  const serviceClient = getServiceClient();

  // 1. Fetch EDL with related data
  const { data: edl, error } = await serviceClient
    .from("edl")
    .select(`
      *,
      lease:leases(
        *,
        property:properties(*),
        signers:lease_signers(
          *,
          profile:profiles(*, tenant_profile:tenant_profiles(*))
        )
      ),
      property_details:properties(*)
    `)
    .eq("id", edlId)
    .single();

  if (error || !edl) {
    console.error("[fetchInspectionDetail] EDL fetch error:", error?.message);
    return null;
  }

  // 2. Fetch items and media in parallel
  const [itemsResult, mediaResult, signaturesResult] = await Promise.all([
    serviceClient.from("edl_items").select("*").eq("edl_id", edlId),
    serviceClient.from("edl_media").select("*").eq("edl_id", edlId),
    serviceClient.from("edl_signatures").select("*").eq("edl_id", edlId),
  ]);

  if (itemsResult.error) console.error("[fetchInspectionDetail] edl_items error:", itemsResult.error.message);
  if (mediaResult.error) console.error("[fetchInspectionDetail] edl_media error:", mediaResult.error.message);
  if (signaturesResult.error) console.error("[fetchInspectionDetail] edl_signatures error:", signaturesResult.error.message);

  const edl_items: EDLItem[] = (itemsResult.data || []) as EDLItem[];
  const edl_media: EDLMedia[] = (mediaResult.data || []) as unknown as EDLMedia[];
  let edl_signatures: EDLSignature[] = (signaturesResult.data || []) as unknown as EDLSignature[];

  // 3. Attach profiles to signatures
  if (edl_signatures.length > 0) {
    const signerProfileIds = edl_signatures
      .map(s => s.signer_profile_id)
      .filter((id): id is string => !!id);

    if (signerProfileIds.length > 0) {
      const { data: signerProfiles } = await serviceClient
        .from("profiles")
        .select("*")
        .in("id", signerProfileIds);

      if (signerProfiles && signerProfiles.length > 0) {
        edl_signatures = edl_signatures.map(sig => ({
          ...sig,
          profile: (signerProfiles as EDLProfile[]).find(p => p.id === sig.signer_profile_id) || null,
        }));
      }
    }
  }

  // 4. Generate signed URLs for signature images (private bucket)
  for (const sig of edl_signatures) {
    if (sig.signature_image_path) {
      const { data: signedUrlData } = await serviceClient.storage
        .from("documents")
        .createSignedUrl(sig.signature_image_path, 3600);

      if (signedUrlData?.signedUrl) {
        sig.signature_image_url = signedUrlData.signedUrl;
      }
    }
  }

  // 5. Resolve lease and property
  const edlAny = edl as Record<string, unknown>;
  let lease: Lease | null = (edlAny.lease as Lease) || null;
  let property: Property | null = (lease?.property as Property) || (edlAny.property_details as Property) || null;

  // 6. AUTO-HEALING: Inject missing signatures from lease signers
  if (edl_signatures.length === 0 && lease?.signers) {
    const newSignatures = lease.signers.map((ls: LeaseSigner) => ({
      edl_id: edlId,
      signer_profile_id: ls.profile_id,
      signer_role: (ls.role === "proprietaire" || ls.role === "owner") ? "owner" : "tenant",
      invitation_token: crypto.randomUUID(),
    }));

    const { data: inserted, error: insertError } = await serviceClient
      .from("edl_signatures")
      .insert(newSignatures as unknown as Record<string, unknown>[])
      .select("*");

    if (insertError) {
      console.error("[fetchInspectionDetail] Failed to inject signers:", insertError.message);
    } else if (inserted) {
      const newProfileIds = inserted
        .map((s: Record<string, unknown>) => s.signer_profile_id as string)
        .filter(Boolean);
      if (newProfileIds.length > 0) {
        const { data: profiles } = await serviceClient
          .from("profiles")
          .select("*")
          .in("id", newProfileIds);
        edl_signatures = (inserted as unknown as EDLSignature[]).map(sig => ({
          ...sig,
          profile: (profiles as EDLProfile[] | null)?.find(p => p.id === sig.signer_profile_id) || null,
        }));
      } else {
        edl_signatures = inserted as unknown as EDLSignature[];
      }
    }
  }

  // 7. Fallback: find lease via property_id if not linked
  if (!lease && (property?.id || (edl as Record<string, unknown>).property_id)) {
    const propId = property?.id || (edl as Record<string, unknown>).property_id as string;
    const { data: propertyLease } = await serviceClient
      .from("leases")
      .select(`*, property:properties(*), signers:lease_signers(*, profile:profiles(*))`)
      .eq("property_id", propId)
      .in("statut", ["active", "fully_signed", "partially_signed", "pending_signature"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (propertyLease) {
      lease = propertyLease as unknown as Lease;
      if (!property) property = (propertyLease as Record<string, unknown>).property as Property;
    }
  }

  // 8. Fetch missing signers for lease
  if (lease && (!lease.signers || lease.signers.length === 0)) {
    const { data: signers } = await serviceClient
      .from("lease_signers")
      .select("*, profile:profiles(*)")
      .eq("lease_id", lease.id);
    if (signers && signers.length > 0) {
      lease = { ...lease, signers: signers as unknown as LeaseSigner[] };
    }
  }

  // 9. Fallback: find property via lease_id
  if (!property && (edl as Record<string, unknown>).lease_id) {
    const { data: leaseData } = await serviceClient
      .from("leases")
      .select(`*, property:properties(*), signers:lease_signers(*, profile:profiles(*))`)
      .eq("id", String((edl as Record<string, unknown>).lease_id ?? ""))
      .single();

    if ((leaseData as Record<string, unknown>)?.property) {
      property = (leaseData as Record<string, unknown>).property as Property;
      lease = leaseData as unknown as Lease;
    }
  }

  // 10. Final fallback for signers
  if (lease && (!lease.signers || lease.signers.length === 0)) {
    const { data: signers } = await serviceClient
      .from("lease_signers")
      .select("*, profile:profiles(*)")
      .eq("lease_id", lease.id);
    if (signers && signers.length > 0) {
      lease = { ...lease, signers: signers as unknown as LeaseSigner[] };
    }
  }

  // 11. Fetch missing profiles for signers
  if (lease?.signers && lease.signers.length > 0) {
    const signersWithMissingProfiles = lease.signers.filter(s => s.profile_id && !s.profile);

    if (signersWithMissingProfiles.length > 0) {
      const profileIds = signersWithMissingProfiles.map(s => s.profile_id).filter(Boolean) as string[];
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("*")
        .in("id", profileIds);

      if (profiles && profiles.length > 0) {
        lease.signers = lease.signers.map(s => {
          if (s.profile_id && !s.profile) {
            const matchedProfile = (profiles as EDLProfile[]).find(p => p.id === s.profile_id);
            if (matchedProfile) return { ...s, profile: matchedProfile };
          }
          return s;
        });
      }
    }
  }

  // 12. Last resort: fetch property by ID
  if (!property) {
    const propId = (edl as Record<string, unknown>).property_id as string | undefined;
    if (propId) {
      const { data: propData } = await serviceClient.from("properties").select("*").eq("id", propId).single();
      if (propData) property = propData as unknown as Property;
    }
  }

  if (!property) return null;

  // 13. Verify ownership
  if (property.owner_id !== profileId) {
    return null;
  }

  // 14. Fetch owner profile
  const { data: ownerProfile } = await serviceClient
    .from("owner_profiles")
    .select(`*, profile:profiles(*)`)
    .eq("profile_id", profileId)
    .single();

  // 15. Fetch meter readings and property meters in parallel
  let meterReadings: MeterReading[] = [];
  let propertyMeters: PropertyMeter[] = [];
  try {
    const [readingsResult, metersResult] = await Promise.all([
      serviceClient
        .from("edl_meter_readings")
        .select("id, edl_id, meter_id, reading_value, reading_unit, photo_path, ocr_value, ocr_confidence, is_validated, created_at, meter:meters(*)")
        .eq("edl_id", edlId),
      serviceClient
        .from("meters")
        .select("*")
        .eq("property_id", property.id),
    ]);

    if (!readingsResult.error) {
      meterReadings = (readingsResult.data || []) as unknown as MeterReading[];
    }
    if (!metersResult.error) {
      propertyMeters = ((metersResult.data || []) as unknown as PropertyMeter[]).filter(m => m?.is_active !== false);
    }
  } catch {
    // Non-blocking: meter data fetch failure shouldn't break the page
  }

  // 16. Build rooms from items + media
  const roomsMap: Record<string, Array<EDLItem & { media: EDLMedia[] }>> = {};
  for (const item of edl_items) {
    const roomName = item.room_name || "Général";
    if (!roomsMap[roomName]) roomsMap[roomName] = [];
    const itemMedia = edl_media.filter(m => m.item_id === item.id);
    roomsMap[roomName].push({ ...item, media: itemMedia });
  }

  const rooms: Room[] = Object.entries(roomsMap).map(([name, roomItems]) => {
    const completed = roomItems.filter(i => i.condition).length;
    return {
      name,
      items: roomItems,
      stats: {
        total: roomItems.length,
        completed,
        neuf: roomItems.filter(i => i.condition === "neuf").length,
        bon: roomItems.filter(i => i.condition === "bon").length,
        moyen: roomItems.filter(i => i.condition === "moyen").length,
        mauvais: roomItems.filter(i => i.condition === "mauvais").length,
        tres_mauvais: roomItems.filter(i => i.condition === "tres_mauvais").length,
      },
    };
  });

  return {
    raw: {
      ...edl,
      scheduled_at: (edl as Record<string, unknown>).scheduled_at ?? null,
      lease: lease ? { ...lease, property } : null,
      edl_items,
      edl_media,
      edl_signatures,
    },
    meterReadings,
    propertyMeters,
    ownerProfile,
    rooms,
    stats: {
      totalItems: edl_items.length,
      completedItems: edl_items.filter(i => i.condition).length,
      totalPhotos: edl_media.length,
      signaturesCount: edl_signatures.filter(s => s.signature_image_path && s.signed_at).length,
    },
  } as Parameters<typeof InspectionDetailClient>[0]["data"];
}

// ─── Components ─────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 sm:w-72" />
          <Skeleton className="h-4 w-36 sm:w-48" />
        </div>
        <Skeleton className="h-10 w-full sm:w-32" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
