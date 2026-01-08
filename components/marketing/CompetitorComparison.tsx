"use client";

/**
 * CompetitorComparison - Tableau comparatif vs concurrence
 * 
 * Composant standalone réutilisable pour afficher la comparaison
 * Talok vs les principaux concurrents du marché français
 * 
 * Basé sur le benchmark de 15 concurrents (Rentila, Smovin, Hektor, etc.)
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Check,
  X,
  Trophy,
  TrendingUp,
  ChevronDown,
  Info,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================
// TYPES
// ============================================

interface Competitor {
  id: string;
  name: string;
  logo?: string;
  price: string;
  description?: string;
}

interface ComparisonFeature {
  id: string;
  name: string;
  description?: string;
  category: string;
  talok: boolean | string;
  competitors: Record<string, boolean | string>;
  isHighlight?: boolean;
}

interface CompetitorComparisonProps {
  className?: string;
  showTitle?: boolean;
  showScores?: boolean;
  variant?: "full" | "compact" | "minimal";
  highlightedFeatures?: string[];
}

// ============================================
// DATA - Basé sur le benchmark concurrentiel
// ============================================

const COMPETITORS: Competitor[] = [
  { 
    id: "rentila", 
    name: "Rentila", 
    price: "9,90€/mois",
    description: "Leader historique, freemium"
  },
  { 
    id: "smovin", 
    name: "Smovin", 
    price: "39€/mois",
    description: "E-signature intégrée"
  },
  { 
    id: "hektor", 
    name: "Hektor", 
    price: "69€/mois",
    description: "Focus agences"
  },
  { 
    id: "ublo", 
    name: "Ublo", 
    price: "Sur devis",
    description: "Bailleurs sociaux"
  },
];

const COMPARISON_FEATURES: ComparisonFeature[] = [
  // Différenciateurs majeurs
  {
    id: "open_banking",
    name: "Open Banking",
    description: "Synchronisation bancaire automatique, rapprochement loyers/paiements",
    category: "💰 Finance",
    talok: true,
    competitors: { rentila: false, smovin: false, hektor: false, ublo: true },
    isHighlight: true,
  },
  {
    id: "scoring_ia",
    name: "Scoring IA Locataire",
    description: "Analyse automatique dossiers, score solvabilité, détection fraude",
    category: "🤖 Innovation",
    talok: true,
    competitors: { rentila: false, smovin: false, hektor: false, ublo: false },
    isHighlight: true,
  },
  {
    id: "support_drom",
    name: "Support DROM",
    description: "Martinique, Guadeloupe, Réunion, Guyane, Mayotte - IRL spécifiques",
    category: "🌍 Couverture",
    talok: true,
    competitors: { rentila: false, smovin: false, hektor: false, ublo: false },
    isHighlight: true,
  },
  {
    id: "portail_locataire",
    name: "Portail Locataire",
    description: "Dashboard personnalisé, tickets, chat, paiement en ligne",
    category: "👤 Expérience",
    talok: true,
    competitors: { rentila: false, smovin: "basic", hektor: true, ublo: true },
    isHighlight: true,
  },
  // Fonctionnalités standards
  {
    id: "esignature",
    name: "E-signature intégrée",
    description: "Signature électronique légale des baux et documents",
    category: "📄 Documents",
    talok: true,
    competitors: { rentila: false, smovin: true, hektor: true, ublo: true },
  },
  {
    id: "edl_numeriques",
    name: "EDL numériques",
    description: "États des lieux avec photos, annotations, comparatif entrée/sortie",
    category: "📄 Documents",
    talok: true,
    competitors: { rentila: false, smovin: "basic", hektor: true, ublo: true },
  },
  {
    id: "channel_manager",
    name: "Channel Manager",
    description: "Sync Airbnb, Booking, Abritel pour locations saisonnières",
    category: "🏨 Saisonnier",
    talok: true,
    competitors: { rentila: false, smovin: false, hektor: "basic", ublo: "basic" },
  },
  {
    id: "api_ouverte",
    name: "API ouverte",
    description: "Intégration avec outils tiers, automatisations",
    category: "🔧 Technique",
    talok: true,
    competitors: { rentila: false, smovin: false, hektor: "basic", ublo: true },
  },
  {
    id: "white_label",
    name: "White Label",
    description: "Personnalisation avec votre marque, domaine personnalisé",
    category: "🎨 Branding",
    talok: true,
    competitors: { rentila: false, smovin: false, hektor: false, ublo: true },
  },
  {
    id: "colocation",
    name: "Gestion Colocation",
    description: "Caution solidaire, turnover, baux multi-locataires",
    category: "🏠 Gestion",
    talok: true,
    competitors: { rentila: true, smovin: true, hektor: true, ublo: true },
  },
  {
    id: "relances_auto",
    name: "Relances automatiques",
    description: "Email et SMS pour les loyers impayés",
    category: "⚡ Automatisation",
    talok: true,
    competitors: { rentila: "basic", smovin: true, hektor: true, ublo: true },
  },
  {
    id: "multi_utilisateurs",
    name: "Multi-utilisateurs",
    description: "Gestion d'équipe avec rôles et permissions",
    category: "👥 Collaboration",
    talok: true,
    competitors: { rentila: false, smovin: "basic", hektor: true, ublo: true },
  },
];

// Calcul des scores
function calculateScore(competitor: string): number {
  return COMPARISON_FEATURES.filter(f => {
    const value = competitor === "talok" ? f.talok : f.competitors[competitor];
    return value === true;
  }).length;
}

const SCORES = {
  talok: calculateScore("talok"),
  rentila: calculateScore("rentila"),
  smovin: calculateScore("smovin"),
  hektor: calculateScore("hektor"),
  ublo: calculateScore("ublo"),
};

// ============================================
// COMPONENTS
// ============================================

function FeatureCell({ 
  value, 
  isTalok = false 
}: { 
  value: boolean | string; 
  isTalok?: boolean;
}) {
  if (value === true) {
    return (
      <div className={cn(
        "inline-flex items-center justify-center w-8 h-8 rounded-full transition-transform",
        isTalok 
          ? "bg-emerald-500/20 scale-110" 
          : "bg-slate-700/50"
      )}>
        <Check className={cn(
          "w-5 h-5",
          isTalok ? "text-emerald-400" : "text-green-500"
        )} />
      </div>
    );
  }
  
  if (value === false) {
    return (
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10">
        <X className="w-5 h-5 text-red-400/70" />
      </div>
    );
  }
  
  // Valeur partielle (string)
  return (
    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
      {value === "basic" ? "Basique" : value}
    </Badge>
  );
}

function ScoreCard({ 
  name, 
  score, 
  maxScore, 
  isHighlighted = false,
  price,
}: { 
  name: string; 
  score: number; 
  maxScore: number;
  isHighlighted?: boolean;
  price?: string;
}) {
  const percentage = Math.round((score / maxScore) * 100);
  
  return (
    <div className={cn(
      "p-4 rounded-xl text-center transition-all",
      isHighlighted 
        ? "bg-emerald-500/10 border-2 border-emerald-500/30 scale-105" 
        : "bg-slate-800/30 border border-slate-700/50"
    )}>
      <div className={cn(
        "text-3xl font-bold mb-1",
        isHighlighted ? "text-emerald-400" : "text-slate-400"
      )}>
        {score}/{maxScore}
      </div>
      <div className={cn(
        "text-sm font-medium",
        isHighlighted ? "text-white" : "text-slate-400"
      )}>
        {name}
      </div>
      {price && (
        <div className="text-xs text-slate-500 mt-1">{price}</div>
      )}
      {/* Progress bar */}
      <div className="mt-2 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
        <motion.div 
          className={cn(
            "h-full rounded-full",
            isHighlighted ? "bg-emerald-500" : "bg-slate-500"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CompetitorComparison({
  className,
  showTitle = true,
  showScores = true,
  variant = "full",
  highlightedFeatures,
}: CompetitorComparisonProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showAllFeatures, setShowAllFeatures] = useState(variant === "full");
  
  // Filtrer les features à afficher
  const displayFeatures = showAllFeatures 
    ? COMPARISON_FEATURES 
    : COMPARISON_FEATURES.filter(f => f.isHighlight);
  
  // Grouper par catégorie
  const categories = [...new Set(displayFeatures.map(f => f.category))];
  
  const maxScore = COMPARISON_FEATURES.length;

  return (
    <div className={cn("w-full", className)}>
      {/* Header */}
      {showTitle && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 mb-4">
            <Trophy className="w-3 h-3 mr-1" />
            Analyse de 15 concurrents
          </Badge>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Talok vs <span className="text-slate-400">la concurrence</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm md:text-base">
            Comparaison objective avec Rentila, Smovin, Hektor, Ublo et autres acteurs du marché français.
          </p>
        </motion.div>
      )}

      {/* Scores Summary */}
      {showScores && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8"
        >
          <ScoreCard 
            name="Talok" 
            score={SCORES.talok} 
            maxScore={maxScore}
            isHighlighted 
            price="À partir de 19€"
          />
          {COMPETITORS.map(comp => (
            <ScoreCard
              key={comp.id}
              name={comp.name}
              score={SCORES[comp.id as keyof typeof SCORES]}
              maxScore={maxScore}
              price={comp.price}
            />
          ))}
        </motion.div>
      )}

      {/* Comparison Table */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="overflow-x-auto rounded-2xl border border-slate-700/50 bg-slate-800/30"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left p-4 text-slate-400 font-medium min-w-[200px]">
                Fonctionnalité
              </th>
              <th className="p-4 text-center min-w-[100px]">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Sparkles className="w-4 h-4" />
                    Talok
                  </span>
                </div>
              </th>
              {COMPETITORS.map((comp) => (
                <th key={comp.id} className="p-4 text-center min-w-[100px]">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-slate-300 font-medium">{comp.name}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{comp.description}</p>
                        <p className="text-xs text-slate-400 mt-1">{comp.price}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayFeatures.map((feature, i) => (
              <tr
                key={feature.id}
                className={cn(
                  "border-b border-slate-700/30 transition-colors",
                  i % 2 === 0 ? "bg-slate-800/20" : "",
                  feature.isHighlight && "bg-emerald-500/5"
                )}
              >
                <td className="p-4">
                  <div className="flex items-start gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{feature.name}</span>
                        {feature.isHighlight && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 text-xs px-1.5 py-0">
                            Unique
                          </Badge>
                        )}
                      </div>
                      {feature.description && (
                        <p className="text-xs text-slate-500 mt-0.5 max-w-[250px]">
                          {feature.description}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-4 text-center">
                  <FeatureCell value={feature.talok} isTalok />
                </td>
                {COMPETITORS.map((comp) => (
                  <td key={comp.id} className="p-4 text-center">
                    <FeatureCell value={feature.competitors[comp.id]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* Toggle more features */}
      {variant !== "minimal" && !showAllFeatures && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center mt-6"
        >
          <Button
            variant="outline"
            onClick={() => setShowAllFeatures(true)}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Voir toutes les fonctionnalités ({COMPARISON_FEATURES.length})
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
      )}

      {/* Legend */}
      <div className="mt-6 flex flex-wrap justify-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-4 h-4 text-emerald-400" />
          </div>
          <span>Disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-500/20 text-amber-400 text-xs">Basique</Badge>
          <span>Fonctionnalité limitée</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center">
            <X className="w-4 h-4 text-red-400/70" />
          </div>
          <span>Non disponible</span>
        </div>
      </div>
    </div>
  );
}

export default CompetitorComparison;

