"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { TrendingUp, ShieldCheck, Info, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface CreditBuilderCardProps {
  score: number;
  className?: string;
}

export function CreditBuilderCard({ score, className }: CreditBuilderCardProps) {
  // Score de 300 à 850 (standard FICO)
  const percentage = ((score - 300) / (850 - 300)) * 100;

  return (
    <GlassCard className={className}>
      <div className="relative z-10 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-inner">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Credit Builder</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Confiance Locative</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black text-slate-900 tracking-tighter">{score}</p>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Excellent</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
            <span>300</span>
            <div className="flex items-center gap-1 text-emerald-600">
              <Sparkles className="h-3 w-3" />
              <span>+12 pts ce mois</span>
            </div>
            <span>850</span>
          </div>
          <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-amber-400 via-emerald-500 to-emerald-600"
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 leading-relaxed">
            Vos 6 derniers loyers payés à l'échéance ont boosté votre score. Ce certificat est exportable pour vos futurs projets.
          </p>
        </div>

        <Button className="w-full h-12 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-xl shadow-slate-200 group">
          Exporter mon Passeport Confiance
          <motion.span
            className="ml-2"
            animate={{ x: [0, 5, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            →
          </motion.span>
        </Button>
      </div>
      
      {/* Glow effect */}
      <div className="absolute -top-24 -right-24 h-48 w-48 bg-emerald-500/10 rounded-full blur-3xl" />
    </GlassCard>
  );
}

