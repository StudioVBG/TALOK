"use client";

/**
 * Écran 3: Résultats de l'évaluation des dommages + Répartition des coûts
 * 3 catégories simples : Locataire / Vétusté / Conseillé
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Clock,
  Sparkles,
  Euro,
  User,
  Home,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DamageType, DAMAGE_TYPE_LABELS } from "@/lib/types/end-of-lease";

interface DamageItem {
  id: string;
  category: string;
  description: string;
  damageType: DamageType;
  estimatedCost: number;
  vetustyRate?: number;
  tenantShare: number;
  ownerShare: number;
  photos?: string[];
}

interface DamageAssessmentResultsProps {
  damages: DamageItem[];
  dgAmount: number;
  onContinue: () => void;
  onBack: () => void;
  className?: string;
}

const DAMAGE_CONFIG: Record<string, {
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  description: string;
}> = {
  tenant_damage: {
    label: "Dommages locataire",
    icon: <AlertTriangle className="w-5 h-5" />,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    description: "Retenue sur dépôt de garantie",
  },
  normal_wear: {
    label: "Usure normale",
    icon: <Clock className="w-5 h-5" />,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    description: "À charge du propriétaire (vétusté)",
  },
  recommended_renovation: {
    label: "Rénovation conseillée",
    icon: <Sparkles className="w-5 h-5" />,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    description: "Optionnel - augmente la valeur locative",
  },
};

export function DamageAssessmentResults({
  damages,
  dgAmount,
  onContinue,
  onBack,
  className,
}: DamageAssessmentResultsProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Calculer les totaux par catégorie
  const totals = {
    tenant: damages
      .filter((d) => d.damageType === "tenant_damage")
      .reduce((sum, d) => sum + d.tenantShare, 0),
    owner: damages
      .filter((d) => d.damageType === "normal_wear")
      .reduce((sum, d) => sum + d.ownerShare, 0),
    recommended: damages
      .filter((d) => (d.damageType as string) === "recommended_renovation")
      .reduce((sum, d) => sum + d.estimatedCost, 0),
  };

  // Calculer la retenue DG
  const dgRetention = Math.min(totals.tenant, dgAmount);
  const dgRefund = dgAmount - dgRetention;

  // Total pour le propriétaire
  const totalOwnerBudget = totals.owner + totals.recommended;

  // Grouper les dommages par type
  const groupedDamages = {
    tenant: damages.filter((d) => d.damageType === "tenant_damage"),
    owner: damages.filter((d) => d.damageType === "normal_wear"),
    recommended: damages.filter((d) => (d.damageType as string) === "recommended_renovation"),
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="bg-gradient-to-r from-violet-500 to-purple-500 text-white">
        <CardTitle className="text-xl flex items-center gap-2">
          <Euro className="w-6 h-6" />
          Répartition des coûts
        </CardTitle>
        <p className="text-white/80 text-sm mt-1">
          Qui paie quoi ? Résumé clair et juridiquement correct
        </p>
      </CardHeader>

      <CardContent className="p-0">
        {/* 3 Montants clés - Ultra simple */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
          {/* A. Retenue DG (locataire) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative p-4 rounded-xl bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/20 border border-red-200 dark:border-red-800"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-2 rounded-lg", DAMAGE_CONFIG.tenant_damage.bgColor)}>
                <User className={cn("w-5 h-5", DAMAGE_CONFIG.tenant_damage.color)} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Locataire</div>
                <div className="font-medium text-sm">Retenue DG</div>
              </div>
            </div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">
              {dgRetention.toLocaleString("fr-FR")} €
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              sur {dgAmount.toLocaleString("fr-FR")} € de DG
            </div>
          </motion.div>

          {/* B. Coût propriétaire (vétusté) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative p-4 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 border border-amber-200 dark:border-amber-800"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-2 rounded-lg", DAMAGE_CONFIG.normal_wear.bgColor)}>
                <Home className={cn("w-5 h-5", DAMAGE_CONFIG.normal_wear.color)} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Propriétaire</div>
                <div className="font-medium text-sm">Travaux obligatoires</div>
              </div>
            </div>
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {totals.owner.toLocaleString("fr-FR")} €
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Vétusté et usure normale
            </div>
          </motion.div>

          {/* C. Rénovation conseillée */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("p-2 rounded-lg", DAMAGE_CONFIG.recommended_renovation.bgColor)}>
                <Sparkles className={cn("w-5 h-5", DAMAGE_CONFIG.recommended_renovation.color)} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Optionnel</div>
                <div className="font-medium text-sm">Rénovation +</div>
              </div>
            </div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {totals.recommended.toLocaleString("fr-FR")} €
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Pour augmenter le loyer
            </div>
          </motion.div>
        </div>

        <Separator />

        {/* Résumé total */}
        <div className="p-6 bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Budget total pour remise en location</div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">
                  {(dgRetention + totalOwnerBudget).toLocaleString("fr-FR")} €
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">
                        = {dgRetention.toLocaleString("fr-FR")} € (locataire) +{" "}
                        {totals.owner.toLocaleString("fr-FR")} € (vétusté) +{" "}
                        {totals.recommended.toLocaleString("fr-FR")} € (optionnel)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="text-center">
                <div className="text-muted-foreground">À rembourser</div>
                <div className="font-semibold text-green-600">
                  {dgRefund.toLocaleString("fr-FR")} €
                </div>
              </div>
              <Separator orientation="vertical" className="h-10" />
              <div className="text-center">
                <div className="text-muted-foreground">À investir</div>
                <div className="font-semibold text-primary">
                  {totalOwnerBudget.toLocaleString("fr-FR")} €
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Détails (accordéon) */}
        <div className="p-6">
          <Button
            variant="ghost"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full justify-between"
          >
            <span>Voir le détail des dommages</span>
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>

          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4 space-y-4"
            >
              {Object.entries(groupedDamages).map(([type, items]) => {
                if (items.length === 0) return null;
                const config = DAMAGE_CONFIG[type as DamageType];

                return (
                  <div key={type} className="space-y-2">
                    <div className={cn("flex items-center gap-2 font-medium", config.color)}>
                      {config.icon}
                      {config.label} ({items.length})
                    </div>
                    <div className="space-y-2 pl-7">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div>
                            <div className="font-medium text-sm">{item.category}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.description}
                            </div>
                            {item.vetustyRate !== undefined && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                Vétusté : {Math.round((item.vetustyRate || 0) * 100)}%
                              </Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">
                              {item.estimatedCost.toLocaleString("fr-FR")} €
                            </div>
                            {type === "tenant_damage" && (
                              <div className="text-xs text-muted-foreground">
                                Locataire : {item.tenantShare.toLocaleString("fr-FR")} €
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div className="p-4 flex items-center justify-between bg-muted/30">
          <Button variant="outline" onClick={onBack}>
            Retour
          </Button>
          <Button onClick={onContinue} className="gap-2">
            Voir le planning
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

