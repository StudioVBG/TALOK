"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/helpers/format";
import { cn } from "@/lib/utils";

interface OwnerKpiCardProps {
  label: string;
  value: number;
  diff?: number;
  expected?: number;
  percentage?: number;
  isArrears?: boolean;
  gradient?: string;
  index?: number;
}

export function OwnerKpiCard({
  label,
  value,
  diff,
  expected,
  percentage,
  isArrears = false,
  gradient = "from-blue-50 to-blue-100/50",
  index = 0,
}: OwnerKpiCardProps) {
  return (
    <motion.div
      custom={index}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, type: "spring", stiffness: 100, damping: 15 }}
      whileHover={{ scale: 1.02, y: -2 }}
      className={cn(
        "p-4 rounded-lg border bg-gradient-to-br",
        gradient,
        "cursor-pointer transition-all duration-300"
      )}
    >
      <p className="text-xs font-medium text-slate-600 mb-1">{label}</p>
      <motion.p
        className={cn("text-2xl font-bold", isArrears ? "text-red-600" : "text-slate-900")}
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ delay: index * 0.1 + 0.3, type: "spring", stiffness: 200 }}
      >
        {formatCurrency(value)}
      </motion.p>
      {!isArrears && diff !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          {diff >= 0 ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-600" />
          )}
          <span className={cn("text-xs font-medium", diff >= 0 ? "text-green-600" : "text-red-600")}>
            {diff >= 0 ? "+" : ""}
            {formatCurrency(Math.abs(diff))}
          </span>
          {expected && (
            <span className="text-xs text-slate-500">
              / {formatCurrency(expected)} attendus
            </span>
          )}
        </div>
      )}
      {percentage !== undefined && (
        <p className="text-xs text-slate-500 mt-1">
          {percentage.toFixed(1)}% du montant attendu
        </p>
      )}
      {isArrears && (
        <p className="text-xs text-slate-500 mt-2">Montant total en retard</p>
      )}
    </motion.div>
  );
}

