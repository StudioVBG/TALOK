"use client";

/**
 * Écran 1: Checklist rapide de fin de bail
 * Interface simplifiée pour démarrer le processus
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Calendar,
  FileText,
  Camera,
  Calculator,
  Hammer,
  Home,
  ArrowRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { LeaseEndProcess, PROCESS_STEPS } from "@/lib/types/end-of-lease";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: "pending" | "current" | "completed";
  estimatedTime?: string;
}

interface LeaseEndChecklistProps {
  process: LeaseEndProcess;
  onStepClick: (stepId: string) => void;
  onContinue: () => void;
  className?: string;
}

export function LeaseEndChecklist({
  process,
  onStepClick,
  onContinue,
  className,
}: LeaseEndChecklistProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  // Définir les étapes de la checklist
  const checklistItems: ChecklistItem[] = [
    {
      id: "edl",
      title: "État des lieux de sortie",
      description: "Inspection rapide en 10 points maximum",
      icon: <Camera className="w-5 h-5" />,
      status: getStepStatus(process.status, ["edl_scheduled", "edl_in_progress", "edl_completed"]),
      estimatedTime: "10 min",
    },
    {
      id: "compare",
      title: "Comparaison entrée/sortie",
      description: "L'IA détecte automatiquement les dégradations",
      icon: <FileText className="w-5 h-5" />,
      status: getStepStatus(process.status, ["damages_assessed"]),
      estimatedTime: "Auto",
    },
    {
      id: "budget",
      title: "Calcul des coûts",
      description: "Estimation précise : locataire vs propriétaire",
      icon: <Calculator className="w-5 h-5" />,
      status: getStepStatus(process.status, ["dg_calculated"]),
      estimatedTime: "2 min",
    },
    {
      id: "renovation",
      title: "Planification des travaux",
      description: "Timeline automatique en 7 jours",
      icon: <Hammer className="w-5 h-5" />,
      status: getStepStatus(process.status, ["renovation_planned", "renovation_in_progress"]),
      estimatedTime: "5 min",
    },
    {
      id: "ready",
      title: "Prêt à relouer",
      description: "Nouveau bail + annonce optimisée",
      icon: <Home className="w-5 h-5" />,
      status: getStepStatus(process.status, ["ready_to_rent", "completed"]),
      estimatedTime: "3 min",
    },
  ];

  // Calculer le temps total estimé
  const totalTime = "~20 min";
  const completedSteps = checklistItems.filter((item) => item.status === "completed").length;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="bg-gradient-to-br from-primary/5 to-primary/10 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <span className="text-2xl">📋</span>
              Processus de fin de bail
            </CardTitle>
            <CardDescription className="mt-1">
              Gérez la fin de bail en moins de 10 minutes
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-sm font-medium">
            {completedSteps}/{checklistItems.length} étapes
          </Badge>
        </div>

        {/* Barre de progression globale */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progression</span>
            <span className="font-medium">{process.progress_percentage}%</span>
          </div>
          <Progress value={process.progress_percentage} className="h-2" />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="divide-y">
          {checklistItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "relative",
                item.status === "current" && "bg-primary/5"
              )}
            >
              <button
                onClick={() => onStepClick(item.id)}
                className={cn(
                  "w-full p-4 flex items-start gap-4 text-left transition-colors",
                  "hover:bg-muted/50",
                  item.status === "pending" && "opacity-60"
                )}
              >
                {/* Indicateur de statut */}
                <div className="flex-shrink-0 mt-0.5">
                  {item.status === "completed" ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    >
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    </motion.div>
                  ) : item.status === "current" ? (
                    <div className="relative">
                      <Circle className="w-6 h-6 text-primary" />
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-primary"
                        animate={{ scale: [1, 1.3, 1], opacity: [1, 0, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </div>
                  ) : (
                    <Circle className="w-6 h-6 text-muted-foreground/40" />
                  )}
                </div>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "p-1.5 rounded-lg",
                        item.status === "completed" && "bg-green-100 text-green-600 dark:bg-green-900/30",
                        item.status === "current" && "bg-primary/10 text-primary",
                        item.status === "pending" && "bg-muted text-muted-foreground"
                      )}
                    >
                      {item.icon}
                    </span>
                    <h4 className="font-medium">{item.title}</h4>
                    {item.status === "current" && (
                      <Badge className="ml-auto">En cours</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {item.description}
                  </p>
                </div>

                {/* Temps estimé */}
                <div className="flex-shrink-0 text-right">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Info className="w-3 h-3" />
                          {item.estimatedTime}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        Temps estimé pour cette étape
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </button>

              {/* Ligne de connexion verticale */}
              {index < checklistItems.length - 1 && (
                <div
                  className={cn(
                    "absolute left-[30px] top-[52px] w-0.5 h-[calc(100%-52px)]",
                    item.status === "completed" ? "bg-green-500" : "bg-muted"
                  )}
                />
              )}
            </motion.div>
          ))}
        </div>

        <Separator />

        {/* Résumé et action */}
        <div className="p-4 bg-muted/30">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm">
              <span className="text-muted-foreground">Temps total estimé : </span>
              <span className="font-medium">{totalTime}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              Fin de bail : {new Date(process.lease_end_date).toLocaleDateString("fr-FR")}
            </div>
          </div>

          <Button
            onClick={onContinue}
            size="lg"
            className="w-full group"
          >
            Continuer le processus
            <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper pour déterminer le statut d'une étape
function getStepStatus(
  currentStatus: string,
  stepStatuses: string[]
): "pending" | "current" | "completed" {
  const statusOrder = [
    "pending",
    "triggered",
    "edl_scheduled",
    "edl_in_progress",
    "edl_completed",
    "damages_assessed",
    "dg_calculated",
    "renovation_planned",
    "renovation_in_progress",
    "ready_to_rent",
    "completed",
  ];

  const currentIndex = statusOrder.indexOf(currentStatus);
  const stepIndices = stepStatuses.map((s) => statusOrder.indexOf(s));
  const minStepIndex = Math.min(...stepIndices);
  const maxStepIndex = Math.max(...stepIndices);

  if (currentIndex > maxStepIndex) {
    return "completed";
  } else if (currentIndex >= minStepIndex && currentIndex <= maxStepIndex) {
    return "current";
  }
  return "pending";
}

