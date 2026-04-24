"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Calculator,
  TrendingUp,
  FileSignature,
  Percent,
  Receipt,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const OUTILS = [
  {
    slug: "calcul-rendement-locatif",
    title: "Calculateur de rentabilité locative",
    description:
      "Rentabilité brute, nette et nette-nette. Cash-flow mensuel, TRI, prise en compte des charges, taxe foncière, vacance locative.",
    icon: TrendingUp,
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    slug: "calcul-frais-notaire",
    title: "Calculateur de frais de notaire",
    description:
      "Estimez les frais de notaire pour votre achat : ancien (7-8 %), neuf (2-3 %), terrain. Barèmes 2026, émoluments détaillés.",
    icon: FileSignature,
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    slug: "calcul-revision-irl",
    title: "Calculateur de révision IRL",
    description:
      "Calculez la révision annuelle de votre loyer selon l'Indice de Référence des Loyers (INSEE). Conforme à la loi ALUR.",
    icon: Percent,
    gradient: "from-violet-500 to-purple-600",
  },
  {
    slug: "simulateur-charges",
    title: "Simulateur de charges locatives",
    description:
      "Estimez les charges récupérables et non-récupérables. Provisions, forfait, régularisation annuelle selon le décret 87-713.",
    icon: Receipt,
    gradient: "from-amber-500 to-orange-600",
  },
];

export default function OutilsHubPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto text-center"
          >
            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 mb-4">
              <Sparkles className="w-3 h-3 mr-1" />
              Outils gratuits
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Les bons calculs pour{" "}
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                bien investir
              </span>
            </h1>
            <p className="text-xl text-slate-400 mb-8">
              4 calculateurs gratuits pour propriétaires bailleurs. Sans inscription, sans engagement,
              mis à jour avec les barèmes et indices 2026.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Outils Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {OUTILS.map((outil, index) => (
              <motion.div
                key={outil.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={`/outils/${outil.slug}`} className="block h-full">
                  <Card className="h-full bg-slate-800/30 border-slate-700/50 hover:border-blue-500/50 transition-colors group">
                    <CardHeader>
                      <div
                        className={`w-14 h-14 rounded-xl bg-gradient-to-br ${outil.gradient} flex items-center justify-center mb-4`}
                      >
                        <outil.icon className="w-7 h-7 text-white" />
                      </div>
                      <CardTitle className="text-white text-xl">{outil.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-slate-400 mb-4">{outil.description}</p>
                      <div className="flex items-center text-blue-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
                        Utiliser l&apos;outil
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-blue-900/50 to-cyan-900/50 rounded-3xl p-12 border border-blue-500/30"
          >
            <Calculator className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">Gérez vos biens avec Talok</h2>
            <p className="text-slate-300 mb-8">
              Au-delà des simulations, Talok gère vos baux, vos loyers, vos locataires et votre
              comptabilité. Gratuit pour 1 bien.
            </p>
            <Link href="/essai-gratuit">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
                Essayer gratuitement
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
