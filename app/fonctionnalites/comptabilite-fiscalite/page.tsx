"use client";

/**
 * Page Fonctionnalité: Comptabilité & Fiscalité
 *
 * SEO: Cible "comptabilité locative", "déclaration revenus fonciers"
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calculator,
  ArrowRight,
  Check,
  FileSpreadsheet,
  PieChart,
  TrendingUp,
  FileText,
  Download,
  BarChart3,
  Sparkles,
  Euro,
} from "lucide-react";

const FEATURES = [
  {
    icon: FileSpreadsheet,
    title: "Export déclaration 2044",
    description: "Générez automatiquement les données pour votre déclaration de revenus fonciers 2044.",
  },
  {
    icon: FileText,
    title: "Fichier FEC comptable",
    description: "Export au format FEC pour votre comptable. Conforme aux normes fiscales françaises.",
  },
  {
    icon: Euro,
    title: "Suivi charges et dépenses",
    description: "Catégorisez vos dépenses (travaux, assurance, taxe...). Réconciliation automatique.",
  },
  {
    icon: PieChart,
    title: "Rapports personnalisés",
    description: "Tableaux de bord et rapports sur mesure. Visualisez vos données en un coup d'œil.",
  },
  {
    icon: TrendingUp,
    title: "Analyse de rentabilité",
    description: "Calculez le rendement brut, net, le cash-flow. Par bien ou pour l'ensemble du portefeuille.",
  },
  {
    icon: BarChart3,
    title: "Historique complet",
    description: "Retrouvez l'historique de tous vos flux financiers. Export Excel disponible.",
  },
];

const EXPORTS = [
  { name: "Déclaration 2044", description: "Revenus fonciers", format: "PDF/Excel" },
  { name: "Fichier FEC", description: "Export comptable", format: "FEC" },
  { name: "Récapitulatif annuel", description: "Synthèse des loyers", format: "PDF" },
  { name: "Relevé des charges", description: "Détail par catégorie", format: "Excel" },
];

export default function ComptabiliteFiscalitePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <Link href="/fonctionnalites" className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors">
              <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
              Toutes les fonctionnalités
            </Link>

            <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 mb-4">
              <Calculator className="w-3 h-3 mr-1" />
              Comptabilité & Fiscalité
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Simplifiez votre{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                déclaration fiscale
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl">
              Export 2044 en un clic, fichier FEC pour votre comptable, suivi des charges
              et analyse de rentabilité. Tout pour piloter vos finances locatives.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/auth/signup">
                <Button size="lg" className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:opacity-90">
                  Essayer gratuitement
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/guides/declaration-2044">
                <Button size="lg" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  Guide déclaration 2044
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-8 border-y border-slate-800 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "+8 000", label: "déclarations simplifiées" },
              { value: "2 min", label: "pour export 2044" },
              { value: "100%", label: "conforme aux normes" },
              { value: "24/7", label: "accès aux données" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl md:text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Exports Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Exports disponibles
            </h2>
            <p className="text-slate-400">
              Tous les documents dont vous avez besoin pour votre comptabilité et vos impôts.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {EXPORTS.map((exp, index) => (
              <motion.div
                key={exp.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 hover:border-cyan-500/50 transition-colors text-center"
              >
                <Download className="w-8 h-8 text-cyan-400 mx-auto mb-4" />
                <h3 className="font-semibold text-white mb-1">{exp.name}</h3>
                <p className="text-sm text-slate-400 mb-2">{exp.description}</p>
                <Badge className="bg-slate-700/50 text-slate-300">{exp.format}</Badge>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 2044 Highlight */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-cyan-900/30 to-blue-900/30 rounded-3xl p-8 md:p-12 border border-cyan-500/20"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <Badge className="bg-cyan-500/30 text-cyan-300 border-cyan-500/30 mb-4">
                  <FileSpreadsheet className="w-3 h-3 mr-1" />
                  Déclaration simplifiée
                </Badge>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Export 2044 en un clic
                </h2>
                <p className="text-slate-300 mb-6">
                  Talok calcule automatiquement vos revenus fonciers, charges déductibles,
                  et génère un document prêt pour votre déclaration. Plus de stress en avril.
                </p>
                <ul className="space-y-3">
                  {[
                    "Loyers bruts encaissés",
                    "Charges déductibles par catégorie",
                    "Intérêts d'emprunt",
                    "Travaux et amortissements",
                    "Revenus nets imposables",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-cyan-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-slate-800/50 rounded-2xl p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-slate-700">
                    <span className="text-slate-400">Loyers bruts</span>
                    <span className="font-semibold text-white">32 400 €</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-slate-700">
                    <span className="text-slate-400">Charges déductibles</span>
                    <span className="font-semibold text-red-400">- 8 200 €</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-slate-700">
                    <span className="text-slate-400">Intérêts d'emprunt</span>
                    <span className="font-semibold text-red-400">- 4 800 €</span>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <span className="font-semibold text-white">Revenus fonciers nets</span>
                    <span className="font-bold text-emerald-400">19 400 €</span>
                  </div>
                </div>
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
              Toutes les fonctionnalités
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="h-full bg-slate-800/30 border-slate-700/50 hover:border-cyan-500/50 transition-colors">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-cyan-400" />
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-cyan-900/50 to-blue-900/50 rounded-3xl p-12 border border-cyan-500/30"
          >
            <Sparkles className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Simplifiez votre prochaine déclaration
            </h2>
            <p className="text-slate-300 mb-8">
              Commencez maintenant. Vos données seront prêtes pour avril.
            </p>
            <Link href="/auth/signup">
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
