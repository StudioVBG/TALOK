"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { kpiStyles, type KpiVariant } from "@/lib/design-system/tokens";
import { DynamicIcon, type IconName } from "@/lib/icons";

interface KpiCardProps {
  title: string;
  value: string | number;
  iconName: IconName;
  variant?: KpiVariant;
  subtitle?: string;
  trend?: {
    value: number;
    label?: string;
  };
  href?: string;
  className?: string;
}

export function KpiCard({
  title,
  value,
  iconName,
  variant = "blue",
  subtitle,
  trend,
  href,
  className,
}: KpiCardProps) {
  const styles = kpiStyles[variant];

  const content = (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-200",
        href && "hover:shadow-md hover:border-primary/20 cursor-pointer",
        className
      )}
    >
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/[0.02] dark:to-primary/[0.05]" />

      <CardContent className="relative pt-6">
        <div className="flex items-start justify-between gap-4">
          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-medium text-muted-foreground truncate">
              {title}
            </p>
            <p className="text-2xl font-bold tracking-tight truncate">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">
                {subtitle}
              </p>
            )}
            {trend && (
              <div className="flex items-center gap-1 pt-1">
                <span
                  className={cn(
                    "text-xs font-medium",
                    trend.value >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {trend.value >= 0 ? "+" : ""}
                  {trend.value}%
                </span>
                {trend.label && (
                  <span className="text-xs text-muted-foreground">
                    {trend.label}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Icon */}
          <div
            className={cn(
              "shrink-0 p-3 rounded-xl transition-transform duration-200",
              styles.icon,
              href && "group-hover:scale-110"
            )}
          >
            <DynamicIcon name={iconName} className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
