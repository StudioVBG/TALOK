export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// @ts-nocheck
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LeaseHubNav } from "./LeaseHubNav";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function LeaseHubLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    redirect("/dashboard");
  }

  // Fetch minimal lease data for the hub header
  const { data: lease } = await supabase
    .from("leases")
    .select(`
      id,
      statut,
      type_bail,
      date_debut,
      property:properties!inner(
        id,
        adresse_complete,
        ville,
        owner_id
      )
    `)
    .eq("id", id)
    .single();

  if (!lease || (lease.property as any)?.owner_id !== profile.id) {
    redirect("/owner/leases");
  }

  // Get tenant name
  const { data: mainSigner } = await supabase
    .from("lease_signers")
    .select("profile:profiles(prenom, nom)")
    .eq("lease_id", id)
    .in("role", ["locataire_principal", "locataire", "tenant"])
    .limit(1)
    .maybeSingle();

  const tenantName = mainSigner?.profile
    ? `${(mainSigner.profile as any).prenom || ""} ${(mainSigner.profile as any).nom || ""}`.trim()
    : undefined;

  const property = lease.property as any;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <LeaseHubNav
        leaseId={id}
        leaseStatus={lease.statut}
        propertyAddress={property.adresse_complete || "Bien"}
        propertyCity={property.ville || ""}
        tenantName={tenantName}
      />
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {children}
      </div>
    </div>
  );
}
