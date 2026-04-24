"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Calculator,
  TrendingDown,
  Euro,
  Home,
  Sparkles,
  ArrowRight,
  Info,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const AGENCY_COMMISSION_RATE = 0.08;
const MONTHS_PER_YEAR = 12;

type PlanSuggestion = {
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  reason: string;
};

function suggestPlan(nbBiens: number): PlanSuggestion {
  if (nbBiens <= 1) {
    return {
      name: "Gratuit",
      monthlyPrice: 0,
      annualPrice: 0,
      reason: "1 bien inclus gratuitement, sans carte bancaire",
    };
  }
  if (nbBiens <= 3) {
    return {
      name: "Starter",
      monthlyPrice: 9,
      annualPrice: 90,
      reason: "Jusqu'à 3 biens — idéal petits portefeuilles",
    };
  }
  if (nbBiens <= 10) {
    return {
      name: "Confort",
      monthlyPrice: 35,
      annualPrice: 336,
      reason: "Jusqu'à 10 biens — le plus choisi",
    };
  }
  if (nbBiens <= 50) {
    return {
      name: "Pro",
      monthlyPrice: 69,
      annualPrice: 662,
      reason: "Jusqu'à 50 biens — équipe jusqu'à 5 users",
    };
  }
  return {
    name: "Enterprise",
    monthlyPrice: 249,
    annualPrice: 2390,
    reason: "100+ biens, support dédié, sur devis",
  };
}

