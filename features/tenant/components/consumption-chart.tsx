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
import { GlassCard } from "@/components/ui/glass-card";
import { Zap, Droplet, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

const mockData = [
  { month: "Jan", elec: 45, water: 12, gas: 30 },
  { month: "Feb", elec: 52, water: 11, gas: 35 },
  { month: "Mar", elec: 48, water: 15, gas: 28 },
  { month: "Apr", elec: 40, water: 14, gas: 20 },
  { month: "May", elec: 35, water: 18, gas: 15 },
  { month: "Jun", elec: 30, water: 22, gas: 10 },
];

interface ConsumptionChartProps {
  type: "electricity" | "water" | "gas";
  className?: string;
}

const CONFIG = {
  electricity: { label: "Électricité", color: "#f59e0b", icon: Zap, dataKey: "elec", unit: "kWh" },
  water: { label: "Eau", color: "#3b82f6", icon: Droplet, dataKey: "water", unit: "m³" },
  gas: { label: "Gaz", color: "#ef4444", icon: Flame, dataKey: "gas", unit: "kWh" },
};

export function ConsumptionChart({ type, className }: ConsumptionChartProps) {
  const config = CONFIG[type];
  const Icon = config.icon;

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
            {mockData[mockData.length - 1][config.dataKey as keyof typeof mockData[0]]}
            <span className="text-xs font-bold text-slate-400 ml-1">{config.unit}</span>
          </p>
        </div>
      </div>

      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mockData}>
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
