"use client";

/**
 * Page Index Guides
 *
 * SEO: Cible "guide propriétaire bailleur", "guide gestion locative"
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen,
  ArrowRight,
  Download,
  FileText,
  Building,
  Calculator,
  ClipboardCheck,
  Users,
  Euro,
  Palmtree,
  Sparkles,
} from "lucide-react";

const GUIDES = [
  {
    slug: "proprietaire-bailleur",
    title: "Guide Complet du Propriétaire Bailleur 2026",
    description: "Tout ce que vous devez savoir pour louer sereinement. De la mise en location au départ du locataire.",
    icon: Building,
    pages: 25,
    downloadable: true,
    popular: true,
  },
  {
    slug: "checklist-mise-en-location",
    title: "Checklist Mise en Location",
    description: "La liste complète des étapes pour mettre votre bien en location. Ne rien oublier.",
    icon: ClipboardCheck,
    pages: 5,
    downloadable: true,
    popular: true,
  },
  {
    slug: "gestion-sci",
    title: "Guide Gestion Locative en SCI",
    description: "Multi-associés, AG, répartition des bénéfices. Le guide pour gérer votre SCI familiale.",
    icon: Users,
    pages: 15,
    downloadable: true,
  },
  {
    slug: "fiscalite-locative",
    title: "Tout sur la Fiscalité Locative",
    description: "Micro-foncier, réel, LMNP, déficit foncier. Optimisez votre imposition.",
    icon: Calculator,
    pages: 20,
    downloadable: true,
  },
  {
    slug: "etat-des-lieux-parfait",
    title: "Guide de l'État des Lieux Parfait",
    description: "Conseils d'experts pour réaliser des EDL complets et éviter les litiges.",
    icon: ClipboardCheck,
    pages: 12,
    downloadable: true,
  },
  {
    slug: "lettres-bailleur",
    title: "15 Modèles de Lettres du Bailleur",
    description: "Relances, congés, régularisation, augmentation... Tous les modèles dont vous avez besoin.",
    icon: FileText,
    pages: 15,
    downloadable: true,
  },
  {
    slug: "investissement-dom-tom",
    title: "Guide Investissement DOM-TOM",
    description: "Pinel Outre-Mer, Girardin, spécificités locales. Investir aux Antilles et en Outre-Mer.",
    icon: Palmtree,
    pages: 18,
    downloadable: true,
  },
  {
    slug: "checklist-fin-bail",
    title: "Checklist Fin de Bail",
    description: "Toutes les étapes du départ du locataire : préavis, EDL sortie, restitution caution.",
    icon: ClipboardCheck,
    pages: 4,
    downloadable: false,
  },
];

export default function GuidesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 mb-4">
              <BookOpen className="w-3 h-3 mr-1" />
              Ressources gratuites
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Guides & Ressources pour{" "}
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Propriétaires Bailleurs
              </span>
            </h1>

            <p className="text-lg text-slate-400 mb-8">
              Des guides pratiques, checklists et modèles pour gérer vos locations
              sereinement. Téléchargement gratuit.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Guides Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {GUIDES.map((guide, index) => (
              <motion.div
                key={guide.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={`/guides/${guide.slug}`}>
                  <Card className="h-full bg-slate-800/30 border-slate-700/50 hover:border-indigo-500/50 hover:bg-slate-800/50 transition-all cursor-pointer group">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <guide.icon className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div className="flex gap-2">
                          {guide.popular && (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                              Populaire
                            </Badge>
                          )}
                          {guide.downloadable && (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                              <Download className="w-3 h-3 mr-1" />
                              PDF
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardTitle className="text-lg text-white group-hover:text-indigo-300 transition-colors">
                        {guide.title}
                      </CardTitle>
                      <CardDescription className="text-slate-400">
                        {guide.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">{guide.pages} pages</span>
                        <span className="text-indigo-400 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                          Lire le guide
                          <ArrowRight className="w-4 h-4" />
                        </span>
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-indigo-900/50 to-violet-900/50 rounded-3xl p-12 border border-indigo-500/30"
          >
            <Sparkles className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">
              Passez à la pratique avec Talok
            </h2>
            <p className="text-slate-300 mb-6">
              Ces guides vous ont aidé ? Avec Talok, tout est automatisé :
              baux, quittances, relances, comptabilité.
            </p>
            <Link href="/auth/signup">
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
