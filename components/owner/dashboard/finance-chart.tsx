"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/helpers/format";

interface FinanceData {
  period: string;
  expected: number;
  collected: number;
}

interface FinanceChartProps {
  chartData: FinanceData[];
}

function FinanceChart({ chartData }: FinanceChartProps) {
  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Aucune donnée disponible</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={256} minHeight={256}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
        <XAxis
          dataKey="period"
          className="text-xs"
          tick={{ fill: "#64748b" }}
        />
        <YAxis
          className="text-xs"
          tick={{ fill: "#64748b" }}
          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          }}
          formatter={(value: number) => formatCurrency(value)}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="expected"
          stroke="#3b82f6"
          strokeWidth={2}
          name="Attendus"
          dot={{ r: 4 }}
          animationDuration={1000}
        />
        <Line
          type="monotone"
          dataKey="collected"
          stroke="#10b981"
          strokeWidth={3}
          name="Encaissés"
          dot={{ r: 4 }}
          animationDuration={1000}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default FinanceChart;

