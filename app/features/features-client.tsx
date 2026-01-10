"use client";

/**
 * FeaturesClient - Page Fonctionnalités SOTA 2026
 *
 * Page SEO stratégique ciblant :
 * - "logiciel gestion locative" (2,400/mois)
 * - "gestion locative en ligne" (1,900/mois)
 *
 * Structure optimisée pour les rich snippets
 */

import React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  Building2,
  FileText,
  FileSignature,
  Brain,
  Landmark,
  Users,
  CreditCard,
  Receipt,
  Calendar,
  MessageSquare,
  Shield,
  BarChart3,
  Bell,
  Download,
  Settings,
  CheckCircle2,
  Zap,
  Clock,
  MapPin,
  Wrench,
  Home,
  TrendingUp,
  Globe,
  Lock,
  Headphones,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TrustBar, Guarantees } from "@/components/marketing/TrustBadges";
import { DemoVideoModalFeatures } from "@/components/marketing/DemoVideoModal";

// ============================================
// DATA
// ============================================

const FEATURE_CATEGORIES = [
  {
    id: "property",
    title: "Gestion des Biens",
    icon: Building2,
    description: "Centralisez tous vos biens immobiliers en un seul endroit",
    gradient: "from-indigo-500 to-blue-500",
    features: [
      {
        icon: Home,
        title: "Multi-types de biens",
        description:
          "Appartements, maisons, parkings, locaux commerciaux, colocations. Gérez tout depuis une interface unique.",
      },
      {
        icon: MapPin,
        title: "Couverture France + DROM",
        description:
          "Martinique, Guadeloupe, Réunion, Guyane... Le seul logiciel qui couvre tous les territoires français.",
      },
      {
        icon: BarChart3,
        title: "Tableaux de bord",
        description:
          "Visualisez la performance de votre patrimoine : taux d'occupation, rentabilité, loyers encaissés.",
      },
      {
        icon: Download,
        title: "Import/Export",
        description:
          "Importez vos biens depuis Excel ou d'autres logiciels. Exportez vos données à tout moment.",
      },
    ],
  },
  {
    id: "leases",
    title: "Création de Baux",
    icon: FileText,
    description: "Générez des baux conformes en quelques clics",
    gradient: "from-emerald-500 to-teal-500",
    features: [
      {
        icon: FileText,
        title: "Baux conformes loi ALUR",
        description:
          "Tous les baux sont générés avec les clauses légales obligatoires et les annexes requises.",
      },
      {
        icon: Clock,
        title: "Génération en 10 minutes",
        description:
          "Renseignez les informations de base, le système génère automatiquement le bail complet.",
      },
      {
        icon: CheckCircle2,
        title: "Annexes incluses",
        description:
          "Notice d'information, DPE, règlement de copropriété, état des risques... Tout est automatique.",
      },
      {
        icon: Calendar,
        title: "Révision IRL automatique",
        description:
          "Le loyer est révisé automatiquement chaque année selon l'indice de référence des loyers.",
      },
    ],
  },
  {
    id: "signatures",
    title: "Signatures Électroniques",
    icon: FileSignature,
    description: "Signez vos baux en ligne avec valeur légale",
    gradient: "from-violet-500 to-purple-500",
    features: [
      {
        icon: Shield,
        title: "Conformité eIDAS",
        description:
          "Signatures électroniques avec la même valeur juridique qu'une signature manuscrite.",
      },
      {
        icon: Clock,
        title: "Signature en 24h",
        description:
          "Envoyez le bail par email, le locataire signe depuis son téléphone. Gain de temps énorme.",
      },
      {
        icon: Lock,
        title: "Certificat de preuve",
        description:
          "Chaque signature est horodatée, tracée et archivée avec un certificat de preuve légale.",
      },
      {
        icon: Users,
        title: "Multi-signataires",
        description:
          "Colocations, couples, garants... Gérez plusieurs signataires sur un même document.",
      },
    ],
  },
  {
    id: "ai",
    title: "Scoring IA Locataires",
    icon: Brain,
    description: "Analysez la solvabilité avec l'intelligence artificielle",
    gradient: "from-amber-500 to-orange-500",
    badge: "Exclusif",
    features: [
      {
        icon: Brain,
        title: "94% de précision",
        description:
          "Notre algorithme analyse les dossiers de candidature et prédit les risques d'impayés.",
      },
      {
        icon: TrendingUp,
        title: "Analyse multi-critères",
        description:
          "Revenus, stabilité professionnelle, historique locatif, comportement bancaire.",
      },
      {
        icon: Zap,
        title: "Résultat instantané",
        description:
          "Score de solvabilité en quelques secondes. Comparez facilement les candidatures.",
      },
      {
        icon: Shield,
        title: "Évitez les impayés",
        description:
          "Nos clients évitent en moyenne 3 000€ d'impayés par an grâce au scoring.",
      },
    ],
  },
  {
    id: "banking",
    title: "Open Banking",
    icon: Landmark,
    description: "Synchronisation bancaire automatique",
    gradient: "from-cyan-500 to-blue-500",
    badge: "Unique",
    features: [
      {
        icon: Landmark,
        title: "Connexion sécurisée",
        description:
          "Connectez vos comptes bancaires en toute sécurité via les APIs bancaires officielles.",
      },
      {
        icon: TrendingUp,
        title: "Temps réel",
        description:
          "Voyez les loyers reçus instantanément. Plus besoin de vérifier vos relevés manuellement.",
      },
      {
        icon: CheckCircle2,
        title: "Rapprochement auto",
        description:
          "Les paiements sont automatiquement associés aux locataires. Zéro saisie manuelle.",
      },
      {
        icon: BarChart3,
        title: "Reporting financier",
        description:
          "Tableaux de bord financiers complets : encaissements, retards, prévisions.",
      },
    ],
  },
  {
    id: "payments",
    title: "Paiements en Ligne",
    icon: CreditCard,
    description: "Encaissez les loyers en quelques clics",
    gradient: "from-green-500 to-emerald-500",
    features: [
      {
        icon: CreditCard,
        title: "Carte bancaire",
        description:
          "Paiement par CB sécurisé via Stripe. Le locataire paie, vous recevez le lendemain.",
      },
      {
        icon: Landmark,
        title: "Prélèvement SEPA",
        description:
          "Mettez en place un prélèvement automatique mensuel. Le loyer rentre sans effort.",
      },
      {
        icon: Receipt,
        title: "Quittances automatiques",
        description:
          "La quittance est générée et envoyée automatiquement dès réception du paiement.",
      },
      {
        icon: Bell,
        title: "Relances impayés",
        description:
          "Emails et SMS de relance automatiques en cas de retard de paiement.",
      },
    ],
  },
  {
    id: "tenant",
    title: "Portail Locataire",
    icon: Users,
    description: "Un espace moderne pour vos locataires",
    gradient: "from-pink-500 to-rose-500",
    features: [
      {
        icon: Home,
        title: "Dashboard locataire",
        description:
          "Vos locataires ont leur propre espace : bail, paiements, quittances, informations.",
      },
      {
        icon: CreditCard,
        title: "Paiement en 2 clics",
        description:
          "Le locataire peut payer son loyer directement depuis son espace en toute simplicité.",
      },
      {
        icon: Download,
        title: "Documents à disposition",
        description:
          "Bail, quittances, attestations... Tout est téléchargeable 24h/24.",
      },
      {
        icon: MessageSquare,
        title: "Chat intégré",
        description:
          "Communication directe propriétaire-locataire. Historique complet des échanges.",
      },
    ],
  },
  {
    id: "maintenance",
    title: "Maintenance & Tickets",
    icon: Wrench,
    description: "Gérez les incidents et travaux efficacement",
    gradient: "from-slate-500 to-zinc-600",
    features: [
      {
        icon: Bell,
        title: "Tickets instantanés",
        description:
          "Le locataire signale un problème en 30 secondes avec photos et description.",
      },
      {
        icon: Users,
        title: "Gestion prestataires",
        description:
          "Assignez les tickets à vos prestataires. Suivez l'avancement en temps réel.",
      },
      {
        icon: Receipt,
        title: "Devis et factures",
        description:
          "Les prestataires peuvent envoyer devis et factures directement dans l'application.",
      },
      {
        icon: BarChart3,
        title: "Historique complet",
        description:
          "Gardez trace de tous les travaux effectués sur chaque bien pour la revente.",
      },
    ],
  },
];

