"use client";

/**
 * Page Fonctionnalité: Signature Électronique
 *
 * SEO: Cible "signature bail électronique", "signature numérique bail"
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PenTool,
  ArrowRight,
  Check,
  Shield,
  Clock,
  Users,
  FileCheck,
  Lock,
  Globe,
  Sparkles,
  Award,
} from "lucide-react";

const FEATURES = [
  {
    icon: Shield,
    title: "Conforme eIDAS",
    description: "Nos signatures électroniques sont conformes au règlement européen eIDAS. Valeur juridique garantie.",
  },
  {
    icon: Users,
    title: "Multi-signataires",
    description: "Faites signer plusieurs parties (locataires, cautions, co-propriétaires) en parallèle ou séquentiellement.",
  },
  {
    icon: Clock,
    title: "Horodatage certifié",
    description: "Chaque signature est horodatée par une autorité de certification. Preuve irréfutable.",
  },
  {
    icon: FileCheck,
    title: "Tous types de documents",
    description: "Baux, avenants, EDL, mandats, congés... Signez tous vos documents locatifs.",
  },
  {
    icon: Lock,
    title: "Archivage sécurisé",
    description: "Documents archivés pendant 10 ans minimum. Accessibles à tout moment.",
  },
  {
    icon: Globe,
    title: "Signature à distance",
    description: "Vos signataires peuvent signer depuis n'importe où. Email ou SMS de notification.",
  },
];

const PROCESS_STEPS = [
  {
    number: "1",
    title: "Téléchargez le document",
    description: "Importez votre bail ou document à signer.",
  },
  {
    number: "2",
    title: "Ajoutez les signataires",
    description: "Email, nom, ordre de signature.",
  },
  {
    number: "3",
    title: "Envoyez l'invitation",
    description: "Les signataires reçoivent un email.",
  },
  {
    number: "4",
    title: "Récupérez le document signé",
    description: "PDF certifié avec preuves de signature.",
  },
];

const COMPLIANCE = [
  { label: "eIDAS", description: "Règlement européen" },
  { label: "RGPD", description: "Protection des données" },
  { label: "Code civil", description: "Art. 1366-1367" },
  { label: "CNIL", description: "Déclaration conforme" },
];

export default function SignatureElectroniquePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-pink-900/20 via-transparent to-transparent" />

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

            <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30 mb-4">
              <PenTool className="w-3 h-3 mr-1" />
              Signature Électronique
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Signez vos baux{" "}
              <span className="bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
                100% en ligne
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl">
              Signature électronique conforme eIDAS avec valeur juridique.
              Faites signer vos documents à distance en quelques clics.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/auth/signup">
                <Button size="lg" className="bg-gradient-to-r from-pink-600 to-rose-600 hover:opacity-90">
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

      {/* Stats Bar */}
      <section className="py-8 border-y border-slate-800 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "+30 000", label: "documents signés" },
              { value: "< 24h", label: "délai moyen signature" },
              { value: "100%", label: "valeur juridique" },
              { value: "10 ans", label: "archivage garanti" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl md:text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance Badges */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-4">
            {COMPLIANCE.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 bg-slate-800/30 rounded-full px-6 py-3 border border-slate-700/50"
              >
                <Award className="w-5 h-5 text-pink-400" />
                <div>
                  <span className="font-semibold text-white">{item.label}</span>
                  <span className="text-slate-400 ml-2 text-sm">{item.description}</span>
                </div>
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
            <p className="text-slate-400">
              4 étapes simples pour faire signer vos documents.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {PROCESS_STEPS.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                <div className="bg-slate-800/30 rounded-2xl p-6 border border-slate-700/50 h-full text-center">
                  <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center mb-4 mx-auto">
                    <span className="text-xl font-bold text-pink-400">{step.number}</span>
                  </div>
                  <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-400">{step.description}</p>
                </div>
                {index < PROCESS_STEPS.length - 1 && (
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
                <Card className="h-full bg-slate-800/30 border-slate-700/50 hover:border-pink-500/50 transition-colors">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-pink-400" />
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

      {/* Legal Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-pink-900/30 to-rose-900/30 rounded-3xl p-8 md:p-12 border border-pink-500/20"
            >
              <div className="flex items-start gap-6">
                <Shield className="w-12 h-12 text-pink-400 flex-shrink-0" />
                <div>
                  <h3 className="text-2xl font-bold text-white mb-4">
                    Valeur juridique garantie
                  </h3>
                  <p className="text-slate-300 mb-6">
                    La signature électronique Talok est conforme au règlement européen eIDAS
                    (Electronic IDentification, Authentication and trust Services) et aux
                    articles 1366 et 1367 du Code civil français. Elle a la même valeur
                    juridique qu'une signature manuscrite.
                  </p>
                  <ul className="space-y-2">
                    {[
                      "Signature avancée eIDAS niveau 2",
                      "Horodatage qualifié par autorité certifiée",
                      "Fichier de preuves détaillé",
                      "Archivage 10 ans conforme",
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
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-pink-900/50 to-rose-900/50 rounded-3xl p-12 border border-pink-500/30"
          >
            <Sparkles className="w-12 h-12 text-pink-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Faites signer votre premier bail en ligne
            </h2>
            <p className="text-slate-300 mb-8">
              2 signatures incluses dans le plan Confort. Testez gratuitement.
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
