"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, AlertCircle, ArrowRight, BarChart3, Users, ShieldCheck, Zap } from "lucide-react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { useOwnerData } from "../_data/OwnerDataProvider";
import { OWNER_ROUTES } from "@/lib/config/owner-routes";
import type { OwnerDashboardData } from "../_data/fetchDashboard";
import type { ProfileCompletionData } from "@/components/owner/dashboard/profile-completion-card";
import { Badge } from "@/components/ui/badge";

// SOTA Imports
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { StatusBadge } from "@/components/ui/status-badge";
import { UpgradeTrigger, UsageLimitBanner } from "@/components/subscription";
import { UrgentActionsSection, type UrgentAction } from "@/components/owner/dashboard/urgent-actions-section";
import { PushNotificationPrompt } from "@/components/notifications/push-notification-prompt";
import { SignatureAlertBanner } from "@/components/owner/dashboard/signature-alert-banner";
import { OwnerRecentActivity } from "@/components/owner/dashboard/recent-activity";
import { RealtimeRevenueWidget, RealtimeStatusIndicator } from "@/components/owner/dashboard/realtime-revenue-widget";
import { StartTourButton } from "@/components/onboarding";

// Lazy loading des composants lourds
const OwnerTodoSection = dynamic(
  () => import("@/components/owner/dashboard/owner-todo-section").then((mod) => ({ default: mod.OwnerTodoSection })),
  { 
    loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
    ssr: false 
  }
);

const OwnerFinanceSummary = dynamic(
  () => import("@/components/owner/dashboard/owner-finance-summary").then((mod) => ({ default: mod.OwnerFinanceSummary })),
  { 
    loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
    ssr: false 
  }
);

const OwnerPortfolioByModule = dynamic(
  () => import("@/components/owner/dashboard/owner-portfolio-by-module").then((mod) => ({ default: mod.OwnerPortfolioByModule })),
  { 
    loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
    ssr: false 
  }
);

const OwnerRiskSection = dynamic(
  () => import("@/components/owner/dashboard/owner-risk-section").then((mod) => ({ default: mod.OwnerRiskSection })),
  { 
    loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
    ssr: false 
  }
);

const ProfileCompletionCard = dynamic(
  () => import("@/components/owner/dashboard/profile-completion-card").then((mod) => ({ default: mod.ProfileCompletionCard })),
  { 
    loading: () => <Skeleton className="h-80 w-full rounded-2xl rounded-xl" />,
    ssr: false 
  }
);

// Animation Variants SOTA
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

// Calcul du pourcentage de complétion du profil
function calculateCompletionPercentage(data: ProfileCompletionData): number {
  const tasks = [
    data.hasFirstName,
    data.hasLastName,
    data.hasPhone,
    data.hasAvatar,
    data.hasOwnerType,
    data.hasIban,
    data.hasBillingAddress,
    data.hasIdentityDocument,
    data.hasProperty,
  ];
  
  if (data.ownerType === "societe") {
    tasks.push(data.hasSiret);
  }
  
  if (data.hasProperty) {
    tasks.push(data.hasLease);
  }
  
  const completed = tasks.filter(Boolean).length;
  return Math.round((completed / tasks.length) * 100);
}

interface DashboardClientProps {
  dashboardData: OwnerDashboardData | null;
  profileCompletion: ProfileCompletionData | null;
}

