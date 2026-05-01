// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { redirect, notFound } from "next/navigation";
import { JobDetailClient } from "./JobDetailClient";
import { Skeleton } from "@/components/ui/skeleton";


async function fetchJobDetails(jobId: string, profileId: string) {
  const serviceClient = getServiceClient();

  const { data: wo, error } = await serviceClient
    .from("work_orders")
    .select(`
      *,
      tickets!ticket_id(
        id,
        titre,
        description,
        priorite,
        statut,
        created_at,
        properties(
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

  if (wo.provider_id !== profileId) {
    return null;
  }

  // Récupère les paiements escrow associés pour piloter la UI prestataire :
  // savoir si l'acompte est sécurisé avant le démarrage des travaux et si
  // le solde est en attente.
  const { data: payments } = await serviceClient
    .from("work_order_payments")
    .select("payment_type, status, escrow_status, gross_amount, escrow_held_at, escrow_released_at")
    .eq("work_order_id", jobId);

  const paymentList = (payments ?? []) as Array<{
    payment_type: string;
    status: string;
    escrow_status: string;
    gross_amount: number | string;
    escrow_held_at: string | null;
    escrow_released_at: string | null;
  }>;

  const depositPayment = paymentList.find(
    (p) => p.payment_type === "deposit" && p.status === "succeeded"
  );
  const balancePayment = paymentList.find(
    (p) => (p.payment_type === "balance" || p.payment_type === "full") &&
           p.status === "succeeded"
  );

  return {
    id: wo.id,
    ticket_id: wo.ticket_id,
    title: wo.title || wo.tickets?.titre || "Intervention",
    description: wo.description || wo.tickets?.description || "",
    priority: wo.tickets?.priorite || "normale",
    // Modern EN status (source of truth pour le flow escrow)
    status: wo.status || null,
    // Legacy FR statut (fallback pour anciens WO)
    statut: wo.statut || null,
    quote_amount_cents: wo.quote_amount_cents ?? null,
    intervention_report: wo.intervention_report ?? null,
    dispute_deadline: wo.dispute_deadline ?? null,
    scheduled_date: wo.scheduled_date || wo.date_intervention_prevue,
    completed_at: wo.completed_at || wo.date_intervention_reelle,
    estimated_cost: wo.cout_estime,
    final_cost: wo.cout_final,
    provider_notes: wo.provider_notes,
    created_at: wo.created_at,

    property: {
      address: wo.tickets?.properties?.adresse_complete || "",
      city: wo.tickets?.properties?.ville || "",
      postalCode: wo.tickets?.properties?.code_postal || "",
    },
    owner: {
      name: `${wo.tickets?.properties?.owner?.prenom || ""} ${wo.tickets?.properties?.owner?.nom || ""}`.trim(),
      phone: wo.tickets?.properties?.owner?.telephone || null,
      email: wo.tickets?.properties?.owner?.email || null,
    },
    tenant: {
      name: wo.tickets?.tenant ? `${wo.tickets.tenant.prenom} ${wo.tickets.tenant.nom}` : "Non spécifié",
      phone: wo.tickets?.tenant?.telephone || null,
    },

    payments: {
      deposit: depositPayment
        ? {
            amount: Number(depositPayment.gross_amount),
            escrow_status: depositPayment.escrow_status,
            held_at: depositPayment.escrow_held_at,
            released_at: depositPayment.escrow_released_at,
          }
        : null,
      balance: balancePayment
        ? {
            amount: Number(balancePayment.gross_amount),
            escrow_status: balancePayment.escrow_status,
            held_at: balancePayment.escrow_held_at,
            released_at: balancePayment.escrow_released_at,
          }
        : null,
    },
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

  const serviceClient = getServiceClient();
  const { data: profile } = await serviceClient
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
