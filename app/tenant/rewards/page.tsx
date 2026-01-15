"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Star, ArrowUpRight, History, Sparkles, ShoppingBag, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/ui/page-transition";
import { rewardsService, RewardTransaction } from "@/lib/services/rewards.service";
import { formatDateShort } from "@/lib/helpers/format";

export default function TenantRewardsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ total_points: number; history: RewardTransaction[] } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await rewardsService.getTenantRewardsSummary();
        setData(res);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-indigo-600" /></div>;
  }

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        
        {/* Header SOTA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-600 rounded-lg shadow-lg shadow-purple-200">
                <Gift className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Mes Récompenses</h1>
            </div>
            <p className="text-slate-500 text-lg">
              Transformez votre ponctualité et vos éco-gestes en avantages.
            </p>
          </motion.div>
        </div>

        {/* Hero Points */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-2xl md:rounded-[2.5rem] p-6 md:p-12 text-white relative overflow-hidden shadow-2xl"
        >
          <div className="relative z-10 grid md:grid-cols-2 gap-6 md:gap-12 items-center">
            <div className="space-y-4 md:space-y-6">
              <p className="text-xs font-black uppercase tracking-[0.3em] opacity-80">Solde Actuel</p>
              <h2 className="text-4xl md:text-7xl font-black tracking-tighter">
                {data?.total_points.toLocaleString()} <span className="text-lg md:text-2xl font-bold opacity-60">Points</span>
              </h2>
              <p className="text-indigo-100 max-w-sm leading-relaxed">
                Vous avez gagné 120 points ce mois-ci. Vous êtes à 250 points de votre prochain bon d'achat IKEA.
              </p>
              <Button size="lg" className="bg-white text-indigo-600 hover:bg-slate-50 font-black rounded-2xl h-12 md:h-14 px-6 md:px-10 shadow-xl w-full sm:w-auto">
                Découvrir la boutique <ShoppingBag className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <div className="hidden md:flex justify-center">
              <div className="relative">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                  className="absolute -inset-8 border-2 border-dashed border-white/20 rounded-full"
                />
                <div className="h-48 w-48 bg-white/10 backdrop-blur-2xl rounded-full flex items-center justify-center border border-white/20 shadow-inner">
                  <Star className="h-24 w-24 text-white fill-white" />
                </div>
              </div>
            </div>
          </div>
          <Sparkles className="absolute top-10 right-10 h-24 w-24 text-white/10 rotate-12" />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
          
          {/* Historique - 7/12 */}
          <div className="lg:col-span-7 space-y-6">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 px-2">
              <History className="h-5 w-5 text-indigo-600" /> Historique des points
            </h3>
            <GlassCard className="p-0 overflow-hidden border-slate-200 bg-white shadow-xl">
              <div className="divide-y divide-slate-100">
                {data?.history.map((tx) => (
                  <div key={tx.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Star className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{tx.description}</p>
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">{formatDateShort(tx.created_at)}</p>
                      </div>
                    </div>
                    <span className="font-black text-emerald-600">+{tx.points}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          {/* Comment gagner - 5/12 */}
          <div className="lg:col-span-5 space-y-6">
            <h3 className="text-xl font-bold text-slate-800 px-2">Comment gagner des points ?</h3>
            <div className="space-y-4">
              {[
                { label: "Loyer payé à l'échéance", pts: 100, color: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "Réduction consommation d'eau", pts: 50, color: "text-blue-600", bg: "bg-blue-50" },
                { label: "Profil 100% complété", pts: 200, color: "text-purple-600", bg: "bg-purple-50" },
                { label: "Signature EDL d'entrée", pts: 150, color: "text-amber-600", bg: "bg-amber-50" },
              ].map((item, i) => (
                <GlassCard key={i} className="p-4 border-slate-100 flex items-center justify-between">
                  <span className="font-bold text-slate-700">{item.label}</span>
                  <Badge className={`${item.bg} ${item.color} border-none font-black`}>+{item.pts} pts</Badge>
                </GlassCard>
              ))}
            </div>
          </div>

        </div>
      </div>
    </PageTransition>
  );
}

