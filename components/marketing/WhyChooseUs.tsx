"use client";

/**
 * WhyChooseUs - Section "Pourquoi nous choisir"
 * 
 * Composant marketing mettant en avant les avantages clés
 * avec stats, témoignages et comparaison concurrentielle légère
 */

import React from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Landmark,
  Brain,
  MapPin,
  Users,
  ArrowRight,
  Star,
  Check,
  Shield,
  Zap,
  Clock,
  TrendingUp,
  Building2,
  FileSignature,
  CreditCard,
  Headphones,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface WhyChooseUsProps {
  className?: string;
  variant?: "full" | "compact";
}

// ============================================
// DATA
// ============================================

const KEY_ADVANTAGES = [
  {
    icon: Landmark,
    title: "Open Banking Natif",
    description: "Synchronisation bancaire automatique. Seuls 2 concurrents sur 15 le proposent.",
    badge: "Unique",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: Brain,
    title: "Scoring IA Locataire",
    description: "Analysez la solvabilité avec 94% de précision. Aucun concurrent ne le propose.",
    badge: "Innovation",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    icon: MapPin,
    title: "Support DROM",
    description: "Martinique, Guadeloupe, Réunion... Marché totalement inexploité par la concurrence.",
    badge: "Exclusif",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    icon: Users,
    title: "Portail Locataire",
    description: "Espace dédié moderne avec tickets, chat et paiement en ligne. 11/15 concurrents sans.",
    badge: "Premium",
    gradient: "from-blue-500 to-cyan-500",
  },
];

const TRUST_STATS = [
  { value: "+10 000", label: "Propriétaires", icon: Building2 },
  { value: "+50 000", label: "Biens gérés", icon: Building2 },
  { value: "4.8/5", label: "Satisfaction", icon: Star },
  { value: "24h", label: "Support", icon: Clock },
];

const INCLUDED_FEATURES = [
  "Quittances automatiques",
  "Baux conformes loi ALUR",
  "E-signature légale",
  "Révision IRL auto",
  "Relances impayés",
  "Export comptable",
  "EDL numériques",
  "Multi-utilisateurs",
];

// ============================================
// MAIN COMPONENT
// ============================================

export function WhyChooseUs({ className, variant = "full" }: WhyChooseUsProps) {
  return (
    <section className={cn(
      "py-16 md:py-24 bg-gradient-to-b from-slate-900/50 to-slate-950",
      className
    )}>
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 mb-4">
            <Shield className="w-3 h-3 mr-1" />
            Pourquoi nous choisir
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            La solution la plus{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              complète du marché
            </span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Après analyse de 15 concurrents (Rentila, Smovin, Hektor...), 
            Talok se distingue par 4 fonctionnalités uniques.
          </p>
        </motion.div>

        {/* Key Advantages Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
        >
          {KEY_ADVANTAGES.map((advantage, index) => (
            <motion.div
              key={advantage.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -4 }}
              className="relative p-6 rounded-2xl bg-slate-800/30 border border-slate-700/50 hover:border-slate-600 transition-all duration-300 group"
            >
              {/* Badge */}
              <div className="absolute -top-2.5 right-4">
                <Badge className={cn(
                  "border-0 text-white text-xs font-bold",
                  `bg-gradient-to-r ${advantage.gradient}`
                )}>
                  {advantage.badge}
                </Badge>
              </div>

              {/* Icon */}
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                `bg-gradient-to-br ${advantage.gradient} text-white`,
                "group-hover:scale-110 transition-transform duration-300"
              )}>
                <advantage.icon className="w-6 h-6" />
              </div>

              {/* Content */}
              <h3 className="text-lg font-bold text-white mb-2">
                {advantage.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {advantage.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {variant === "full" && (
          <>
            {/* Trust Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16"
            >
              {TRUST_STATS.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="text-center p-6 rounded-2xl bg-slate-800/20 border border-slate-700/30"
                >
                  <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-violet-500/20 flex items-center justify-center">
                    <stat.icon className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="text-2xl md:text-3xl font-bold text-white mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-slate-500">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>

            {/* Features Included */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-4xl mx-auto mb-12"
            >
              <h3 className="text-xl font-bold text-white text-center mb-6">
                Inclus dans tous les forfaits
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {INCLUDED_FEATURES.map((feature, index) => (
                  <motion.div
                    key={feature}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-slate-300">{feature}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Comparison Teaser */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-3xl mx-auto"
            >
              <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      Score fonctionnalités : <span className="text-emerald-400">10/10</span>
                    </h3>
                    <p className="text-slate-400 text-sm">
                      vs Rentila (3/10), Smovin (5/10), Hektor (6/10), Ublo (8/10)
                    </p>
                  </div>
                  <Button
                    asChild
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 whitespace-nowrap"
                  >
                    <Link href="/pricing#comparison">
                      Voir le comparatif
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="bg-white text-slate-900 hover:bg-slate-100"
            >
              <Link href="/auth/register">
                Créer mon compte gratuit
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-violet-500/50 text-violet-300 hover:bg-violet-500/10"
            >
              <Link href="/pricing">
                Voir les tarifs
              </Link>
            </Button>
          </div>
          <p className="text-sm text-slate-500 mt-4">
            1er mois offert • Sans engagement • Support français
          </p>
        </motion.div>
      </div>
    </section>
  );
}

export default WhyChooseUs;

