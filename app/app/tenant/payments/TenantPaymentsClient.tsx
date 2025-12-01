"use client";
// @ts-nocheck

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { Download, CreditCard, Receipt, Search } from "lucide-react";
import { PaymentCheckout } from "@/features/billing/components/payment-checkout";
import { Input } from "@/components/ui/input";

// SOTA Imports
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { EmptyState } from "@/components/ui/empty-state";

interface TenantPaymentsClientProps {
  invoices: any[];
}

export function TenantPaymentsClient({ invoices }: TenantPaymentsClientProps) {
  const router = useRouter();
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handlePaymentSuccess = () => {
    setIsPaymentOpen(false);
    router.refresh(); 
  };

  // Filtrage simple
  const filteredInvoices = invoices.filter(inv => 
    inv.periode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    formatCurrency(inv.montant_total).includes(searchQuery)
  );

  const columns = [
    {
        header: "Période",
        accessorKey: "periode" as const,
        cell: (invoice: any) => (
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${invoice.statut === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                    <Receipt className="h-4 w-4" />
                </div>
                <div>
                    <span className="font-semibold block text-slate-900">Loyer {invoice.periode}</span>
                    <span className="text-xs text-muted-foreground">{formatDateShort(invoice.created_at)}</span>
                </div>
            </div>
        )
    },
    {
        header: "Montant",
        className: "text-right",
        cell: (invoice: any) => (
            <div className="text-right">
                <span className="font-bold text-slate-900">{formatCurrency(invoice.montant_total)}</span>
                {invoice.montant_charges > 0 && (
                    <span className="text-xs text-muted-foreground block">dont {formatCurrency(invoice.montant_charges)} chg.</span>
                )}
            </div>
        )
    },
    {
        header: "Statut",
        className: "text-right",
        cell: (invoice: any) => (
            <div className="flex justify-end">
                <StatusBadge 
                    status={invoice.statut === "paid" ? "Payé" : "À régler"}
                    type={invoice.statut === "paid" ? "success" : "error"}
                />
            </div>
        )
    },
    {
        header: "Actions",
        className: "text-right",
        cell: (invoice: any) => (
            <div className="flex justify-end gap-2">
                {invoice.statut !== "paid" && (
                    <Button 
                        size="sm" 
                        className="h-8 gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                        onClick={() => {
                            setSelectedInvoice(invoice);
                            setIsPaymentOpen(true);
                        }}
                    >
                        <CreditCard className="h-3 w-3" />
                        <span className="hidden sm:inline">Payer</span>
                    </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700">
                    <Download className="h-4 w-4" />
                </Button>
            </div>
        )
    }
  ];

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Paiements</h1>
                <p className="text-muted-foreground mt-1">Historique de vos loyers et factures</p>
            </div>
            
            {/* Barre de recherche */}
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Rechercher..." 
                    className="pl-9 bg-white"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
        </div>

        {/* Dialog de paiement (Global) */}
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
            <DialogContent className="sm:max-w-md">
                {selectedInvoice && (
                <PaymentCheckout 
                    invoiceId={selectedInvoice.id}
                    amount={selectedInvoice.montant_total}
                    description={`Loyer ${selectedInvoice.periode}`}
                    onSuccess={handlePaymentSuccess}
                    onCancel={() => setIsPaymentOpen(false)}
                />
                )}
            </DialogContent>
        </Dialog>

        {filteredInvoices.length === 0 ? (
          <EmptyState 
            title="Aucune facture"
            description="Vous n'avez aucune facture ou reçu de paiement pour le moment."
            icon={Receipt}
          />
        ) : (
          <GlassCard className="p-0 overflow-hidden">
             <ResponsiveTable 
                data={filteredInvoices}
                columns={columns}
                keyExtractor={(inv) => inv.id}
             />
          </GlassCard>
        )}
      </div>
    </PageTransition>
  );
}
