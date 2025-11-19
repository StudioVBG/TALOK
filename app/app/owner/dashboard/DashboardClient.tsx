/**
 * Client Component pour le dashboard Owner
 * Utilise les données déjà chargées dans le Context
 */

"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { useOwnerData } from "../_data/OwnerDataProvider";
import { OWNER_ROUTES } from "@/lib/config/owner-routes";
import type { OwnerDashboardData } from "../_data/fetchDashboard";

// Lazy loading des composants lourds
const OwnerTodoSection = dynamic(
  () => import("@/components/owner/dashboard/owner-todo-section").then((mod) => ({ default: mod.OwnerTodoSection })),
  { 
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false 
  }
);

const OwnerFinanceSummary = dynamic(
  () => import("@/components/owner/dashboard/owner-finance-summary").then((mod) => ({ default: mod.OwnerFinanceSummary })),
  { 
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false 
  }
);

const OwnerPortfolioByModule = dynamic(
  () => import("@/components/owner/dashboard/owner-portfolio-by-module").then((mod) => ({ default: mod.OwnerPortfolioByModule })),
  { 
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false 
  }
);

const OwnerRiskSection = dynamic(
  () => import("@/components/owner/dashboard/owner-risk-section").then((mod) => ({ default: mod.OwnerRiskSection })),
  { 
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false 
  }
);

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

interface DashboardClientProps {
  dashboardData: OwnerDashboardData | null;
}

export function DashboardClient({ dashboardData }: DashboardClientProps) {
  const { dashboard: contextDashboard } = useOwnerData();
  
  // Utiliser les données du Context si disponibles, sinon celles passées en props
  const dashboard = contextDashboard || dashboardData;

  if (!dashboard) {
    return <EmptyState />;
  }

  // Transformer les données du format OwnerDashboardData vers le format attendu par les composants
  // TODO: Adapter selon la structure réelle des composants
  const transformedData = {
    zone1_tasks: [], // TODO: Transformer depuis dashboard
    zone2_finances: {
      chart_data: [],
      kpis: {
        revenue_current_month: { collected: 0, expected: 0, percentage: 0 },
        revenue_last_month: { collected: 0, expected: 0, percentage: 0 },
        arrears_amount: 0,
      },
    },
    zone3_portfolio: {
      modules: [],
      compliance: [],
    },
  };

  // Vérifier s'il y a des biens
  const hasProperties = dashboard.properties?.total > 0;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Header */}
      <motion.header
        variants={itemVariants}
        className="relative overflow-hidden"
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-2xl blur-3xl"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <div className="relative flex items-center justify-between p-6 backdrop-blur-sm bg-white/50 rounded-2xl border border-white/20 shadow-xl">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <motion.h1
              className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent"
              animate={{
                backgroundPosition: ["0%", "100%", "0%"],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "linear",
              }}
              style={{
                backgroundSize: "200% 100%",
              }}
            >
              Tableau de bord
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-muted-foreground mt-2 text-lg"
            >
              Vue d'ensemble de votre portefeuille locatif
            </motion.p>
          </motion.div>
          {hasProperties && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
            >
              <Button
                asChild
                className="relative overflow-hidden group shadow-lg hover:shadow-2xl transition-all duration-300"
              >
                <Link href={`${OWNER_ROUTES.properties.path}/new`}>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    whileHover={{ scale: 1.1 }}
                  />
                  <span className="relative flex items-center">
                    <motion.div
                      whileHover={{ rotate: 90 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                    </motion.div>
                    Ajouter un bien
                  </span>
                </Link>
              </Button>
            </motion.div>
          )}
        </div>
      </motion.header>

      {/* Zone 1 - À faire maintenant */}
      <motion.section variants={itemVariants}>
        <OwnerTodoSection todos={transformedData.zone1_tasks} />
      </motion.section>

      {/* Zone 2 - Vue finances */}
      <motion.section variants={itemVariants}>
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
        <OwnerPortfolioByModule modules={transformedData.zone3_portfolio.modules} />
        <OwnerRiskSection risks={transformedData.zone3_portfolio.compliance} />
      </motion.div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="text-center py-16"
    >
      <motion.div
        className="max-w-md mx-auto"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <motion.div
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 mb-6"
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Plus className="h-10 w-10 text-blue-600" />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold mb-4 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent"
        >
          Bienvenue !
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-muted-foreground mb-6 text-lg"
        >
          Pour commencer, ajoutez votre premier bien. Nous vous guiderons ensuite
          pour créer un bail et encaisser vos loyers.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            asChild
            size="lg"
            className="relative overflow-hidden group shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Link href={`${OWNER_ROUTES.properties.path}/new`}>
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                whileHover={{ scale: 1.1 }}
              />
              <span className="relative flex items-center">
                <motion.div
                  whileHover={{ rotate: 90 }}
                  transition={{ duration: 0.3 }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                </motion.div>
                Ajouter un bien
              </span>
            </Link>
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

