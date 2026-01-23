"use client";

/**
 * Page Fonctionnalité: Gestion des Locataires
 *
 * SEO: Cible "gestion locataires", "suivi locataire"
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  ArrowRight,
  Check,
  Brain,
  MessageSquare,
  FileCheck,
  Wallet,
  Shield,
  UserPlus,
  Sparkles,
} from "lucide-react";

const FEATURES = [
  {
    icon: Brain,
    title: "Scoring IA des candidats",
    description: "Analysez automatiquement la solvabilité des candidats. 94% de précision pour éviter les impayés.",
  },
  {
    icon: FileCheck,
    title: "Dossiers complets",
    description: "Centralisez les pièces justificatives, contrats, et documents de chaque locataire.",
  },
  {
    icon: MessageSquare,
    title: "Communication intégrée",
    description: "Échangez avec vos locataires via la messagerie intégrée. Historique conservé.",
  },
  {
    icon: Wallet,
    title: "Suivi des paiements",
    description: "Visualisez en temps réel les loyers reçus, en retard, ou impayés par locataire.",
  },
  {
    icon: Shield,
    title: "Portail locataire",
    description: "Vos locataires ont leur propre espace pour payer, télécharger leurs quittances, signaler un problème.",
  },
  {
    icon: UserPlus,
    title: "Gestion entrée/sortie",
    description: "Processus guidé pour l'arrivée et le départ des locataires. Rien n'est oublié.",
  },
];

const BENEFITS = [
  "Réduisez les impayés avec le scoring IA",
  "Gagnez du temps sur la gestion quotidienne",
  "Améliorez la relation avec vos locataires",
  "Archivage automatique des échanges",
  "Conformité RGPD garantie",
  "Portail locataire en marque blanche",
];

export default function GestionLocatairesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent" />

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

            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 mb-4">
              <Users className="w-3 h-3 mr-1" />
              Gestion des Locataires
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Gérez vos locataires{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                intelligemment
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl">
              Du scoring des candidats au suivi des paiements, simplifiez la gestion
              de vos locataires avec des outils intelligents.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/auth/signup">
                <Button size="lg" className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90">
                  Essayer gratuitement
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  Voir les tarifs
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
              { value: "+25 000", label: "locataires actifs" },
              { value: "94%", label: "précision scoring IA" },
              { value: "-75%", label: "impayés avec scoring" },
              { value: "4.8/5", label: "satisfaction locataires" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl md:text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scoring IA Highlight */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-emerald-900/30 to-teal-900/30 rounded-3xl p-8 md:p-12 border border-emerald-500/20"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <Badge className="bg-emerald-500/30 text-emerald-300 border-emerald-500/30 mb-4">
                  <Brain className="w-3 h-3 mr-1" />
                  Exclusif Talok
                </Badge>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Scoring IA des locataires
                </h2>
                <p className="text-slate-300 mb-6">
                  Notre algorithme analyse automatiquement les dossiers de candidature
                  et vous donne un score de solvabilité. Réduisez vos risques d'impayés
                  de 75% en moyenne.
                </p>
                <ul className="space-y-3">
                  {[
                    "Analyse des revenus et charges",
                    "Vérification des documents",
                    "Score de risque sur 100",
                    "Recommandation automatique",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-slate-800/50 rounded-2xl p-6">
                <div className="text-center">
                  <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-4">
                    <span className="text-4xl font-bold text-white">94</span>
                  </div>
                  <p className="text-lg font-semibold text-white">Score excellent</p>
                  <p className="text-sm text-slate-400">Candidat recommandé</p>
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
            <p className="text-slate-400 max-w-2xl mx-auto">
              Des outils pensés pour simplifier la gestion de vos locataires au quotidien.
            </p>
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
                <Card className="h-full bg-slate-800/30 border-slate-700/50 hover:border-emerald-500/50 transition-colors">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-emerald-400" />
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

      {/* Benefits */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold text-white mb-4">
                Les avantages pour vous
              </h2>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {BENEFITS.map((benefit, index) => (
                <motion.div
                  key={benefit}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center gap-3 bg-slate-800/30 rounded-xl p-4 border border-slate-700/50"
                >
                  <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-slate-300">{benefit}</span>
                </motion.div>
              ))}
            </div>
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-emerald-900/50 to-teal-900/50 rounded-3xl p-12 border border-emerald-500/30"
          >
            <Sparkles className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Commencez à sélectionner les meilleurs locataires
            </h2>
            <p className="text-slate-300 mb-8">
              Testez le scoring IA gratuitement. Réduisez vos risques d'impayés dès aujourd'hui.
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
