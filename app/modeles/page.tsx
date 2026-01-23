"use client";

/**
 * Page Index Modèles de Documents
 *
 * SEO: Cible "modèle bail location", "quittance loyer gratuit"
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  ArrowRight,
  Download,
  Receipt,
  ClipboardCheck,
  Home,
  Mail,
  Users,
  Shield,
  Sparkles,
  Search,
} from "lucide-react";

const MODELES = [
  {
    slug: "quittance-loyer",
    title: "Quittance de Loyer",
    description: "Modèle conforme loi ALUR. Toutes les mentions obligatoires incluses.",
    icon: Receipt,
    format: "PDF / Word",
    volume: "6 200/mois",
    popular: true,
  },
  {
    slug: "etat-des-lieux-entree",
    title: "État des Lieux d'Entrée",
    description: "Grille complète pièce par pièce. Conforme au décret 2016.",
    icon: ClipboardCheck,
    format: "PDF",
    volume: "4 100/mois",
    popular: true,
  },
  {
    slug: "etat-des-lieux-sortie",
    title: "État des Lieux de Sortie",
    description: "Avec comparatif entrée/sortie et calcul vétusté.",
    icon: ClipboardCheck,
    format: "PDF",
    volume: "2 800/mois",
  },
  {
    slug: "bail-location-vide",
    title: "Bail Location Vide",
    description: "Contrat type conforme loi ALUR pour location nue.",
    icon: Home,
    format: "PDF / Word",
    volume: "3 200/mois",
    popular: true,
  },
  {
    slug: "bail-location-meublee",
    title: "Bail Location Meublée",
    description: "Contrat type LMNP avec liste mobilier obligatoire.",
    icon: Home,
    format: "PDF / Word",
    volume: "2 900/mois",
  },
  {
    slug: "bail-mobilite",
    title: "Bail Mobilité",
    description: "Contrat 1-10 mois pour locataires en mobilité professionnelle.",
    icon: Home,
    format: "PDF / Word",
    volume: "890/mois",
  },
  {
    slug: "lettre-relance-impaye",
    title: "Lettre de Relance Impayé",
    description: "3 modèles : relance amiable, mise en demeure, pré-contentieux.",
    icon: Mail,
    format: "PDF / Word",
    volume: "1 200/mois",
  },
  {
    slug: "lettre-conge-bailleur",
    title: "Congé Donné par le Bailleur",
    description: "Pour vente, reprise ou motif légitime. Délais légaux rappelés.",
    icon: Mail,
    format: "PDF / Word",
    volume: "980/mois",
  },
  {
    slug: "lettre-conge-locataire",
    title: "Congé Donné par le Locataire",
    description: "Préavis 1 ou 3 mois selon situation. Cas réduits listés.",
    icon: Mail,
    format: "PDF / Word",
    volume: "1 400/mois",
  },
  {
    slug: "inventaire-meuble",
    title: "Inventaire du Mobilier",
    description: "Liste détaillée obligatoire pour location meublée.",
    icon: FileText,
    format: "PDF",
    volume: "720/mois",
  },
  {
    slug: "attestation-hebergement",
    title: "Attestation d'Hébergement",
    description: "Pour héberger un tiers (famille, ami). Mentions légales.",
    icon: Users,
    format: "PDF / Word",
    volume: "2 100/mois",
  },
  {
    slug: "caution-solidaire",
    title: "Acte de Caution Solidaire",
    description: "Engagement du garant conforme loi ALUR.",
    icon: Shield,
    format: "PDF / Word",
    volume: "1 100/mois",
  },
];

const CATEGORIES = [
  { id: "all", label: "Tous", count: MODELES.length },
  { id: "bail", label: "Baux", count: 3 },
  { id: "edl", label: "États des lieux", count: 2 },
  { id: "lettre", label: "Lettres", count: 3 },
  { id: "autre", label: "Autres", count: 4 },
];

export default function ModelesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 mb-4">
              <FileText className="w-3 h-3 mr-1" />
              Téléchargement gratuit
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Modèles de Documents{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Conformes 2026
              </span>
            </h1>

            <p className="text-lg text-slate-400 mb-8">
              Baux, quittances, états des lieux, lettres types. Tous les documents
              dont vous avez besoin, conformes à la loi ALUR.
            </p>

            {/* Stats */}
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <div className="flex items-center gap-2 bg-slate-800/30 rounded-full px-4 py-2">
                <Download className="w-4 h-4 text-emerald-400" />
                <span className="text-white">+50 000 téléchargements</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-800/30 rounded-full px-4 py-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-white">Conformes loi ALUR</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Modèles Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {MODELES.map((modele, index) => (
              <motion.div
                key={modele.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.03 }}
              >
                <Link href={`/modeles/${modele.slug}`}>
                  <Card className="h-full bg-slate-800/30 border-slate-700/50 hover:border-emerald-500/50 hover:bg-slate-800/50 transition-all cursor-pointer group">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <modele.icon className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div className="flex gap-2">
                          {modele.popular && (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">
                              Populaire
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardTitle className="text-lg text-white group-hover:text-emerald-300 transition-colors">
                        {modele.title}
                      </CardTitle>
                      <CardDescription className="text-slate-400">
                        {modele.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-slate-700/50 text-slate-300 text-xs">
                            {modele.format}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            <Search className="w-3 h-3 inline mr-1" />
                            {modele.volume}
                          </span>
                        </div>
                        <span className="text-emerald-400 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                          <Download className="w-4 h-4" />
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-emerald-900/50 to-teal-900/50 rounded-3xl p-12 border border-emerald-500/30"
          >
            <Sparkles className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">
              Générez vos documents automatiquement
            </h2>
            <p className="text-slate-300 mb-6">
              Avec Talok, plus besoin de télécharger des modèles.
              Baux, quittances et EDL sont générés automatiquement, pré-remplis avec vos données.
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
