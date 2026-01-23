"use client";

/**
 * Page Fonctionnalité: Quittances de Loyer
 *
 * SEO: Cible "logiciel quittance loyer", "quittance automatique"
 * Volume recherche: 880/mois
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Receipt,
  ArrowRight,
  Check,
  Mail,
  Bell,
  Calendar,
  FileText,
  Download,
  Zap,
  Sparkles,
  Clock,
} from "lucide-react";

const FEATURES = [
  {
    icon: Calendar,
    title: "Envoi automatique mensuel",
    description: "Configurez une fois, oubliez. Les quittances sont générées et envoyées automatiquement chaque mois.",
  },
  {
    icon: FileText,
    title: "Conformes loi ALUR",
    description: "Nos quittances respectent scrupuleusement les obligations légales. Mentions obligatoires incluses.",
  },
  {
    icon: Bell,
    title: "Relances impayés",
    description: "En cas de retard de paiement, des relances automatiques sont envoyées au locataire.",
  },
  {
    icon: Mail,
    title: "Envoi par email ou courrier",
    description: "Choisissez le mode d'envoi préféré de chaque locataire. Email gratuit, courrier en option.",
  },
  {
    icon: Download,
    title: "Historique complet",
    description: "Retrouvez toutes les quittances émises depuis le début. Export PDF ou Excel.",
  },
  {
    icon: Zap,
    title: "Personnalisables",
    description: "Ajoutez votre logo, personnalisez le message d'accompagnement, adaptez le format.",
  },
];

const AUTOMATION_BENEFITS = [
  "Plus d'oublis de quittances",
  "Locataires satisfaits",
  "Conformité garantie",
  "Temps gagné chaque mois",
  "Historique centralisé",
  "Relances automatiques",
];

export default function QuittancesLoyersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-transparent to-transparent" />

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

            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 mb-4">
              <Receipt className="w-3 h-3 mr-1" />
              Quittances de Loyer
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Quittances automatiques,{" "}
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                zéro effort
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl">
              Générez et envoyez automatiquement les quittances chaque mois.
              Conformes à la loi ALUR, personnalisables, toujours à l'heure.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/auth/signup">
                <Button size="lg" className="bg-gradient-to-r from-amber-600 to-orange-600 hover:opacity-90">
                  Essayer gratuitement
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/modeles/quittance-loyer">
                <Button size="lg" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  <Download className="w-4 h-4 mr-2" />
                  Modèle gratuit
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
              { value: "+100 000", label: "quittances/mois" },
              { value: "100%", label: "conformes ALUR" },
              { value: "0€", label: "coût envoi email" },
              { value: "< 5 min", label: "configuration" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl md:text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Automation Highlight */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 rounded-3xl p-8 md:p-12 border border-amber-500/20"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <Badge className="bg-amber-500/30 text-amber-300 border-amber-500/30 mb-4">
                  <Clock className="w-3 h-3 mr-1" />
                  Automatisation totale
                </Badge>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Configurez une fois, oubliez pour toujours
                </h2>
                <p className="text-slate-300 mb-6">
                  Définissez la date d'envoi, le format, et le mode d'envoi préféré de chaque locataire.
                  Talok s'occupe du reste, chaque mois, automatiquement.
                </p>
                <ul className="grid grid-cols-2 gap-3">
                  {AUTOMATION_BENEFITS.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-amber-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-slate-800/50 rounded-2xl p-6">
                <div className="space-y-4">
                  {[
                    { date: "1er du mois", status: "Génération automatique", color: "amber" },
                    { date: "2 du mois", status: "Envoi par email", color: "emerald" },
                    { date: "7 du mois", status: "Relance si impayé", color: "orange" },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-4 bg-slate-900/50 rounded-xl p-4">
                      <div className={`w-3 h-3 rounded-full bg-${step.color}-400`} />
                      <div>
                        <p className="font-medium text-white">{step.date}</p>
                        <p className="text-sm text-slate-400">{step.status}</p>
                      </div>
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
              Fonctionnalités complètes
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
                <Card className="h-full bg-slate-800/30 border-slate-700/50 hover:border-amber-500/50 transition-colors">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-amber-400" />
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

      {/* Sample Quittance */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold text-white mb-4">
                Exemple de quittance
              </h2>
              <p className="text-slate-400">
                Un document professionnel, conforme, avec toutes les mentions légales.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-8 shadow-2xl"
            >
              <div className="text-slate-900">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <div className="font-bold text-lg">QUITTANCE DE LOYER</div>
                    <div className="text-sm text-slate-500">Janvier 2026</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">SCI Immobilier</div>
                    <div className="text-sm text-slate-500">12 rue de la Paix, Paris</div>
                  </div>
                </div>

                <div className="border-t border-b border-slate-200 py-4 mb-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Locataire :</span>
                      <span className="ml-2 font-medium">M. Jean Dupont</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Adresse :</span>
                      <span className="ml-2 font-medium">15 avenue Victor Hugo, Lyon</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex justify-between">
                    <span>Loyer</span>
                    <span className="font-medium">850,00 €</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Charges</span>
                    <span className="font-medium">75,00 €</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                    <span className="font-bold">Total reçu</span>
                    <span className="font-bold text-emerald-600">925,00 €</span>
                  </div>
                </div>

                <div className="text-xs text-slate-500">
                  Document conforme à la loi ALUR du 24 mars 2014
                </div>
              </div>
            </motion.div>
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-amber-900/50 to-orange-900/50 rounded-3xl p-12 border border-amber-500/30"
          >
            <Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Automatisez vos quittances dès aujourd'hui
            </h2>
            <p className="text-slate-300 mb-8">
              Plus jamais d'oublis. Plus de locataires qui attendent. Configurez en 5 minutes.
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
