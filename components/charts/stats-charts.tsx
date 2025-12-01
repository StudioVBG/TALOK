"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from "lucide-react";

// Types
interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface TimeSeriesPoint {
  date: string;
  value: number;
  label?: string;
}

// ============================================
// COMPOSANT: Barre de progression avec animation
// ============================================

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  color?: string;
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  color = "bg-primary",
  showValue = true,
  size = "md",
  animate = true,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);
  
  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  };

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-sm text-muted-foreground">{label}</span>}
          {showValue && (
            <span className="text-sm font-medium">
              {value.toLocaleString("fr-FR")} / {max.toLocaleString("fr-FR")}
            </span>
          )}
        </div>
      )}
      <div className={cn("w-full bg-muted rounded-full overflow-hidden", sizeClasses[size])}>
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            color,
            animate && "animate-in slide-in-from-left"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ============================================
// COMPOSANT: Graphique en barres horizontal
// ============================================

interface HorizontalBarChartProps {
  data: DataPoint[];
  title?: string;
  description?: string;
  valueFormatter?: (value: number) => string;
  className?: string;
}

export function HorizontalBarChart({
  data,
  title,
  description,
  valueFormatter = (v) => v.toLocaleString("fr-FR"),
  className,
}: HorizontalBarChartProps) {
  const maxValue = useMemo(() => Math.max(...data.map((d) => d.value)), [data]);

  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-yellow-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-orange-500",
    "bg-teal-500",
  ];

  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader className="pb-2">
          {title && <CardTitle className="text-base">{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-3">
          {data.map((item, index) => (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground truncate max-w-[60%]">
                  {item.label}
                </span>
                <span className="font-medium">{valueFormatter(item.value)}</span>
              </div>
              <ProgressBar
                value={item.value}
                max={maxValue}
                color={item.color || colors[index % colors.length]}
                showValue={false}
                size="sm"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// COMPOSANT: Mini sparkline (graphique simplifié)
// ============================================

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  showTrend?: boolean;
  className?: string;
}

export function Sparkline({
  data,
  color = "stroke-primary",
  height = 40,
  showTrend = true,
  className,
}: SparklineProps) {
  const { path, trend, trendPercentage } = useMemo(() => {
    if (data.length < 2) return { path: "", trend: "neutral" as const, trendPercentage: 0 };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const width = 100;
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    });

    const path = `M ${points.join(" L ")}`;
    
    const first = data[0];
    const last = data[data.length - 1];
    const trendPercentage = first !== 0 ? ((last - first) / first) * 100 : 0;
    const trend = trendPercentage > 1 ? "up" : trendPercentage < -1 ? "down" : "neutral";

    return { path, trend, trendPercentage };
  }, [data, height]);

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg width="100" height={height} className="overflow-visible">
        <path
          d={path}
          fill="none"
          className={cn("transition-all duration-300", color)}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showTrend && (
        <div className={cn("flex items-center gap-1 text-sm", trendColor)}>
          <TrendIcon className="h-4 w-4" />
          <span>{Math.abs(trendPercentage).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

// ============================================
// COMPOSANT: Carte de statistique améliorée
// ============================================

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label?: string;
  };
  sparklineData?: number[];
  className?: string;
  valueClassName?: string;
}

export function StatCard({
  title,
  value,
  description,
  icon,
  trend,
  sparklineData,
  className,
  valueClassName,
}: StatCardProps) {
  const isPositiveTrend = trend && trend.value >= 0;

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={cn("text-2xl font-bold", valueClassName)}>
              {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {icon && (
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              {icon}
            </div>
          )}
        </div>
        
        {(trend || sparklineData) && (
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            {trend && (
              <div className={cn(
                "flex items-center gap-1 text-sm",
                isPositiveTrend ? "text-green-600" : "text-red-600"
              )}>
                {isPositiveTrend ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
                <span className="font-medium">{Math.abs(trend.value)}%</span>
                {trend.label && (
                  <span className="text-muted-foreground">{trend.label}</span>
                )}
              </div>
            )}
            {sparklineData && sparklineData.length > 1 && (
              <Sparkline data={sparklineData} showTrend={!trend} height={30} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// COMPOSANT: Graphique en anneau (donut)
// ============================================

interface DonutChartProps {
  data: DataPoint[];
  title?: string;
  description?: string;
  size?: number;
  thickness?: number;
  showLegend?: boolean;
  showTotal?: boolean;
  totalLabel?: string;
  valueFormatter?: (value: number) => string;
  className?: string;
}

export function DonutChart({
  data,
  title,
  description,
  size = 160,
  thickness = 20,
  showLegend = true,
  showTotal = true,
  totalLabel = "Total",
  valueFormatter = (v) => v.toLocaleString("fr-FR"),
  className,
}: DonutChartProps) {
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);
  
  const segments = useMemo(() => {
    const radius = (size - thickness) / 2;
    const circumference = 2 * Math.PI * radius;
    let currentAngle = -90; // Commencer en haut

    const defaultColors = [
      "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
      "#ec4899", "#06b6d4", "#f97316",
    ];

    return data.map((item, index) => {
      const percentage = (item.value / total) * 100;
      const angle = (percentage / 100) * 360;
      const dashArray = (percentage / 100) * circumference;
      
      const segment = {
        ...item,
        color: item.color || defaultColors[index % defaultColors.length],
        percentage,
        dashArray,
        dashOffset: circumference - dashArray,
        rotation: currentAngle,
      };

      currentAngle += angle;
      return segment;
    });
  }, [data, total, size, thickness]);

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader className="pb-2">
          {title && <CardTitle className="text-base">{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Graphique */}
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
              {segments.map((segment, index) => (
                <circle
                  key={index}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${segment.dashArray} ${circumference}`}
                  strokeDashoffset={0}
                  style={{
                    transform: `rotate(${segment.rotation + 90}deg)`,
                    transformOrigin: "50% 50%",
                    transition: "stroke-dasharray 0.5s ease-out",
                  }}
                />
              ))}
            </svg>
            {showTotal && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{valueFormatter(total)}</span>
                <span className="text-xs text-muted-foreground">{totalLabel}</span>
              </div>
            )}
          </div>

          {/* Légende */}
          {showLegend && (
            <div className="flex-1 space-y-2">
              {segments.map((segment, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="text-sm text-muted-foreground truncate flex-1">
                    {segment.label}
                  </span>
                  <span className="text-sm font-medium">
                    {segment.percentage.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// COMPOSANT: Grille de métriques
// ============================================

interface MetricGridProps {
  metrics: Array<{
    label: string;
    value: string | number;
    change?: number;
    icon?: React.ReactNode;
  }>;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function MetricGrid({ metrics, columns = 4, className }: MetricGridProps) {
  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {metrics.map((metric, index) => (
        <div
          key={index}
          className="bg-card rounded-lg border p-4 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{metric.label}</span>
            {metric.icon}
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold">
              {typeof metric.value === "number"
                ? metric.value.toLocaleString("fr-FR")
                : metric.value}
            </span>
            {metric.change !== undefined && (
              <span
                className={cn(
                  "text-sm flex items-center",
                  metric.change >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {metric.change >= 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {Math.abs(metric.change)}%
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default {
  ProgressBar,
  HorizontalBarChart,
  Sparkline,
  StatCard,
  DonutChart,
  MetricGrid,
};

