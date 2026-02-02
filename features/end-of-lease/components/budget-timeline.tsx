"use client";

/**
 * Écran 4: Budget + Timeline automatique en 7 jours
 * Plan d'action clair que même un débutant comprend
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Euro,
  FileText,
  Hammer,
  Camera,
  Home,
  ArrowRight,
  Play,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
// Local types matching the component's richer timeline data model
type BudgetActionType =
  | "dg_retention"
  | "request_quotes"
  | "select_quote"
  | "start_renovation"
  | "take_photos"
  | "mark_ready"
  | "create_listing"
  | "custom";

interface BudgetTimelineItem {
  id: string;
  title: string;
  description: string;
  status: "completed" | "in_progress" | "pending";
  day_offset: number;
  action_type: BudgetActionType;
  scheduled_date?: string;
}

interface BudgetTimelineProps {
  timeline: BudgetTimelineItem[];
  budgetSummary: {
    tenantResponsibility: number;
    ownerResponsibility: number;
    totalBudget: number;
    dgRetention: number;
    dgRefund: number;
  };
  estimatedReadyDate: string;
  onActionClick: (actionId: string) => void;
  onComplete: () => void;
  onBack: () => void;
  className?: string;
}

const ACTION_ICONS: Record<BudgetActionType, React.ReactNode> = {
  dg_retention: <Euro className="w-5 h-5" />,
  request_quotes: <FileText className="w-5 h-5" />,
  select_quote: <CheckCircle2 className="w-5 h-5" />,
  start_renovation: <Hammer className="w-5 h-5" />,
  take_photos: <Camera className="w-5 h-5" />,
  mark_ready: <Home className="w-5 h-5" />,
  create_listing: <FileText className="w-5 h-5" />,
  custom: <Circle className="w-5 h-5" />,
};

const ACTION_COLORS: Record<BudgetActionType, string> = {
  dg_retention: "from-red-500 to-orange-500",
  request_quotes: "from-blue-500 to-cyan-500",
  select_quote: "from-green-500 to-emerald-500",
  start_renovation: "from-amber-500 to-yellow-500",
  take_photos: "from-purple-500 to-pink-500",
  mark_ready: "from-teal-500 to-green-500",
  create_listing: "from-indigo-500 to-blue-500",
  custom: "from-gray-500 to-gray-600",
};

export function BudgetTimeline({
  timeline,
  budgetSummary,
  estimatedReadyDate,
  onActionClick,
  onComplete,
  onBack,
  className,
}: BudgetTimelineProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  // Calculer la progression
  const completedActions = timeline.filter((t) => t.status === "completed").length;
  const progress = timeline.length > 0 ? (completedActions / timeline.length) * 100 : 0;

  // Calculer le nombre de jours total
  const totalDays = Math.max(...timeline.map((t) => t.day_offset), 7);

  // Formater la date estimée
  const formattedReadyDate = new Date(estimatedReadyDate).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Calendar className="w-6 h-6" />
              Plan d'action automatique
            </CardTitle>
            <p className="text-white/80 text-sm mt-1">
              Votre logement sera prêt en {totalDays} jours
            </p>
          </div>
          <Badge className="bg-white/20 text-white border-0 text-lg px-3 py-1">
            J+{totalDays}
          </Badge>
        </div>

        {/* Résumé budget */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">
              {budgetSummary.dgRetention.toLocaleString("fr-FR")} €
            </div>
            <div className="text-xs text-white/70">Récupéré (DG)</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">
              {budgetSummary.ownerResponsibility.toLocaleString("fr-FR")} €
            </div>
            <div className="text-xs text-white/70">À investir</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">
              {budgetSummary.totalBudget.toLocaleString("fr-FR")} €
            </div>
            <div className="text-xs text-white/70">Budget total</div>
          </div>
        </div>

        {/* Progression */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm text-white/80">
            <span>Progression</span>
            <span>{completedActions}/{timeline.length} actions</span>
          </div>
          <Progress value={progress} className="h-2 bg-white/30" />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Timeline visuelle */}
        <div className="p-6">
          <div className="relative">
            {/* Ligne verticale de connexion */}
            <div className="absolute left-[23px] top-0 bottom-0 w-0.5 bg-muted" />

            {timeline.map((item, index) => {
              const isCompleted = item.status === "completed";
              const isInProgress = item.status === "in_progress";
              const isPending = item.status === "pending";

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative flex gap-4 pb-6 last:pb-0"
                >
                  {/* Indicateur jour */}
                  <div className="flex-shrink-0 w-12 text-center">
                    <div
                      className={cn(
                        "relative z-10 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm",
                        isCompleted && "bg-green-500",
                        isInProgress && "bg-primary animate-pulse",
                        isPending && "bg-muted text-muted-foreground"
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-6 h-6" />
                      ) : (
                        `J+${item.day_offset}`
                      )}
                    </div>
                  </div>

                  {/* Contenu de l'action */}
                  <div
                    className={cn(
                      "flex-1 p-4 rounded-xl border transition-all cursor-pointer",
                      isCompleted && "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800",
                      isInProgress && "bg-primary/5 border-primary shadow-md",
                      isPending && "bg-muted/30 border-muted hover:border-primary/50 hover:shadow-sm"
                    )}
                    onClick={() => onActionClick(item.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "p-2 rounded-lg",
                            isCompleted && "bg-green-100 text-green-600 dark:bg-green-900/30",
                            isInProgress && "bg-primary/10 text-primary",
                            isPending && "bg-muted text-muted-foreground"
                          )}
                        >
                          {ACTION_ICONS[item.action_type]}
                        </div>
                        <div>
                          <h4 className="font-medium">{item.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      {isInProgress && (
                        <Button size="sm" className="gap-1">
                          <Play className="w-4 h-4" />
                          Faire
                        </Button>
                      )}

                      {isCompleted && (
                        <Badge variant="outline" className="border-green-500 text-green-600">
                          ✓ Fait
                        </Badge>
                      )}
                    </div>

                    {/* Date planifiée */}
                    {item.scheduled_date && (
                      <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.scheduled_date).toLocaleDateString("fr-FR", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Date estimée de disponibilité */}
        <div className="p-6 bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Logement prêt à relouer</div>
              <div className="text-xl font-semibold capitalize">{formattedReadyDate}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Nouveau loyer possible</div>
              <div className="text-xl font-semibold text-green-600">
                +{Math.round(budgetSummary.ownerResponsibility * 0.1)} €/mois
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="p-4 flex items-center justify-between bg-muted/30">
          <Button variant="outline" onClick={onBack}>
            Retour
          </Button>
          <Button onClick={onComplete} className="gap-2">
            Demander les devis
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

