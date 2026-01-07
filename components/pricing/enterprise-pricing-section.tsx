"use client";

/**
 * Section Pricing Enterprise - VERSION AMÉLIORÉE
 * Affichage dédié des 4 tiers Enterprise avec comparatif
 * Inclut les différenciateurs majeurs vs concurrence
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Crown,
  Check,
  ArrowRight,
  Users,
  FileSignature,
  CreditCard,
  Shield,
  Building2,
  Headphones,
  Zap,
  Globe,
  Lock,
  Brain,
  Landmark,
  MapPin,
  Sparkles,
  TrendingUp,
  ClipboardCheck,
  MessageSquare,
  Home,
  ChevronDown,
  Award,
  Target,
  Rocket,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS, type PlanSlug, formatPrice } from "@/lib/subscriptions/plans";

interface EnterprisePricingSectionProps {
  billing: "monthly" | "yearly";
  onSelectPlan: (slug: PlanSlug) => void;
  loading?: string | null;
}

const ENTERPRISE_TIERS: PlanSlug[] = ["enterprise_s", "enterprise_m", "enterprise_l", "enterprise_xl"];

const TIER_ICONS: Record<string, React.ReactNode> = {
  enterprise_s: <Building2 className="w-6 h-6" />,
  enterprise_m: <Users className="w-6 h-6" />,
  enterprise_l: <Crown className="w-6 h-6" />,
  enterprise_xl: <Zap className="w-6 h-6" />,
};

const TIER_COLORS: Record<string, string> = {
  enterprise_s: "from-emerald-500 to-teal-600",
  enterprise_m: "from-teal-500 to-cyan-600",
  enterprise_l: "from-cyan-500 to-blue-600",
  enterprise_xl: "from-blue-500 to-indigo-600",
};

// ============================================
// DIFFÉRENCIATEURS MAJEURS vs CONCURRENCE
// ============================================
const UNIQUE_DIFFERENTIATORS = [
  {
    id: "open_banking",
    icon: Landmark,
    title: "Open Banking Natif",
    subtitle: "Synchronisation bancaire automatique",
    description: "Rapprochement automatique loyers/paiements. Seuls 2 concurrents sur 15 proposent cette fonctionnalité.",
    competitors: "Rentila ❌ Smovin ❌ Hektor ❌",
    gradient: "from-emerald-500 to-teal-500",
    highlight: "13/15 concurrents sans",
  },
  {
    id: "scoring_ia",
    icon: Brain,
    title: "Scoring IA Locataire",
    subtitle: "Intelligence artificielle prédictive",
    description: "Analyse automatique dossiers, score solvabilité, détection fraude documents. Innovation unique sur le marché.",
    competitors: "Aucun concurrent ne propose cette fonctionnalité",
    gradient: "from-violet-500 to-purple-600",
    highlight: "0/15 concurrents",
  },
  {
    id: "drom",
    icon: MapPin,
    title: "Support DROM Complet",
    subtitle: "Martinique, Guadeloupe, Réunion...",
    description: "Spécificités fiscales, indices IRL DROM, modèles de bail adaptés. Marché totalement inexploité.",
    competitors: "0 concurrent adresse les DROM",
    gradient: "from-amber-500 to-orange-500",
    highlight: "Marché vierge",
  },
  {
    id: "portail_locataire",
    icon: Users,
    title: "Portail Locataire Moderne",
    subtitle: "Expérience utilisateur premium",
    description: "Dashboard personnalisé, tickets maintenance, chat temps réel, paiement en ligne. Seuls 4/15 concurrents proposent un portail.",
    competitors: "Rentila ❌ BailFacile ❌ Qalimo ❌",
    gradient: "from-blue-500 to-cyan-500",
    highlight: "11/15 concurrents sans",
  },
];

// ============================================
// COMPARATIF CONCURRENTIEL
// ============================================
const COMPETITIVE_COMPARISON = [
  { feature: "Open Banking", talok: true, rentila: false, smovin: false, hektor: false, ublo: true },
  { feature: "Scoring IA", talok: true, rentila: false, smovin: false, hektor: false, ublo: false },
  { feature: "Support DROM", talok: true, rentila: false, smovin: false, hektor: false, ublo: false },
  { feature: "Portail Locataire", talok: true, rentila: false, smovin: "basic", hektor: true, ublo: true },
  { feature: "E-signature intégrée", talok: true, rentila: false, smovin: true, hektor: true, ublo: true },
  { feature: "EDL numériques", talok: true, rentila: false, smovin: "basic", hektor: true, ublo: true },
  { feature: "Channel Manager", talok: true, rentila: false, smovin: false, hektor: "basic", ublo: "basic" },
  { feature: "API ouverte", talok: true, rentila: false, smovin: false, hektor: "basic", ublo: true },
  { feature: "White Label", talok: true, rentila: false, smovin: false, hektor: false, ublo: true },
  { feature: "Gestion Colocation", talok: true, rentila: true, smovin: true, hektor: true, ublo: true },
];

const COMPETITORS = [
  { id: "rentila", name: "Rentila", price: "9,90€" },
  { id: "smovin", name: "Smovin", price: "39€" },
  { id: "hektor", name: "Hektor", price: "69€" },
  { id: "ublo", name: "Ublo", price: "Sur devis" },
];

export function EnterprisePricingSection({
  billing,
  onSelectPlan,
  loading,
}: EnterprisePricingSectionProps) {
  const [activeTab, setActiveTab] = useState<"plans" | "differentiators" | "comparison">("plans");
  const [expandedDifferentiator, setExpandedDifferentiator] = useState<string | null>(null);

  return (
    <section className="py-20 bg-gradient-to-b from-slate-900/50 to-slate-950">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <Badge className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border-emerald-500/30 mb-4 px-4 py-1.5">
            <Rocket className="w-4 h-4 mr-2" />
            Solutions Enterprise • Innovation Leader
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            La plateforme la plus{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              complète du marché
            </span>
          </h2>
          <p className="text-slate-400 max-w-3xl mx-auto text-lg mb-2">
            Open Banking natif • Scoring IA • Support DROM • Portail locataire moderne
          </p>
          <p className="text-slate-500 text-sm">
            Comparé à 15 concurrents : Rentila, Smovin, Hektor, BailFacile, Ublo...
          </p>
        </motion.div>

        {/* Navigation Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex justify-center mb-10"
        >
          <div className="inline-flex bg-slate-800/50 rounded-xl p-1.5 border border-slate-700/50">
            {[
              { id: "plans", label: "Tarifs Enterprise", icon: Crown },
              { id: "differentiators", label: "Nos Différenciateurs", icon: Sparkles },
              { id: "comparison", label: "vs Concurrence", icon: Target },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300",
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* TAB 1: Plans Enterprise */}
          {activeTab === "plans" && (
            <motion.div
              key="plans"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >

              {/* Plans Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-12">
                {ENTERPRISE_TIERS.map((slug, index) => {
                  const plan = PLANS[slug];
                  const price = billing === "yearly" ? plan.price_yearly : plan.price_monthly;
                  const monthlyEquivalent = billing === "yearly" && price 
                    ? Math.round(price / 12) 
                    : null;
                  const isPopular = plan.is_popular;
                  
                  return (
                    <motion.div
                      key={slug}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                      className={cn(
                        "relative rounded-2xl border-2 p-6 transition-all duration-300",
                        isPopular
                          ? "border-cyan-500 bg-cyan-500/10 shadow-xl shadow-cyan-500/20 scale-105 z-10"
                          : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600"
                      )}
                    >
                      {/* Badge populaire */}
                      {isPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-0 px-4 py-1 shadow-lg">
                            ⭐ Le plus choisi
                          </Badge>
                        </div>
                      )}

                      {/* Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center",
                          `bg-gradient-to-br ${TIER_COLORS[slug]} text-white`
                        )}>
                          {TIER_ICONS[slug]}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                          <p className="text-sm text-slate-400">{plan.tagline}</p>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="mb-6">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-white">
                            {formatPrice(price)}
                          </span>
                          <span className="text-slate-400">
                            /{billing === "yearly" ? "an" : "mois"}
                          </span>
                        </div>
                        {monthlyEquivalent && (
                          <p className="text-sm text-slate-500 mt-1">
                            soit {formatPrice(monthlyEquivalent)}/mois
                          </p>
                        )}
                      </div>

                      {/* Key Features */}
                      <div className="space-y-3 mb-6">
                        {/* Biens */}
                        <div className="flex items-center gap-3 text-sm">
                          <Building2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-slate-300">
                            {plan.limits.max_properties === -1 
                              ? "Biens illimités" 
                              : `Jusqu'à ${plan.limits.max_properties} biens`}
                          </span>
                        </div>
                        
                        {/* Signatures */}
                        <div className="flex items-center gap-3 text-sm">
                          <FileSignature className="w-4 h-4 text-violet-400" />
                          <span className="text-slate-300">
                            {plan.limits.signatures_monthly_quota === -1
                              ? "Signatures illimitées"
                              : `${plan.limits.signatures_monthly_quota} signatures/mois`}
                          </span>
                        </div>
                        
                        {/* Frais CB */}
                        <div className="flex items-center gap-3 text-sm">
                          <CreditCard className="w-4 h-4 text-amber-400" />
                          <span className="text-slate-300">
                            Frais CB : <span className="text-emerald-400 font-medium">1,9%</span>
                          </span>
                        </div>
                        
                        {/* Open Banking - NOUVEAU DIFFÉRENCIATEUR */}
                        <div className="flex items-center gap-3 text-sm">
                          <Landmark className="w-4 h-4 text-cyan-400" />
                          <span className="text-slate-300">
                            <span className="text-cyan-400 font-medium">Open Banking</span> natif
                          </span>
                        </div>

                        {/* Scoring IA - NOUVEAU DIFFÉRENCIATEUR */}
                        <div className="flex items-center gap-3 text-sm">
                          <Brain className="w-4 h-4 text-purple-400" />
                          <span className="text-slate-300">
                            <span className="text-purple-400 font-medium">Scoring IA</span> locataire
                          </span>
                        </div>
                        
                        {/* Features spécifiques par tier */}
                        {slug === "enterprise_m" && (
                          <div className="flex items-center gap-3 text-sm">
                            <Globe className="w-4 h-4 text-blue-400" />
                            <span className="text-slate-300">White label basique</span>
                          </div>
                        )}
                        {slug === "enterprise_l" && (
                          <>
                            <div className="flex items-center gap-3 text-sm">
                              <Headphones className="w-4 h-4 text-pink-400" />
                              <span className="text-slate-300">Account Manager dédié</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <Shield className="w-4 h-4 text-green-400" />
                              <span className="text-slate-300">SLA 99,5%</span>
                            </div>
                          </>
                        )}
                        {slug === "enterprise_xl" && (
                          <>
                            <div className="flex items-center gap-3 text-sm">
                              <Lock className="w-4 h-4 text-orange-400" />
                              <span className="text-slate-300">SSO (SAML/OAuth)</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <MapPin className="w-4 h-4 text-amber-400" />
                              <span className="text-slate-300">
                                <span className="text-amber-400 font-medium">Support DROM</span> complet
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* CTA */}
                      <Button
                        className={cn(
                          "w-full",
                          isPopular
                            ? `bg-gradient-to-r ${TIER_COLORS[slug]} hover:opacity-90`
                            : "bg-slate-700 hover:bg-slate-600"
                        )}
                        size="lg"
                        onClick={() => onSelectPlan(slug)}
                        disabled={loading === slug}
                      >
                        {slug === "enterprise_l" || slug === "enterprise_xl" ? (
                          <>Nous contacter</>
                        ) : (
                          <>
                            Essai gratuit 30j
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </motion.div>
                  );
                })}
              </div>

              {/* Benefits Row */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
              >
                {[
                  { 
                    label: "Frais CB réduits", 
                    value: "1,9%", 
                    sublabel: "au lieu de 2,2%",
                    color: "text-emerald-400" 
                  },
                  { 
                    label: "Frais SEPA", 
                    value: "0,35€", 
                    sublabel: "au lieu de 0,50€",
                    color: "text-blue-400" 
                  },
                  { 
                    label: "Réduction GLI", 
                    value: "-20%", 
                    sublabel: "sur les primes",
                    color: "text-violet-400" 
                  },
                  { 
                    label: "Support", 
                    value: "Prioritaire", 
                    sublabel: "ou dédié",
                    color: "text-pink-400" 
                  },
                ].map((item, i) => (
                  <div 
                    key={i} 
                    className="text-center p-4 rounded-xl bg-slate-800/30 border border-slate-700/50"
                  >
                    <div className={cn("text-2xl font-bold", item.color)}>{item.value}</div>
                    <div className="text-sm font-medium text-white">{item.label}</div>
                    <div className="text-xs text-slate-500">{item.sublabel}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* TAB 2: Différenciateurs */}
          {activeTab === "differentiators" && (
            <motion.div
              key="differentiators"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-6xl mx-auto"
            >
              {/* Hero message */}
              <div className="text-center mb-10">
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
                  Ce que les concurrents ne font <span className="text-red-400">pas</span>
                </h3>
                <p className="text-slate-400 max-w-2xl mx-auto">
                  Après analyse de 15 solutions concurrentes (Rentila, Smovin, Hektor, BailFacile, Ublo...), 
                  voici nos 4 différenciateurs majeurs.
                </p>
              </div>

              {/* Differentiators Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                {UNIQUE_DIFFERENTIATORS.map((diff, index) => (
                  <motion.div
                    key={diff.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      "relative p-6 rounded-2xl border-2 transition-all duration-300 cursor-pointer",
                      expandedDifferentiator === diff.id
                        ? "border-transparent bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl"
                        : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600"
                    )}
                    onClick={() => setExpandedDifferentiator(
                      expandedDifferentiator === diff.id ? null : diff.id
                    )}
                  >
                    {/* Highlight Badge */}
                    <div className="absolute -top-3 right-4">
                      <Badge className={cn(
                        "border-0 px-3 py-1 text-white text-xs font-bold shadow-lg",
                        `bg-gradient-to-r ${diff.gradient}`
                      )}>
                        {diff.highlight}
                      </Badge>
                    </div>

                    {/* Header */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className={cn(
                        "w-14 h-14 rounded-xl flex items-center justify-center shrink-0",
                        `bg-gradient-to-br ${diff.gradient} text-white shadow-lg`
                      )}>
                        <diff.icon className="w-7 h-7" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-xl font-bold text-white mb-1">{diff.title}</h4>
                        <p className="text-sm text-slate-400">{diff.subtitle}</p>
                      </div>
                      <ChevronDown className={cn(
                        "w-5 h-5 text-slate-400 transition-transform duration-300 shrink-0",
                        expandedDifferentiator === diff.id && "rotate-180"
                      )} />
                    </div>

                    {/* Expanded content */}
                    <AnimatePresence>
                      {expandedDifferentiator === diff.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-4 border-t border-slate-700/50">
                            <p className="text-slate-300 mb-4">{diff.description}</p>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-slate-500">Concurrents :</span>
                              <span className="text-red-400 font-medium">{diff.competitors}</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>

              {/* Additional unique features */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: ClipboardCheck, label: "EDL numériques", desc: "Photos + comparatif auto" },
                  { icon: MessageSquare, label: "Relances SMS", desc: "Automatisées" },
                  { icon: Home, label: "Channel Manager", desc: "Airbnb, Booking..." },
                  { icon: Award, label: "White Label", desc: "Votre marque" },
                ].map((feat, i) => (
                  <div 
                    key={i}
                    className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 text-center"
                  >
                    <feat.icon className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <div className="font-medium text-white text-sm">{feat.label}</div>
                    <div className="text-xs text-slate-500">{feat.desc}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB 3: Comparatif Concurrence */}
          {activeTab === "comparison" && (
            <motion.div
              key="comparison"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-6xl mx-auto"
            >
              {/* Hero */}
              <div className="text-center mb-8">
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
                  Talok vs <span className="text-slate-400">la concurrence</span>
                </h3>
                <p className="text-slate-400 max-w-2xl mx-auto">
                  Comparaison objective avec les 4 principaux concurrents du marché français.
                </p>
              </div>

              {/* Comparison Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-700/50 bg-slate-800/30">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left p-4 text-slate-400 font-medium">Fonctionnalité</th>
                      <th className="p-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-emerald-400 font-bold">Talok</span>
                          <Badge className="bg-emerald-500/20 text-emerald-300 text-xs">À partir de 19€</Badge>
                        </div>
                      </th>
                      {COMPETITORS.map((comp) => (
                        <th key={comp.id} className="p-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-slate-300 font-medium">{comp.name}</span>
                            <span className="text-slate-500 text-xs">{comp.price}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPETITIVE_COMPARISON.map((row, i) => (
                      <tr 
                        key={i} 
                        className={cn(
                          "border-b border-slate-700/30",
                          i % 2 === 0 ? "bg-slate-800/20" : ""
                        )}
                      >
                        <td className="p-4 text-white font-medium">{row.feature}</td>
                        <td className="p-4 text-center">
                          <ComparisonCell value={row.talok} highlight />
                        </td>
                        <td className="p-4 text-center">
                          <ComparisonCell value={row.rentila} />
                        </td>
                        <td className="p-4 text-center">
                          <ComparisonCell value={row.smovin} />
                        </td>
                        <td className="p-4 text-center">
                          <ComparisonCell value={row.hektor} />
                        </td>
                        <td className="p-4 text-center">
                          <ComparisonCell value={row.ublo} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Score summary */}
              <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                  <div className="text-3xl font-bold text-emerald-400">10/10</div>
                  <div className="text-sm text-slate-300">Talok</div>
                </div>
                {COMPETITORS.map((comp, i) => {
                  const scores = [3, 5, 6, 8]; // Scores simulés
                  return (
                    <div key={comp.id} className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 text-center">
                      <div className="text-2xl font-bold text-slate-400">{scores[i]}/10</div>
                      <div className="text-sm text-slate-500">{comp.name}</div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA Final - toujours visible */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <p className="text-slate-400 mb-4">
            Besoin d&apos;une solution personnalisée ?
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              variant="outline"
              size="lg"
              className="border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10"
              onClick={() => onSelectPlan("enterprise" as PlanSlug)}
            >
              <Crown className="w-4 h-4 mr-2" />
              Demander un devis personnalisé
            </Button>
            <Button
              size="lg"
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90"
              onClick={() => onSelectPlan("enterprise_l")}
            >
              <Rocket className="w-4 h-4 mr-2" />
              Démarrer l&apos;essai gratuit
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================
// COMPOSANT HELPER : Cellule de comparaison
// ============================================
function ComparisonCell({ value, highlight = false }: { value: boolean | string; highlight?: boolean }) {
  if (value === true) {
    return (
      <div className={cn(
        "inline-flex items-center justify-center w-8 h-8 rounded-full",
        highlight ? "bg-emerald-500/20" : "bg-slate-700/50"
      )}>
        <Check className={cn(
          "w-5 h-5",
          highlight ? "text-emerald-400" : "text-green-500"
        )} />
      </div>
    );
  }
  
  if (value === false) {
    return (
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10">
        <X className="w-5 h-5 text-red-400" />
      </div>
    );
  }
  
  // Valeur partielle (string comme "basic")
  return (
    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
      {value === "basic" ? "Basique" : value}
    </Badge>
  );
}

export default EnterprisePricingSection;

