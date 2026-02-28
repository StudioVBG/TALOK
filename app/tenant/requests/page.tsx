import { Suspense } from "react";
import Link from "next/link";
import { Plus, Wrench, MessageSquare, Info, ShieldAlert, Calendar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TicketListUnified } from "@/features/tickets/components/ticket-list-unified";
import { getTickets } from "@/features/tickets/server/data-fetching";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { PullToRefreshContainer } from "@/components/ui/pull-to-refresh-container";
import { createClient } from "@/lib/supabase/server";

async function getClaims() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: claims } = await supabase
      .from("claims")
      .select("id, claim_number, incident_date, description, status, estimated_damage, created_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    return claims || [];
  } catch {
    return [];
  }
}

const CLAIM_STATUS_MAP: Record<string, { label: string; color: string }> = {
  submitted: { label: "Soumis", color: "bg-blue-100 text-blue-700" },
  in_review: { label: "En examen", color: "bg-purple-100 text-purple-700" },
  approved: { label: "Approuvé", color: "bg-green-100 text-green-700" },
  rejected: { label: "Refusé", color: "bg-red-100 text-red-700" },
  paid: { label: "Indemnisé", color: "bg-emerald-100 text-emerald-700" },
};

export default async function TenantRequestsPage() {
  const [tickets, claims] = await Promise.all([
    getTickets("tenant"),
    getClaims(),
  ]);

  return (
    <PageTransition>
      <PullToRefreshContainer>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        
        {/* Header SOTA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-200 dark:shadow-blue-900/30">
                <Wrench className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Mes demandes</h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Signalez un problème ou suivez vos interventions en temps réel.
            </p>
          </div>
          
          <Button asChild className="h-12 px-6 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 font-bold rounded-xl transition-all hover:scale-105 active:scale-95">
            <Link href="/tenant/requests/new">
              <Plus className="mr-2 h-5 w-5" /> Nouvelle demande
            </Link>
          </Button>
        </div>

        {/* Note informative SOTA */}
        <div className="p-6 bg-muted rounded-3xl border border-border flex flex-col sm:flex-row items-start gap-4">
          <div className="p-2 bg-card rounded-xl shadow-sm border border-border shrink-0">
            <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="space-y-1 flex-1">
            <p className="font-bold text-foreground">Une assistance intelligente</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Utilisez notre assistant <strong>Tom</strong> lors de la création d'un ticket pour un diagnostic automatique et une prise en charge prioritaire par votre gestionnaire.
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 rounded-xl font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/30" asChild>
            <Link href="/tenant/requests/new">
              <Wrench className="h-3.5 w-3.5 mr-1.5" />
              Diagnostiquer avec Tom
            </Link>
          </Button>
        </div>

        {/* Liste des Tickets */}
        <Suspense fallback={
          <div className="space-y-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-[2rem]" />)}
          </div>
        }>
          <div className="space-y-4">
            <TicketListUnified tickets={tickets as any} variant="tenant" />
          </div>
        </Suspense>

        {/* Section Sinistres */}
        {claims.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-600 rounded-lg shadow-lg shadow-red-200 dark:shadow-red-900/30">
                <ShieldAlert className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">Mes sinistres</h2>
            </div>
            <div className="space-y-3">
              {claims.map((claim: any) => {
                const statusConfig = CLAIM_STATUS_MAP[claim.status] || CLAIM_STATUS_MAP.submitted;
                return (
                  <GlassCard key={claim.id} className="p-5 border-border bg-card">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground">
                            {claim.claim_number ? `Sinistre #${claim.claim_number}` : "Déclaration de sinistre"}
                          </p>
                          <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">{claim.description}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Incident du {new Date(claim.incident_date).toLocaleDateString("fr-FR")}
                          {claim.estimated_damage && ` — Estimation : ${Number(claim.estimated_damage).toLocaleString("fr-FR")} €`}
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          </div>
        )}

      </div>
      </PullToRefreshContainer>
    </PageTransition>
  );
}
