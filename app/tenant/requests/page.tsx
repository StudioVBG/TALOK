import { Suspense } from "react";
import Link from "next/link";
import { Plus, Wrench, MessageSquare, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketListUnified } from "@/features/tickets/components/ticket-list-unified";
import { getTickets } from "@/features/tickets/server/data-fetching";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";

export default async function TenantRequestsPage() {
  const tickets = await getTickets("tenant");

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        
        {/* Header SOTA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-200">
                <Wrench className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Mes demandes</h1>
            </div>
            <p className="text-slate-500 text-lg">
              Signalez un problème ou suivez vos interventions en temps réel.
            </p>
          </div>
          
          <Button asChild className="h-12 px-6 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 font-bold rounded-xl transition-all hover:scale-105 active:scale-95">
            <Link href="/tenant/requests/new">
              <Plus className="mr-2 h-5 w-5" /> Nouvelle demande
            </Link>
          </Button>
        </div>

        {/* Note informative SOTA */}
        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-start gap-4">
          <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="space-y-1">
            <p className="font-bold text-slate-900">Une assistance intelligente</p>
            <p className="text-sm text-slate-500 leading-relaxed">
              Utilisez notre assistant <strong>Tom</strong> lors de la création d'un ticket pour un diagnostic automatique et une prise en charge prioritaire par votre gestionnaire.
            </p>
          </div>
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

      </div>
    </PageTransition>
  );
}
