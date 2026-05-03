"use client";

/**
 * Page Solution: Garants
 *
 * Persona: Patricia, 58 ans, parente d'un étudiant locataire. Veut
 * comprendre son engagement, recevoir les quittances, suivre les paiements,
 * être alertée en cas de retard mais pas paniquée pour rien.
 * SEO: Cible "espace garant", "caution solidaire bail", "engagement de caution"
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ShieldCheck,
  ArrowRight,
  Check,
  FileSignature,
  Bell,
  Eye,
  FileCheck,
  Sparkles,
  Heart,
  AlertTriangle,
  Lightbulb,
  Scale,
  Users,
  MessageSquare,
} from "lucide-react";

const PAIN_POINTS = [
  {
    icon: AlertTriangle,
    title: "« Je ne sais pas vraiment à quoi je m’engage »",
    solution:
      "Talok vous présente l’acte de cautionnement avec ses montants, sa durée et ses limites avant signature. Toutes les mentions légales sont expliquées en français clair.",
  },
  {
    icon: AlertTriangle,
    title: "« Je n’ai aucune visibilité sur les paiements »",
    solution:
      "Tableau de bord temps réel : loyer payé / en retard, période actuelle, solde courant. Pas besoin de demander au locataire.",
  },
  {
    icon: AlertTriangle,
    title: "« Je découvre les problèmes trop tard »",
    solution:
      "Alerte dès qu’un loyer est en retard de 5 jours, avant que la situation se dégrade. Vous pouvez réagir tôt avec le locataire.",
  },
];

const FEATURES_GARANTS = [
  {
    icon: FileSignature,
    title: "Signer l’acte de cautionnement à distance",
    description:
      "Acte conforme au Code civil, mentions manuscrites guidées, signature électronique avec valeur légale. Reçu en PDF immédiatement.",
  },
  {
    icon: Eye,
    title: "Suivre les loyers en temps réel",
    description:
      "Tableau de bord avec statut de chaque période : payée, en retard, contestée. Aucune surprise, vous voyez tout.",
  },
  {
    icon: Bell,
    title: "Alertes intelligentes",
    description:
      "Notification dès qu’un loyer est en retard significatif. Pas de spam : vous n’êtes prévenu que quand c’est important.",
  },
  {
    icon: FileCheck,
    title: "Documents centralisés",
    description:
      "Acte de caution, bail, avenants et quittances de loyer accessibles à vie. Pratique pour les démarches bancaires ou administratives.",
  },
];

const RIGHTS_INFO = [
  {
    title: "Durée de votre engagement",
    desc: "L’acte précise une durée déterminée ou indéterminée. Talok l’affiche en haut de votre tableau de bord.",
  },
  {
    title: "Plafond de votre engagement",
    desc: "Montant maximum que vous pouvez avoir à payer (loyers + charges + indemnités). Toujours visible.",
  },
  {
    title: "Résiliation",
    desc: "Vous pouvez résilier un cautionnement indéterminé à tout moment, par lettre recommandée. Modèle inclus.",
  },
  {
    title: "Mentions obligatoires",
    desc: "L’acte respecte les articles 22-1 et 2297 : montant en chiffres et lettres, durée, étendue.",
  },
];

const TESTIMONIAL = {
  quote:
    "Mon fils est étudiant à Lille. Avant Talok, je le harcelais le 10 du mois pour savoir s’il avait payé. Maintenant je vois directement dans l’app. Et je sais exactement ce que je risque.",
  author: "Patricia G.",
  location: "Pointe-à-Pitre, Guadeloupe",
  context: "Garante de son fils étudiant",
};

export default function GarantsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto text-center"
          >
            <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 mb-4">
              <ShieldCheck className="w-3 h-3 mr-1" />
              Pour les garants
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Vous vous portez garant ?{" "}
              <span className="bg-gradient-to-r from-sky-400 to-blue-400 bg-clip-text text-transparent">
                Restez en contrôle
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
              Comprenez votre engagement, suivez les paiements de la
              personne que vous cautionnez, et soyez alerté tôt en cas de
              difficulté. Sans pour autant être harcelé pour rien.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <Link href="/auth/signup?role=guarantor">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-sky-600 to-blue-600 hover:opacity-90"
                >
                  Créer mon espace garant
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/invite">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  J’ai reçu une invitation
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                100 % gratuit pour le garant
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Acte de caution conforme
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Visibilité temps réel
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
              Les vraies inquiétudes du garant
            </h2>
            <p className="text-slate-400">
              Et la transparence que Talok apporte.
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
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4">
                      <point.icon className="w-6 h-6 text-amber-400" />
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
              Votre tableau de bord garant
            </h2>
            <p className="text-slate-400">
              Tout ce qu’il faut pour exercer sereinement votre rôle.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {FEATURES_GARANTS.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-4 bg-slate-800/30 rounded-xl p-6 border border-slate-700/50"
              >
                <div className="w-12 h-12 rounded-xl bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-6 h-6 text-sky-400" />
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

      {/* Vos droits */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <div className="text-center mb-12">
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 mb-4">
                <Scale className="w-3 h-3 mr-1" />
                Vos droits expliqués
              </Badge>
              <h2 className="text-3xl font-bold text-white mb-4">
                Engagement clair, sans piège
              </h2>
              <p className="text-slate-400">
                Toutes les informations légales que vous devez connaître,
                rappelées dans votre tableau de bord.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {RIGHTS_INFO.map((info) => (
                <div
                  key={info.title}
                  className="rounded-xl bg-slate-800/30 border border-slate-700/50 p-5"
                >
                  <div className="font-semibold text-white text-sm mb-1">
                    {info.title}
                  </div>
                  <div className="text-xs text-slate-400 leading-relaxed">
                    {info.desc}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
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
            <Heart className="w-12 h-12 text-pink-400 mx-auto mb-6" />
            <blockquote className="text-2xl text-white mb-6 leading-relaxed">
              « {TESTIMONIAL.quote} »
            </blockquote>
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full bg-sky-500/20 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-sky-400" />
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-sky-900/50 to-blue-900/50 rounded-3xl p-12 border border-sky-500/30"
          >
            <Sparkles className="w-12 h-12 text-sky-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Vous avez reçu une invitation à vous porter garant ?
            </h2>
            <p className="text-slate-300 mb-8">
              Activez votre espace en 2 minutes. Vous pourrez relire l’acte
              avant de le signer, et garder un œil sur les paiements en
              continu.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/invite">
                <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                  Activer mon invitation
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Une question juridique ?
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-400">
              Garant : c’est toujours gratuit · Aucune carte bancaire
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