const BONUS_FEATURES = [
  { icon: Globe, text: "Accessible depuis partout" },
  { icon: Lock, text: "Données chiffrées SSL" },
  { icon: Shield, text: "Hébergement France" },
  { icon: Headphones, text: "Support français" },
  { icon: Download, text: "Export comptable" },
  { icon: Users, text: "Multi-utilisateurs" },
];

// ============================================
// COMPONENTS
// ============================================

function FeatureCategoryCard({
  category,
  index,
  motionEnabled,
}: {
  category: (typeof FEATURE_CATEGORIES)[0];
  index: number;
  motionEnabled: boolean;
}) {
  return (
    <motion.section
      initial={motionEnabled ? { opacity: 0, y: 30 } : undefined}
      whileInView={motionEnabled ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true }}
      transition={motionEnabled ? { delay: index * 0.1 } : undefined}
      className="py-16 md:py-20"
      id={category.id}
    >
      {/* Category Header */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br text-white",
            category.gradient
          )}
        >
          <category.icon className="w-7 h-7" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              {category.title}
            </h2>
            {category.badge && (
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                {category.badge}
              </Badge>
            )}
          </div>
          <p className="text-slate-400">{category.description}</p>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {category.features.map((feature, featureIndex) => (
          <motion.div
            key={feature.title}
            initial={motionEnabled ? { opacity: 0, y: 20 } : undefined}
            whileInView={motionEnabled ? { opacity: 1, y: 0 } : undefined}
            viewport={{ once: true }}
            transition={
              motionEnabled ? { delay: index * 0.1 + featureIndex * 0.05 } : undefined
            }
          >
            <Card className="h-full bg-slate-800/30 border-slate-700/50 hover:border-slate-600/50 transition-all duration-300 group">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br text-white group-hover:scale-110 transition-transform",
                      category.gradient
                    )}
                  >
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function FeaturesClient() {
  const prefersReducedMotion = useReducedMotion();
  const motionEnabled = !prefersReducedMotion;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Hero Section */}
      <section className="relative pt-8 pb-16 md:pt-16 md:pb-24 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 opacity-60 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.2),_transparent_50%)]" />
        </div>

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={motionEnabled ? { opacity: 0, y: 20 } : undefined}
            animate={motionEnabled ? { opacity: 1, y: 0 } : undefined}
            className="max-w-4xl mx-auto text-center"
          >
            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 mb-6">
              <Zap className="w-3 h-3 mr-1" />
              Fonctionnalités complètes
            </Badge>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6">
              <span className="text-white">Tout ce dont vous avez besoin</span>
              <br />
              <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                pour gérer vos locations
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto mb-8">
              De la création du bail à l'encaissement du loyer, en passant par
              le scoring des locataires et la maintenance. Talok couvre tous vos
              besoins de gestion locative.
            </p>

            {/* Quick nav */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {FEATURE_CATEGORIES.map((cat) => (
                <a
                  key={cat.id}
                  href={`#${cat.id}`}
                  className="px-4 py-2 rounded-full bg-slate-800/50 text-slate-300 text-sm hover:bg-slate-700/50 hover:text-white transition-colors"
                >
                  {cat.title}
                </a>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup/role">
                <Button
                  size="lg"
                  className="h-14 px-8 text-lg font-semibold bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 shadow-lg"
                >
                  Essayer gratuitement
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 text-lg font-semibold border-white/20 text-white hover:bg-white/10"
                >
                  Voir les tarifs
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust Bar */}
      <TrustBar />

      {/* Feature Categories */}
      <div className="container mx-auto px-4">
        {FEATURE_CATEGORIES.map((category, index) => (
          <FeatureCategoryCard
            key={category.id}
            category={category}
            index={index}
            motionEnabled={motionEnabled}
          />
        ))}
      </div>

      {/* Bonus Features */}
      <section className="py-16 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={motionEnabled ? { opacity: 0, y: 20 } : undefined}
            whileInView={motionEnabled ? { opacity: 1, y: 0 } : undefined}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h2 className="text-2xl font-bold text-white mb-2">
              Et aussi inclus...
            </h2>
            <p className="text-slate-400">Dans tous les forfaits</p>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-4 md:gap-8">
            {BONUS_FEATURES.map((feature, index) => (
              <motion.div
                key={feature.text}
                initial={motionEnabled ? { opacity: 0 } : undefined}
                whileInView={motionEnabled ? { opacity: 1 } : undefined}
                viewport={{ once: true }}
                transition={motionEnabled ? { delay: index * 0.05 } : undefined}
                className="flex items-center gap-2 text-slate-300"
              >
                <feature.icon className="w-4 h-4 text-emerald-400" />
                <span className="text-sm">{feature.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial={motionEnabled ? { opacity: 0, y: 20 } : undefined}
            whileInView={motionEnabled ? { opacity: 1, y: 0 } : undefined}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-cyan-600 p-8 md:p-16 text-center"
          >
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
            </div>

            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Prêt à découvrir Talok ?
              </h2>
              <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
                Créez votre compte gratuitement et explorez toutes les
                fonctionnalités. Premier mois offert sur tous les plans.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/signup/role">
                  <Button
                    size="lg"
                    className="h-14 px-8 text-lg font-semibold bg-white text-indigo-600 hover:bg-slate-100 shadow-lg"
                  >
                    Créer mon compte gratuit
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <DemoVideoModalFeatures />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Guarantees */}
      <Guarantees />

      {/* Footer spacer */}
      <div className="h-12" />
    </div>
  );
}
