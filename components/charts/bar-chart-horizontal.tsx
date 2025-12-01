"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BarData {
  name: string;
  value: number;
  color?: string;
}

interface BarChartHorizontalProps {
  data: BarData[];
  title?: string;
  description?: string;
  height?: number;
  className?: string;
  valueFormatter?: (value: number) => string;
  showValues?: boolean;
}

const COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(199, 89%, 48%)",
];

export function BarChartHorizontal({
  data,
  title,
  description,
  height = 250,
  className,
  valueFormatter = (v) => v.toLocaleString("fr-FR"),
  showValues = true,
}: BarChartHorizontalProps) {
  const maxValue = Math.max(...data.map((d) => d.value));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-popover/95 backdrop-blur-sm border rounded-lg shadow-xl p-3 animate-in fade-in-0 zoom-in-95">
          <p className="font-semibold text-sm">{item.name}</p>
          <p className="text-muted-foreground text-sm">{valueFormatter(item.value)}</p>
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

            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: showValues ? 60 : 10, left: 0, bottom: 5 }}
            >
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                domain={[0, maxValue * 1.1]}
              />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                width={100}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted)/0.3)" }} />
              <Bar
                dataKey="value"
                radius={[0, 6, 6, 0]}
                animationDuration={1200}
                animationBegin={200}
                label={
                  showValues
                    ? {
                        position: "right",
                        fill: "hsl(var(--muted-foreground))",
                        fontSize: 12,
                        fontWeight: 500,
                        formatter: valueFormatter,
                      }
                    : false
                }
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || COLORS[index % COLORS.length]}
                    className="hover:opacity-80 transition-opacity"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </CardContent>
    </Card>
  );
}

