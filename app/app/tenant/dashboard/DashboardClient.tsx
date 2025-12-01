"use client";
// @ts-nocheck

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTenantData } from "../_data/TenantDataProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Home, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  ArrowRight,
  Phone,
  Sparkles,
  Zap,
  PenTool,
  Shield,
  User,
  Eye,
  ChevronRight,
  PartyPopper,
  Loader2,
  Building2,
  Euro,
  Calendar
} from "lucide-react";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

// SOTA Imports
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { OptimizedImage, OptimizedAvatar } from "@/components/ui/optimized-image";
import { EmptyState } from "@/components/ui/empty-state";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 100, damping: 15 },
  },
};

interface SignatureLink {
  leaseId: string;
  token: string;
  signatureUrl: string;
  type_bail: string;
  loyer: number;
  charges: number;
  date_debut: string;
  propertyAddress: string;
}

// Labels types de bail
const LEASE_TYPE_LABELS: Record<string, string> = {
  nu: "Location nue",
  meuble: "Location meublée",
  colocation: "Colocation",
  saisonnier: "Location saisonnière",
  mobilite: "Bail mobilité",
};

// Étapes de l'onboarding locataire
const ONBOARDING_STEPS = [
  { id: 1, title: "Créer votre compte", icon: User, description: "Inscription et vérification email" },
  { id: 2, title: "Vérifier votre identité", icon: Shield, description: "CNI ou France Identité" },
  { id: 3, title: "Compléter votre dossier", icon: FileText, description: "Informations personnelles" },
  { id: 4, title: "Signer votre bail", icon: PenTool, description: "Signature électronique" },
];

