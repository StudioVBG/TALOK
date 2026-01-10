/**
 * StatsCardEnhanced - Composant spécialisé avec sparkline
 *
 * Ce composant est une extension du KpiCard unifié (@/components/ui/kpi-card)
 * avec support pour les graphiques sparkline via recharts.
 *
 * Utiliser ce composant uniquement quand les sparklines sont nécessaires.
 * Pour les cas simples, utiliser KpiCard depuis @/components/ui/kpi-card.
 *
 * @see @/components/ui/kpi-card pour le composant KPI unifié standard
 */

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, LucideIcon } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";

interface Trend {
  value: number;
  direction: "up" | "down" | "neutral";
}

interface StatsCardEnhancedProps {
  title: string;
  value: number | string;
  trend?: Trend;
  sparklineData?: number[];
  icon: LucideIcon;
  color?: "primary" | "success" | "warning" | "destructive" | "info";
  description?: string;
  delay?: number;
}

const colorConfig = {
  primary: {
    bg: "bg-blue-500/10",
    text: "text-blue-600",
    fill: "#3b82f6",
    gradient: "from-blue-500/20 to-blue-500/0",
  },
  success: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600",
    fill: "#10b981",
    gradient: "from-emerald-500/20 to-emerald-500/0",
  },
  warning: {
    bg: "bg-amber-500/10",
    text: "text-amber-600",
    fill: "#f59e0b",
    gradient: "from-amber-500/20 to-amber-500/0",
  },
  destructive: {
    bg: "bg-red-500/10",
    text: "text-red-600",
    fill: "#ef4444",
    gradient: "from-red-500/20 to-red-500/0",
  },
  info: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-600",
    fill: "#06b6d4",
    gradient: "from-cyan-500/20 to-cyan-500/0",
  },
};

export function StatsCardEnhanced({
  title,
  value,
  trend,
  sparklineData,
  icon: Icon,
  color = "primary",
  description,
  delay = 0,
}: StatsCardEnhancedProps) {
  const colors = colorConfig[color];
  const chartData = sparklineData?.map((v, i) => ({ value: v, index: i }));
  const uniqueId = React.useId();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay * 0.1 }}
    >
      <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-0 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <p className="text-sm font-medium text-muted-foreground">
                {title}
              </p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <motion.span
                  className="text-3xl font-bold tracking-tight"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    delay: delay * 0.1 + 0.2,
                  }}
                >
                  {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
                </motion.span>
                {trend && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: delay * 0.1 + 0.4 }}
                    className={cn(
                      "flex items-center text-sm font-medium px-2 py-0.5 rounded-full",
                      trend.direction === "up" && "text-emerald-600 bg-emerald-100",
                      trend.direction === "down" && "text-red-600 bg-red-100",
                      trend.direction === "neutral" && "text-muted-foreground bg-muted"
                    )}
                  >
                    {trend.direction === "up" && (
                      <TrendingUp className="h-3.5 w-3.5 mr-1" />
                    )}
                    {trend.direction === "down" && (
                      <TrendingDown className="h-3.5 w-3.5 mr-1" />
                    )}
                    {trend.direction === "neutral" && (
                      <Minus className="h-3.5 w-3.5 mr-1" />
                    )}
                    {trend.value > 0 ? "+" : ""}
                    {trend.value}%
                  </motion.span>
                )}
              </div>
              {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
              )}
            </div>
            <motion.div
              className={cn(
                "p-3 rounded-xl transition-transform duration-300 group-hover:scale-110",
                colors.bg
              )}
              whileHover={{ rotate: 5 }}
            >
              <Icon className={cn("h-6 w-6", colors.text)} />
            </motion.div>
          </div>

          {/* Sparkline */}
          {chartData && chartData.length > 0 && (
            <motion.div
              className="mt-4 -mx-2"
              style={{ width: '100%', height: 48, minHeight: 48 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: delay * 0.1 + 0.5 }}
            >
              <ResponsiveContainer width="100%" height={48} minHeight={48}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient
                      id={`gradient-${uniqueId}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={colors.fill} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={colors.fill} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={colors.fill}
                    strokeWidth={2}
                    fill={`url(#gradient-${uniqueId})`}
                    animationDuration={1500}
                    animationBegin={delay * 100 + 300}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

