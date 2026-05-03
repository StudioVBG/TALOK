"use client";

/**
 * Page Solution: Prestataires & artisans
 *
 * Persona: Karl, plombier indépendant en Martinique, veut recevoir des
 * missions, envoyer des devis pro, facturer en ligne, gérer son planning,
 * être visible auprès de centaines de bailleurs.
 * SEO: Cible "logiciel artisan plombier", "marketplace prestataires bâtiment"
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wrench,
  ArrowRight,
  Check,
  Calendar,
  FileText,
  Banknote,
  Star,
  Briefcase,
  Sparkles,
  Heart,
  AlertTriangle,
  Lightbulb,
  ShieldCheck,
  Users,
  TrendingUp,
} from "lucide-react";

const PAIN_POINTS = [
  {
    icon: AlertTriangle,
    title: "« Je perds des heures à courir après les paiements »",
    solution:
      "Devis signé en ligne, facture envoyée à la fin du chantier, paiement par CB ou virement directement dans Talok. Vous êtes payé plus vite, sans relance.",
  },
  {
    icon: AlertTriangle,
    title: "« Je dois trouver mes clients moi-même »",
    solution:
      "Inscrivez-vous au catalogue Talok. Plus de 10 000 bailleurs et syndics vous voient quand un ticket correspond à votre métier et votre zone.",
  },
  {
    icon: AlertTriangle,
    title: "« Mon agenda est un fichier Excel chaotique »",
    solution:
      "Planning visuel avec créneaux, rappels SMS automatiques aux clients, vue d’ensemble des chantiers en cours. Tout sur le téléphone.",
  },
];

const FEATURES_PRESTATAIRES = [
  {
    icon: Briefcase,
    title: "Recevoir des missions ciblées",
    description:
      "Bailleurs et syndics envoient des tickets adaptés à votre métier, votre zone et vos disponibilités. Plus de prospection à froid.",
  },
  {
    icon: FileText,
    title: "Devis & factures en 5 minutes",
    description:
      "Modèles pros pré-remplis, signature électronique, conversion devis → facture en un clic. Numérotation et archivage automatiques.",
  },
  {
    icon: Calendar,
    title: "Planning & rendez-vous",
    description:
      "Calendrier des interventions, rappels SMS au client, gestion des urgences. Synchronisation Google Calendar / iCloud.",
  },
  {
    icon: Banknote,
    title: "Encaisser plus vite",
    description:
      "Paiement par CB ou virement directement après facturation. Versement rapide. Suivi des impayés intégré.",
  },
  {
    icon: ShieldCheck,
    title: "Conformité & assurances",
    description:
      "Stockez attestation décennale, RC pro, Kbis, URSSAF. Renouvellement signalé automatiquement avant expiration.",
  },
  {
    icon: Star,
    title: "Avis & portfolio",
    description:
      "Chaque mission notée alimente votre profil public. Photos avant/après pour montrer la qualité de votre travail.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Inscription en 5 min",
    desc: "Métier, zone d’intervention, photos, attestation décennale. Validation sous 24 h.",
  },
  {
    n: "2",
    title: "Recevez des tickets",
    desc: "Notifications quand un bien dans votre zone a besoin de votre métier.",
  },
  {
    n: "3",
    title: "Devis → mission → facture",
    desc: "Tout dans Talok, avec signature et paiement intégrés.",
  },
  {
    n: "4",
    title: "Notation client",
    desc: "L’avis du bailleur ou du locataire booste votre profil.",
  },
];

const TESTIMONIAL = {
  quote:
    "Avant Talok, je passais une heure le soir à faire mes devis sur Word et mes factures sur un autre logiciel. Maintenant tout est dans la poche, et les bailleurs me trouvent au lieu de l’inverse.",
  author: "Karl D.",
  location: "Le Lamentin, Martinique",
  context: "Plombier · 12 ans d’expérience",
};

export default function PrestatairesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto text-center"
          >
            <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 mb-4">
              <Wrench className="w-3 h-3 mr-1" />
              Pour les artisans &amp; entreprises d’intervention
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Plus de chantiers,{" "}
              <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                moins de paperasse
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
              Recevez des missions adaptées à votre métier et votre zone,
              envoyez devis et factures en quelques clics, gérez votre
              planning et encaissez plus vite. Tout sur Talok, gratuit.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <Link href="/auth/signup?role=provider">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-orange-600 to-amber-600 hover:opacity-90"
                >
                  Rejoindre le catalogue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/fonctionnalites/tickets-et-travaux">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Voir comment ça marche
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Inscription gratuite
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                10 000+ bailleurs sur la plateforme
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Application iPhone &amp; Android
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
              Les vrais problèmes des artisans
            </h2>
            <p className="text-slate-400">
              Et comment Talok les résout, concrètement.
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
                      <point.icon className="w-6 h-6 text-red-400" />
                    </div>
                    <CardTitle className="text-lg text-white">
                      {point.title}
                    </CardTitle>
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

      {/* Features */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Votre logiciel d’artisan complet
            </h2>
            <p className="text-slate-400">
              Du premier contact au paiement, sans changer d’outil.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {FEATURES_PRESTATAIRES.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-4 bg-slate-800/30 rounded-xl p-6 border border-slate-700/50"
              >
                <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-400">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-5xl mx-auto"
          >
            <div className="text-center mb-12">
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 mb-4">
                <TrendingUp className="w-3 h-3 mr-1" />
                Comment ça marche
              </Badge>
              <h2 className="text-3xl font-bold text-white mb-4">
                4 étapes pour démarrer
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {STEPS.map((step) => (
                <div
                  key={step.n}
                  className="relative rounded-2xl bg-slate-800/30 border border-slate-700/50 p-6 hover:border-orange-500/50 transition-colors"
                >
                  <div className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center font-bold text-white shadow-lg">
                    {step.n}
                  </div>
                  <h3 className="font-semibold text-white mt-2 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-400">{step.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Marketplace pitch */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto rounded-3xl border border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-slate-900/40 p-8 md:p-12"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-violet-400" />
              </div>
              <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30">
                Marketplace
              </Badge>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Une marketplace française de prestataires fiables
            </h2>
            <p className="text-slate-300 leading-relaxed mb-6">
              Talok met en relation directe les bailleurs et les artisans
              vérifiés. Pas de commission cachée, pas d’intermédiaire qui
              prend sa marge : le bailleur paie ce que vous facturez. Vous
              gardez la main sur vos prix et votre relation client.
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-slate-300">
                <Check className="w-4 h-4 text-emerald-400" />
                Vos prix, vos règles
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Check className="w-4 h-4 text-emerald-400" />
                Aucune commission
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Check className="w-4 h-4 text-emerald-400" />
                Profil public optimisé SEO
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Check className="w-4 h-4 text-emerald-400" />
                Vérification documents pro
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center"
          >
            <Heart className="w-12 h-12 text-pink-400 mx-auto mb-6" />
            <blockquote className="text-2xl text-white mb-6 leading-relaxed">
              « {TESTIMONIAL.quote} »
            </blockquote>
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Wrench className="w-6 h-6 text-orange-400" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-white">
                  {TESTIMONIAL.author}
                </div>
                <div className="text-sm text-slate-400">
                  {TESTIMONIAL.location} · {TESTIMONIAL.context}
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-orange-900/50 to-amber-900/50 rounded-3xl p-12 border border-orange-500/30"
          >
            <Sparkles className="w-12 h-12 text-orange-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Prêt à recevoir vos premières missions ?
            </h2>
            <p className="text-slate-300 mb-8">
              Inscription gratuite. Aucune commission sur vos chantiers.
              Validation de votre profil sous 24 h ouvrables.
            </p>
            <Link href="/auth/signup?role=provider">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                Créer mon profil prestataire
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <p className="mt-4 text-sm text-slate-400">
              Gratuit · Sans engagement · Support en français
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
