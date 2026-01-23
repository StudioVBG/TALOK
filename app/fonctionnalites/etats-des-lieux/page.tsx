"use client";

/**
 * Page Fonctionnalité: États des Lieux
 *
 * SEO: Cible "application état des lieux", "état des lieux numérique"
 * Volume recherche: 1,200/mois
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ClipboardCheck,
  ArrowRight,
  Check,
  Camera,
  PenTool,
  Clock,
  Smartphone,
  FileText,
  MapPin,
  Sparkles,
  Download,
} from "lucide-react";

const FEATURES = [
  {
    icon: Smartphone,
    title: "Application mobile intuitive",
    description: "Réalisez vos EDL depuis votre smartphone ou tablette. Interface optimisée pour le terrain.",
  },
  {
    icon: Camera,
    title: "Photos horodatées",
    description: "Chaque photo est automatiquement horodatée et géolocalisée. Preuve irréfutable en cas de litige.",
  },
  {
    icon: PenTool,
    title: "Signature sur place",
    description: "Le locataire signe directement sur l'écran. Signature électronique conforme eIDAS.",
  },
  {
    icon: FileText,
    title: "PDF instantané",
    description: "Le document PDF est généré immédiatement et envoyé par email aux deux parties.",
  },
  {
    icon: Clock,
    title: "Modèles personnalisables",
    description: "Adaptez les grilles d'inspection à vos besoins. Sauvegardez vos modèles.",
  },
  {
    icon: MapPin,
    title: "Comparaison entrée/sortie",
    description: "Comparez facilement l'état d'entrée et de sortie. Identifiez les dégradations.",
  },
];

const STEPS = [
  {
    number: "1",
    title: "Préparez l'EDL",
    description: "Sélectionnez le bien et le locataire. Choisissez votre modèle.",
  },
  {
    number: "2",
    title: "Inspectez sur place",
    description: "Parcourez chaque pièce. Notez l'état. Prenez des photos.",
  },
  {
    number: "3",
    title: "Faites signer",
    description: "Le locataire et vous signez sur l'écran. C'est instantané.",
  },
  {
    number: "4",
    title: "Partagez le document",
    description: "Le PDF est envoyé automatiquement. Archivé dans Talok.",
  },
];

export default function EtatDesLieuxPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent" />

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

            <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 mb-4">
              <ClipboardCheck className="w-3 h-3 mr-1" />
              États des Lieux
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              États des lieux{" "}
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                numériques et conformes
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl">
              Réalisez des états des lieux professionnels depuis votre mobile.
              Photos horodatées, signature électronique, PDF instantané.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/auth/signup">
                <Button size="lg" className="bg-gradient-to-r from-violet-600 to-purple-600 hover:opacity-90">
                  Essayer gratuitement
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/modeles/etat-des-lieux">
                <Button size="lg" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                  <Download className="w-4 h-4 mr-2" />
                  Voir le modèle gratuit
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
              { value: "+15 000", label: "EDL réalisés" },
              { value: "15 min", label: "temps moyen" },
              { value: "100%", label: "conformes ALUR" },
              { value: "0€", label: "impression papier" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl md:text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Steps */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Comment ça marche ?
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Un processus simple en 4 étapes pour des états des lieux professionnels.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {STEPS.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 h-full">
                  <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center mb-4">
                    <span className="text-xl font-bold text-violet-400">{step.number}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-400">{step.description}</p>
                </div>
                {index < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2">
                    <ArrowRight className="w-6 h-6 text-slate-600" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-slate-900/50">
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
                <Card className="h-full bg-slate-800/30 border-slate-700/50 hover:border-violet-500/50 transition-colors">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-violet-400" />
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

      {/* Comparison Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <h2 className="text-3xl font-bold text-white text-center mb-12">
              EDL papier vs EDL Talok
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50">
                <h3 className="text-lg font-semibold text-slate-400 mb-4">EDL papier ❌</h3>
                <ul className="space-y-3">
                  {[
                    "Formulaires à imprimer",
                    "Photos à coller manuellement",
                    "Signature sur papier uniquement",
                    "Scan et envoi par email",
                    "Archivage papier",
                    "Comparaison difficile",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-slate-400">
                      <span className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-gradient-to-br from-violet-900/30 to-purple-900/30 rounded-2xl p-6 border border-violet-500/30">
                <h3 className="text-lg font-semibold text-violet-300 mb-4">EDL Talok ✅</h3>
                <ul className="space-y-3">
                  {[
                    "Application mobile intuitive",
                    "Photos horodatées et géolocalisées",
                    "Signature électronique sur place",
                    "PDF envoyé automatiquement",
                    "Archivage cloud sécurisé",
                    "Comparaison entrée/sortie en 1 clic",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-slate-300">
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

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-violet-900/50 to-purple-900/50 rounded-3xl p-12 border border-violet-500/30"
          >
            <Sparkles className="w-12 h-12 text-violet-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Réalisez votre premier EDL numérique
            </h2>
            <p className="text-slate-300 mb-8">
              Essayez gratuitement pendant 14 jours. Aucune carte bancaire requise.
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
