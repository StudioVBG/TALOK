"use client";

/**
 * Widget Prévisions de Trésorerie
 * 
 * Affiche une projection des revenus et dépenses sur 6 mois:
 * - Loyers attendus
 * - Charges prévisionnelles
 * - Solde projeté
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Euro,
  ArrowRight,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/helpers/format";

interface CashflowData {
  month: string; // YYYY-MM
  monthLabel: string; // "Jan", "Fév", etc.
  expectedRevenue: number;
  expectedExpenses: number;
  netCashflow: number;
  cumulativeBalance: number;
}

interface CashflowWidgetProps {
  data: CashflowData[];
  currentBalance?: number;
  className?: string;
}

// Tooltip personnalisé
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;

  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-900 mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-slate-600">{entry.name}</span>
            </div>
            <span className="font-medium">
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export function CashflowWidget({ data, currentBalance = 0, className }: CashflowWidgetProps) {
  // Calculer les totaux
  const totals = useMemo(() => {
    const totalRevenue = data.reduce((sum, d) => sum + d.expectedRevenue, 0);
    const totalExpenses = data.reduce((sum, d) => sum + d.expectedExpenses, 0);
    const totalNet = totalRevenue - totalExpenses;
    const projectedBalance = currentBalance + totalNet;
    const trend = totalNet >= 0 ? "positive" : "negative";
    
    return { totalRevenue, totalExpenses, totalNet, projectedBalance, trend };
  }, [data, currentBalance]);

  // Formater les données pour le graphique
  const chartData = useMemo(() => {
    let cumulative = currentBalance;
    return data.map((d) => {
      cumulative += d.netCashflow;
      return {
        ...d,
        cumulativeBalance: cumulative,
      };
    });
  }, [data, currentBalance]);

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Euro className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Prévisions de trésorerie</CardTitle>
          </div>
          <Badge
            variant="outline"
            className={cn(
              totals.trend === "positive"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-red-50 text-red-700 border-red-200"
            )}
          >
            {totals.trend === "positive" ? (
              <TrendingUp className="h-3 w-3 mr-1" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1" />
            )}
            {totals.trend === "positive" ? "+" : ""}
            {formatCurrency(totals.totalNet)}
          </Badge>
        </div>
        <CardDescription>
          Projection sur les {data.length} prochains mois
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mini KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-3 rounded-lg bg-emerald-50 border border-emerald-100"
          >
            <p className="text-xs text-emerald-600 font-medium">Revenus prévus</p>
            <p className="text-lg font-bold text-emerald-700">
              {formatCurrency(totals.totalRevenue)}
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-3 rounded-lg bg-red-50 border border-red-100"
          >
            <p className="text-xs text-red-600 font-medium">Dépenses prévues</p>
            <p className="text-lg font-bold text-red-700">
              {formatCurrency(totals.totalExpenses)}
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-3 rounded-lg bg-blue-50 border border-blue-100"
          >
            <p className="text-xs text-blue-600 font-medium">Solde projeté</p>
            <p className="text-lg font-bold text-blue-700">
              {formatCurrency(totals.projectedBalance)}
            </p>
          </motion.div>
        </div>

        {/* Graphique */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="h-[200px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "12px" }}
                iconType="circle"
                iconSize={8}
              />
              <Bar
                dataKey="expectedRevenue"
                name="Revenus"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                barSize={20}
              />
              <Bar
                dataKey="expectedExpenses"
                name="Dépenses"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
                barSize={20}
              />
              <Line
                type="monotone"
                dataKey="cumulativeBalance"
                name="Solde cumulé"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Info */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
          <Info className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-600">
            Les prévisions sont basées sur vos loyers actuels et les charges récurrentes. 
            Les dépenses exceptionnelles ne sont pas incluses.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Génère les données de prévision de trésorerie
 */
export function generateCashflowForecast(params: {
  monthlyRent: number;
  monthlyCharges: number;
  monthlyExpenses: number;
  currentBalance: number;
  months?: number;
}): CashflowData[] {
  const { monthlyRent, monthlyCharges, monthlyExpenses, months = 6 } = params;
  const data: CashflowData[] = [];
  
  const now = new Date();
  const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

  for (let i = 0; i < months; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    const month = date.toISOString().slice(0, 7);
    const monthLabel = monthNames[date.getMonth()];
    
    const expectedRevenue = monthlyRent + monthlyCharges;
    const expectedExpenses = monthlyExpenses;
    const netCashflow = expectedRevenue - expectedExpenses;

    data.push({
      month,
      monthLabel,
      expectedRevenue,
      expectedExpenses,
      netCashflow,
      cumulativeBalance: 0, // Calculé après
    });
  }

  return data;
}