export function DashboardClient({ dashboardData, profileCompletion }: DashboardClientProps) {
  const { dashboard: contextDashboard } = useOwnerData();
  const dashboard = contextDashboard || dashboardData;
  const completionPercentage = profileCompletion ? calculateCompletionPercentage(profileCompletion) : 0;

  if (!dashboard) {
    return (
      <EmptyState 
        title="Bienvenue !"
        description="Chargement de votre tableau de bord..."
        icon={Sparkles}
      />
    );
  }

  // Vérifier s'il y a des biens
  const hasProperties = dashboard.properties?.total > 0;

  if (!hasProperties && completionPercentage < 50) {
     return (
       <EmptyState 
         title="Bienvenue sur Talok !"
         description="Pour commencer, ajoutez votre premier bien immobilier."
         icon={Plus}
         action={{
            label: "Ajouter un bien",
            href: `${OWNER_ROUTES.properties.path}/new`,
            variant: "default"
         }}
       />
     );
  }

  // Construire les actions urgentes avec le nouveau format
  const urgentActions: UrgentAction[] = [
    // Impayés (critique)
    ...(dashboard.invoices?.late > 0 ? [{
      id: "invoices_late",
      type: "payment" as const,
      priority: "critical" as const,
      title: `${dashboard.invoices.late} loyer(s) en retard`,
      description: "Des paiements sont en retard et nécessitent une relance",
      link: OWNER_ROUTES.money.path,
      linkLabel: "Gérer les impayés",
      metadata: { count: dashboard.invoices.late },
    }] : []),
    // Signatures en attente (haute)
    ...(dashboard.leases?.pending > 0 ? [{
      id: "leases_pending",
      type: "signature" as const,
      priority: "high" as const,
      title: `${dashboard.leases.pending} signature(s) en attente`,
      description: "Des baux attendent votre signature ou celle du locataire",
      link: `${OWNER_ROUTES.contracts.path}?filter=pending_signature`,
      linkLabel: "Signer",
      metadata: { count: dashboard.leases.pending },
    }] : []),
    // EDL en attente de signature propriétaire (haute)
    ...(dashboard.edl?.pending_owner_signature > 0 ? [{
      id: "edl_pending",
      type: "signature" as const,
      priority: "high" as const,
      title: `${dashboard.edl.pending_owner_signature} État des lieux à signer`,
      description: "Des états des lieux sont terminés et attendent votre signature pour validation",
      link: "/owner/inspections",
      linkLabel: "Signer",
      metadata: { count: dashboard.edl.pending_owner_signature },
    }] : []),
    // Tickets ouverts (moyenne)
    ...(dashboard.tickets?.open > 0 ? [{
      id: "tickets_open",
      type: "ticket" as const,
      priority: "medium" as const,
      title: `${dashboard.tickets.open} ticket(s) de maintenance`,
      description: "Des demandes de maintenance attendent une action",
      link: OWNER_ROUTES.tickets.path,
      linkLabel: "Voir les tickets",
      metadata: { count: dashboard.tickets.open },
    }] : []),
    // Factures en attente (moyenne)
    ...(dashboard.invoices?.pending > 0 ? [{
      id: "invoices_pending",
      type: "payment" as const,
      priority: "medium" as const,
      title: `${dashboard.invoices.pending} facture(s) à envoyer`,
      description: "Des factures sont prêtes à être envoyées aux locataires",
      link: OWNER_ROUTES.money.path,
      linkLabel: "Envoyer",
      metadata: { count: dashboard.invoices.pending },
    }] : []),
    // Alertes DPE expirantes (depuis l'API)
    ...(dashboard.zone3_portfolio?.compliance || [])
      .filter((c) => c.type === "dpe_expiring")
      .map((alert) => ({
        id: alert.id,
        type: "document" as const,
        priority: alert.severity === "high" ? "high" as const : "medium" as const,
        title: "DPE bientôt expiré",
        description: alert.label,
        link: alert.action_url,
        linkLabel: "Voir le bien",
        metadata: { type: "dpe" },
      })),
  ];

  const transformedData = {
    zone1_tasks: urgentActions.map(action => ({
      id: action.id,
      type: action.type,
      title: action.title,
      priority: action.priority,
      dueDate: new Date().toISOString(),
      link: action.link,
    })),
    zone2_finances: {
      chart_data: [],
      kpis: {
        revenue_current_month: { 
          collected: dashboard.invoices?.paid || 0, 
          expected: (dashboard.invoices?.paid || 0) + (dashboard.invoices?.pending || 0), 
          percentage: dashboard.invoices?.paid && dashboard.invoices?.pending 
            ? Math.round((dashboard.invoices.paid / (dashboard.invoices.paid + dashboard.invoices.pending)) * 100) 
            : 0 
        },
        revenue_last_month: { collected: 0, expected: 0, percentage: 0 },
        arrears_amount: dashboard.invoices?.late || 0,
      },
    },
    zone3_portfolio: {
      modules: [
        { 
          module: "habitation" as const, 
          label: "Habitation", 
          stats: { 
            properties_count: dashboard.properties?.total || 0, 
            active_leases: dashboard.leases?.active || 0,
            monthly_revenue: dashboard.invoices?.total || 0,
          },
          action_url: "/owner/properties" 
        },
      ],
      compliance: [
        // Factures en retard
        ...(dashboard.invoices?.late > 0 ? [{
          id: "late-invoices",
          type: "compliance" as const,
          severity: "high" as const,
          label: `${dashboard.invoices.late} facture(s) en retard de paiement`,
          action_url: "/owner/money",
        }] : []),
        // Alertes DPE expirantes (depuis l'API)
        ...(dashboard.zone3_portfolio?.compliance || []).filter(
          (c) => c.type === "dpe_expiring"
        ),
      ],
    },
  };

  return (
    <PageTransition>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-8 pb-10"
      >
        {/* SOTA Header - Responsive pour tous appareils 2025-2026 */}
        <motion.header
          variants={itemVariants}
          className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-4 xs:p-5 sm:p-6 lg:p-8 text-white shadow-2xl"
        >
          {/* Background decorations - Masquées sur très petit écran pour performance */}
          <div className="hidden xs:block absolute top-0 right-0 -mt-10 -mr-10 h-48 sm:h-64 w-48 sm:w-64 rounded-full bg-white/5 blur-3xl" />
          <div className="hidden xs:block absolute bottom-0 left-0 -mb-10 -ml-10 h-48 sm:h-64 w-48 sm:w-64 rounded-full bg-blue-500/10 blur-3xl" />
          
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 lg:gap-6">
            <div className="min-w-0 flex-1">
              {/* Titre + Badge - Toujours en ligne */}
              <div className="flex flex-row items-center flex-wrap gap-2 xs:gap-3 mb-1.5 sm:mb-2">
                <motion.h1 
                  className="text-xl xs:text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  data-tour="dashboard-header"
                >
                  Tableau de bord
                </motion.h1>
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-center gap-1.5 xs:gap-2"
                >
                  {/* Badge SOTA - Condensé sur mobile */}
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 gap-1 xs:gap-1.5 px-1.5 xs:px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] xs:text-xs">
                    <ShieldCheck className="h-3 w-3 xs:h-3.5 xs:w-3.5" />
                    <span className="hidden sm:inline">SOTA 2026</span> Secure
                  </Badge>
                  <RealtimeStatusIndicator />
                </motion.div>
              </div>
              <motion.p 
                className="text-slate-300 text-sm xs:text-base sm:text-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                Bienvenue, vous gérez {dashboard.properties?.total || 0} bien{(dashboard.properties?.total || 0) > 1 ? 's' : ''} avec succès.
              </motion.p>
            </div>
            
            {/* ✅ SOTA 2026: Bouton "Ajouter un bien" supprimé du header - déjà présent dans quick-links */}
          </div>

          {/* Quick Stats in Header - Grid responsive */}
          <div className="mt-4 sm:mt-6 lg:mt-8 grid grid-cols-2 lg:grid-cols-4 gap-2.5 xs:gap-3 sm:gap-4 border-t border-white/10 pt-4 sm:pt-6">
             {/* KPI 1: Revenus */}
             <div className="min-w-0">
                <p className="text-slate-400 text-[10px] xs:text-xs sm:text-sm font-medium truncate">Revenus du mois</p>
                <p className="text-base xs:text-lg sm:text-xl lg:text-2xl font-bold mt-0.5 sm:mt-1 truncate">
                   <AnimatedCounter value={transformedData.zone2_finances.kpis.revenue_current_month.collected} type="currency" />
                </p>
             </div>
             {/* KPI 2: Biens */}
             <div className="min-w-0">
                <p className="text-slate-400 text-[10px] xs:text-xs sm:text-sm font-medium truncate">Biens gérés</p>
                <p className="text-base xs:text-lg sm:text-xl lg:text-2xl font-bold mt-0.5 sm:mt-1">
                   <AnimatedCounter value={dashboard.properties?.total || 0} />
                </p>
             </div>
             {/* KPI 3: Baux */}
             <div className="min-w-0">
                <p className="text-slate-400 text-[10px] xs:text-xs sm:text-sm font-medium truncate">Baux actifs</p>
                <p className="text-base xs:text-lg sm:text-xl lg:text-2xl font-bold mt-0.5 sm:mt-1">
                   <AnimatedCounter value={dashboard.leases?.active || 0} />
                </p>
             </div>
             {/* KPI 4: Taux d'occupation */}
             <div className="min-w-0">
                <p className="text-slate-400 text-[10px] xs:text-xs sm:text-sm font-medium truncate">Taux d'occupation</p>
                {(() => {
                  const rate = dashboard.properties?.total > 0 
                    ? Math.round(((dashboard.leases?.active || 0) / dashboard.properties.total) * 100) 
                    : 0;
                  const colorClass = rate >= 80 ? "text-emerald-400" : rate >= 50 ? "text-amber-400" : "text-red-400";
                  const barColor = rate >= 80 ? "bg-emerald-400" : rate >= 50 ? "bg-amber-400" : "bg-red-400";
                  return (
                    <div className="space-y-0.5 sm:space-y-1">
                      <p className={`text-base xs:text-lg sm:text-xl lg:text-2xl font-bold ${colorClass}`}>
                        {rate}%
                      </p>
                      <div className="h-1 xs:h-1.5 w-16 xs:w-20 sm:w-24 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${barColor} transition-all duration-500`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}
             </div>
          </div>
        </motion.header>

        {/* Section Complétion du profil */}
        {profileCompletion && completionPercentage < 100 && (
          <motion.section variants={itemVariants}>
            <GlassCard gradient={true} className="border-amber-200/50 bg-amber-50/30">
               <div className="p-1">
                  <ProfileCompletionCard data={profileCompletion} />
               </div>
            </GlassCard>
          </motion.section>
        )}

        {/* Bannière notifications push */}
        <motion.section variants={itemVariants}>
          <PushNotificationPrompt variant="banner" />
        </motion.section>

        {/* 🔔 Alerte signatures en attente */}
        <motion.section variants={itemVariants}>
          <SignatureAlertBanner />
        </motion.section>

        {/* Zone 1 - Actions Urgentes (SOTA 2025) */}
        <motion.section variants={itemVariants}>
          <UrgentActionsSection actions={urgentActions} />
        </motion.section>
        
        {/* Liens rapides - Touch-friendly et responsive */}
        <motion.section variants={itemVariants}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 xs:gap-2.5 sm:gap-3">
            <Link href="/owner/tenants">
              <GlassCard hoverEffect className="p-3 xs:p-4 text-center cursor-pointer touch-target active:scale-[0.98] transition-transform min-h-[72px] xs:min-h-[80px] flex flex-col items-center justify-center">
                <Users className="h-6 w-6 xs:h-7 xs:w-7 sm:h-6 sm:w-6 mx-auto text-blue-600 mb-1.5 xs:mb-2" />
                <p className="text-[11px] xs:text-xs sm:text-sm font-medium text-slate-700 line-clamp-1">Mes locataires</p>
              </GlassCard>
            </Link>
            <Link href="/owner/analytics">
              <GlassCard hoverEffect className="p-3 xs:p-4 text-center cursor-pointer touch-target active:scale-[0.98] transition-transform min-h-[72px] xs:min-h-[80px] flex flex-col items-center justify-center">
                <BarChart3 className="h-6 w-6 xs:h-7 xs:w-7 sm:h-6 sm:w-6 mx-auto text-emerald-600 mb-1.5 xs:mb-2" />
                <p className="text-[11px] xs:text-xs sm:text-sm font-medium text-slate-700 line-clamp-1">Analytics</p>
              </GlassCard>
            </Link>
            <Link href={`${OWNER_ROUTES.contracts.path}/new`}>
              <GlassCard hoverEffect className="p-3 xs:p-4 text-center cursor-pointer touch-target active:scale-[0.98] transition-transform min-h-[72px] xs:min-h-[80px] flex flex-col items-center justify-center">
                <Plus className="h-6 w-6 xs:h-7 xs:w-7 sm:h-6 sm:w-6 mx-auto text-amber-600 mb-1.5 xs:mb-2" />
                <p className="text-[11px] xs:text-xs sm:text-sm font-medium text-slate-700 line-clamp-1">Nouveau bail</p>
              </GlassCard>
            </Link>
            <Link href={`${OWNER_ROUTES.properties.path}/new`}>
              <GlassCard hoverEffect className="p-3 xs:p-4 text-center cursor-pointer touch-target active:scale-[0.98] transition-transform min-h-[72px] xs:min-h-[80px] flex flex-col items-center justify-center">
                <Plus className="h-6 w-6 xs:h-7 xs:w-7 sm:h-6 sm:w-6 mx-auto text-purple-600 mb-1.5 xs:mb-2" />
                <p className="text-[11px] xs:text-xs sm:text-sm font-medium text-slate-700 line-clamp-1">Ajouter un bien</p>
              </GlassCard>
            </Link>
          </div>
        </motion.section>

        {/* Zone 2 - Vue finances détaillée avec Temps Réel */}
        <motion.section variants={itemVariants}>
          <div className="mb-3 sm:mb-4 flex flex-row items-center justify-between gap-2">
             <h2 className="text-sm xs:text-base sm:text-lg lg:text-xl font-semibold text-slate-800 truncate">Performance Financière</h2>
             <div className="flex items-center gap-1.5 xs:gap-2 shrink-0">
               <StartTourButton className="text-[10px] xs:text-xs hidden xs:flex" />
               <Button variant="ghost" size="sm" asChild className="text-blue-600 hover:text-blue-700 h-7 xs:h-8 sm:h-9 px-2 xs:px-3 text-xs xs:text-sm">
                  <Link href="/owner/money">
                     <span className="hidden sm:inline">Voir détails</span>
                     <span className="sm:hidden">Détails</span>
                     <ArrowRight className="ml-1 h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4" />
                  </Link>
               </Button>
             </div>
          </div>
          <div className="grid gap-3 sm:gap-4 lg:gap-6 lg:grid-cols-2">
            {/* Widget Temps Réel SOTA 2026 */}
            <RealtimeRevenueWidget />
            {/* Widget classique */}
            <OwnerFinanceSummary
              chartData={transformedData.zone2_finances.chart_data}
              kpis={transformedData.zone2_finances.kpis}
            />
          </div>
        </motion.section>

        {/* Zone 3 - Portefeuille & conformité - Responsive mobile → tablet → desktop */}
        <div className="grid gap-3 sm:gap-4 lg:gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="md:col-span-2 lg:col-span-2 space-y-3 sm:space-y-4 lg:space-y-6">
            <div className="grid gap-3 sm:gap-4 lg:gap-6 sm:grid-cols-2">
              <GlassCard hoverEffect={true}>
                <div className="p-0.5 xs:p-1">
                  <OwnerPortfolioByModule modules={transformedData.zone3_portfolio.modules} />
                </div>
              </GlassCard>
              
              <GlassCard hoverEffect={true} className={transformedData.zone3_portfolio.compliance.length > 0 ? "border-red-100 bg-red-50/30" : ""}>
                <div className="p-0.5 xs:p-1">
                  <OwnerRiskSection risks={transformedData.zone3_portfolio.compliance} />
                </div>
              </GlassCard>
            </div>
          </div>
          
          <div className="md:col-span-2 lg:col-span-1">
            <OwnerRecentActivity activities={dashboard.recentActivity || []} />
          </div>
        </div>

        {/* SOTA 2026 - Usage Limits & Upgrade Trigger */}
        <motion.section variants={itemVariants} className="space-y-4">
          <UsageLimitBanner
            resource="properties"
            variant="inline"
            threshold={80}
            dismissible={true}
          />
          <UsageLimitBanner
            resource="leases"
            variant="inline"
            threshold={80}
            dismissible={true}
          />
          <UsageLimitBanner
            resource="signatures"
            variant="inline"
            threshold={80}
            dismissible={true}
          />
          <UpgradeTrigger variant="prominent" />
        </motion.section>
      </motion.div>
    </PageTransition>
  );
}
