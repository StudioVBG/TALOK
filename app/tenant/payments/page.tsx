import { Suspense } from "react";
import { getTenantInvoices } from "@/features/billing/server/data-fetching";
import { InvoiceListUnified } from "@/features/billing/components/invoice-list-unified";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck } from "lucide-react";

export default async function TenantPaymentsPage() {
  const invoices = await getTenantInvoices();

  // Calcul du montant à payer (tout ce qui n'est pas payé)
  const toPay = invoices
    .filter((i: any) => i.statut !== 'paid' && i.statut !== 'cancelled')
    .reduce((acc: number, curr: any) => acc + curr.montant_total, 0);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Mes Paiements</h1>
        <p className="text-slate-500 mt-1">Retrouvez vos factures et quittances de loyer</p>
      </div>

      {/* État des lieux financier */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className={`p-6 rounded-2xl border ${toPay > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
          <p className="text-sm font-medium opacity-80 mb-2">Reste à payer</p>
          <p className={`text-4xl font-bold ${toPay > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
            {toPay.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
          </p>
          {toPay === 0 && (
            <div className="flex items-center gap-2 mt-4 text-emerald-700 text-sm font-medium">
              <ShieldCheck className="h-4 w-4" />
              Vous êtes à jour !
            </div>
          )}
        </div>
      </div>

      {/* Liste Unifiée */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-6">Historique</h2>
        
        <Suspense fallback={<div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>}>
          <InvoiceListUnified invoices={invoices as any} variant="tenant" />
        </Suspense>
      </div>
    </div>
  );
}
