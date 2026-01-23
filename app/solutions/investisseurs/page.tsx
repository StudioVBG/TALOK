"use client";

/**
 * Page Solution: Investisseurs
 *
 * Persona: Pierre, 52 ans, 8 biens, Excel ingérable, préoccupations fiscales
 * SEO: Cible "logiciel gestion locative investisseur"
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  ArrowRight,
  Check,
  FileSpreadsheet,
  PieChart,
  Calculator,
  Zap,
  Upload,
  BarChart3,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  Euro,
} from "lucide-react";

const PAIN_POINTS = [
  {
    icon: FileSpreadsheet,
    title: "\"Mon Excel est devenu ingérable\"",
    solution: "Importez vos biens en 30 minutes. Fini les formules cassées et les fichiers perdus.",
  },
  {
    icon: Euro,
    title: "\"L'agence fait le minimum pour 5 600€/an\"",
    solution: "Reprenez le contrôle. Talok Pro à 64€/mois = 768€/an. ROI immédiat.",
  },
  {
    icon: Calculator,
    title: "\"Ma déclaration 2044 est un cauchemar\"",
    solution: "Export 2044 automatique. Toutes les données prêtes en 2 clics.",
  },
];

const FEATURES_FOR_INVESTORS = [
  {
    icon: Upload,
    title: "Import Excel/CSV",
    description: "Importez votre portefeuille existant. Mapping intelligent des colonnes.",
  },
  {
    icon: PieChart,
    title: "Analyse de rentabilité",
    description: "Rendement brut, net, cash-flow par bien. Optimisez votre portefeuille.",
  },
  {
    icon: Calculator,
    title: "Export fiscal 2044",
    description: "Générez votre déclaration de revenus fonciers automatiquement.",
  },
  {
    icon: TrendingUp,
    title: "Prévisions de trésorerie",
    description: "Anticipez vos flux. Visualisez les échéances à venir.",
  },
  {
    icon: BarChart3,
    title: "Comparatif biens",
    description: "Identifiez vos meilleurs et moins bons performers.",
  },
  {
    icon: Zap,
    title: "Automatisations avancées",
    description: "Révision IRL, relances, régularisation charges. Tout en automatique.",
  },
];

const ROI_CALCULATION = {
  before: [
    { label: "Agence (8%)", value: "5 600€/an" },
    { label: "Comptable (heures)", value: "~800€/an" },
    { label: "Temps passé (10h/mois)", value: "~valeur perdue" },
  ],
  after: [
    { label: "Talok Pro", value: "768€/an" },
    { label: "Comptable (réduit)", value: "~400€/an" },
    { label: "Temps passé (2h/mois)", value: "80% économisé" },
  ],
  savings: "5 032€/an",
};

export default function InvestisseursPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto text-center"
          >
            <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 mb-4">
              <TrendingUp className="w-3 h-3 mr-1" />
              Pour les investisseurs
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Pilotez votre patrimoine{" "}
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                comme un pro
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
              5, 10, 50 biens ou plus ? Talok scale avec vous.
              Import Excel, analyse de rentabilité, export fiscal automatique.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <Link href="/auth/signup">
                <Button size="lg" className="bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90">
                  Essayer gratuitement
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/outils/calcul-rendement-locatif">
                <Button size="lg" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  <Calculator className="w-4 h-4 mr-2" />
                  Calculateur rendement
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Import Excel en 30 min
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Export 2044 automatique
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Biens illimités (plan Pro)
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              On connaît vos frustrations
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PAIN_POINTS.map((point, index) => (
              <motion.div
                key={point.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full bg-slate-800/30 border-slate-700/50">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center mb-4">
                      <AlertTriangle className="w-6 h-6 text-red-400" />
                    </div>
                    <CardTitle className="text-lg text-white">{point.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <p className="text-slate-300 text-sm">{point.solution}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI Section */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">
                Calculez votre économie
              </h2>
              <p className="text-slate-400">
                Pour un portefeuille de 8 biens (loyer moyen 700€)
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50">
                <h3 className="font-semibold text-slate-400 mb-4">❌ Avant Talok</h3>
                <ul className="space-y-3">
                  {ROI_CALCULATION.before.map((item) => (
                    <li key={item.label} className="flex justify-between text-slate-300">
                      <span>{item.label}</span>
                      <span className="font-medium">{item.value}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-gradient-to-br from-violet-900/50 to-purple-900/50 rounded-2xl p-6 border border-violet-500/30">
                <h3 className="font-semibold text-violet-300 mb-4">✅ Avec Talok Pro</h3>
                <ul className="space-y-3">
                  {ROI_CALCULATION.after.map((item) => (
                    <li key={item.label} className="flex justify-between text-slate-300">
                      <span>{item.label}</span>
                      <span className="font-medium">{item.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="text-center">
              <div className="inline-block bg-emerald-500/20 rounded-2xl px-8 py-4 border border-emerald-500/30">
                <div className="text-sm text-emerald-300 mb-1">Économie estimée</div>
                <div className="text-4xl font-bold text-emerald-400">{ROI_CALCULATION.savings}</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Outils pour investisseurs
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {FEATURES_FOR_INVESTORS.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="h-full bg-slate-800/30 border-slate-700/50 hover:border-violet-500/50 transition-colors">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-violet-400" />
                    </div>
                    <CardTitle className="text-white">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-400">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-violet-900/50 to-purple-900/50 rounded-3xl p-12 border border-violet-500/30"
          >
            <Sparkles className="w-12 h-12 text-violet-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Importez votre portefeuille en 30 minutes
            </h2>
            <p className="text-slate-300 mb-8">
              Excel, CSV, ou saisie manuelle. Vous choisissez.
              Toutes vos données centralisées, prêtes pour la prochaine déclaration.
            </p>
            <Link href="/auth/signup">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                Commencer l'import gratuit
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
