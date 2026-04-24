"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  ArrowRight,
  Check,
  Users,
  Vote,
  Euro,
  FileText,
  PieChart,
  Sparkles,
  Globe,
} from "lucide-react";

const FEATURES = [
  {
    icon: Building2,
    title: "Gestion des lots et tantièmes",
    description:
      "Définissez les lots, les tantièmes et les copropriétaires. Répartition automatique des charges et des votes.",
  },
  {
    icon: Vote,
    title: "Assemblées générales",
    description:
      "Convocation envoyée 21 jours avant, vote en ligne ou en présentiel, PV généré automatiquement avec comptage des voix.",
  },
  {
    icon: Euro,
    title: "Appels de fonds & budgets",
    description:
      "Budget prévisionnel, appels de fonds trimestriels, régularisation annuelle. Suivi des impayés par copropriétaire.",
  },
  {
    icon: PieChart,
    title: "Comptabilité copropriété",
    description:
      "Plan comptable des copropriétés (décret 2005-240). Journal, grand-livre, balance, exercice clos annuel.",
  },
  {
    icon: Globe,
    title: "Extranet copropriétaires",
    description:
      "Chaque copropriétaire a un accès dédié : PV d'AG, budgets, appels de fonds, documents, historique.",
  },
  {
    icon: FileText,
    title: "Documents centralisés",
    description:
      "Règlement de copropriété, PV d'AG, contrats fournisseurs, diagnostics communs, assurances — tout au même endroit.",
  },
];

const AG_STEPS = [
  { title: "Préparation", description: "Rédaction de l'ordre du jour avec les résolutions à voter." },
  { title: "Convocation", description: "Envoi automatique à J-21 par email + papier si souhaité." },
  { title: "Vote", description: "Chaque copropriétaire vote en ligne (ou en séance). Pondération par tantièmes." },
  { title: "PV automatique", description: "Procès-verbal généré avec comptage des voix, envoyé à tous." },
];

export default function ImmeubleCoproprietePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <Link
              href="/fonctionnalites"
              className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors"
            >
              <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
              Toutes les fonctionnalités
            </Link>

            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 mb-4">
              <Building2 className="w-3 h-3 mr-1" />
              Immeuble & copropriété
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Immeubles et copropriétés,{" "}
              <span className="bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">
                gérés simplement
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl">
              Lots, tantièmes, copropriétaires, AG, appels de fonds, PV : tout intégré à votre
              gestion locative. Pensé pour les petits et moyens immeubles.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/essai-gratuit">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:opacity-90"
                >
                  Essayer gratuitement
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Voir les tarifs
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-8 border-y border-slate-800 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "Multi-lots", label: "gestion intégrée" },
              { value: "AG", label: "vote en ligne" },
              { value: "Plan comptable", label: "copro officiel" },
              { value: "Extranet", label: "copropriétaires" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-xl md:text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AG Workflow */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">L'assemblée générale, sans friction</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              De la convocation au PV, Talok automatise toutes les étapes réglementaires.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {AG_STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 h-full">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white font-bold mb-4">
                    {i + 1}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-slate-400 text-sm">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">Toutes les fonctionnalités</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="h-full bg-slate-800/30 border-slate-700/50 hover:border-indigo-500/50 transition-colors">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-4">
                      <f.icon className="w-6 h-6 text-indigo-400" />
                    </div>
                    <CardTitle className="text-white">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-400">{f.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Appels de fonds */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-indigo-900/30 to-blue-900/30 rounded-3xl p-8 md:p-12 border border-indigo-500/20 max-w-5xl mx-auto"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <Badge className="bg-indigo-500/30 text-indigo-300 border-indigo-500/30 mb-4">
                  <Euro className="w-3 h-3 mr-1" />
                  Appels de fonds
                </Badge>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Les appels de fonds, générés et encaissés automatiquement
                </h2>
                <p className="text-slate-300 mb-6">
                  Trimestriels ou annuels, les appels de fonds sont calculés selon les tantièmes,
                  envoyés à chaque copropriétaire et encaissés via prélèvement SEPA.
                </p>
                <ul className="space-y-3">
                  {[
                    "Calcul automatique au tantième",
                    "Envoi PDF avec bulletin de paiement",
                    "Prélèvement SEPA ou virement",
                    "Relances automatiques des impayés",
                    "Régularisation annuelle des charges",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-indigo-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-slate-800/50 rounded-2xl p-6">
                <div className="space-y-3">
                  {[
                    { name: "Appel T1 2026 - Lot 4", amount: "450,00 €", status: "Payé" },
                    { name: "Appel T1 2026 - Lot 7", amount: "680,00 €", status: "Payé" },
                    { name: "Appel T1 2026 - Lot 2", amount: "320,00 €", status: "En attente" },
                    { name: "Régul. 2025 - Lot 4", amount: "+85,00 €", status: "Remboursé" },
                  ].map((tx) => (
                    <div
                      key={tx.name}
                      className="flex items-center justify-between bg-slate-900/50 rounded-xl p-3"
                    >
                      <div>
                        <p className="font-medium text-white text-sm">{tx.name}</p>
                        <p className="text-xs text-slate-400">{tx.amount}</p>
                      </div>
                      <Badge
                        className={
                          tx.status === "Payé" || tx.status === "Remboursé"
                            ? "bg-emerald-500/20 text-emerald-300 text-xs"
                            : "bg-amber-500/20 text-amber-300 text-xs"
                        }
                      >
                        {tx.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-indigo-900/50 to-blue-900/50 rounded-3xl p-12 border border-indigo-500/30"
          >
            <Sparkles className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">Votre copropriété, en pilote automatique</h2>
            <p className="text-slate-300 mb-8">
              Syndic bénévole ou professionnel, Talok vous fait gagner des dizaines d'heures par an.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/essai-gratuit">
                <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                  Créer mon compte gratuit
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/solutions/syndics">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10"
                >
                  Solution dédiée syndics
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
