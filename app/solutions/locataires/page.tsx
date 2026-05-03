"use client";

/**
 * Page Solution: Locataires & colocataires
 *
 * Persona: Léa, 28 ans, locataire (parfois colocataire), veut payer en
 * 2 clics, retrouver ses quittances, signer un bail à distance,
 * connaître ses droits.
 * SEO: Cible "espace locataire", "payer loyer en ligne", "quittance loyer"
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
  CreditCard,
  Receipt,
  Wrench,
  ShieldCheck,
  FileSignature,
  Sparkles,
  Heart,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  Calendar,
  Scale,
} from "lucide-react";

const PAIN_POINTS = [
  {
    icon: AlertTriangle,
    title: "« Je perds mes quittances »",
    solution:
      "Toutes vos quittances et votre bail sont archivés à vie dans votre espace. Téléchargeables en PDF en 2 clics, prêts pour vos démarches (CAF, impôts, banque).",
  },
  {
    icon: AlertTriangle,
    title: "« Je ne sais pas quoi faire en cas de problème »",
    solution:
      "Un robinet qui fuit, une chaudière en panne ? Signalez-le en 30 secondes avec photo. Le bailleur reçoit la notif et peut envoyer un artisan directement.",
  },
  {
    icon: AlertTriangle,
    title: "« Je veux connaître mes droits »",
    solution:
      "Espace « Mes droits de locataire » intégré : protocoles, lettres types, calculateurs (préavis, IRL, dépôt de garantie). Mis à jour avec la loi.",
  },
];

const FEATURES_LOCATAIRES = [
  {
    icon: CreditCard,
    title: "Payer son loyer en 2 clics",
    description:
      "Carte bancaire, prélèvement automatique SEPA, virement. Confirmation instantanée. Plus de chèque, plus d’oubli.",
  },
  {
    icon: Receipt,
    title: "Quittances reçues automatiquement",
    description:
      "Dès le paiement validé, votre quittance ALUR vous est envoyée par email et archivée. Toutes consultables à tout moment.",
  },
  {
    icon: FileSignature,
    title: "Signer son bail à distance",
    description:
      "Bail, avenant, état des lieux : tout se signe par téléphone avec valeur légale d’un original papier. Aucun déplacement.",
  },
  {
    icon: Wrench,
    title: "Signaler un incident en 30 sec",
    description:
      "Photo, description, urgence : votre demande arrive directement au bailleur ou au syndic. Suivi en temps réel jusqu’à résolution.",
  },
  {
    icon: Scale,
    title: "Mes droits de locataire",
    description:
      "Calculateurs (préavis, IRL, charges, dépôt), modèles de lettres et FAQ juridique alimentés par notre IA TALO. À jour de la loi.",
  },
  {
    icon: Users,
    title: "Colocation simplifiée",
    description:
      "Quote-part de loyer par colocataire, paiements individuels, clause de solidarité claire, départ d’un colocataire géré sereinement.",
  },
];

const RIGHTS_TOPICS = [
  { label: "Calcul du préavis", desc: "Zone tendue, mutation, raison de santé" },
  { label: "Révision IRL", desc: "Vérifiez l’augmentation autorisée" },
  { label: "Régularisation des charges", desc: "Que peut vraiment refacturer le bailleur ?" },
  { label: "Dépôt de garantie", desc: "Délais et déductions autorisées" },
  { label: "Réparations locatives", desc: "Liste précise loi de 1987" },
  { label: "Modèles de lettres", desc: "Préavis, contestation, mise en demeure" },
];

const TESTIMONIAL = {
  quote:
    "J’avais perdu mes 3 dernières quittances pour un dossier banque. Sur Talok, je les ai retrouvées en 10 secondes. Et je signale les problèmes sans attendre que mon proprio décroche.",
  author: "Léa M.",
  location: "Saint-Denis, La Réunion",
  context: "Locataire d’un T2",
};

export default function LocatairesPage() {
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
              <Users className="w-3 h-3 mr-1" />
              Pour les locataires &amp; colocataires
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Votre logement,{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                sous contrôle
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
              Payez votre loyer en 2 clics, retrouvez toutes vos quittances,
              signalez un problème, signez votre bail à distance. Talok
              centralise toute votre vie de locataire.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <Link href="/auth/signup">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:opacity-90"
                >
                  Créer mon espace
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/rejoindre-logement">
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
                100 % gratuit pour le locataire
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Quittances ALUR archivées à vie
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
              Ce que les locataires nous disent
            </h2>
            <p className="text-slate-400">
              Et comment Talok règle chacun de ces points.
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
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-slate-400">
              Du paiement aux droits, sans rien oublier.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {FEATURES_LOCATAIRES.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-4 bg-slate-800/30 rounded-xl p-6 border border-slate-700/50"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-6 h-6 text-emerald-400" />
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

      {/* Mes droits de locataire */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <div className="text-center mb-12">
              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 mb-4">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Mes droits de locataire
              </Badge>
              <h2 className="text-3xl font-bold text-white mb-4">
                Vos droits, expliqués clairement
              </h2>
              <p className="text-slate-400">
                Calculateurs, lettres types, FAQ juridique. À jour de la loi
                ALUR/ELAN.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {RIGHTS_TOPICS.map((topic) => (
                <div
                  key={topic.label}
                  className="rounded-xl bg-slate-800/30 border border-slate-700/50 p-5 hover:border-cyan-500/50 transition-colors"
                >
                  <div className="font-semibold text-white text-sm mb-1">
                    {topic.label}
                  </div>
                  <div className="text-xs text-slate-400">{topic.desc}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Link href="/outils">
                <Button
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Voir tous les outils gratuits
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Colocation focus */}
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
                Colocation
              </Badge>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Conçu pour la coloc, pas adapté
            </h2>
            <p className="text-slate-300 leading-relaxed mb-6">
              Quote-part de loyer individuelle, paiements séparés, clause de
              solidarité de 6 mois conforme ALUR, départ d’un colocataire
              géré sans drame, état des lieux multiple. Talok est l’une des
              rares solutions à traiter la colocation comme un cas de
              première classe.
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-slate-300">
                <Check className="w-4 h-4 text-emerald-400" />
                Paiement individuel
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Check className="w-4 h-4 text-emerald-400" />
                Solidarité 6 mois
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Check className="w-4 h-4 text-emerald-400" />
                Quittance par colocataire
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Check className="w-4 h-4 text-emerald-400" />
                Garants invités gratuitement
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
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-emerald-400" />
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-emerald-900/50 to-cyan-900/50 rounded-3xl p-12 border border-emerald-500/30"
          >
            <Sparkles className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Votre bailleur n’est pas encore sur Talok ?
            </h2>
            <p className="text-slate-300 mb-8">
              Parlez-lui en. Il pourra créer son compte gratuit en 2 minutes
              et vous inviter dans la foulée. Vous gagnerez tous du temps.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/auth/signup">
                <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                  Créer mon espace gratuit
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
                  Une question ?
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-slate-400">
              Locataire : c’est toujours gratuit · Aucune carte bancaire requise
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
