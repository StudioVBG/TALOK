"use client";

/**
 * Carte de processus de fin de bail
 * Affiche le résumé d'un processus en cours
 */

import { motion } from "framer-motion";
import {
  Calendar,
  ChevronRight,
  Euro,
  Home,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { LeaseEndProcess, LeaseEndProcessStatus, RENTAL_STATUS_LABELS } from "@/lib/types/end-of-lease";

interface LeaseEndProcessCardProps {
  process: LeaseEndProcess;
  onClick?: () => void;
  className?: string;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  pending: { label: "En attente", color: "text-gray-600", bgColor: "bg-gray-100" },
  triggered: { label: "Démarré", color: "text-blue-600", bgColor: "bg-blue-100" },
  edl_scheduled: { label: "EDL planifié", color: "text-blue-600", bgColor: "bg-blue-100" },
  edl_in_progress: { label: "EDL en cours", color: "text-amber-600", bgColor: "bg-amber-100" },
  edl_completed: { label: "EDL terminé", color: "text-amber-600", bgColor: "bg-amber-100" },
  damages_assessed: { label: "Dommages évalués", color: "text-purple-600", bgColor: "bg-purple-100" },
  dg_calculated: { label: "DG calculée", color: "text-purple-600", bgColor: "bg-purple-100" },
  renovation_planned: { label: "Travaux planifiés", color: "text-orange-600", bgColor: "bg-orange-100" },
  renovation_in_progress: { label: "Travaux en cours", color: "text-orange-600", bgColor: "bg-orange-100" },
  ready_to_rent: { label: "Prêt à louer", color: "text-green-600", bgColor: "bg-green-100" },
  completed: { label: "Terminé", color: "text-green-600", bgColor: "bg-green-100" },
  cancelled: { label: "Annulé", color: "text-red-600", bgColor: "bg-red-100" },
};

export function LeaseEndProcessCard({
  process,
  onClick,
  className,
}: LeaseEndProcessCardProps) {
  const statusConfig = STATUS_CONFIG[process.status] || STATUS_CONFIG.pending;
  const daysUntilEnd = Math.ceil(
    (new Date((process as any).lease_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const isUrgent = daysUntilEnd <= 30;

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn("cursor-pointer", className)}
    >
      <Card className={cn(
        "overflow-hidden transition-shadow hover:shadow-lg",
        isUrgent && "border-orange-300 dark:border-orange-700"
      )}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            {/* Icône logement */}
            <div className={cn(
              "p-3 rounded-xl",
              isUrgent ? "bg-orange-100 dark:bg-orange-900/30" : "bg-primary/10"
            )}>
              <Home className={cn(
                "w-6 h-6",
                isUrgent ? "text-orange-600" : "text-primary"
              )} />
            </div>

            {/* Infos principales */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold truncate">
                  {process.property?.adresse_complete || "Logement"}
                </h4>
                <Badge
                  variant="outline"
                  className={cn("flex-shrink-0", statusConfig.color, statusConfig.bgColor)}
                >
                  {statusConfig.label}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground mb-2">
                {process.property?.ville} • {process.lease?.type_bail}
              </p>

              {/* Progression */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Progression</span>
                  <span className="font-medium">{(process as any).progress_percentage}%</span>
                </div>
                <Progress value={(process as any).progress_percentage} className="h-1.5" />
              </div>
            </div>

            {/* Indicateurs */}
            <div className="flex flex-col items-end gap-2">
              {/* Jours restants */}
              <div className={cn(
                "flex items-center gap-1 text-sm font-medium",
                isUrgent ? "text-orange-600" : "text-muted-foreground"
              )}>
                {isUrgent && <AlertCircle className="w-4 h-4" />}
                <Clock className="w-4 h-4" />
                J-{daysUntilEnd}
              </div>

              {/* Budget */}
              {process.total_budget > 0 && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Euro className="w-4 h-4" />
                  {process.total_budget.toLocaleString("fr-FR")} €
                </div>
              )}

              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>

          {/* Date de fin */}
          <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Fin de bail : {new Date((process as any).lease_end_date).toLocaleDateString("fr-FR")}
            </div>

            {process.ready_to_rent_date && (
              <div>
                Dispo : {new Date(process.ready_to_rent_date).toLocaleDateString("fr-FR")}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

