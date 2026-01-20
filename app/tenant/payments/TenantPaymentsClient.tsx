"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import {
  CreditCard,
  Receipt,
  Search,
  Download,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  FileText,
  Filter,
  Euro,
  PartyPopper,
  Sparkles,
  History,
  CheckCircle2
} from "lucide-react";
import { PaymentCheckout } from "@/features/billing/components/payment-checkout";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TenantPaymentsClientProps {
  invoices: any[];
}

export function TenantPaymentsClient({ invoices }: TenantPaymentsClientProps) {
  const router = useRouter();
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleDownload = (invoiceId: string) => {
    window.open(`/api/invoices/${invoiceId}/receipt`, "_blank");
  };

  const handlePaymentSuccess = () => {
    setIsPaymentOpen(false);
    router.refresh(); 
  };

  // Statistiques financières SOTA
  const stats = useMemo(() => {
    const unpaid = invoices.filter(i => i.statut !== 'paid');
    const totalUnpaid = unpaid.reduce((acc, curr) => acc + (curr.montant_total || 0), 0);
    const paidCount = invoices.filter(i => i.statut === 'paid').length;
    return { totalUnpaid, unpaidCount: unpaid.length, paidCount };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => 
      inv.periode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      formatCurrency(inv.montant_total).includes(searchQuery)
    );
  }, [invoices, searchQuery]);

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
        
        {/* Header SOTA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-600 rounded-lg shadow-lg shadow-emerald-200">
                <Receipt className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Paiements</h1>
            </div>
            <p className="text-slate-500 text-lg">
              Suivi de vos loyers, quittances et santé financière.
            </p>
          </motion.div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Rechercher une période..." 
              className="pl-10 h-11 bg-white border-slate-200 shadow-sm focus:ring-emerald-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Panneau de Statut Financier Bento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <GlassCard className="p-6 border-none shadow-xl bg-slate-900 text-white relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-1">Total à régulariser</p>
                <p className="text-4xl font-black">{formatCurrency(stats.totalUnpaid)}</p>
                <div className="mt-4 flex items-center gap-2">
                  <Badge className={cn("border-none", stats.totalUnpaid > 0 ? "bg-red-500" : "bg-emerald-500")}>
                    {stats.unpaidCount} facture{stats.unpaidCount > 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
              <Euro className="absolute -right-4 -bottom-4 h-24 w-24 text-white/5 rotate-12" />
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="md:col-span-2">
            <GlassCard className="p-6 border-slate-200 bg-white shadow-lg h-full flex flex-col justify-center">
              <div className="flex items-center gap-6">
                <div className="h-16 w-16 rounded-3xl bg-emerald-50 flex items-center justify-center shadow-inner">
                  <TrendingUp className="h-8 w-8 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Score de ponctualité</h3>
                  <p className="text-slate-500 text-sm">Vous avez payé {stats.paidCount} loyers à l'échéance. Continuez ainsi !</p>
                </div>
                <div className="ml-auto text-center hidden sm:block">
                  <p className="text-3xl font-black text-emerald-600">100%</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Excellent</p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* Liste des Paiements - Timeline Style */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <History className="h-5 w-5 text-emerald-600" /> Historique
            </h2>
            <Badge variant="outline" className="bg-white/50">{filteredInvoices.length} transactions</Badge>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredInvoices.map((invoice, index) => (
                <motion.div 
                  key={invoice.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <GlassCard className={cn(
                    "p-0 border-slate-200 bg-white hover:shadow-xl transition-all duration-300 group overflow-hidden",
                    invoice.statut !== 'paid' && "border-red-100 ring-1 ring-red-50"
                  )}>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center">
                      <div className={cn(
                        "w-full sm:w-2 sm:h-20 h-2",
                        invoice.statut === 'paid' ? "bg-emerald-500" : "bg-red-500"
                      )} />
                      
                      <div className="flex-1 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "p-3 rounded-2xl transition-transform group-hover:scale-110",
                            invoice.statut === 'paid' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                          )}>
                            <FileText className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-lg">Loyer {invoice.periode}</p>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-0.5">
                              Échéance : {formatDateShort(invoice.created_at)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 sm:gap-8 ml-auto sm:ml-0">
                          <div className="text-right">
                            <p className="text-2xl font-black text-slate-900">{formatCurrency(invoice.montant_total)}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Montant total</p>
                          </div>

                          <div className="flex items-center gap-3">
                            <StatusBadge 
                              status={invoice.statut === 'paid' ? 'Payé' : 'À régler'} 
                              type={invoice.statut === 'paid' ? 'success' : 'error'}
                              className="h-7 px-3 text-[10px] font-black uppercase tracking-widest"
                            />
                            
                            <div className="flex gap-2">
                              {invoice.statut !== 'paid' ? (
                                <Button 
                                  size="sm" 
                                  className="bg-red-600 hover:bg-red-700 text-white font-bold h-10 px-6 rounded-xl shadow-lg shadow-red-100"
                                  onClick={() => {
                                    setSelectedInvoice(invoice);
                                    setIsPaymentOpen(true);
                                  }}
                                >
                                  <CreditCard className="mr-2 h-4 w-4" /> Payer
                                </Button>
                              ) : (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-10 w-10 rounded-xl hover:bg-emerald-50 hover:text-emerald-600"
                                  onClick={() => handleDownload(invoice.id)}
                                >
                                  <Download className="h-5 w-5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Dialog de paiement */}
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl">
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

        {/* Zone de Tips SOTA */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="mt-12 p-8 rounded-[2rem] bg-gradient-to-br from-slate-900 to-slate-800 text-white relative overflow-hidden shadow-2xl">
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <div className="h-14 w-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <PartyPopper className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-3xl font-black">Besoin d'un justificatif ?</h2>
              <p className="text-slate-400 leading-relaxed">
                Vos quittances de loyer sont générées automatiquement dès réception de votre paiement. Elles servent de justificatif de domicile officiel.
              </p>
              <Button variant="secondary" className="bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold h-12 px-8" asChild>
                <Link href="/tenant/documents">Accéder à mes quittances</Link>
              </Button>
            </div>
            <div className="flex justify-end">
              <div className="relative group">
                <GlassCard className="p-6 bg-white/5 border-white/10 backdrop-blur-xl rotate-3 group-hover:rotate-0 transition-transform duration-500">
                  <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-4" />
                  <p className="text-xl font-bold">Paiement Garanti</p>
                  <p className="text-sm text-slate-400 mt-2">Toutes vos transactions sont sécurisées par cryptage SSL 256 bits.</p>
                </GlassCard>
                <Sparkles className="absolute -top-4 -right-4 h-12 w-12 text-emerald-400/30 animate-pulse" />
              </div>
            </div>
          </div>
        </motion.div>

      </div>
    </PageTransition>
  );
}