export function DashboardClient() {
  const { dashboard } = useTenantData();
  const [signatureLinks, setSignatureLinks] = useState<SignatureLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentOnboardingStep, setCurrentOnboardingStep] = useState(1);

  // Vérifier s'il y a des baux en attente de signature et récupérer les liens
  useEffect(() => {
    async function fetchSignatureLinks() {
      try {
        const response = await fetch("/api/tenant/signature-link");
        
        if (!response.ok) {
          console.error("[DashboardClient] Erreur API:", response.status);
          return;
        }

        const data = await response.json();
        
        if (data.signatureLinks && data.signatureLinks.length > 0) {
          setSignatureLinks(data.signatureLinks);
          // Si on a des baux en attente, on est à l'étape 2 (vérification identité)
          setCurrentOnboardingStep(2);
        } else {
          // Pas de bail en attente, vérifier si on a un bail actif
          if (dashboard?.lease) {
            setCurrentOnboardingStep(5); // Onboarding terminé
          }
        }
      } catch (error) {
        console.error("[DashboardClient] Erreur:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSignatureLinks();
  }, [dashboard?.lease]);

  // Calculer le pourcentage de progression
  const progressPercentage = Math.min(((currentOnboardingStep - 1) / (ONBOARDING_STEPS.length)) * 100, 100);

  // Affichage de chargement
  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Chargement de votre espace...</p>
        </div>
      </div>
    );
  }

  // Si on a des baux en attente de signature, afficher l'écran d'onboarding
  if (signatureLinks.length > 0) {
    const firstLease = signatureLinks[0];
    
    return (
      <PageTransition>
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="container mx-auto px-4 py-8 max-w-4xl"
        >
          {/* Header de bienvenue */}
          <motion.div variants={itemVariants} className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg mb-4">
              <PartyPopper className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Bienvenue sur Gestion Locative !
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              Finalisez votre dossier pour signer votre bail
            </p>
          </motion.div>

          {/* Progression globale */}
          <motion.div variants={itemVariants} className="mb-8">
            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Votre progression</h2>
                <Badge variant="secondary" className="text-sm">
                  Étape {currentOnboardingStep} sur {ONBOARDING_STEPS.length}
                </Badge>
              </div>
              <Progress value={progressPercentage} className="h-3 mb-4" />
              
              {/* Steps */}
              <div className="grid grid-cols-4 gap-2 mt-6">
                {ONBOARDING_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const isCompleted = currentOnboardingStep > step.id;
                  const isCurrent = currentOnboardingStep === step.id;
                  
                  return (
                    <div key={step.id} className="text-center">
                      <div className={`
                        mx-auto w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all
                        ${isCompleted ? "bg-green-500 text-white" : 
                          isCurrent ? "bg-blue-500 text-white ring-4 ring-blue-200" : 
                          "bg-slate-100 text-slate-400"}
                      `}>
                        {isCompleted ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                      </div>
                      <p className={`text-xs font-medium ${isCurrent ? "text-blue-600" : isCompleted ? "text-green-600" : "text-muted-foreground"}`}>
                        {step.title}
                      </p>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          </motion.div>

          {/* Carte du bail à signer */}
          <motion.div variants={itemVariants}>
            <GlassCard className="overflow-hidden border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
              <div className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      Votre futur logement
                    </h3>
                    <p className="text-muted-foreground">
                      {firstLease.propertyAddress}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-white/50 dark:bg-slate-800/50 rounded-xl">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Type de bail</p>
                    <p className="font-semibold">{LEASE_TYPE_LABELS[firstLease.type_bail] || firstLease.type_bail}</p>
                  </div>
                  <div className="text-center border-x border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-muted-foreground">Loyer + charges</p>
                    <p className="font-semibold text-lg">{formatCurrency(firstLease.loyer + firstLease.charges)}<span className="text-sm font-normal">/mois</span></p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Début du bail</p>
                    <p className="font-semibold">{formatDateShort(firstLease.date_debut)}</p>
                  </div>
                </div>

                {/* CTA Principal */}
                <Button 
                  asChild
                  size="lg"
                  className="w-full h-14 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30"
                >
                  <Link href={firstLease.signatureUrl} className="gap-3">
                    <PenTool className="h-5 w-5" />
                    Compléter mon dossier et signer
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>

                <p className="text-center text-sm text-muted-foreground mt-4">
                  ⏱️ Environ 5 minutes • 🔒 Données sécurisées
                </p>
              </div>
            </GlassCard>
          </motion.div>

          {/* Ce qu'il vous faut */}
          <motion.div variants={itemVariants} className="mt-8">
            <h3 className="text-lg font-semibold mb-4">📋 Ce dont vous aurez besoin</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <GlassCard className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                    <Shield className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Pièce d'identité</p>
                    <p className="text-xs text-muted-foreground">CNI ou passeport</p>
                  </div>
                </div>
              </GlassCard>
              <GlassCard className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                    <Phone className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Téléphone portable</p>
                    <p className="text-xs text-muted-foreground">Pour la signature SMS</p>
                  </div>
                </div>
              </GlassCard>
              <GlassCard className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                    <FileText className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">Justificatifs de revenus</p>
                    <p className="text-xs text-muted-foreground">Optionnel mais recommandé</p>
                  </div>
                </div>
              </GlassCard>
            </div>
          </motion.div>

          {/* Aide */}
          <motion.div variants={itemVariants} className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Besoin d'aide ? <Link href="/help" className="text-blue-600 hover:underline">Consultez notre centre d'aide</Link>
            </p>
          </motion.div>
        </motion.div>
      </PageTransition>
    );
  }

  // Dashboard normal si pas de bail en attente
  if (!dashboard) {
    return (
      <EmptyState 
        title="Bienvenue !"
        description="Aucun logement n'est encore associé à votre compte. Attendez l'invitation de votre propriétaire."
        icon={Home}
      />
    );
  }

  const { lease, property, invoices, tickets, stats } = dashboard;

  // Si on a un bail actif, afficher le dashboard normal
  return (
    <PageTransition>
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="container mx-auto px-4 py-8 max-w-7xl space-y-8"
      >
        {/* Header avec Message de bienvenue personnalisé */}
        <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Bonjour{dashboard.tenant?.prenom ? `, ${dashboard.tenant.prenom}` : ""} !
            </h1>
            <p className="text-muted-foreground mt-1 text-lg">
              Ravi de vous revoir. Voici ce qui se passe aujourd'hui.
            </p>
          </div>
          
          <div className="flex gap-2">
             {/* Actions rapides contextuelles */}
             {stats.unpaid_amount > 0 ? (
                <Button asChild size="lg" className="shadow-lg shadow-red-500/20 bg-red-600 hover:bg-red-700 text-white animate-pulse">
                   <Link href="/app/tenant/payments">
                      Payer mon loyer ({formatCurrency(stats.unpaid_amount)})
                   </Link>
                </Button>
             ) : (
                <Button asChild variant="outline" className="gap-2">
                   <Link href="/app/tenant/requests/new">
                      <Zap className="h-4 w-4 text-amber-500" />
                      Signaler un problème
                   </Link>
                </Button>
             )}
          </div>
        </motion.div>

        {/* Alerte Impayés - Version SOTA */}
        {stats.unpaid_amount > 0 && (
          <motion.div variants={itemVariants}>
            <GlassCard className="border-red-200 bg-red-50/50 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
                <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-red-100 rounded-full">
                            <AlertCircle className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-red-900">Action requise : Paiement en attente</h3>
                            <p className="text-red-700">
                                {stats.unpaid_count} facture(s) en attente pour un total de <span className="font-bold">{formatCurrency(stats.unpaid_amount)}</span>.
                            </p>
                        </div>
                    </div>
                    <Button variant="default" className="bg-red-600 hover:bg-red-700 text-white whitespace-nowrap" asChild>
                        <Link href="/app/tenant/payments">Régler maintenant</Link>
                    </Button>
                </div>
            </GlassCard>
          </motion.div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Colonne Gauche : Mon Logement */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div variants={itemVariants}>
                <GlassCard gradient={true} className="overflow-hidden p-0 border-none shadow-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
                    <div className="relative">
                        {/* Background Pattern */}
                        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                        
                        <CardContent className="p-8 relative z-10">
                            <div className="flex flex-col-reverse md:flex-row md:items-start justify-between gap-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-2 opacity-80">
                                        <Home className="h-4 w-4" />
                                        <span className="text-sm font-medium uppercase tracking-wider">Mon Logement</span>
                                    </div>
                                    {property ? (
                                        <>
                                            <h2 className="text-3xl font-bold mb-2 leading-tight">{property.adresse_complete}</h2>
                                            <p className="text-lg opacity-90 font-light">
                                                {property.ville}, {property.code_postal}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="opacity-80">Aucun logement assigné</p>
                                    )}
                                </div>
                                {property?.cover_url && (
                                    <div className="h-24 w-24 md:h-32 md:w-32 rounded-2xl bg-white/20 backdrop-blur-md shadow-inner border border-white/30 overflow-hidden shrink-0 transform rotate-3 hover:rotate-0 transition-transform duration-300">
                                        <OptimizedImage 
                                            src={property.cover_url} 
                                            alt="Logement" 
                                            fill 
                                            className="object-cover" 
                                        />
                                    </div>
                                )}
                            </div>
                            
                            {lease && (
                                <div className="mt-8 pt-6 border-t border-white/20 flex flex-wrap gap-8 items-end">
                                    <div>
                                        <p className="text-sm opacity-70 mb-1">Loyer mensuel</p>
                                        <p className="text-3xl font-bold tracking-tight">
                                            <AnimatedCounter value={(lease.loyer || 0) + (lease.charges_forfaitaires || 0)} type="currency" />
                                        </p>
                                    </div>
                                    <div className="flex-1 text-right">
                                        <Button variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border border-white/30 backdrop-blur-sm" asChild>
                                            <Link href="/app/tenant/lease">Voir mon bail</Link>
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </div>
                </GlassCard>
            </motion.div>

            {/* Dernières factures */}
            <motion.div variants={itemVariants}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-slate-800">Derniers paiements</h2>
                    <Button variant="ghost" size="sm" asChild className="text-blue-600 hover:text-blue-700">
                        <Link href="/app/tenant/payments">Tout voir <ArrowRight className="ml-1 h-4 w-4" /></Link>
                    </Button>
                </div>
                
                <GlassCard className="p-0 overflow-hidden">
                    {invoices.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                            {invoices.slice(0, 3).map((invoice: any) => (
                                <div key={invoice.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl ${invoice.statut === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900">Loyer {invoice.periode}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Échéance : {formatDateShort(invoice.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-slate-900">{formatCurrency(invoice.montant_total)}</p>
                                        <div className="flex justify-end mt-1">
                                            <StatusBadge 
                                                status={invoice.statut === 'paid' ? 'Payé' : 'À régler'} 
                                                type={invoice.statut === 'paid' ? 'success' : 'warning'} 
                                                className="text-[10px] px-2 py-0 h-5"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState 
                            title="Aucune facture" 
                            description="Vos factures apparaîtront ici."
                            icon={FileText}
                            className="py-8 border-none"
                        />
                    )}
                </GlassCard>
            </motion.div>
          </div>

          {/* Colonne Droite : Actions & Tickets */}
          <div className="space-y-6">
            {/* Propriétaire / Contact */}
            <motion.div variants={itemVariants}>
                <GlassCard className="bg-gradient-to-br from-white to-slate-50">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold text-muted-foreground uppercase tracking-wider text-xs">Mon Gestionnaire</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {property?.owner_name ? (
                            <div className="flex items-center gap-4 mb-6">
                                <OptimizedAvatar 
                                    alt={property.owner_name}
                                    fallbackText={property.owner_name}
                                    className="h-12 w-12 border-2 border-white shadow-md"
                                />
                                <div>
                                    <p className="font-bold text-lg text-slate-900">{property.owner_name}</p>
                                    <p className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full inline-block">Propriétaire</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground mb-4 italic">Information non disponible</p>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="outline" size="sm" className="w-full border-slate-200 shadow-sm hover:bg-white hover:border-blue-300 hover:text-blue-600 transition-all" asChild>
                                <Link href="/app/tenant/requests/new">
                                    <Clock className="mr-2 h-3 w-3" />
                                    Intervention
                                </Link>
                            </Button>
                            <Button variant="outline" size="sm" className="w-full border-slate-200 shadow-sm hover:bg-white hover:border-blue-300 hover:text-blue-600 transition-all">
                                <Phone className="mr-2 h-3 w-3" />
                                Contact
                            </Button>
                        </div>
                    </CardContent>
                </GlassCard>
            </motion.div>

            {/* Demandes en cours */}
            <motion.div variants={itemVariants}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-800">Mes demandes</h2>
                    <Link href="/app/tenant/requests" className="text-xs font-medium text-blue-600 hover:underline">Voir tout</Link>
                </div>
                
                <GlassCard className="p-0 overflow-hidden min-h-[200px]">
                    {tickets.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                            {tickets.slice(0, 3).map((ticket: any) => (
                                <div key={ticket.id} className="p-4 hover:bg-slate-50 transition-colors">
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="font-medium text-sm text-slate-900 line-clamp-1">{ticket.titre}</p>
                                        <StatusBadge 
                                            status={ticket.statut} 
                                            type={ticket.statut === 'open' ? 'info' : ticket.statut === 'resolved' ? 'success' : 'neutral'}
                                            className="text-[10px] px-1.5 py-0 h-5"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{ticket.description}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[200px] text-center p-4">
                            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                                <Sparkles className="h-6 w-6 text-slate-300" />
                            </div>
                            <p className="text-sm font-medium text-slate-900">Tout va bien !</p>
                            <p className="text-xs text-muted-foreground mt-1 mb-3">Aucune demande en cours.</p>
                            <Button variant="outline" size="sm" className="text-xs" asChild>
                                <Link href="/app/tenant/requests/new">Faire une demande</Link>
                            </Button>
                        </div>
                    )}
                </GlassCard>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </PageTransition>
  );
}

function formatDateShortLocal(date: string) {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
