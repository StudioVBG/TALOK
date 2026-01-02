// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { JobDetailClient } from "./JobDetailClient";
import { Skeleton } from "@/components/ui/skeleton";


async function fetchJobDetails(jobId: string, profileId: string) {
  const supabase = await createClient();

  const { data: wo, error } = await supabase
    .from("work_orders")
    .select(`
      *,
      tickets!inner(
        id,
        titre,
        description,
        priorite,
        statut,
        created_at,
        properties!inner(
          id,
          adresse_complete, 
          ville, 
          code_postal, 
          owner:profiles!properties_owner_id_fkey(
            prenom, 
            nom, 
            telephone, 
            email
          )
        ),
        tenant:profiles!created_by_profile_id(
          prenom, 
          nom, 
          telephone
        )
      )
    `)
    .eq("id", jobId)
    .single();

  if (error || !wo) {
    console.error("[fetchJobDetails] Error:", error);
    return null;
  }

  // Vérifier la permission
  if (wo.provider_id !== profileId) {
    return null;
  }

  return {
    id: wo.id,
    ticket_id: wo.ticket_id,
    title: wo.tickets?.titre || "",
    description: wo.tickets?.description || "",
    priority: wo.tickets?.priorite || "normale",
    status: wo.statut,
    
    // Property Info
    property: {
      address: wo.tickets?.properties?.adresse_complete || "",
      city: wo.tickets?.properties?.ville || "",
      postalCode: wo.tickets?.properties?.code_postal || "",
    },

    // Contacts
    owner: {
      name: `${wo.tickets?.properties?.owner?.prenom || ""} ${wo.tickets?.properties?.owner?.nom || ""}`.trim(),
      phone: wo.tickets?.properties?.owner?.telephone || null,
      email: wo.tickets?.properties?.owner?.email || null,
    },
    tenant: {
      name: wo.tickets?.tenant ? `${wo.tickets.tenant.prenom} ${wo.tickets.tenant.nom}` : "Non spécifié",
      phone: wo.tickets?.tenant?.telephone || null,
    },

    // Job details
    scheduled_date: wo.date_intervention_prevue,
    completed_date: wo.date_intervention_reelle,
    estimated_cost: wo.cout_estime,
    final_cost: wo.cout_final,
    provider_notes: wo.provider_notes,
    created_at: wo.created_at,
    photos_before: wo.photos_before || [],
    photos_after: wo.photos_after || [],
  };
}

function JobSkeleton() {
  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-6">
      <Skeleton className="h-8 w-2/3" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </div>
  );
}

async function JobContent({ jobId, profileId }: { jobId: string; profileId: string }) {
  const job = await fetchJobDetails(jobId, profileId);
  
  if (!job) notFound();
  
  return <JobDetailClient job={job} />;
}

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "provider") redirect("/dashboard");

  return (
    <Suspense fallback={<JobSkeleton />}>
      <JobContent jobId={params.id} profileId={profile.id} />
    </Suspense>
  );
}
