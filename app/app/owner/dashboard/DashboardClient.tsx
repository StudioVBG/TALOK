"use client";
// @ts-nocheck

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, AlertCircle, ArrowRight } from "lucide-react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { useOwnerData } from "../_data/OwnerDataProvider";
import { OWNER_ROUTES } from "@/lib/config/owner-routes";
import type { OwnerDashboardData } from "../_data/fetchDashboard";
import type { ProfileCompletionData } from "@/components/owner/dashboard/profile-completion-card";

// SOTA Imports
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { StatusBadge } from "@/components/ui/status-badge";

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
         title="Bienvenue sur Lokatif !"
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

  const transformedData = {
    zone1_tasks: [
      ...(dashboard.invoices?.pending > 0 ? [{
        id: "invoices_pending",
        type: "invoice" as const,
        title: `${dashboard.invoices.pending} facture(s) en attente`,
        priority: "high" as const,
        dueDate: new Date().toISOString(),
        link: OWNER_ROUTES.money.path,
      }] : []),
      ...(dashboard.tickets?.open > 0 ? [{
        id: "tickets_open",
        type: "ticket" as const,
        title: `${dashboard.tickets.open} ticket(s) ouvert(s)`,
        priority: "medium" as const,
        dueDate: new Date().toISOString(),
        link: "/tickets",
      }] : []),
      ...(dashboard.leases?.pending > 0 ? [{
        id: "leases_pending",
        type: "lease" as const,
        title: `${dashboard.leases.pending} bail(aux) en attente`,
        priority: "medium" as const,
        dueDate: new Date().toISOString(),
        link: OWNER_ROUTES.contracts.path,
      }] : []),
    ],
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
            monthly_revenue: (dashboard.invoices as any)?.total_amount || dashboard.invoices?.total || 0,
          },
          action_url: "/app/owner/properties" 
        },
      ],
      compliance: dashboard.invoices?.late > 0 ? [{
        id: "late-invoices",
        type: "compliance" as const,
        severity: "high" as const,
        label: `${dashboard.invoices.late} facture(s) en retard de paiement`,
        action_url: "/app/owner/money",
      }] : [],
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
              <motion.h1 
                className="text-4xl font-bold tracking-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Tableau de bord
              </motion.h1>
              <motion.p 
                className="text-slate-300 mt-2 text-lg"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                Vue d'ensemble de votre portefeuille locatif
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
                <p className="text-2xl font-bold mt-1 text-emerald-400">
                   {dashboard.properties?.total > 0 
                      ? Math.round(((dashboard.leases?.active || 0) / dashboard.properties.total) * 100) 
                      : 0}%
                </p>
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

        {/* Zone 1 - À faire maintenant */}
        <motion.section variants={itemVariants}>
          <div className="mb-4 flex items-center justify-between">
             <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-blue-600" />
                À traiter
             </h2>
          </div>
          {transformedData.zone1_tasks.length > 0 ? (
             <OwnerTodoSection todos={transformedData.zone1_tasks} />
          ) : (
             <GlassCard className="p-8 text-center text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                <p>Rien à signaler, tout est à jour !</p>
             </GlassCard>
          )}
        </motion.section>

        {/* Zone 2 - Vue finances détaillée */}
        <motion.section variants={itemVariants}>
          <div className="mb-4 flex items-center justify-between">
             <h2 className="text-xl font-semibold text-slate-800">Performance Financière</h2>
             <Button variant="ghost" size="sm" asChild className="text-blue-600 hover:text-blue-700">
                <Link href="/app/owner/money">
                   Voir détails <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
             </Button>
          </div>
          <OwnerFinanceSummary
            chartData={transformedData.zone2_finances.chart_data}
            kpis={transformedData.zone2_finances.kpis}
          />
        </motion.section>

        {/* Zone 3 - Portefeuille & conformité */}
        <motion.div
          variants={itemVariants}
          className="grid gap-6 lg:grid-cols-2"
        >
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
        </motion.div>
      </motion.div>
    </PageTransition>
  );
}
