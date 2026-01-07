"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DynamicIcon, type IconName } from "@/lib/icons";

/**
 * KpiCard unifié - SOTA 2026
 *
 * Combine les fonctionnalités de:
 * - components/dashboard/KpiCard.tsx
 * - components/owner/cards/OwnerKpiCard.tsx
 * - components/admin/stats-card-enhanced.tsx
 */

export type KpiVariant =
  | "default"
  | "blue"
  | "green"
  | "orange"
  | "red"
  | "purple"
  | "gradient";

interface KpiCardProps {
  // Contenu principal
  title: string;
  value: string | number;

  // Icône
  icon?: IconName;

  // Style
  variant?: KpiVariant;
  gradient?: string;
  className?: string;

  // Informations supplémentaires
  subtitle?: string;
  description?: string;

  // Tendance / Évolution
  trend?: {
    value: number;
    label?: string;
    direction?: "up" | "down";
  };

  // Comparaison avec attendu
  diff?: number;
  expected?: number;
  percentage?: number;

  // Indicateurs spéciaux
  isArrears?: boolean;
  isLoading?: boolean;

  // Navigation
  href?: string;

  // Animation
  animationIndex?: number;
  disableAnimation?: boolean;

  // Format
  formatAsCurrency?: boolean;
}

const VARIANT_STYLES: Record<
  KpiVariant,
  { icon: string; gradient: string }
> = {
  default: {
    icon: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    gradient: "from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30",
  },
  blue: {
    icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400",
    gradient: "from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10",
  },
  green: {
    icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400",
    gradient: "from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-800/10",
  },
  orange: {
    icon: "bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400",
    gradient: "from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10",
  },
  red: {
    icon: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400",
    gradient: "from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10",
  },
  purple: {
    icon: "bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400",
    gradient: "from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10",
  },
  gradient: {
    icon: "bg-gradient-to-br from-primary to-primary/60 text-primary-foreground",
    gradient: "from-primary/5 to-primary/10",
  },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function KpiCard({
  title,
  value,
  icon,
  variant = "default",
  gradient,
  className,
  subtitle,
  description,
  trend,
  diff,
  expected,
  percentage,
  isArrears = false,
  isLoading = false,
  href,
  animationIndex = 0,
  disableAnimation = false,
  formatAsCurrency = false,
}: KpiCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = !disableAnimation && !prefersReducedMotion;

  const styles = VARIANT_STYLES[variant];
  const customGradient = gradient || styles.gradient;

  // Formater la valeur
  const displayValue =
    formatAsCurrency && typeof value === "number"
      ? formatCurrency(value)
      : value;

  // Déterminer la direction de la tendance
  const trendDirection = trend?.direction ?? (trend?.value && trend.value >= 0 ? "up" : "down");
  const trendIsPositive = trendDirection === "up";

  const content = (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-200",
        href && "hover:shadow-md hover:border-primary/20 cursor-pointer",
        isArrears && "border-red-200 dark:border-red-900",
        className
      )}
    >
      {/* Background gradient */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-50",
          customGradient
        )}
      />

      <CardContent className="relative pt-6">
        <div className="flex items-start justify-between gap-4">
          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-medium text-muted-foreground truncate">
              {title}
            </p>

            {isLoading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            ) : (
              <p
                className={cn(
                  "text-2xl font-bold tracking-tight truncate",
                  isArrears ? "text-red-600 dark:text-red-400" : "text-foreground"
                )}
              >
                {displayValue}
              </p>
            )}

            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">
                {subtitle}
              </p>
            )}

            {description && (
              <p className="text-xs text-muted-foreground truncate">
                {description}
              </p>
            )}

            {/* Trend */}
            {trend && (
              <div className="flex items-center gap-1 pt-1">
                {trendIsPositive ? (
                  <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                )}
                <span
                  className={cn(
                    "text-xs font-medium",
                    trendIsPositive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {trendIsPositive ? "+" : ""}
                  {trend.value}%
                </span>
                {trend.label && (
                  <span className="text-xs text-muted-foreground">
                    {trend.label}
                  </span>
                )}
              </div>
            )}

            {/* Diff avec attendu */}
            {!isArrears && diff !== undefined && (
              <div className="flex items-center gap-1 pt-1">
                {diff >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span
                  className={cn(
                    "text-xs font-medium",
                    diff >= 0 ? "text-emerald-600" : "text-red-600"
                  )}
                >
                  {diff >= 0 ? "+" : ""}
                  {formatCurrency(Math.abs(diff))}
                </span>
                {expected && (
                  <span className="text-xs text-muted-foreground">
                    / {formatCurrency(expected)} attendus
                  </span>
                )}
              </div>
            )}

            {/* Percentage */}
            {percentage !== undefined && (
              <p className="text-xs text-muted-foreground pt-1">
                {percentage.toFixed(1)}% du montant attendu
              </p>
            )}

            {/* Message arrears */}
            {isArrears && (
              <p className="text-xs text-muted-foreground pt-1">
                Montant total en retard
              </p>
            )}
          </div>

          {/* Icon */}
          {icon && (
            <div
              className={cn(
                "shrink-0 p-3 rounded-xl transition-transform duration-200",
                styles.icon,
                href && "group-hover:scale-110"
              )}
            >
              <DynamicIcon name={icon} className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // Wrapper avec animation
  const animatedContent = shouldAnimate ? (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: animationIndex * 0.1,
        type: "spring",
        stiffness: 100,
        damping: 15,
      }}
      whileHover={href ? { scale: 1.02, y: -2 } : undefined}
    >
      {content}
    </motion.div>
  ) : (
    content
  );

  // Wrapper avec lien si href
  if (href) {
    return (
      <Link href={href} className="block">
        {animatedContent}
      </Link>
    );
  }

  return animatedContent;
}

/**
 * Grille de KPI cards
 */
interface KpiGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function KpiGrid({ children, columns = 4, className }: KpiGridProps) {
  const gridCols = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {children}
    </div>
  );
}

export default KpiCard;
