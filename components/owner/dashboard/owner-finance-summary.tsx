"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/helpers/format";
import { OWNER_ROUTES } from "@/lib/config/owner-routes";
import { Skeleton } from "@/components/ui/skeleton";

// Chargement dynamique de Recharts (bibliothèque lourde ~200KB)
const FinanceChart = dynamic(
  () => import("./finance-chart"),
  { 
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full" />
  }
);

interface FinanceData {
  period: string;
  expected: number;
  collected: number;
}

interface FinanceKPIs {
  revenue_current_month: {
    collected: number;
    expected: number;
    percentage: number;
  };
  revenue_last_month: {
    collected: number;
    expected: number;
    percentage: number;
  };
  arrears_amount: number;
}

interface OwnerFinanceSummaryProps {
  chartData: FinanceData[];
  kpis: FinanceKPIs;
}

const kpiVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  }),
};

export function OwnerFinanceSummary({ chartData, kpis }: OwnerFinanceSummaryProps) {
  // Vérification de sécurité pour éviter les erreurs si les données ne sont pas encore chargées
  if (!kpis || !kpis.revenue_current_month || !kpis.revenue_last_month) {
    return (
      <Card className="backdrop-blur-sm bg-white/80 border-white/20 shadow-xl">
        <CardContent className="py-12 text-center">
          <Skeleton className="h-64 w-full mb-4" />
          <Skeleton className="h-8 w-48 mx-auto" />
        </CardContent>
      </Card>
    );
  }

  const currentMonthDiff = kpis.revenue_current_month.collected - kpis.revenue_current_month.expected;
  const lastMonthDiff = kpis.revenue_last_month.collected - kpis.revenue_last_month.expected;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="backdrop-blur-sm bg-white/80 border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <TrendingUp className="h-5 w-5 text-green-600" />
            </motion.div>
            Vue finances
          </CardTitle>
          <CardDescription>Loyers encaissés vs attendus sur 6 mois</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Graphique - Chargé dynamiquement pour optimiser le démarrage */}
          <motion.div
            className="h-64 w-full min-h-[256px]"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <FinanceChart chartData={chartData} />
          </motion.div>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                label: "Revenus ce mois",
                value: kpis.revenue_current_month.collected,
                diff: currentMonthDiff,
                expected: kpis.revenue_current_month.expected,
                percentage: kpis.revenue_current_month.percentage,
                gradient: "from-blue-50 to-blue-100/50",
              },
              {
                label: "Revenus mois dernier",
                value: kpis.revenue_last_month.collected,
                diff: lastMonthDiff,
                percentage: kpis.revenue_last_month.percentage,
                gradient: "from-slate-50 to-slate-100/50",
              },
              {
                label: "Impayés",
                value: kpis.arrears_amount,
                gradient: "from-red-50 to-red-100/50",
                isArrears: true,
              },
            ].map((kpi, index) => (
              <motion.div
                key={index}
                custom={index}
                variants={kpiVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.02, y: -2 }}
                className={`p-4 rounded-lg border bg-gradient-to-br ${kpi.gradient} cursor-pointer transition-all duration-300`}
              >
                <p className="text-xs font-medium text-slate-600 mb-1">{kpi.label}</p>
                <motion.p
                  className={`text-2xl font-bold ${kpi.isArrears ? "text-red-600" : "text-slate-900"}`}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.1 + 0.3, type: "spring", stiffness: 200 }}
                >
                  {formatCurrency(kpi.value)}
                </motion.p>
                {!kpi.isArrears && kpi.diff !== undefined && (
                  <div className="flex items-center gap-1 mt-2">
                    {kpi.diff >= 0 ? (
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      </motion.div>
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <span
                      className={`text-xs font-medium ${
                        kpi.diff >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {kpi.diff >= 0 ? "+" : ""}
                      {formatCurrency(Math.abs(kpi.diff))}
                    </span>
                    {kpi.expected && (
                      <span className="text-xs text-slate-500">
                        / {formatCurrency(kpi.expected)} attendus
                      </span>
                    )}
                  </div>
                )}
                {kpi.percentage !== undefined && (
                  <p className="text-xs text-slate-500 mt-1">
                    {kpi.percentage.toFixed(1)}% du montant attendu
                  </p>
                )}
                {kpi.isArrears && (
                  <p className="text-xs text-slate-500 mt-2">Montant total en retard</p>
                )}
              </motion.div>
            ))}
          </div>

          {/* Bouton action */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button variant="outline" className="w-full group" asChild>
              <Link href={OWNER_ROUTES.money.path}>
                Voir le détail des loyers
                <motion.div
                  className="inline-block ml-2"
                  whileHover={{ x: 4 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <ArrowRight className="h-4 w-4" />
                </motion.div>
              </Link>
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
