"use client";

/**
 * Page À Propos
 *
 * Story, équipe, valeurs
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building2,
  ArrowRight,
  Palmtree,
  Heart,
  Users,
  Target,
  Award,
  Sparkles,
  MapPin,
  Zap,
  Shield,
  MessageSquare,
} from "lucide-react";

const VALUES = [
  {
    icon: Zap,
    title: "Simplicité",
    description: "Un logiciel que n'importe qui peut utiliser. Pas de formation nécessaire.",
  },
  {
    icon: Heart,
    title: "Humanité",
    description: "Un vrai support humain. Le fondateur répond encore aux emails.",
  },
  {
    icon: Shield,
    title: "Fiabilité",
    description: "Vos données sont sacrées. Sécurité et conformité au premier plan.",
  },
  {
    icon: MapPin,
    title: "Proximité",
    description: "Né aux Antilles, pour toute la France. On comprend vos réalités.",
  },
];

const MILESTONES = [
  { year: "2022", event: "Idée née à Fort-de-France", icon: Palmtree },
  { year: "2023", event: "Lancement beta, 100 premiers utilisateurs", icon: Users },
  { year: "2024", event: "+5 000 propriétaires, expansion métropole", icon: Target },
  { year: "2025", event: "+10 000 clients, scoring IA lancé", icon: Award },
  { year: "2026", event: "Leader DOM-TOM, Open Banking", icon: Sparkles },
];

const STATS = [
  { value: "+10 000", label: "Propriétaires" },
  { value: "+50 000", label: "Biens gérés" },
  { value: "+2 000", label: "Aux Antilles" },
  { value: "4.8/5", label: "Satisfaction" },
];

export default function AProposPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <Badge className="bg-teal-500/20 text-teal-300 border-teal-500/30 mb-4">
              <Building2 className="w-3 h-3 mr-1" />
              Notre histoire
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Né en Martinique,{" "}
              <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                pour toute la France
              </span>
            </h1>

            <p className="text-lg text-slate-400 mb-8">
              Talok est né d'une frustration simple : pourquoi aucun logiciel de gestion
              locative ne comprenait les réalités des propriétaires ultramarins ?
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-8 border-y border-slate-800 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl md:text-4xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="prose prose-invert max-w-none"
            >
              <h2 className="text-3xl font-bold text-white mb-8 text-center">
                L'histoire de Talok
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mb-12">
                <div className="bg-slate-800/30 rounded-2xl p-8 border border-slate-700/50">
                  <Palmtree className="w-12 h-12 text-teal-400 mb-4" />
                  <p className="text-slate-300 leading-relaxed">
                    En 2022, Thomas, propriétaire de 3 appartements en Martinique,
                    cherchait un logiciel pour gérer ses locations. Il a testé une dizaine
                    de solutions : soit trop compliquées, soit pas adaptées aux spécificités
                    ultramarines.
                  </p>
                </div>
                <div className="bg-slate-800/30 rounded-2xl p-8 border border-slate-700/50">
                  <Heart className="w-12 h-12 text-teal-400 mb-4" />
                  <p className="text-slate-300 leading-relaxed">
                    Aucun logiciel ne comprenait les délais postaux, la fiscalité Pinel
                    Outre-Mer, ou simplement le décalage horaire pour joindre le support.
                    Alors il a décidé de créer Talok.
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-teal-900/30 to-cyan-900/30 rounded-2xl p-8 border border-teal-500/20 text-center">
                <blockquote className="text-xl text-white italic mb-4">
                  "J'ai créé l'outil que j'aurais voulu avoir. Simple à utiliser,
                  vraiment adapté à nos réalités, avec un support humain et réactif."
                </blockquote>
                <p className="text-teal-300 font-semibold">Thomas, Fondateur de Talok</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Notre parcours
            </h2>
          </motion.div>

          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-0.5 bg-slate-700" />
              {MILESTONES.map((milestone, index) => (
                <motion.div
                  key={milestone.year}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative flex items-center mb-8 ${
                    index % 2 === 0 ? "flex-row" : "flex-row-reverse"
                  }`}
                >
                  <div className={`w-1/2 ${index % 2 === 0 ? "pr-8 text-right" : "pl-8"}`}>
                    <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                      <span className="text-teal-400 font-bold text-lg">{milestone.year}</span>
                      <p className="text-slate-300 mt-1">{milestone.event}</p>
                    </div>
                  </div>
                  <div className="absolute left-1/2 transform -translate-x-1/2 w-10 h-10 rounded-full bg-teal-500/20 border-2 border-teal-500 flex items-center justify-center">
                    <milestone.icon className="w-5 h-5 text-teal-400" />
                  </div>
                  <div className="w-1/2" />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Nos valeurs
            </h2>
            <p className="text-slate-400">
              Ce qui guide chaque décision chez Talok.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {VALUES.map((value, index) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full bg-slate-800/30 border-slate-700/50 text-center">
                  <CardContent className="pt-6">
                    <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center mx-auto mb-4">
                      <value.icon className="w-6 h-6 text-teal-400" />
                    </div>
                    <h3 className="font-semibold text-white mb-2">{value.title}</h3>
                    <p className="text-sm text-slate-400">{value.description}</p>
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-teal-900/50 to-cyan-900/50 rounded-3xl p-12 border border-teal-500/30"
          >
            <Sparkles className="w-12 h-12 text-teal-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">
              Rejoignez l'aventure Talok
            </h2>
            <p className="text-slate-300 mb-6">
              +10 000 propriétaires nous font déjà confiance.
              Et vous ?
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/signup">
                <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                  Essayer gratuitement
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Nous contacter
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
