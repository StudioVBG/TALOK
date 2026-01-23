"use client";

/**
 * Page Solution: Propriétaires Particuliers
 *
 * Persona: Marie, 45 ans, 2 biens, première location, peur des erreurs
 * SEO: Cible "logiciel gestion locative particulier"
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Home,
  ArrowRight,
  Check,
  Shield,
  Clock,
  Euro,
  FileText,
  Sparkles,
  Heart,
  AlertTriangle,
  Lightbulb,
  Users,
} from "lucide-react";

const PAIN_POINTS = [
  {
    icon: AlertTriangle,
    title: "\"Je ne sais pas par où commencer\"",
    solution: "Talok vous guide étape par étape : création du bail, états des lieux, quittances. Impossible de se tromper.",
  },
  {
    icon: Euro,
    title: "\"Les agences prennent 8%, c'est trop\"",
    solution: "Avec Talok, gérez vous-même pour 9€/mois. Économisez jusqu'à 2 000€/an.",
  },
  {
    icon: FileText,
    title: "\"J'ai peur de faire des erreurs juridiques\"",
    solution: "Tous nos documents sont conformes ALUR, rédigés par des juristes. Mise à jour automatique.",
  },
];

const FEATURES_FOR_PARTICULIERS = [
  {
    icon: FileText,
    title: "Baux conformes clé en main",
    description: "Créez votre bail en 10 minutes. Toutes les clauses obligatoires incluses.",
  },
  {
    icon: Clock,
    title: "Quittances automatiques",
    description: "Plus d'oublis. La quittance part chaque mois sans que vous ayez à y penser.",
  },
  {
    icon: Shield,
    title: "États des lieux professionnels",
    description: "Application mobile avec photos. Fini les litiges à la sortie.",
  },
  {
    icon: Euro,
    title: "Suivi des loyers simplifié",
    description: "Voyez en un coup d'œil qui a payé, qui est en retard.",
  },
];

const TESTIMONIAL = {
  quote: "J'avais hérité de 2 appartements et je ne savais pas comment gérer. Avec Talok, j'ai tout configuré en une soirée. Les quittances partent toutes seules, c'est magique !",
  author: "Marie L.",
  location: "Fort-de-France, Martinique",
  properties: "2 appartements",
};

const SAVINGS = [
  { label: "Agence traditionnelle", cost: "8% des loyers", annual: "~2 400€/an" },
  { label: "Talok Essentiel", cost: "9€/mois", annual: "108€/an", highlight: true },
];

export default function ProprietairesParticuliersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto text-center"
          >
            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 mb-4">
              <Home className="w-3 h-3 mr-1" />
              Pour les propriétaires particuliers
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Gérez vos locations{" "}
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                sans stress
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
              Vous avez 1, 2 ou 3 biens à louer ? Talok est fait pour vous.
              Simple à utiliser, conforme à la loi, et bien moins cher qu'une agence.
            </p>

            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <Link href="/auth/signup">
                <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90">
                  Essayer gratuitement
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  À partir de 9€/mois
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                14 jours d'essai gratuit
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Sans carte bancaire
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Support en français
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
              On comprend vos inquiétudes
            </h2>
            <p className="text-slate-400">
              Ce sont les mêmes que celles de nos 10 000+ propriétaires.
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
              Ce que Talok fait pour vous
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {FEATURES_FOR_PARTICULIERS.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-4 bg-slate-800/30 rounded-xl p-6 border border-slate-700/50"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                  <p className="text-sm text-slate-400">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Savings Comparison */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">
                Économisez jusqu'à 2 000€/an
              </h2>
              <p className="text-slate-400">
                Pour un loyer de 800€/mois, voici ce que vous payez :
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {SAVINGS.map((option) => (
                <div
                  key={option.label}
                  className={`rounded-2xl p-6 border ${
                    option.highlight
                      ? "bg-gradient-to-br from-indigo-900/50 to-violet-900/50 border-indigo-500/50"
                      : "bg-slate-800/30 border-slate-700/50"
                  }`}
                >
                  <h3 className="font-semibold text-white mb-4">{option.label}</h3>
                  <div className="text-3xl font-bold text-white mb-1">{option.cost}</div>
                  <div className={option.highlight ? "text-indigo-300" : "text-slate-400"}>
                    {option.annual}
                  </div>
                  {option.highlight && (
                    <Badge className="mt-4 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                      Économie : ~2 300€/an
                    </Badge>
                  )}
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
              "{TESTIMONIAL.quote}"
            </blockquote>
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-indigo-400" />
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-indigo-900/50 to-violet-900/50 rounded-3xl p-12 border border-indigo-500/30"
          >
            <Sparkles className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Prêt à gérer vos locations sereinement ?
            </h2>
            <p className="text-slate-300 mb-8">
              Créez votre compte en 2 minutes. Ajoutez votre premier bien.
              Les quittances partent toutes seules.
            </p>
            <Link href="/auth/signup">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                Créer mon compte gratuit
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <p className="mt-4 text-sm text-slate-400">
              14 jours gratuits · Sans engagement · Support inclus
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
