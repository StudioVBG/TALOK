"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { fadeUp, stagger, floatVariants, ctaPulse } from "@/lib/marketing/animations";
import { track } from "@/lib/analytics/posthog";

// ============================================
// STATIC DATA — no useEffect, no fetch
// ============================================

const KPIS = [
  { label: "Revenus du mois", value: "4 850 €" },
  { label: "Biens gérés", value: "6" },
  { label: "Baux actifs", value: "5" },
];

const LEASES = [
  { name: "Apt T3 · Fort-de-France", tenant: "J. Dupont", amount: "1 250 €", status: "Actif", color: "bg-emerald-500" },
  { name: "Studio · Le Lamentin", tenant: "M. Laurent", amount: "650 €", status: "Signé", color: "bg-blue-500" },
  { name: "Maison T4 · Schœlcher", tenant: "P. Bernard", amount: "1 450 €", status: "Actif", color: "bg-emerald-500" },
  { name: "T2 · Ducos", tenant: "A. Celmar", amount: "750 €", status: "En attente", color: "bg-orange-500" },
];

// SVG line chart points (12 months, ascending trend)
const CHART_POINTS = "0,60 40,55 80,50 120,45 160,48 200,40 240,35 280,30 320,25 360,22 400,18 440,10";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-background pb-16 pt-8 md:pb-24 md:pt-12">
      <div className="container relative z-10 mx-auto max-w-6xl px-4">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Copy — staggered reveal */}
          <motion.div variants={stagger} initial="hidden" animate="visible">
            <motion.h1
              variants={fadeUp}
              className="font-display text-5xl font-extrabold tracking-tight text-foreground md:text-5xl lg:text-[56px] leading-[1.1]"
            >
              TALOK — <span className="text-[#2563EB]">LE</span> Logiciel
              <br />
              de Gestion Locative
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-lg text-base font-normal leading-relaxed text-muted-foreground"
            >
              Gérez vos locations, encaissez vos loyers et dormez
              tranquille. Tout ce qu&apos;une agence fait à 8 % — vous le
              faites seul, pour moins de 35 €/mois.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <motion.div variants={ctaPulse} animate="animate">
                <Button size="lg" className="bg-[#2563EB] text-white hover:bg-[#1D4ED8]" asChild>
                  <Link href="/signup/role" onClick={() => track("cta_hero_signup_clicked", { source: "hero" })}>
                    Commencer gratuitement
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
              <Button size="lg" variant="outline" asChild>
                <a href="#comment-ca-marche" onClick={() => track("cta_hero_demo_clicked", { source: "hero" })}>Comment ça marche ?</a>
              </Button>
            </motion.div>

            {/* Reassurance lines */}
            <motion.div variants={fadeUp} className="mt-8 space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <span className="text-talok-vert font-bold">✓</span>
                Gratuit pour commencer, sans carte bancaire
              </p>
              <p className="flex items-center gap-2">
                <span className="text-talok-vert font-bold">✓</span>
                Contrats toujours à jour avec la loi
              </p>
              <p className="flex items-center gap-2">
                <span className="text-talok-vert font-bold">✓</span>
                Application mobile iPhone et Android incluse
              </p>
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
                {KPIS.map((kpi) => (
                  <div key={kpi.label} className="rounded-xl bg-secondary p-3">
                    <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                    <p className="mt-1 text-lg font-bold text-foreground">{kpi.value}</p>
                  </div>
                ))}
              </div>

              {/* Line chart (SVG) */}
              <div className="mt-4">
                <svg viewBox="0 0 440 70" className="w-full h-16" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Area fill */}
                  <polygon
                    points={`0,70 ${CHART_POINTS} 440,70`}
                    fill="url(#chartGrad)"
                  />
                  {/* Line */}
                  <polyline
                    points={CHART_POINTS}
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="mt-1 text-[10px] text-muted-foreground">Revenus mensuels</p>
              </div>

              {/* Lease list */}
              <div className="mt-4 divide-y divide-border text-xs">
                {LEASES.map((l) => (
                  <div key={l.name} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="font-medium text-foreground">{l.name}</p>
                      <p className="text-muted-foreground">{l.tenant}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-foreground">{l.amount}</span>
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${l.color}`} />
                        <span className="text-muted-foreground">{l.status}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating badges */}
            <motion.div
              className="absolute -right-4 top-8 rounded-lg bg-card border border-border px-3 py-2 text-xs font-semibold shadow-lg"
              variants={floatVariants(0)}
              animate="animate"
            >
              ✓ Bail signé
            </motion.div>
            <motion.div
              className="absolute -left-4 top-1/3 rounded-lg bg-card border border-border px-3 py-2 text-xs font-semibold shadow-lg"
              variants={floatVariants(1)}
              animate="animate"
            >
              ✓ Relance envoyée
            </motion.div>
            <motion.div
              className="absolute -left-2 bottom-12 rounded-lg bg-card border border-border px-3 py-2 text-xs font-semibold shadow-lg"
              variants={floatVariants(2)}
              animate="animate"
            >
              ✓ 35€ reçu
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