function formatEuro(n: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function CalculateurROIPage() {
  const [nbBiens, setNbBiens] = useState(5);
  const [loyerMoyen, setLoyerMoyen] = useState(800);

  const results = useMemo(() => {
    const loyersAnnuels = nbBiens * loyerMoyen * MONTHS_PER_YEAR;
    const coutAgence = loyersAnnuels * AGENCY_COMMISSION_RATE;
    const plan = suggestPlan(nbBiens);
    const coutTalok = plan.annualPrice;
    const economies = Math.max(0, coutAgence - coutTalok);
    const economies5ans = economies * 5;
    const economies10ans = economies * 10;
    const pourcentageEconomise =
      coutAgence > 0 ? Math.round((economies / coutAgence) * 100) : 0;

    return {
      loyersAnnuels,
      coutAgence,
      coutTalok,
      economies,
      economies5ans,
      economies10ans,
      pourcentageEconomise,
      plan,
    };
  }, [nbBiens, loyerMoyen]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto text-center"
          >
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 mb-4">
              <Calculator className="w-3 h-3 mr-1" />
              Calculateur d'économies
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Combien économisez-vous{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                avec Talok ?
              </span>
            </h1>
            <p className="text-xl text-slate-400 mb-2">
              Gérer seul avec Talok au lieu de passer par une agence à 8 % :
              résultat en temps réel.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Calculator */}
      <section className="pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Inputs */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2 bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50"
            >
              <h2 className="text-xl font-semibold text-white mb-6">Votre situation</h2>

              {/* Nb biens */}
              <div className="mb-8">
                <div className="flex items-baseline justify-between mb-3">
                  <label className="text-sm font-medium text-slate-300">
                    <Home className="w-4 h-4 inline mr-2 text-emerald-400" />
                    Nombre de biens
                  </label>
                  <span className="text-2xl font-bold text-white">{nbBiens}</span>
                </div>
                <Slider
                  min={1}
                  max={50}
                  step={1}
                  value={[nbBiens]}
                  onValueChange={(v) => setNbBiens(v[0])}
                  className="mb-2"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>1</span>
                  <span>50+</span>
                </div>
              </div>

              {/* Loyer moyen */}
              <div className="mb-8">
                <div className="flex items-baseline justify-between mb-3">
                  <label className="text-sm font-medium text-slate-300">
                    <Euro className="w-4 h-4 inline mr-2 text-emerald-400" />
                    Loyer moyen mensuel
                  </label>
                  <span className="text-2xl font-bold text-white">
                    {formatEuro(loyerMoyen)}
                  </span>
                </div>
                <Slider
                  min={300}
                  max={3000}
                  step={50}
                  value={[loyerMoyen]}
                  onValueChange={(v) => setLoyerMoyen(v[0])}
                  className="mb-2"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>300 €</span>
                  <span>3 000 €</span>
                </div>
              </div>

              <div className="rounded-xl bg-slate-900/50 p-4 text-xs text-slate-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  Commission agence fixée à <strong className="text-white">8 %</strong> HT
                  des loyers encaissés (moyenne française pour la gestion locative).
                </p>
              </div>
            </motion.div>

            {/* Results */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-3 space-y-4"
            >
              {/* Headline economies */}
              <div className="bg-gradient-to-br from-emerald-900/40 to-cyan-900/40 rounded-2xl p-6 border border-emerald-500/30">
                <p className="text-sm text-emerald-300 mb-2 font-medium">
                  Vous économisez par an
                </p>
                <div className="flex items-baseline gap-3 mb-2">
                  <p className="text-5xl md:text-6xl font-bold text-white">
                    {formatEuro(results.economies)}
                  </p>
                  {results.pourcentageEconomise > 0 && (
                    <Badge className="bg-emerald-500/30 text-emerald-300 border-emerald-500/30">
                      <TrendingDown className="w-3 h-3 mr-1" />
                      -{results.pourcentageEconomise}%
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-400">
                  Soit <strong className="text-white">{formatEuro(results.economies5ans)}</strong> sur
                  5 ans, <strong className="text-white">{formatEuro(results.economies10ans)}</strong>{" "}
                  sur 10 ans.
                </p>
              </div>

              {/* Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-800/30 rounded-2xl p-5 border border-slate-700/50">
                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                    Agence (8 %)
                  </p>
                  <p className="text-2xl font-bold text-rose-300 mb-1">
                    {formatEuro(results.coutAgence)}
                  </p>
                  <p className="text-xs text-slate-400">par an, hors frais annexes</p>
                </div>
                <div className="bg-slate-800/30 rounded-2xl p-5 border border-slate-700/50">
                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                    Talok {results.plan.name}
                  </p>
                  <p className="text-2xl font-bold text-emerald-300 mb-1">
                    {results.coutTalok === 0 ? "Gratuit" : formatEuro(results.coutTalok)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {results.coutTalok === 0 ? "1 bien inclus" : "par an, tout inclus"}
                  </p>
                </div>
              </div>

              {/* Plan suggestion */}
              <div className="bg-slate-800/30 rounded-2xl p-5 border border-slate-700/50">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-400 mb-1">Plan Talok recommandé</p>
                    <p className="text-lg font-semibold text-white mb-1">
                      {results.plan.name}
                      {results.plan.monthlyPrice > 0 && (
                        <span className="text-slate-400 font-normal ml-2 text-sm">
                          — {results.plan.monthlyPrice} €/mois HT
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-slate-400">{results.plan.reason}</p>
                  </div>
                </div>
              </div>

              {/* Revenus annuels info */}
              <p className="text-center text-xs text-slate-500">
                Vos loyers annuels : {formatEuro(results.loyersAnnuels)} · sur {nbBiens}{" "}
                {nbBiens > 1 ? "biens" : "bien"}
              </p>

              {/* CTA */}
              <div className="pt-4">
                <Link href="/essai-gratuit">
                  <Button
                    size="lg"
                    className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:opacity-90"
                  >
                    Commencer à économiser avec Talok
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <p className="text-center text-xs text-slate-500 mt-3">
                  Gratuit pour 1 bien · Sans carte bancaire · Résiliable à tout moment
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Assumptions */}
      <section className="py-16 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              Méthodologie du calcul
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Coût agence
                </h3>
                <p className="text-sm text-slate-400 mb-3">
                  8 % HT des loyers encaissés, moyenne française constatée pour la
                  gestion locative classique (source : enquêtes fédérations).
                </p>
                <p className="text-xs text-slate-500">
                  À cela s'ajoutent souvent : honoraires de mise en location, frais
                  d'états des lieux, frais de gestion des travaux — non inclus ici.
                </p>
              </div>

              <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Coût Talok
                </h3>
                <p className="text-sm text-slate-400 mb-3">
                  Tarif annuel HT du plan Talok adapté à votre nombre de biens,
                  facturation annuelle (−20 %) appliquée.
                </p>
                <p className="text-xs text-slate-500">
                  Plan suggéré automatiquement : Gratuit (1 bien), Starter (2-3),
                  Confort (4-10), Pro (11-50), Enterprise (50+).
                </p>
              </div>
            </div>

            <p className="text-center text-xs text-slate-500 mt-8">
              Ce calcul est une estimation. Les économies réelles dépendent de votre
              portefeuille, du marché local et des services annexes souscrits.
            </p>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-emerald-900/50 to-cyan-900/50 rounded-3xl p-12 border border-emerald-500/30"
          >
            <TrendingDown className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Arrêtez de payer 8 % à votre agence
            </h2>
            <p className="text-slate-300 mb-8">
              Gratuit pour 1 bien · Migration assistée · 5 000+ propriétaires en France
            </p>
            <Link href="/essai-gratuit">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                Créer mon compte gratuit
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
