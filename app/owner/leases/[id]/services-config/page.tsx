export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { normalizePermissions } from "@/lib/tickets/tenant-service-permissions";
import { TenantServiceBookingsConfig } from "@/features/tickets/components/tenant-service-bookings-config";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leaseId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/signin?redirect=/owner/leases/${leaseId}/services-config`);

  const serviceClient = getServiceClient();

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) redirect("/auth/signin");

  const profileData = profile as { id: string; role: string };

  const { data: lease } = await serviceClient
    .from("leases")
    .select("id, property_id, tenant_service_bookings, statut")
    .eq("id", leaseId)
    .maybeSingle();

  if (!lease) notFound();
  const leaseData = lease as {
    id: string;
    property_id: string;
    tenant_service_bookings: any;
    statut: string;
  };

  if (profileData.role !== "admin") {
    const { data: property } = await serviceClient
      .from("properties")
      .select("owner_id")
      .eq("id", leaseData.property_id)
      .maybeSingle();
    const ownerId = (property as { owner_id: string } | null)?.owner_id;
    if (ownerId !== profileData.id) {
      redirect(`/owner/leases/${leaseId}`);
    }
  }

  const permissions = normalizePermissions(leaseData.tenant_service_bookings);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      <Link
        href={`/owner/leases/${leaseId}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Retour au bail
      </Link>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Services réservables par le locataire
        </h1>
        <p className="text-muted-foreground">
          Choisissez les catégories que votre locataire peut réserver
          directement auprès de nos prestataires partenaires.
        </p>
      </div>

      <TenantServiceBookingsConfig leaseId={leaseId} initial={permissions} />
    </div>
  );
}
