"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingUp, MapPin } from "lucide-react";
import { fadeUp, stagger, floatVariants, ctaPulse } from "@/lib/marketing/animations";

const CHART_HEIGHTS = [40, 55, 45, 65, 50, 70, 60, 75, 55, 80, 65, 85];

const TENANTS = [
  { name: "Jean Dupont", type: "T3", city: "Fort-de-France", amount: "1 250 €", status: "Payé", statusEmoji: "✅", statusColor: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400" },
  { name: "Marie Laurent", type: "T2", city: "Le Lamentin", amount: "890 €", status: "En cours", statusEmoji: "🟡", statusColor: "text-yellow-600 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-400" },
  { name: "Pierre Bernard", type: "T4", city: "Schoelcher", amount: "1 450 €", status: "En retard", statusEmoji: "🔴", statusColor: "text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400" },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pb-16 pt-8 md:pb-24 md:pt-12">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/50 to-background" />
      <div className="absolute right-0 top-0 h-[600px] w-[600px] -translate-y-1/3 translate-x-1/3 rounded-full bg-talok-cyan/5 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-[400px] w-[400px] translate-y-1/3 -translate-x-1/3 rounded-full bg-talok-bleu-marque/5 blur-3xl" />

      <div className="container relative z-10 mx-auto max-w-6xl px-4">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Copy — staggered reveal */}
          <motion.div variants={stagger} initial="hidden" animate="visible">
            <motion.div variants={fadeUp}>
              <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Né en Martinique
              </Badge>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="mt-6 font-display text-5xl font-extrabold tracking-tight text-foreground md:text-5xl lg:text-6xl"
            >
              Gérez vos locations sans prise de tête
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-lg text-base font-normal leading-relaxed text-muted-foreground"
            >
              Baux, loyers, quittances, relances, documents — tout est regroupé
              dans un seul outil. Vous gardez le contrôle, sans y passer vos
              soirées.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <motion.div variants={ctaPulse} animate="animate">
                <Button size="lg" className="bg-[#2563EB] text-white hover:bg-[#1D4ED8]" asChild>
                  <Link href="/inscription">
                    Commencer gratuitement
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
              <Button size="lg" variant="outline" asChild>
                <a href="#comment-ca-marche">Comment ça marche ?</a>
              </Button>
            </motion.div>

            {/* Reassurance pills */}
            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 shadow-sm border border-border">
                ✓ Gratuit jusqu&apos;à 2 biens
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 shadow-sm border border-border">
                ✓ Sans engagement
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 shadow-sm border border-border">
                ✓ Conforme droit français
              </span>
            </motion.div>
          </motion.div>

          {/* Right: Dashboard Mockup */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <div className="rounded-2xl border border-border bg-card/80 p-5 shadow-xl backdrop-blur-sm">
              {/* KPI row */}
              <div className="grid grid-cols-3 gap-3">
                <KpiCard label="Loyers encaissés" value="12 450 €" delta="+8,2%" />
                <KpiCard label="Taux occupation" value="94%" delta="+2,1%" />
                <KpiCard label="Rendement net" value="6,8%" delta="+0,4%" />
              </div>

              {/* Mini chart */}
              <div className="mt-4 flex items-end gap-1.5" style={{ height: 80 }}>
                {CHART_HEIGHTS.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-talok-bleu-marque/70"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">Encaissements mensuels</p>

              {/* Tenant list */}
              <div className="mt-4 divide-y divide-border text-xs">
                {TENANTS.map((t) => (
                  <div key={t.name} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-talok-bleu-marque/20 to-talok-cyan/20" />
                      <div>
                        <p className="font-medium text-foreground">{t.name}</p>
                        <p className="text-muted-foreground">
                          {t.type} · {t.city}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-foreground">{t.amount}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${t.statusColor}`}>
                        {t.status} {t.statusEmoji}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating badges */}
            <motion.div
              className="absolute -left-4 top-8 rounded-lg bg-card border border-border px-3 py-2 text-xs font-semibold shadow-lg"
              variants={floatVariants(0)}
              animate="animate"
            >
              ✓ Bail signé
            </motion.div>
            <motion.div
              className="absolute -right-4 top-1/3 rounded-lg bg-card border border-border px-3 py-2 text-xs font-semibold shadow-lg"
              variants={floatVariants(1)}
              animate="animate"
            >
              ✓ 35€ reçu
            </motion.div>
            <motion.div
              className="absolute -left-2 bottom-12 rounded-lg bg-card border border-border px-3 py-2 text-xs font-semibold shadow-lg"
              variants={floatVariants(2)}
              animate="animate"
            >
              ✓ Relance envoyée
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function KpiCard({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="rounded-xl bg-secondary p-3">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
      <span className="flex items-center gap-0.5 text-[10px] font-medium text-talok-vert">
        <TrendingUp className="h-3 w-3" />
        {delta}
      </span>
    </div>
  );
}
