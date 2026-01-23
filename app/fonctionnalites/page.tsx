"use client";

/**
 * Page Index Fonctionnalités
 *
 * SEO: Cible "outil gestion locative", "fonctionnalités logiciel gestion"
 * Objectif: Présenter toutes les fonctionnalités et rediriger vers pages détails
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  Users,
  ClipboardCheck,
  Receipt,
  Calculator,
  PenTool,
  CreditCard,
  ArrowRight,
  Check,
  Sparkles,
  Shield,
  Clock,
  Zap,
} from "lucide-react";
import { PublicFooter } from "@/components/layout/public-footer";

const FEATURES = [
  {
    slug: "gestion-biens",
    title: "Gestion des Biens",
    description: "Centralisez tous vos biens immobiliers en un seul endroit. Photos, documents, historique.",
    icon: Building2,
    gradient: "from-blue-500 to-indigo-600",
    highlights: [
      "Fiches biens complètes avec photos",
      "Historique des travaux et interventions",
      "Documents et diagnostics centralisés",
      "Alertes échéances automatiques",
    ],
    stats: { label: "biens gérés", value: "+50 000" },
  },
  {
    slug: "gestion-locataires",
    title: "Gestion des Locataires",
    description: "Suivez vos locataires, leurs paiements et leur historique depuis un tableau de bord unifié.",
    icon: Users,
    gradient: "from-emerald-500 to-teal-600",
    highlights: [
      "Scoring IA des candidats",
      "Dossiers locataires complets",
      "Historique des échanges",
      "Portail locataire dédié",
    ],
    stats: { label: "locataires actifs", value: "+25 000" },
  },
  {
    slug: "etats-des-lieux",
    title: "États des Lieux",
    description: "Réalisez des états des lieux numériques complets depuis votre mobile ou tablette.",
    icon: ClipboardCheck,
    gradient: "from-violet-500 to-purple-600",
    highlights: [
      "Application mobile intuitive",
      "Photos horodatées et géolocalisées",
      "Signature électronique sur place",
      "PDF généré instantanément",
    ],
    stats: { label: "EDL réalisés", value: "+15 000" },
  },
  {
    slug: "quittances-loyers",
    title: "Quittances de Loyer",
    description: "Générez et envoyez automatiquement les quittances chaque mois. Zéro effort.",
    icon: Receipt,
    gradient: "from-amber-500 to-orange-600",
    highlights: [
      "Envoi automatique chaque mois",
      "Conformes à la loi ALUR",
      "Historique complet",
      "Relances impayés automatiques",
    ],
    stats: { label: "quittances/mois", value: "+100 000" },
  },
  {
    slug: "comptabilite-fiscalite",
    title: "Comptabilité & Fiscalité",
    description: "Simplifiez votre déclaration fiscale avec des exports 2044 et FEC prêts à l'emploi.",
    icon: Calculator,
    gradient: "from-cyan-500 to-blue-600",
    highlights: [
      "Export déclaration 2044",
      "Fichier FEC comptable",
      "Suivi charges et dépenses",
      "Rapports personnalisés",
    ],
    stats: { label: "déclarations simplifiées", value: "+8 000" },
  },
  {
    slug: "signature-electronique",
    title: "Signature Électronique",
    description: "Faites signer vos baux et documents à distance en quelques clics. Valeur juridique garantie.",
    icon: PenTool,
    gradient: "from-pink-500 to-rose-600",
    highlights: [
      "Conforme eIDAS",
      "Valeur juridique garantie",
      "Signature multi-parties",
      "Horodatage certifié",
    ],
    stats: { label: "documents signés", value: "+30 000" },
  },
  {
    slug: "paiements-en-ligne",
    title: "Paiements en Ligne",
    description: "Recevez les loyers par CB ou prélèvement SEPA. Réconciliation bancaire automatique.",
    icon: CreditCard,
    gradient: "from-green-500 to-emerald-600",
    highlights: [
      "Paiement CB et SEPA",
      "Prélèvement automatique",
      "Réconciliation bancaire",
      "Open Banking intégré",
    ],
    stats: { label: "transactions/mois", value: "+2M€" },
  },
];

const BENEFITS = [
  {
    icon: Clock,
    title: "Gagnez 5h/mois",
    description: "Automatisez les tâches répétitives : quittances, relances, révisions IRL.",
  },
  {
    icon: Shield,
    title: "Conformité garantie",
    description: "Documents conformes loi ALUR, signatures eIDAS, RGPD respecté.",
  },
  {
    icon: Zap,
    title: "Prise en main rapide",
    description: "Interface intuitive. Opérationnel en moins de 10 minutes.",
  },
];

export default function FonctionnalitesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 mb-4">
              <Sparkles className="w-3 h-3 mr-1" />
              Tout-en-un pour la gestion locative
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Toutes les fonctionnalités pour{" "}
              <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                gérer vos locations
              </span>
            </h1>
            <p className="text-lg text-slate-400 mb-8">
              De la création du bail à l'encaissement des loyers, Talok automatise
              votre gestion locative. Simple, complet, conforme.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/auth/signup">
                <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:opacity-90">
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

      {/* Benefits Bar */}
      <section className="py-12 border-y border-slate-800 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {BENEFITS.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <benefit.icon className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{benefit.title}</h3>
                  <p className="text-sm text-slate-400">{benefit.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={feature.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={`/fonctionnalites/${feature.slug}`}>
                  <Card className="h-full bg-slate-800/30 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/50 transition-all duration-300 group cursor-pointer">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                          <feature.icon className="w-6 h-6 text-white" />
                        </div>
                        <Badge className="bg-slate-700/50 text-slate-300 border-slate-600">
                          {feature.stats.value}
                        </Badge>
                      </div>
                      <CardTitle className="text-xl text-white group-hover:text-indigo-300 transition-colors">
                        {feature.title}
                      </CardTitle>
                      <CardDescription className="text-slate-400">
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {feature.highlights.slice(0, 3).map((highlight, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            {highlight}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 flex items-center text-indigo-400 text-sm font-medium group-hover:text-indigo-300">
                        En savoir plus
                        <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-indigo-900/50 to-cyan-900/50 rounded-3xl p-12 border border-indigo-500/30"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Prêt à simplifier votre gestion locative ?
            </h2>
            <p className="text-slate-300 mb-8">
              Rejoignez +10 000 propriétaires qui gagnent du temps avec Talok.
              Premier mois offert, sans engagement.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/signup">
                <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                  Créer mon compte gratuit
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
                  Comparer les forfaits
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter variant="dark" />
    </div>
  );
}
