"use client";

import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DonutChartData {
  name: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: DonutChartData[];
  title?: string;
  centerLabel?: string;
  centerValue?: string | number;
  className?: string;
  height?: number;
  showLegend?: boolean;
}

const COLORS = [
  "hsl(217, 91%, 60%)", // primary blue
  "hsl(142, 71%, 45%)", // success green
  "hsl(38, 92%, 50%)",  // warning amber
  "hsl(0, 84%, 60%)",   // destructive red
  "hsl(199, 89%, 48%)", // info cyan
  "hsl(262, 83%, 58%)", // violet
  "hsl(326, 78%, 60%)", // pink
  "hsl(173, 80%, 40%)", // teal
];

export function DonutChart({
  data,
  title,
  centerLabel,
  centerValue,
  className,
  height = 280,
  showLegend = true,
}: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
      return (
        <div className="bg-popover/95 backdrop-blur-sm border rounded-lg shadow-xl p-3 animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color || COLORS[data.indexOf(item) % COLORS.length] }}
            />
            <p className="font-semibold text-sm">{item.name}</p>
          </div>
          <p className="text-muted-foreground text-sm">
            {item.value.toLocaleString("fr-FR")} ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={cn("overflow-hidden border-0 bg-card/50 backdrop-blur-sm", className)}>
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={title ? "pt-0" : "pt-6"}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative"
          style={{ height, minHeight: height }}
        >
          <ResponsiveContainer width="100%" height={height} minHeight={height}>

            <PieChart>
              <Pie
                data={data as any}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={3}
                dataKey="value"
                animationBegin={0}
                animationDuration={1200}
                animationEasing="ease-out"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || COLORS[index % COLORS.length]}
                    className="hover:opacity-80 transition-opacity cursor-pointer drop-shadow-sm"
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Center label */}
          {(centerLabel || centerValue) && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              {centerValue !== undefined && (
                <span className="text-3xl font-bold">
                  {typeof centerValue === "number"
                    ? centerValue.toLocaleString("fr-FR")
                    : centerValue}
                </span>
              )}
              {centerLabel && (
                <span className="text-sm text-muted-foreground">{centerLabel}</span>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Legend */}
        {showLegend && (
          <motion.div
            className="mt-4 grid grid-cols-2 gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            {data.map((item, index) => {
              const percentage = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
              return (
                <div
                  key={item.name}
                  className="flex items-center gap-2 text-sm group cursor-default"
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0 transition-transform group-hover:scale-125"
                    style={{
                      backgroundColor: item.color || COLORS[index % COLORS.length],
                    }}
                  />
                  <span className="text-muted-foreground truncate">
                    {item.name}
                  </span>
                  <span className="font-medium ml-auto">{percentage}%</span>
                </div>
              );
            })}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

