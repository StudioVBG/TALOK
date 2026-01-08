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
        {/* SOTA Header */}
        <motion.header
          variants={itemVariants}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-8 text-white shadow-2xl"
        >
          <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
          
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <motion.h1 
                  className="text-4xl font-bold tracking-tight"
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
                  className="flex items-center gap-2"
                >
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 gap-1.5 px-2.5 py-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    SOTA 2026 Secure
                  </Badge>
                  <RealtimeStatusIndicator />
                </motion.div>
              </div>
              <motion.p 
                className="text-slate-300 text-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                Bienvenue, vous gérez {dashboard.properties?.total || 0} biens avec succès.
              </motion.p>
            </div>
            
            {hasProperties && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, type: "spring" }}
              >
                <Button
                  asChild
                  size="lg"
                  className="bg-white text-slate-900 hover:bg-slate-100 shadow-lg border-0 font-semibold"
                >
                  <Link href={`${OWNER_ROUTES.properties.path}/new`}>
                    <Plus className="mr-2 h-5 w-5" />
                    Ajouter un bien
                  </Link>
                </Button>
              </motion.div>
            )}
          </div>

          {/* Quick Stats in Header */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-white/10 pt-6">
             <div>
                <p className="text-slate-400 text-sm font-medium">Revenus du mois</p>
                <p className="text-2xl font-bold mt-1">
                   <AnimatedCounter value={transformedData.zone2_finances.kpis.revenue_current_month.collected} type="currency" />
                </p>
             </div>
             <div>
                <p className="text-slate-400 text-sm font-medium">Biens gérés</p>
                <p className="text-2xl font-bold mt-1">
                   <AnimatedCounter value={dashboard.properties?.total || 0} />
                </p>
             </div>
             <div>
                <p className="text-slate-400 text-sm font-medium">Baux actifs</p>
                <p className="text-2xl font-bold mt-1">
                   <AnimatedCounter value={dashboard.leases?.active || 0} />
                </p>
             </div>
             <div>
                <p className="text-slate-400 text-sm font-medium">Taux d'occupation</p>
                {(() => {
                  const rate = dashboard.properties?.total > 0 
                    ? Math.round(((dashboard.leases?.active || 0) / dashboard.properties.total) * 100) 
                    : 0;
                  const colorClass = rate >= 80 ? "text-emerald-400" : rate >= 50 ? "text-amber-400" : "text-red-400";
                  const barColor = rate >= 80 ? "bg-emerald-400" : rate >= 50 ? "bg-amber-400" : "bg-red-400";
                  return (
                    <div className="space-y-1">
                      <p className={`text-2xl font-bold ${colorClass}`}>
                        {rate}%
                      </p>
                      <div className="h-1.5 w-24 bg-slate-700 rounded-full overflow-hidden">
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
        
        {/* Liens rapides */}
        <motion.section variants={itemVariants}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/owner/tenants">
              <GlassCard hoverEffect className="p-4 text-center cursor-pointer">
                <Users className="h-6 w-6 mx-auto text-blue-600 mb-2" />
                <p className="text-sm font-medium text-slate-700">Mes locataires</p>
              </GlassCard>
            </Link>
            <Link href="/owner/analytics">
              <GlassCard hoverEffect className="p-4 text-center cursor-pointer">
                <BarChart3 className="h-6 w-6 mx-auto text-emerald-600 mb-2" />
                <p className="text-sm font-medium text-slate-700">Analytics</p>
              </GlassCard>
            </Link>
            <Link href={`${OWNER_ROUTES.contracts.path}/new`}>
              <GlassCard hoverEffect className="p-4 text-center cursor-pointer">
                <Plus className="h-6 w-6 mx-auto text-amber-600 mb-2" />
                <p className="text-sm font-medium text-slate-700">Nouveau bail</p>
              </GlassCard>
            </Link>
            <Link href={`${OWNER_ROUTES.properties.path}/new`}>
              <GlassCard hoverEffect className="p-4 text-center cursor-pointer">
                <Plus className="h-6 w-6 mx-auto text-purple-600 mb-2" />
                <p className="text-sm font-medium text-slate-700">Ajouter un bien</p>
              </GlassCard>
            </Link>
          </div>
        </motion.section>

        {/* Zone 2 - Vue finances détaillée avec Temps Réel */}
        <motion.section variants={itemVariants}>
          <div className="mb-4 flex items-center justify-between">
             <h2 className="text-xl font-semibold text-slate-800">Performance Financière</h2>
             <div className="flex items-center gap-2">
               <StartTourButton className="text-xs" />
               <Button variant="ghost" size="sm" asChild className="text-blue-600 hover:text-blue-700">
                  <Link href="/owner/money">
                     Voir détails <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
               </Button>
             </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Widget Temps Réel SOTA 2026 */}
            <RealtimeRevenueWidget />
            {/* Widget classique */}
            <OwnerFinanceSummary
              chartData={transformedData.zone2_finances.chart_data}
              kpis={transformedData.zone2_finances.kpis}
            />
          </div>
        </motion.section>

        {/* Zone 3 - Portefeuille & conformité */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <GlassCard hoverEffect={true}>
                <div className="p-1">
                  <OwnerPortfolioByModule modules={transformedData.zone3_portfolio.modules} />
                </div>
              </GlassCard>
              
              <GlassCard hoverEffect={true} className={transformedData.zone3_portfolio.compliance.length > 0 ? "border-red-100 bg-red-50/30" : ""}>
                <div className="p-1">
                  <OwnerRiskSection risks={transformedData.zone3_portfolio.compliance} />
                </div>
              </GlassCard>
            </div>
          </div>
          
          <div className="lg:col-span-1">
            <OwnerRecentActivity activities={dashboard.recentActivity || []} />
          </div>
        </div>

        {/* SOTA 2025 - Usage Limits & Upgrade Trigger */}
        <motion.section variants={itemVariants} className="space-y-4">
          <UsageLimitBanner 
            resource="properties" 
            variant="inline" 
            threshold={70}
            dismissible={true}
          />
          <UpgradeTrigger variant="prominent" />
        </motion.section>
      </motion.div>
    </PageTransition>
  );
}
