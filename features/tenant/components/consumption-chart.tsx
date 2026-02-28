"use client";

import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Zap, Droplet, Flame, BarChart3, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface ConsumptionDataPoint {
  month: string;
  elec: number;
  water: number;
  gas: number;
}

interface ConsumptionChartProps {
  type: "electricity" | "water" | "gas";
  className?: string;
  /** Données réelles - si non fournies ou vides, affiche un état vide */
  data?: ConsumptionDataPoint[];
  /** Valeur actuelle à afficher */
  currentValue?: number;
  /** Indique si les données sont disponibles */
  hasData?: boolean;
  /** Date de dernière mise à jour */
  lastUpdate?: string | null;
  /** Lien CTA pour saisir un relevé */
  ctaHref?: string;
}

const CONFIG = {
  electricity: { label: "Électricité", color: "#f59e0b", icon: Zap, dataKey: "elec", unit: "kWh" },
  water: { label: "Eau", color: "#3b82f6", icon: Droplet, dataKey: "water", unit: "m³" },
  gas: { label: "Gaz", color: "#ef4444", icon: Flame, dataKey: "gas", unit: "kWh" },
};

export function ConsumptionChart({
  type,
  className,
  data,
  currentValue,
  hasData = false,
  lastUpdate,
  ctaHref
}: ConsumptionChartProps) {
  const config = CONFIG[type];
  const Icon = config.icon;

  // Déterminer la valeur à afficher
  const displayValue = currentValue ?? (data && data.length > 0 
    ? data[data.length - 1][config.dataKey as keyof ConsumptionDataPoint] 
    : 0);

  // Si pas de données, afficher l'état vide
  if (!hasData || !data || data.length === 0) {
    return (
      <GlassCard className={cn("p-6 bg-white border-slate-200 shadow-xl", className)}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <Icon className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{config.label}</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Évolution 6 mois</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-slate-300">
              --
              <span className="text-xs font-bold text-slate-300 ml-1">{config.unit}</span>
            </p>
          </div>
        </div>

        {/* État vide */}
        <motion.div 
          className="h-[200px] w-full flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="p-4 rounded-2xl bg-slate-50 mb-4">
            <BarChart3 className="h-8 w-8 text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-400 text-center max-w-[200px]">
            Aucun relevé de compteur disponible
          </p>
          <p className="text-xs text-slate-300 mt-1">
            Les données apparaîtront après un état des lieux
          </p>
          {ctaHref && (
            <Button variant="outline" size="sm" className="mt-4 rounded-xl font-bold text-slate-500 border-slate-200 hover:bg-slate-50" asChild>
              <Link href={ctaHref}>
                Saisir un relevé <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          )}
        </motion.div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className={cn("p-6 bg-white border-slate-200 shadow-xl", className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <Icon className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">{config.label}</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Évolution 6 mois</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-slate-900">
            {displayValue}
            <span className="text-xs font-bold text-slate-400 ml-1">{config.unit}</span>
          </p>
          {lastUpdate && (
            <p className="text-[10px] text-slate-400">
              Mis à jour {new Date(lastUpdate).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
      </div>

      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`color${type}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={config.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={config.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="month" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} 
              dy={10}
            />
            <YAxis hide />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '16px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                padding: '12px'
              }}
              formatter={(value: number) => [`${value} ${config.unit}`, config.label]}
            />
            <Area 
              type="monotone" 
              dataKey={config.dataKey} 
              stroke={config.color} 
              strokeWidth={3}
              fillOpacity={1} 
              fill={`url(#color${type})`} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
