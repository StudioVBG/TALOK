"use client";

/**
 * Page Solution: SCI Familiales
 *
 * Persona: Sylvie, 58 ans, SCI familiale avec 2 frères, 12 biens
 * SEO: Cible "logiciel gestion locative SCI"
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building,
  ArrowRight,
  Check,
  Users,
  BarChart3,
  FileSpreadsheet,
  Share2,
  Eye,
  Lock,
  Sparkles,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";

const PAIN_POINTS = [
  {
    icon: Users,
    title: "\"On se dispute sur qui fait quoi\"",
    solution: "Attribuez des rôles et permissions. Chaque associé voit uniquement ce qui le concerne.",
  },
  {
    icon: Eye,
    title: "\"Personne n'a une vue claire des comptes\"",
    solution: "Tableau de bord partagé en temps réel. Tous les associés voient les mêmes chiffres.",
  },
  {
    icon: FileSpreadsheet,
    title: "\"Le comptable nous coûte une fortune\"",
    solution: "Export FEC automatique. Votre comptable passe moins de temps, vous payez moins.",
  },
];

const FEATURES_FOR_SCI = [
  {
    icon: Users,
    title: "Multi-utilisateurs inclus",
    description: "Invitez tous les associés. Chacun a son accès avec ses permissions.",
  },
  {
    icon: BarChart3,
    title: "Rapports pour AG",
    description: "Générez des rapports complets pour vos assemblées générales en 1 clic.",
  },
  {
    icon: Share2,
    title: "Répartition automatique",
    description: "Calcul automatique de la répartition entre associés selon les parts.",
  },
  {
    icon: FileSpreadsheet,
    title: "Export comptable FEC",
    description: "Fichier conforme pour votre expert-comptable. Gain de temps garanti.",
  },
  {
    icon: Lock,
    title: "Audit trail complet",
    description: "Historique de toutes les actions. Qui a fait quoi, quand.",
  },
  {
    icon: Eye,
    title: "Tableau de bord consolidé",
    description: "Vue globale de la SCI : revenus, charges, rentabilité par bien.",
  },
];

const TESTIMONIAL = {
  quote: "Avant Talok, on passait des heures à s'envoyer des Excel. Maintenant, tout le monde a accès aux mêmes informations en temps réel. Les AG sont beaucoup plus sereines.",
  author: "Sylvie M.",
  location: "Guadeloupe",
  properties: "SCI familiale · 12 biens",
};

export default function SCIFamilialesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto text-center"
          >
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 mb-4">
              <Building className="w-3 h-3 mr-1" />
              Pour les SCI familiales
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Gérez votre SCI{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                en famille, sans conflits
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
              Multi-associés, rapports pour AG, export comptable.
              Talok est conçu pour simplifier la gestion de votre SCI familiale.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <Link href="/auth/signup">
                <Button size="lg" className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90">
                  Essayer gratuitement
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/guides/gestion-sci">
                <Button size="lg" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  Guide SCI gratuit
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Multi-utilisateurs inclus
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Rapports AG automatiques
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Export FEC comptable
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
              Les défis de la gestion en famille
            </h2>
            <p className="text-slate-400">
              Nous connaissons les problématiques spécifiques des SCI familiales.
            </p>
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

      {/* Multi-user Highlight */}
      <section className="py-20 bg-slate-900/50">
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
                  <Users className="w-3 h-3 mr-1" />
                  Gestion multi-associés
                </Badge>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Chaque associé à sa place
                </h2>
                <p className="text-slate-300 mb-6">
                  Invitez tous les membres de la SCI. Définissez qui peut voir quoi,
                  qui peut modifier, qui valide les dépenses. Fini les malentendus.
                </p>
                <ul className="space-y-3">
                  {[
                    "Gérant : accès complet",
                    "Associé : consultation + validation",
                    "Comptable : accès aux exports",
                    "Notifications personnalisées",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-slate-800/50 rounded-2xl p-6">
                <div className="space-y-3">
                  {[
                    { name: "Sylvie M.", role: "Gérante", access: "Accès complet" },
                    { name: "Jean M.", role: "Associé", access: "Consultation" },
                    { name: "Pierre M.", role: "Associé", access: "Consultation" },
                    { name: "Cabinet Durand", role: "Comptable", access: "Exports" },
                  ].map((user, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-900/50 rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <span className="text-emerald-400 font-semibold">{user.name[0]}</span>
                        </div>
                        <div>
                          <p className="font-medium text-white">{user.name}</p>
                          <p className="text-xs text-slate-400">{user.role}</p>
                        </div>
                      </div>
                      <Badge className="bg-slate-700/50 text-slate-300">{user.access}</Badge>
                    </div>
                  ))}
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
              Fonctionnalités pour les SCI
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {FEATURES_FOR_SCI.map((feature, index) => (
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

      {/* Testimonial */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center"
          >
            <Building className="w-12 h-12 text-emerald-400 mx-auto mb-6" />
            <blockquote className="text-2xl text-white mb-6 leading-relaxed">
              "{TESTIMONIAL.quote}"
            </blockquote>
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-400 font-semibold">S</span>
              </div>
              <div className="text-left">
                <div className="font-semibold text-white">{TESTIMONIAL.author}</div>
                <div className="text-sm text-slate-400">{TESTIMONIAL.location} · {TESTIMONIAL.properties}</div>
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-emerald-900/50 to-teal-900/50 rounded-3xl p-12 border border-emerald-500/30"
          >
            <Sparkles className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Simplifiez la gestion de votre SCI
            </h2>
            <p className="text-slate-300 mb-8">
              Plan Pro recommandé pour les SCI. Multi-utilisateurs et rapports inclus.
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
