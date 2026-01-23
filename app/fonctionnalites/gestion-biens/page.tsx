"use client";

/**
 * Page Fonctionnalité: Gestion des Biens
 *
 * SEO: Cible "gestion patrimoine locatif", "gestion immobilier locatif"
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  ArrowRight,
  Check,
  Camera,
  FileText,
  Bell,
  History,
  MapPin,
  BarChart3,
  Shield,
  Sparkles,
} from "lucide-react";

const FEATURES = [
  {
    icon: Camera,
    title: "Galerie photos illimitée",
    description: "Ajoutez autant de photos que nécessaire pour chaque bien. Organisation automatique par pièce.",
  },
  {
    icon: FileText,
    title: "Documents centralisés",
    description: "DPE, diagnostics, actes notariés... Tous vos documents au même endroit, accessibles en 1 clic.",
  },
  {
    icon: Bell,
    title: "Alertes intelligentes",
    description: "Soyez notifié des échéances importantes : renouvellement diagnostics, fin de bail, révision loyer.",
  },
  {
    icon: History,
    title: "Historique complet",
    description: "Retrouvez l'historique de chaque bien : travaux, locataires, incidents, paiements.",
  },
  {
    icon: MapPin,
    title: "Géolocalisation",
    description: "Visualisez vos biens sur une carte. Idéal pour les portefeuilles multi-villes.",
  },
  {
    icon: BarChart3,
    title: "Tableaux de bord",
    description: "Suivez la rentabilité de chaque bien. Rendement brut, net, cash-flow en temps réel.",
  },
];

const BENEFITS = [
  "Fini les classeurs et dossiers papier",
  "Accès depuis mobile, tablette ou PC",
  "Partagez avec vos locataires ou prestataires",
  "Import depuis Excel ou autres logiciels",
  "Conformité RGPD et sauvegarde sécurisée",
  "Support client réactif en français",
];

export default function GestionBiensPage() {
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
            <Link href="/fonctionnalites" className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors">
              <ArrowRight className="w-4 h-4 mr-2 rotate-180" />
              Toutes les fonctionnalités
            </Link>

            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 mb-4">
              <Building2 className="w-3 h-3 mr-1" />
              Gestion des Biens
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Centralisez tout votre{" "}
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                patrimoine locatif
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl">
              Un seul endroit pour gérer tous vos biens. Photos, documents, historique,
              alertes. Accessible partout, tout le temps.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/auth/signup">
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90">
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
              { value: "+50 000", label: "biens gérés" },
              { value: "+10 000", label: "propriétaires" },
              { value: "99,9%", label: "disponibilité" },
              { value: "<30s", label: "temps ajout bien" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl md:text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
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
            <p className="text-slate-400 max-w-2xl mx-auto">
              Des fonctionnalités pensées pour simplifier la gestion de votre patrimoine immobilier.
            </p>
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
                <Card className="h-full bg-slate-800/30 border-slate-700/50 hover:border-blue-500/50 transition-colors">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-blue-400" />
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

      {/* Benefits Section */}
      <section className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 mb-4">
                <Shield className="w-3 h-3 mr-1" />
                Avantages
              </Badge>
              <h2 className="text-3xl font-bold text-white mb-6">
                Pourquoi choisir Talok pour gérer vos biens ?
              </h2>
              <ul className="space-y-4">
                {BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">{benefit}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-blue-900/30 to-indigo-900/30 rounded-2xl p-8 border border-blue-500/20"
            >
              <div className="aspect-video bg-slate-800/50 rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <Building2 className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                  <p className="text-slate-400">Interface de gestion des biens</p>
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
            className="max-w-3xl mx-auto text-center bg-gradient-to-br from-blue-900/50 to-indigo-900/50 rounded-3xl p-12 border border-blue-500/30"
          >
            <Sparkles className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Commencez à gérer vos biens efficacement
            </h2>
            <p className="text-slate-300 mb-8">
              Créez votre compte en 2 minutes. Importez vos biens. C'est parti.
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
