"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useTenantData } from "../_data/TenantDataProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PaymentCheckout } from "@/features/billing/components/payment-checkout";
import { Progress } from "@/components/ui/progress";
import { 
  Home, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  Sparkles,
  Zap,
  PenTool,
  Shield,
  User,
  ChevronRight,
  PartyPopper,
  Loader2,
  Building2,
  Euro,
  Calendar,
  CreditCard,
  MessageCircle,
  History,
  Info,
  MapPin,
  Phone,
  ArrowUpRight,
  Wrench,
  Gift,
  LayoutGrid
} from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { Badge } from "@/components/ui/badge";
import { DocumentDownloadButton } from "@/components/documents/DocumentDownloadButton";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { cn } from "@/lib/utils";
import { CreditBuilderCard } from "@/features/tenant/components/credit-builder-card";
import { ConsumptionChart } from "@/features/tenant/components/consumption-chart";

// Constantes pour le layout
const LEASE_TYPE_LABELS: Record<string, string> = {
  nu: "Location nue",
  meuble: "Location meublée",
  colocation: "Colocation",
  saisonnier: "Location saisonnière",
  mobilite: "Bail mobilité",
};

export function DashboardClient() {
  const { dashboard, profile } = useTenantData();
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  
  // Gestion du logement sélectionné si multi-baux
  const [selectedLeaseIndex, setSelectedLeaseIndex] = useState(0);

  const currentLease = useMemo(() => {
    if (!dashboard?.leases || dashboard.leases.length === 0) return dashboard?.lease;
    return dashboard.leases[selectedLeaseIndex];
  }, [dashboard, selectedLeaseIndex]);

  const currentProperty = useMemo(() => currentLease?.property, [currentLease]);

  // 1. Logique de tri du flux d'activité unifié
  const activityFeed = useMemo(() => {
    if (!dashboard) return [];
    
    const items = [
      ...(dashboard.invoices || []).map(inv => ({
        id: `inv-${inv.id}`,
        date: new Date(inv.created_at || new Date()),
        type: 'invoice',
        title: `Loyer ${inv.periode}`,
        amount: inv.montant_total,
        status: inv.statut,
        raw: inv
      })),
      ...(dashboard.tickets || []).map(t => ({
        id: `tick-${t.id}`,
        date: new Date(t.created_at || new Date()),
        type: 'ticket',
        title: t.titre,
        status: t.statut,
        raw: t
      }))
    ];

    return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);
  }, [dashboard]);

  // 2. Calcul des actions requises (Command Center)
  const pendingActions = useMemo(() => {
    if (!dashboard) return [];
    const actions = [];
    
    // Action 1 : Signer le bail (Priorité Haute)
    if (dashboard.lease?.statut === 'pending_signature') {
      actions.push({
        id: 'sign-lease',
        label: "Signer mon bail",
        icon: PenTool,
        color: 'text-indigo-600',
        bg: 'bg-indigo-50',
        href: '/tenant/onboarding/sign'
      });
    }

    // Action 2 : Impayés
    if (dashboard.stats?.unpaid_amount > 0) {
      actions.push({
        id: 'payment',
        label: `Régulariser ${formatCurrency(dashboard.stats.unpaid_amount)}`,
        icon: CreditCard,
        color: 'text-red-600',
        bg: 'bg-red-50',
        href: '/tenant/payments'
      });
    }
    
    // Action 3 : EDL en attente
    if (dashboard.pending_edls?.length > 0) {
      actions.push({
        id: 'edl',
        label: `Signer l'état des lieux`,
        icon: FileText,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        href: `/signature-edl/${dashboard.pending_edls[0].invitation_token}`
      });
    }
    
    // Action 4 : Assurance
    if (!dashboard.insurance?.has_insurance) {
      actions.push({
        id: 'insurance',
        label: "Déposer l'attestation d'assurance",
        icon: Shield,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        href: '/tenant/documents'
      });
    }
    
    return actions;
  }, [dashboard]);

  if (!dashboard) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
    
  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-8">
        
        {/* --- SECTION 1 : HEADER & COMMAND CENTER --- */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">
              Bonjour {profile?.prenom ? `, ${profile.prenom}` : ""} 👋
            </h1>
            <p className="text-slate-500 mt-1 font-medium">
              {pendingActions.length > 0 
                ? `Vous avez ${pendingActions.length} action${pendingActions.length > 1 ? 's' : ''} en attente.`
                : "Tout est en ordre dans votre logement."}
            </p>
          </motion.div>

          <AnimatePresence mode="wait">
            {pendingActions.length > 0 && (
              <motion.div 
                key="pending-actions"
                initial={{ opacity: 0, scale: 0.9, y: -10 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="flex flex-wrap gap-2"
              >
                {pendingActions.map(action => (
                  <Button 
                    key={action.id}
                    variant="ghost" 
                    asChild
                    className={cn(
                      "h-auto py-2.5 px-5 border shadow-sm transition-all hover:scale-105 rounded-xl border-current/10",
                      action.bg, action.color
                    )}
                  >
                    <Link href={action.href} className="flex items-center gap-2">
                      <action.icon className="h-4 w-4" />
                      <span className="text-sm font-bold">{action.label}</span>
                      <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                    </Link>
                  </Button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* --- SECTION 2 : BENTO GRID SOTA 2026 --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Row 1: Logement & Credit Builder */}
          {/* A. CARTE LOGEMENT - 8/12 */}
          <motion.div 
            className="lg:col-span-8 group"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <GlassCard className="relative overflow-hidden h-full border-none shadow-2xl bg-slate-900 text-white min-h-[380px]">
              <div className="absolute inset-0 z-0">
                {currentProperty?.cover_url ? (
                  <OptimizedImage 
                    src={currentProperty.cover_url} 
                    alt="Logement" 
                    fill 
                    className="object-cover opacity-40 group-hover:scale-105 transition-transform duration-700" 
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-blue-900" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
              </div>

              <CardContent className="relative z-10 p-8 flex flex-col h-full justify-between">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-2">
                      <StatusBadge 
                        status={currentLease?.statut === 'active' ? 'Bail Actif' : 'En attente'} 
                        type={currentLease?.statut === 'active' ? 'success' : 'warning'}
                        className="bg-white/10 text-white border-white/20 backdrop-blur-md px-3 h-7 font-bold"
                      />
                      <Badge variant="outline" className="text-white/70 border-white/20 h-7 font-bold">
                        {LEASE_TYPE_LABELS[currentLease?.type_bail || ''] || "Location"}
                      </Badge>
                    </div>
                    
                    {dashboard.leases?.length > 1 && (
                      <div className="flex gap-1.5 p-1 bg-white/10 backdrop-blur-xl rounded-lg border border-white/10">
                        {dashboard.leases.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedLeaseIndex(idx)}
                            className={cn(
                              "w-3 h-3 rounded-full transition-all",
                              selectedLeaseIndex === idx ? "bg-white scale-125 shadow-[0_0_10px_white]" : "bg-white/30 hover:bg-white/50"
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <h2 className="text-4xl md:text-5xl font-black mb-3 leading-tight max-w-2xl tracking-tight">
                    {currentProperty?.adresse_complete || "Adresse non renseignée"}
                  </h2>
                  <p className="text-xl text-white/70 font-medium flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-indigo-400" />
                    {currentProperty?.ville || "Ville non renseignée"}{currentProperty?.code_postal ? `, ${currentProperty.code_postal}` : ""}
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3 pt-6 border-t border-white/10">
                  <DocumentDownloadButton 
                    type="lease" 
                    leaseId={currentLease?.id} 
                    variant="secondary" 
                    className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-xl h-12 px-6 rounded-xl font-bold transition-all"
                    label="Mon Bail PDF"
                  />
                  <Button variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-xl h-12 px-6 rounded-xl font-bold transition-all" asChild>
                    <Link href="/tenant/lease" className="gap-2">
                      <Building2 className="h-4 w-4" /> Fiche Technique
                    </Link>
                  </Button>
                  <Button variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-xl h-12 px-6 rounded-xl font-bold transition-all" asChild>
                    <Link href="/tenant/meters" className="gap-2">
                      <Zap className="h-4 w-4 text-amber-400" /> Relevés
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </GlassCard>
          </motion.div>

          {/* B. CREDIT BUILDER - 4/12 */}
          <motion.div 
            className="lg:col-span-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <CreditBuilderCard score={742} className="h-full bg-white shadow-xl border-slate-200" />
          </motion.div>

          {/* Row 2: Energy, Activity, Rewards */}
          {/* C. ANALYSE ÉNERGIE - 4/12 */}
          <motion.div 
            className="lg:col-span-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <ConsumptionChart type="electricity" className="h-full" />
          </motion.div>

          {/* D. FLUX D'ACTIVITÉ - 4/12 */}
          <motion.div 
            className="lg:col-span-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <GlassCard className="h-full p-0 overflow-hidden border-slate-200 shadow-xl bg-white">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <History className="h-4 w-4 text-indigo-600" /> Activité
                </h3>
                <Button variant="ghost" size="sm" asChild className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50">
                  <Link href="/tenant/payments">Voir tout</Link>
                </Button>
              </div>
              <div className="divide-y divide-slate-100 overflow-y-auto max-h-[300px]">
                {activityFeed.length > 0 ? activityFeed.map((item) => (
                  <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors group cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-xl",
                        item.type === 'invoice' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
                      )}>
                        {item.type === 'invoice' ? <FileText className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 truncate max-w-[120px]">{item.title}</p>
                        <p className="text-[10px] font-medium text-slate-400">{formatDateShort(item.date)}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-3 w-3 text-slate-300 group-hover:text-indigo-600" />
                  </div>
                )) : (
                  <div className="p-8 text-center text-slate-400 text-sm">Aucune activité</div>
                )}
              </div>
            </GlassCard>
          </motion.div>

          {/* E. REWARDS & OFFERS - 4/12 */}
          <motion.div 
            className="lg:col-span-4 space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <GlassCard className="p-6 border-none bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-xl relative overflow-hidden">
              <Gift className="absolute -right-4 -bottom-4 h-20 w-20 text-white/10 rotate-12" />
              <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">Fidélité</p>
                <h3 className="text-2xl font-black mb-4">1,250 <span className="text-sm opacity-70">Pts</span></h3>
                <Button variant="secondary" className="w-full bg-white/10 hover:bg-white/20 border-white/30 text-white font-bold h-10 px-4" asChild>
                  <Link href="/tenant/rewards">Boutique</Link>
                </Button>
              </div>
            </GlassCard>

            <GlassCard className="p-6 border-slate-200 bg-white shadow-xl">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-sm">
                <LayoutGrid className="h-4 w-4 text-indigo-600" /> Services
              </h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-between h-10 rounded-xl border-slate-100 text-xs" asChild>
                  <Link href="/tenant/marketplace">
                    <span className="flex items-center gap-2 font-bold text-slate-700"><Shield className="h-3.5 w-3.5 text-blue-500" /> Assurance</span>
                    <Badge className="bg-emerald-50 text-emerald-600 border-none text-[10px]">-15%</Badge>
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-between h-10 rounded-xl border-slate-100 text-xs" asChild>
                  <Link href="/tenant/marketplace">
                    <span className="flex items-center gap-2 font-bold text-slate-700"><Zap className="h-3.5 w-3.5 text-amber-500" /> Énergie</span>
                    <Badge className="bg-indigo-50 text-indigo-600 border-none text-[10px]">Éco</Badge>
                  </Link>
                </Button>
              </div>
            </GlassCard>
          </motion.div>

          {/* Row 3: Support & AI Tips */}
          {/* F. SUPPORT BAILLEUR - 6/12 */}
          <motion.div 
            className="lg:col-span-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <GlassCard className="p-6 border-slate-200 bg-white shadow-xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg">
                  {currentLease?.owner?.name?.[0] || "P"}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Mon Bailleur</p>
                  <p className="font-black text-slate-900 text-lg leading-tight">{currentLease?.owner?.name || "Propriétaire"}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="h-11 rounded-xl border-slate-200 font-bold" asChild>
                  <Link href="/tenant/requests/new">Aide</Link>
                </Button>
                <Button variant="outline" className="h-11 rounded-xl border-slate-200 font-bold px-4">
                  <Phone className="h-4 w-4" />
                </Button>
              </div>
            </GlassCard>
          </motion.div>

          {/* G. IA TIP - 6/12 */}
          <motion.div 
            className="lg:col-span-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <GlassCard className="p-6 border-none bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-xl relative overflow-hidden flex items-center justify-between">
              <div className="relative z-10 space-y-1">
                <p className="font-black text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5" /> Conseil de Tom
                </p>
                <p className="text-sm text-white/90 leading-relaxed font-medium max-w-sm">
                  Votre assurance expire bientôt. Mettez-la à jour pour rester protégé.
                </p>
              </div>
              <Button variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-md h-11 px-6 rounded-xl font-bold" asChild>
                <Link href="/tenant/documents">Mettre à jour</Link>
              </Button>
              <Sparkles className="absolute -right-4 -top-4 h-24 w-24 text-white/10 rotate-12" />
            </GlassCard>
          </motion.div>

        </div>

        {/* Dialog de paiement */}
        <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
          <DialogContent className="sm:max-w-md rounded-[2rem] border-none shadow-2xl overflow-hidden p-0">
            {selectedInvoice && (
              <PaymentCheckout 
                invoiceId={selectedInvoice.id}
                amount={selectedInvoice.montant_total}
                description={`Loyer ${selectedInvoice.periode}`}
                onSuccess={() => { setIsPaymentOpen(false); window.location.reload(); }}
                onCancel={() => setIsPaymentOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
