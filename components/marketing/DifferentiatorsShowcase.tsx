"use client";

/**
 * DifferentiatorsShowcase - Mise en avant des différenciateurs
 * 
 * Composant hero pour afficher les 4 avantages uniques de Talok
 * par rapport à la concurrence (basé sur benchmark de 15 concurrents)
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Landmark,
  Brain,
  MapPin,
  Users,
  ArrowRight,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Shield,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ============================================
// TYPES
// ============================================

interface Differentiator {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  description: string;
  stats: {
    value: string;
    label: string;
  };
  competitors: string;
  gradient: string;
  features: string[];
}

interface DifferentiatorsShowcaseProps {
  className?: string;
  variant?: "hero" | "grid" | "carousel";
  showCTA?: boolean;
}

// ============================================
// DATA
// ============================================

const DIFFERENTIATORS: Differentiator[] = [
  {
    id: "open_banking",
    icon: Landmark,
    title: "Open Banking Natif",
    subtitle: "Synchronisation bancaire automatique",
    description: "Connectez vos comptes bancaires en toute sécurité. Rapprochement automatique des loyers reçus avec les paiements attendus.",
    stats: { value: "13/15", label: "concurrents sans" },
    competitors: "Rentila ❌ Smovin ❌ Hektor ❌ BailFacile ❌",
    gradient: "from-emerald-500 to-teal-500",
    features: [
      "Sync multi-banques française",
      "Rapprochement automatique",
      "Détection impayés temps réel",
      "Catégorisation intelligente",
    ],
  },
  {
    id: "scoring_ia",
    icon: Brain,
    title: "Scoring IA Locataire",
    subtitle: "Intelligence artificielle prédictive",
    description: "Notre algorithme analyse les dossiers candidats et prédit le risque d'impayé avec une précision de 94%.",
    stats: { value: "0/15", label: "concurrents" },
    competitors: "Innovation unique sur le marché français",
    gradient: "from-violet-500 to-purple-600",
    features: [
      "Score de solvabilité 0-100",
      "Détection fraude documents",
      "Analyse revenus/charges",
      "Historique locatif",
    ],
  },
  {
    id: "drom",
    icon: MapPin,
    title: "Support DROM Complet",
    subtitle: "Martinique, Guadeloupe, Réunion...",
    description: "Seule plateforme adaptée aux spécificités des départements et régions d'outre-mer. IRL spécifiques, fiscalité adaptée.",
    stats: { value: "Marché", label: "vierge" },
    competitors: "0 concurrent ne couvre les DROM",
    gradient: "from-amber-500 to-orange-500",
    features: [
      "Indices IRL DROM",
      "Modèles baux adaptés",
      "Fiscalité spécifique",
      "Support local",
    ],
  },
  {
    id: "portail_locataire",
    icon: Users,
    title: "Portail Locataire Moderne",
    subtitle: "Expérience utilisateur premium",
    description: "Vos locataires accèdent à leur espace personnel : quittances, historique, tickets maintenance, paiement en ligne.",
    stats: { value: "11/15", label: "concurrents sans" },
    competitors: "Rentila ❌ BailFacile ❌ Qalimo ❌ Ownily ❌",
    gradient: "from-blue-500 to-cyan-500",
    features: [
      "Dashboard personnalisé",
      "Tickets maintenance",
      "Chat temps réel",
      "Paiement CB/SEPA",
    ],
  },
];

// ============================================
// ANIMATION VARIANTS
// ============================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

// ============================================
// SUB-COMPONENTS
// ============================================

function DifferentiatorCard({
  differentiator,
  index,
  isExpanded,
  onToggle,
}: {
  differentiator: Differentiator;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const Icon = differentiator.icon;
  
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -4 }}
      className={cn(
        "relative p-6 rounded-2xl border-2 transition-all duration-300 cursor-pointer group",
        isExpanded
          ? "border-transparent bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl"
          : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600"
      )}
      onClick={onToggle}
    >
      {/* Stats Badge */}
      <div className="absolute -top-3 right-4">
        <Badge className={cn(
          "border-0 px-3 py-1 text-white text-xs font-bold shadow-lg",
          `bg-gradient-to-r ${differentiator.gradient}`
        )}>
          {differentiator.stats.value} {differentiator.stats.label}
        </Badge>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className={cn(
          "w-14 h-14 rounded-xl flex items-center justify-center shrink-0",
          `bg-gradient-to-br ${differentiator.gradient} text-white shadow-lg`,
          "group-hover:scale-110 transition-transform duration-300"
        )}>
          <Icon className="w-7 h-7" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-white mb-1 truncate">
            {differentiator.title}
          </h3>
          <p className="text-sm text-slate-400">{differentiator.subtitle}</p>
        </div>
        <ChevronRight className={cn(
          "w-5 h-5 text-slate-400 transition-transform duration-300 shrink-0",
          isExpanded && "rotate-90"
        )} />
      </div>

      {/* Description */}
      <p className="text-slate-300 text-sm leading-relaxed mb-4">
        {differentiator.description}
      </p>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="pt-4 border-t border-slate-700/50 space-y-4">
              {/* Features list */}
              <div className="grid grid-cols-2 gap-2">
                {differentiator.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Zap className={cn(
                      "w-3.5 h-3.5",
                      `text-${differentiator.gradient.split(" ")[0].replace("from-", "")}`
                    )} />
                    <span className="text-slate-300">{feature}</span>
                  </div>
                ))}
              </div>
              
              {/* Competitors info */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Concurrents :</span>
                <span className="text-red-400 font-medium">{differentiator.competitors}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DifferentiatorsShowcase({
  className,
  variant = "grid",
  showCTA = true,
}: DifferentiatorsShowcaseProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <section className={cn("py-16 md:py-24", className)}>
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <Badge className="bg-gradient-to-r from-violet-500/20 to-indigo-500/20 text-violet-300 border-violet-500/30 mb-4 px-4 py-1.5">
            <Sparkles className="w-4 h-4 mr-2" />
            Ce que les concurrents ne font PAS
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            4 avantages{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              uniques
            </span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            Après analyse de 15 solutions concurrentes, voici ce qui nous rend différents.
          </p>
        </motion.div>

        {/* Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-12"
        >
          {DIFFERENTIATORS.map((diff, index) => (
            <DifferentiatorCard
              key={diff.id}
              differentiator={diff}
              index={index}
              isExpanded={expandedId === diff.id}
              onToggle={() => setExpandedId(expandedId === diff.id ? null : diff.id)}
            />
          ))}
        </motion.div>

        {/* Summary Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-12"
        >
          {[
            { icon: TrendingUp, value: "10/10", label: "Score fonctionnalités" },
            { icon: Shield, value: "94%", label: "Précision scoring IA" },
            { icon: Landmark, value: "2/15", label: "Open Banking marché" },
            { icon: MapPin, value: "100%", label: "Couverture DROM" },
          ].map((stat, i) => (
            <div 
              key={i}
              className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 text-center"
            >
              <stat.icon className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-slate-500">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        {showCTA && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <div className="flex flex-wrap justify-center gap-4">
              <Button
                asChild
                size="lg"
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 shadow-lg shadow-emerald-500/25"
              >
                <Link href="/pricing">
                  Voir les tarifs
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <Link href="/pricing#comparison">
                  Comparatif détaillé
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}

export default DifferentiatorsShowcase;

