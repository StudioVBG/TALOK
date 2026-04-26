"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  ArrowRight,
  Check,
  PenTool,
  RefreshCw,
  Home,
  Users,
  Shield,
  Sparkles,
  Calendar,
  FileSignature,
} from "lucide-react";

const FEATURES = [
  {
    icon: FileText,
    title: "Modèles conformes à la loi",
    description:
      "Baux non-meublé, meublé, colocation, bail mobilité, bail commercial. Mis à jour à chaque évolution ALUR/ELAN.",
  },
  {
    icon: PenTool,
    title: "Clauses personnalisables",
    description:
      "Bibliothèque de clauses (animaux, travaux, sous-location…). Ajoutez vos propres clauses, sauvegardez vos modèles.",
  },
  {
    icon: FileSignature,
    title: "Signature électronique à valeur légale",
    description:
      "Bail signé en 5 minutes par tous les signataires. Même valeur qu'un original papier (eIDAS qualifié).",
  },
  {
    icon: Calendar,
    title: "Révision IRL automatique",
    description:
      "Augmentation annuelle calculée selon l'indice INSEE. Avenant généré et envoyé automatiquement à la date anniversaire.",
  },
  {
    icon: RefreshCw,
    title: "Renouvellements & avenants",
    description:
      "Tacite reconduction, renouvellement avec changement de durée, avenant de baisse de loyer : tout est guidé.",
  },
  {
    icon: Shield,
    title: "Archivage 10 ans",
    description:
      "Baux signés archivés dans un coffre-fort chiffré, conformité RGPD, horodatage certifié, téléchargement en 1 clic.",
  },
];

const BAIL_TYPES = [
  { label: "Non-meublé (loi 89)", icon: Home },
  { label: "Meublé (loi 89)", icon: Home },
  { label: "Colocation solidaire", icon: Users },
  { label: "Bail mobilité (1-10 mois)", icon: Calendar },
  { label: "Bail étudiant (9 mois)", icon: Users },
  { label: "Saisonnier courte durée", icon: Calendar },
];

const STEPS = [
  {
    n: "1",
    title: "Choisissez le type de bail",
    description: "Sélectionnez un modèle (non-meublé, meublé, mobilité…) adapté à votre situation.",
  },
  {
    n: "2",
    title: "Complétez les informations",
    description: "Bien, parties, loyer, charges, dépôt : tout est pré-rempli depuis votre dossier Talok.",
  },
  {
    n: "3",
    title: "Envoyez à la signature",
    description: "Tous les signataires reçoivent un email, signent depuis leur mobile en 2 minutes.",
  },
  {
    n: "4",
    title: "Bail signé, archivé, actif",
    description: "Loyer activé, quittances générées, locataire invité à son espace. Zéro paperasse.",
  },
];

export default function GestionDesBauxPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <Link
              href="/fonctionnalites"
              className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors"
            >
              <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
              Toutes les fonctionnalités
            </Link>

            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 mb-4">
              <FileText className="w-3 h-3 mr-1" />
              Gestion des baux
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Des baux conformes,{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                signés en 5 minutes
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl">
              Modèles ALUR/ELAN toujours à jour avec la loi. Signature électronique à valeur légale,
              révision IRL automatique, renouvellements guidés.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/essai-gratuit">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:opacity-90"
                >
                  Essayer gratuitement
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Voir les tarifs
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-8 border-y border-slate-800 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "5 min", label: "pour signer un bail" },
              { value: "100 %", label: "conforme ALUR" },
              { value: "6", label: "types de bail" },
              { value: "10 ans", label: "d'archivage" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl md:text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Types de baux */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">Tous les types de baux couverts</h2>
            <p className="text-slate-400">
              Quel que soit votre bien et votre locataire, Talok a le modèle qu'il faut.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {BAIL_TYPES.map((b, i) => (
              <motion.div
                key={b.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 bg-slate-800/30 rounded-xl p-4 border border-slate-700/50"
              >
                <b.icon className="w-5 h-5 text-blue-400 shrink-0" />
                <span className="text-slate-300 text-sm font-medium">{b.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Process steps */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">Un bail, 4 étapes</h2>
            <p className="text-slate-400">De la création à l'activation, tout est guidé.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative"
              >
                <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 h-full">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold mb-4">
                    {step.n}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-slate-400 text-sm">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-white mb-4">Toutes les fonctionnalités</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="h-full bg-slate-800/30 border-slate-700/50 hover:border-blue-500/50 transition-colors">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
                      <f.icon className="w-6 h-6 text-blue-400" />
                    </div>
                    <CardTitle className="text-white">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-400">{f.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Legal value highlight */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 rounded-3xl p-8 md:p-12 border border-blue-500/20 max-w-4xl mx-auto"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <Badge className="bg-blue-500/30 text-blue-300 border-blue-500/30 mb-4">
                  <Shield className="w-3 h-3 mr-1" />
                  Valeur légale garantie
                </Badge>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Un bail signé sur Talok = un bail opposable en justice
                </h2>
                <p className="text-slate-300 mb-6">
                  Notre signature électronique a la même valeur juridique qu'un original papier.
                  Nous utilisons un prestataire qualifié (eIDAS), avec horodatage certifié et
                  preuve d'identité renforcée.
                </p>
                <ul className="space-y-3">
                  {[
                    "Signature électronique qualifiée eIDAS",
                    "Identité des signataires vérifiée",
                    "Horodatage et scellement certifiés",
                    "Dossier de preuve complet en cas de litige",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-blue-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-slate-800/50 rounded-2xl p-6 text-center">
                <FileSignature className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                <p className="text-2xl font-bold text-white mb-2">Même valeur</p>
                <p className="text-slate-300">qu'un original papier</p>
                <p className="text-sm text-slate-500 mt-4">
                  Conforme règlement eIDAS (UE) n°910/2014
                </p>
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-blue-900/50 to-cyan-900/50 rounded-3xl p-12 border border-blue-500/30"
          >
            <Sparkles className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">Signez votre prochain bail sur Talok</h2>
            <p className="text-slate-300 mb-8">
              Gratuit pour 1 bien. Sans carte bancaire. Configuration en 2 minutes.
            </p>
            <Link href="/essai-gratuit">
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
