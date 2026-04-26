"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Landmark,
  ArrowRight,
  Check,
  Vote,
  Euro,
  PieChart,
  Globe,
  FileText,
  Sparkles,
  Users,
  Shield,
} from "lucide-react";

const FEATURES = [
  {
    icon: Landmark,
    title: "Multi-copropriétés",
    description:
      "Gérez toutes vos copropriétés (bénévoles ou professionnelles) depuis un seul espace. Tableau de bord consolidé.",
  },
  {
    icon: Vote,
    title: "AG en ligne ou hybrides",
    description:
      "Convocation 21j avant, vote en ligne avec pondération par tantièmes, PV automatique. Conforme au décret 2020-834.",
  },
  {
    icon: Euro,
    title: "Appels de fonds SEPA",
    description:
      "Trimestriels ou annuels. Génération PDF, envoi email + courrier, encaissement SEPA, relances des impayés.",
  },
  {
    icon: PieChart,
    title: "Comptabilité copropriété",
    description:
      "Plan comptable des copropriétés (décret 2005-240). Journal, grand-livre, balance, annexes, état daté.",
  },
  {
    icon: Globe,
    title: "Extranet copropriétaires",
    description:
      "Un espace par copropriétaire : documents, PV d'AG, appels de fonds, suivi budget, messagerie syndic.",
  },
  {
    icon: FileText,
    title: "Pré-état daté & contrats",
    description:
      "Génération automatique du pré-état daté, gestion des contrats fournisseurs (ascenseur, nettoyage, espaces verts...).",
  },
];

const PAIN_POINTS = [
  {
    problem: "Vous gérez encore vos AG à la main ?",
    solution: "Talok envoie les convocations, collecte les votes, génère le PV automatiquement.",
  },
  {
    problem: "Les impayés de charges vous font perdre du temps ?",
    solution: "Relances automatiques, suivi par copropriétaire, procédure contentieuse intégrée.",
  },
  {
    problem: "Les copropriétaires vous demandent sans arrêt les mêmes documents ?",
    solution: "Extranet dédié où ils retrouvent tout en autonomie : PV, budgets, factures.",
  },
  {
    problem: "La compta syndic vous fait peur ?",
    solution: "Plan comptable des copropriétés intégré. Annexes d'AG et bilan générés en 1 clic.",
  },
];

export default function SyndicsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 mb-4">
              <Landmark className="w-3 h-3 mr-1" />
              Solution syndics
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Un outil complet{" "}
              <span className="bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent">
                pour les syndics
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl">
              Syndic bénévole ou professionnel : pilotez vos copropriétés, AG, appels de fonds et
              comptabilité dans une plateforme pensée pour vous. Adapté aux DROM-COM.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/essai-gratuit">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-rose-600 to-pink-600 hover:opacity-90"
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

      {/* Pain points */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">On sait ce qui vous pèse</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              4 points de friction quotidiens résolus par Talok.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {PAIN_POINTS.map((p, i) => (
              <motion.div
                key={p.problem}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50"
              >
                <p className="text-rose-300 font-medium mb-3">❌ {p.problem}</p>
                <p className="text-slate-300">
                  <span className="text-emerald-400 font-semibold">✅ </span>
                  {p.solution}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">Tout ce qu'un syndic a besoin</h2>
            <p className="text-slate-400">
              Conforme à la loi du 10 juillet 1965 et au décret 2005-240.
            </p>
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
                <Card className="h-full bg-slate-800/30 border-slate-700/50 hover:border-rose-500/50 transition-colors">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-rose-500/20 flex items-center justify-center mb-4">
                      <f.icon className="w-6 h-6 text-rose-400" />
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

      {/* Bénévole vs Pro */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-5xl mx-auto"
          >
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">Bénévole ou professionnel, on s'adapte</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50">
                <div className="flex items-center gap-3 mb-4">
                  <Users className="w-6 h-6 text-rose-400" />
                  <h3 className="text-xl font-semibold text-white">Syndic bénévole</h3>
                </div>
                <p className="text-slate-300 mb-4">Vous êtes copropriétaire et gérez votre immeuble.</p>
                <ul className="space-y-2">
                  {[
                    "Gestion d'une à plusieurs copros",
                    "AG en ligne simplifiées",
                    "Appels de fonds automatiques",
                    "Comptabilité assistée",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-slate-300 text-sm">
                      <Check className="w-4 h-4 text-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50">
                <div className="flex items-center gap-3 mb-4">
                  <Landmark className="w-6 h-6 text-rose-400" />
                  <h3 className="text-xl font-semibold text-white">Syndic professionnel</h3>
                </div>
                <p className="text-slate-300 mb-4">Vous êtes un cabinet de syndic agréé.</p>
                <ul className="space-y-2">
                  {[
                    "Multi-copros + multi-équipes",
                    "CRG mandant détaillé",
                    "White-label (domaine perso)",
                    "Extranet copropriétaires dédié",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-slate-300 text-sm">
                      <Check className="w-4 h-4 text-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Compliance highlight */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-rose-900/30 to-pink-900/30 rounded-3xl p-8 md:p-12 border border-rose-500/20 max-w-4xl mx-auto text-center"
          >
            <Shield className="w-12 h-12 text-rose-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">100 % conforme à la loi</h2>
            <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
              Talok respecte la loi du 10 juillet 1965, le décret 2005-240, le décret 2020-834
              (AG dématérialisées), et les obligations de mise à jour du règlement de copropriété.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                "Loi 10 juillet 1965",
                "Décret 2005-240",
                "Décret 2020-834",
                "Loi ELAN 2018",
              ].map((law) => (
                <Badge key={law} className="bg-rose-500/20 text-rose-300 border-rose-500/30">
                  {law}
                </Badge>
              ))}
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-rose-900/50 to-pink-900/50 rounded-3xl p-12 border border-rose-500/30"
          >
            <Sparkles className="w-12 h-12 text-rose-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Reprenez le contrôle de vos copropriétés
            </h2>
            <p className="text-slate-300 mb-8">
              Gratuit pour 1 copropriété. Configuration en 30 minutes.
            </p>
            <Link href="/essai-gratuit">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                Démarrer avec Talok Syndic
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
