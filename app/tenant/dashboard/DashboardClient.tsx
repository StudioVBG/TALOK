"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useTenantData } from "../_data/TenantDataProvider";
import { createClient } from "@/lib/supabase/client";
import { useTenantRealtime } from "@/lib/hooks/use-realtime-tenant";
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
  
  // État pour les EDLs en attente (récupérés directement si la RPC ne les renvoie pas)
  const [pendingEDLs, setPendingEDLs] = useState<any[]>([]);
  
  // 🔴 SOTA 2026: Hook temps réel pour synchronisation avec propriétaire
  const realtime = useTenantRealtime({ showToasts: true, enableSound: false });
  
  // Récupérer les EDLs en attente directement depuis le client
  useEffect(() => {
    async function fetchPendingEDLs() {
      // Si la RPC a déjà renvoyé des EDLs, on les utilise
      if (dashboard?.pending_edls && dashboard.pending_edls.length > 0) {
        setPendingEDLs(dashboard.pending_edls);
        return;
      }
      
      // Sinon, on récupère directement
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      
      if (!profileData) return;
      
      // Récupérer les EDLs où la signature n'est pas complète (pas d'image = pas vraiment signé)
      const { data: edls } = await supabase
        .from("edl_signatures")
        .select(`
          id, invitation_token, signed_at, signature_image_path,
          edl:edl_id(id, type, status, scheduled_at, property:property_id(adresse_complete))
        `)
        .eq("signer_profile_id", profileData.id)
        .is("signature_image_path", null); // Vérifie l'absence d'image, pas signed_at
      
      if (edls && edls.length > 0) {
        const formatted = edls
          .filter((sig: any) => sig.edl && sig.edl.status !== 'draft')
          .map((sig: any) => ({
            id: sig.edl.id,
            type: sig.edl.type,
            status: sig.edl.status,
            scheduled_at: sig.edl.scheduled_at,
            invitation_token: sig.invitation_token,
            property_address: sig.edl.property?.adresse_complete || 'Adresse non renseignée'
          }));
        setPendingEDLs(formatted);
      }
    }
    
    fetchPendingEDLs();
  }, [dashboard?.pending_edls]);

  const currentLease = useMemo(() => {
    if (!dashboard?.leases || dashboard.leases.length === 0) return dashboard?.lease;
    return dashboard.leases[selectedLeaseIndex];
  }, [dashboard, selectedLeaseIndex]);

  const currentProperty = useMemo(() => currentLease?.property, [currentLease]);

  // 1. Logique de tri du flux d'activité unifié (inclut les événements temps réel)
  const activityFeed = useMemo(() => {
    if (!dashboard) return [];
    
    const items = [
      // Événements temps réel en premier (les plus récents)
      ...realtime.recentEvents.map(event => ({
        id: `rt-${event.id}`,
        date: event.timestamp,
        type: event.type as string,
        title: event.title,
        status: event.action,
        isRealtime: true, // Marqueur pour style spécial
        importance: event.importance,
        raw: event
      })),
      // Factures
      ...(dashboard.invoices || []).map(inv => ({
        id: `inv-${inv.id}`,
        date: new Date(inv.created_at || new Date()),
        type: 'invoice',
        title: `Loyer ${inv.periode}`,
        amount: inv.montant_total,
        status: inv.statut,
        raw: inv
      })),
      // Tickets
      ...(dashboard.tickets || []).map(t => ({
        id: `tick-${t.id}`,
        date: new Date(t.created_at || new Date()),
        type: 'ticket',
        title: t.titre,
        status: t.statut,
        raw: t
      }))
    ];

    // Dédupliquer par ID (les événements realtime peuvent être des doublons)
    const seen = new Set();
    const unique = items.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    return unique.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
  }, [dashboard, realtime.recentEvents]);

  // ✅ FIX: Vérifier si le locataire a déjà signé ce bail
  const hasSignedLease = useMemo(() => {
    if (!dashboard?.lease?.signers) return false;
    
    // Chercher le signataire locataire
    const tenantSigner = dashboard.lease.signers.find((s: any) => 
      s.role === 'locataire_principal' || s.role === 'tenant' || s.role === 'locataire'
    );
    
    // Le locataire a signé si son statut est 'signed' OU s'il a une date de signature
    return tenantSigner?.signature_status === 'signed' || !!tenantSigner?.signed_at;
  }, [dashboard]);

  // 2. Calcul des actions requises (Command Center)
  const pendingActions = useMemo(() => {
    if (!dashboard) return [];
    const actions = [];
    
    // Action 1 : Signer le bail (Priorité Haute)
    // ✅ FIX: Vérifier AUSSI que le locataire n'a pas déjà signé
    // Le bail peut être pending_signature si le propriétaire n'a pas encore signé
    const needsToSignLease = dashboard.lease?.statut === 'pending_signature' && !hasSignedLease;
    
    if (needsToSignLease) {
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
    
    // Action 3 : EDL en attente (utilise pendingEDLs qui est récupéré directement)
    if (pendingEDLs.length > 0) {
      actions.push({
        id: 'edl',
        label: `Signer l'état des lieux`,
        icon: FileText,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        href: `/signature-edl/${pendingEDLs[0].invitation_token}`
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
  }, [dashboard, pendingEDLs, hasSignedLease]);

  // Vérifier si le bail/logement est lié
  const hasLeaseData = currentLease && currentProperty?.adresse_complete && currentProperty.adresse_complete !== "Adresse à compléter";
  // ✅ FIX: L'onboarding est incomplet seulement si le locataire N'A PAS signé
  const isOnboardingIncomplete = !hasLeaseData || (currentLease?.statut === 'pending_signature' && !hasSignedLease);

  // Calcul de la progression onboarding
  const onboardingProgress = useMemo(() => {
    let steps = 0;
    let completed = 0;
    
    // Étape 1: Compte créé (toujours fait si on est ici)
    steps++; completed++;
    
    // Étape 2: Liaison au logement
    steps++;
    if (hasLeaseData) completed++;
    
    // Étape 3: Dossier locataire
    steps++;
    // TODO: Vérifier si le dossier est complet
    
    // Étape 4: Identité vérifiée
    steps++;
    if (dashboard?.kyc_status === 'verified') completed++;
    
    // Étape 5: Bail signé
    steps++;
    if (currentLease?.statut === 'active' || currentLease?.statut === 'fully_signed') completed++;
    
    return { steps, completed, percentage: Math.round((completed / steps) * 100) };
  }, [hasLeaseData, dashboard?.kyc_status, currentLease?.statut]);

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
        
        {/* --- SECTION 0 : ONBOARDING PROGRESS (SOTA 2026) --- */}
        {isOnboardingIncomplete && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 p-8 text-white shadow-2xl"
            data-tour="tenant-onboarding"
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-300 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
            </div>

            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                      <Sparkles className="h-6 w-6 text-amber-300" />
                    </div>
                    <h2 className="text-2xl font-black">Bienvenue chez vous !</h2>
                  </div>
                  <p className="text-white/80 text-lg font-medium max-w-xl">
                    {!hasLeaseData 
                      ? "Votre espace locataire est presque prêt. Finalisez votre dossier pour débloquer toutes les fonctionnalités."
                      : (currentLease?.statut === 'pending_signature' && !hasSignedLease)
                        ? "Votre bail vous attend ! Signez-le pour activer votre espace."
                        : hasSignedLease && currentLease?.statut === 'pending_signature'
                          ? "Vous avez signé ! En attente de la signature du propriétaire."
                          : "Complétez les dernières étapes pour finaliser votre installation."}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-3 min-w-[200px]">
                  <div className="text-right">
                    <p className="text-sm font-bold text-white/70 uppercase tracking-wider">Progression</p>
                    <p className="text-5xl font-black">{onboardingProgress.percentage}%</p>
                  </div>
                  <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${onboardingProgress.percentage}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-xs text-white/60">{onboardingProgress.completed}/{onboardingProgress.steps} étapes complétées</p>
                </div>
              </div>

              {/* Actions rapides */}
              <div className="mt-8 flex flex-wrap gap-3">
                {!hasLeaseData && (
                  <Button 
                    asChild 
                    className="bg-white text-indigo-700 hover:bg-white/90 font-bold rounded-xl h-12 px-6 shadow-lg"
                  >
                    <Link href="/tenant/onboarding/context" className="flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      Lier mon logement
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
                {/* ✅ SOTA 2026: Bouton "Signer mon bail" supprimé ici car déjà présent dans pendingActions */}
                {dashboard?.kyc_status !== 'verified' && (
                  <Button 
                    asChild 
                    variant="secondary"
                    className="bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl h-12 px-6 backdrop-blur-sm border border-white/20"
                  >
                    <Link href="/tenant/onboarding/identity" className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Vérifier mon identité
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
        
        {/* --- SECTION 1 : HEADER & COMMAND CENTER --- */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight text-slate-900">
                {isOnboardingIncomplete ? "Votre tableau de bord" : `Bonjour${profile?.prenom ? `, ${profile.prenom}` : ""} 👋`}
              </h1>
              {/* 🔴 SOTA 2026: Indicateur de connexion temps réel */}
              {realtime.isConnected && (
                <motion.div 
                  initial={{ scale: 0 }} 
                  animate={{ scale: 1 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Live
                </motion.div>
              )}
            </div>
            <p className="text-slate-500 mt-1 font-medium">
              {!hasLeaseData 
                ? "Liez votre logement pour accéder à toutes les fonctionnalités."
                : pendingActions.length > 0 
                  ? `Vous avez ${pendingActions.length} action${pendingActions.length > 1 ? 's' : ''} en attente.`
                  : "Tout est en ordre dans votre logement."}
            </p>
          </motion.div>

          <AnimatePresence mode="wait">
            {pendingActions.length > 0 && hasLeaseData && (
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
          
          {/* A. STATUS FINANCIER & PAIEMENT - 4/12 */}
          <motion.div 
            className="lg:col-span-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            data-tour="tenant-financial"
          >
            <GlassCard className="p-6 bg-white shadow-xl border-l-4 border-l-indigo-600 h-full flex flex-col justify-between">
              <div>
                <p className="text-xs font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Situation Financière</p>
                {hasLeaseData ? (
                  <>
                    {/* 🔴 SOTA 2026: Utiliser les données temps réel si disponibles */}
                    <div className={cn(
                      "transition-all duration-500",
                      realtime.hasRecentLeaseChange && "ring-2 ring-indigo-400 ring-offset-2 rounded-xl p-2 -m-2"
                    )}>
                      <h3 className="text-3xl font-black text-slate-900 mt-2">
                        {formatCurrency(
                          realtime.totalMonthly > 0 
                            ? realtime.totalMonthly 
                            : (currentLease?.loyer || 0) + (currentLease?.charges_forfaitaires || 0)
                        )}
                      </h3>
                      <p className="text-sm text-slate-500 mt-1 font-medium flex items-center gap-2">
                        Loyer mensuel CC
                        {realtime.hasRecentLeaseChange && (
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] animate-pulse">
                            Mis à jour
                          </Badge>
                        )}
                      </p>
                    </div>
                    
                    {(realtime.unpaidAmount > 0 || dashboard.stats?.unpaid_amount > 0) ? (
                      <div className="mt-6 p-4 rounded-2xl bg-red-50 border border-red-100">
                        <p className="text-xs font-bold text-red-600 uppercase">Impayé en cours</p>
                        <p className="text-2xl font-black text-red-700">
                          {formatCurrency(realtime.unpaidAmount > 0 ? realtime.unpaidAmount : dashboard.stats?.unpaid_amount)}
                        </p>
                      </div>
                    ) : (
                      <div className="mt-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <p className="text-sm font-bold text-emerald-700">À jour de vos loyers</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="text-3xl font-black text-slate-300 mt-2">— €</h3>
                    <p className="text-sm text-slate-400 mt-1 font-medium">En attente de liaison</p>
                    <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-center gap-3">
                      <Clock className="h-5 w-5 text-amber-600" />
                      <p className="text-sm font-bold text-amber-700">Liez votre logement</p>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-8 space-y-3">
                {hasLeaseData ? (
                  <>
                    <Button className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all hover:scale-[1.02]" asChild>
                      <Link href="/tenant/payments">Payer le loyer</Link>
                    </Button>
                    <Button variant="outline" className="w-full h-12 rounded-xl font-bold border-slate-200" asChild>
                      <Link href="/tenant/payments">Historique & Quittances</Link>
                    </Button>
                  </>
                ) : (
                  <Button className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all hover:scale-[1.02]" asChild>
                    <Link href="/tenant/onboarding/context">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Configurer mon espace
                    </Link>
                  </Button>
                )}
              </div>
            </GlassCard>
          </motion.div>

          {/* B. CARTE LOGEMENT RÉDUITE - 8/12 */}
          <motion.div 
            className="lg:col-span-8 group"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            data-tour="tenant-property"
          >
            {hasLeaseData ? (
              <GlassCard className="relative overflow-hidden h-full border-none shadow-2xl bg-slate-900 text-white min-h-[300px]">
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
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <StatusBadge 
                          status={currentLease?.statut === 'active' ? 'Bail Actif' : currentLease?.statut === 'pending_signature' ? 'À signer' : 'En attente'} 
                          type={currentLease?.statut === 'active' ? 'success' : 'warning'}
                          className="bg-white/10 text-white border-white/20 backdrop-blur-md px-3 h-7 font-bold"
                        />
                        <Badge variant="outline" className="text-white/70 border-white/20 h-7 font-bold">
                          {LEASE_TYPE_LABELS[currentLease?.type_bail || ''] || "Location"}
                        </Badge>
                      </div>
                    </div>
                    
                    <h2 className="text-3xl md:text-4xl font-black mb-2 tracking-tight">
                      {currentProperty?.adresse_complete}
                    </h2>
                    <p className="text-lg text-white/70 font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-indigo-400" />
                      {currentProperty?.ville}{currentProperty?.code_postal ? `, ${currentProperty.code_postal}` : ""}
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-3 pt-6 border-t border-white/10">
                    <Button variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-xl h-11 px-5 rounded-xl font-bold transition-all" asChild>
                      <Link href="/tenant/lease" className="gap-2">
                        <Building2 className="h-4 w-4" /> Ma Vie au Logement
                      </Link>
                    </Button>
                    <Button variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-xl h-11 px-5 rounded-xl font-bold transition-all" asChild>
                      <Link href="/tenant/requests/new" className="gap-2">
                        <Wrench className="h-4 w-4" /> Signaler un problème
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </GlassCard>
            ) : (
              /* État vide - Pas de logement lié */
              <GlassCard className="relative overflow-hidden h-full border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-slate-100 min-h-[300px]">
                <CardContent className="p-8 flex flex-col items-center justify-center h-full text-center">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-2xl animate-pulse" />
                    <div className="relative p-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-xl">
                      <Home className="h-12 w-12 text-white" />
                    </div>
                  </div>
                  
                  <h2 className="text-2xl font-black text-slate-800 mb-3">
                    Pas encore de logement
                  </h2>
                  <p className="text-slate-500 max-w-md mb-8 font-medium leading-relaxed">
                    Votre propriétaire doit vous inviter ou vous pouvez entrer le code de votre logement pour accéder à toutes les fonctionnalités.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      asChild
                      className="bg-indigo-600 hover:bg-indigo-700 font-bold rounded-xl h-12 px-6 shadow-lg shadow-indigo-200"
                    >
                      <Link href="/tenant/onboarding/context" className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Entrer un code logement
                      </Link>
                    </Button>
                    <Button 
                      variant="outline"
                      className="font-bold rounded-xl h-12 px-6 border-slate-300"
                    >
                      <Info className="h-4 w-4 mr-2" />
                      Comment ça marche ?
                    </Button>
                  </div>
                </CardContent>
              </GlassCard>
            )}
          </motion.div>

          {/* Row 2: Credit Builder, Energy, Activity */}
          <motion.div className="lg:col-span-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <CreditBuilderCard score={742} className="h-full bg-white shadow-xl border-slate-200" />
          </motion.div>

          <motion.div className="lg:col-span-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <ConsumptionChart type="electricity" className="h-full" />
          </motion.div>

          <motion.div className="lg:col-span-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} data-tour="tenant-activity">
            <GlassCard className="h-full p-0 overflow-hidden border-slate-200 shadow-xl bg-white">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <History className="h-4 w-4 text-indigo-600" /> Activité
                </h3>
              </div>
              <div className="divide-y divide-slate-100 overflow-y-auto max-h-[250px]">
                {activityFeed.length > 0 ? activityFeed.map((item: any) => (
                  <motion.div 
                    key={item.id} 
                    initial={item.isRealtime ? { opacity: 0, x: -20, backgroundColor: "rgb(238, 242, 255)" } : false}
                    animate={{ opacity: 1, x: 0, backgroundColor: "transparent" }}
                    transition={{ duration: 0.5 }}
                    className={cn(
                      "p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors group cursor-pointer",
                      item.isRealtime && item.importance === "high" && "bg-indigo-50/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-xl relative",
                        item.type === 'invoice' ? 'bg-emerald-50 text-emerald-600' : 
                        item.type === 'lease' ? 'bg-indigo-50 text-indigo-600' :
                        item.type === 'document' ? 'bg-amber-50 text-amber-600' :
                        'bg-slate-50 text-slate-600'
                      )}>
                        {item.type === 'invoice' ? <FileText className="h-4 w-4" /> : 
                         item.type === 'lease' ? <Home className="h-4 w-4" /> :
                         item.type === 'document' ? <FileText className="h-4 w-4" /> :
                         <Wrench className="h-4 w-4" />}
                        {/* Indicateur temps réel */}
                        {item.isRealtime && (
                          <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 truncate max-w-[120px]">{item.title}</p>
                        <p className="text-[10px] font-medium text-slate-400">
                          {item.isRealtime ? "À l'instant" : formatDateShort(item.date)}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-3 w-3 text-slate-300 group-hover:text-indigo-600" />
                  </motion.div>
                )) : (
                  <div className="p-8 text-center text-slate-400 text-sm">Aucune activité</div>
                )}
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
