"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DataSeries {
  key: string;
  name: string;
  color: string;
  gradientId?: string;
}

interface AreaChartCardProps {
  data: Record<string, any>[];
  series: DataSeries[];
  xAxisKey: string;
  title?: string;
  description?: string;
  height?: number;
  className?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  valueFormatter?: (value: number) => string;
  stacked?: boolean;
}

export function AreaChartCard({
  data,
  series,
  xAxisKey,
  title,
  description,
  height = 300,
  className,
  showGrid = true,
  showLegend = true,
  valueFormatter = (v) => v.toLocaleString("fr-FR"),
  stacked = false,
}: AreaChartCardProps) {
  const uniqueId = React.useId();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover/95 backdrop-blur-sm border rounded-lg shadow-xl p-4 animate-in fade-in-0 zoom-in-95">
          <p className="font-semibold text-sm mb-2">{label}</p>
          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-muted-foreground">{entry.name}</span>
                </div>
                <span className="font-medium text-sm">{valueFormatter(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={cn("overflow-hidden border-0 bg-card/50 backdrop-blur-sm", className)}>
      {(title || description) && (
        <CardHeader className="pb-2">
          {title && <CardTitle className="text-lg font-semibold">{title}</CardTitle>}
          {description && (
            <CardDescription className="text-sm">{description}</CardDescription>
          )}
        </CardHeader>
      )}
      <CardContent className={title ? "pt-0" : "pt-6"}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{ height, minHeight: height }}
        >
          <ResponsiveContainer width="100%" height={height} minHeight={height}>

            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                {series.map((s, index) => (
                  <linearGradient
                    key={s.key}
                    id={`gradient-${uniqueId}-${index}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              {showGrid && (
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-border/50"
                  vertical={false}
                />
              )}
              <XAxis
                dataKey={xAxisKey}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                  return value.toString();
                }}
                dx={-10}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              {showLegend && (
                <Legend
                  verticalAlign="top"
                  height={36}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingBottom: "10px" }}
                  formatter={(value) => (
                    <span className="text-sm text-muted-foreground">{value}</span>
                  )}
                />
              )}
              {series.map((s, index) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2.5}
                  fill={`url(#gradient-${uniqueId}-${index})`}
                  stackId={stacked ? "stack" : undefined}
                  animationDuration={1500}
                  animationBegin={index * 200}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </CardContent>
    </Card>
  );
}

