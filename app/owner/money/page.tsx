import { Suspense } from "react";
import { getOwnerInvoices } from "@/features/billing/server/data-fetching";
import { InvoiceListUnified } from "@/features/billing/components/invoice-list-unified";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PullToRefreshContainer } from "@/components/ui/pull-to-refresh-container";

// Server Component (Async)
export default async function OwnerMoneyPage() {
  const invoices = await getOwnerInvoices();

  return (
    <PullToRefreshContainer>
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
      {/* Header SOTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Finances</h1>
          <p className="text-muted-foreground mt-1">Gérez vos loyers et suivez vos encaissements</p>
        </div>
        
        <Button asChild className="shadow-lg shadow-blue-500/20">
          {/* Note: Idéalement, créer une Modale d'ajout rapide ici */}
          <Link href="/owner/invoices/new">
            <Plus className="mr-2 h-4 w-4" /> Créer une facture
          </Link>
        </Button>
      </div>

      {/* KPI Cards (À refactoriser plus tard dans features/billing/components/kpi-cards.tsx) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Revenus ce mois</p>
          <p className="text-3xl font-bold text-foreground mt-2">
            {/* Calcul rapide pour la démo - devrait être fait côté serveur */}
            {invoices
              .filter(i => i.statut === 'paid')
              .reduce((acc, curr) => acc + curr.montant_total, 0)
              .toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
        {/* ... Autres KPIs ... */}
      </div>

      {/* Liste Unifiée */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Historique des factures</h2>
        </div>
        
        <Suspense fallback={<div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>}>
          <InvoiceListUnified invoices={invoices as any} variant="owner" />
        </Suspense>
      </div>
    </div>
    </PullToRefreshContainer>
  );
}
