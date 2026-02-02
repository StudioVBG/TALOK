"use client";

/**
 * Composant: Alerte de fin de bail
 * Affiche une notification pour déclencher le processus de fin de bail
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ArrowRight, Home, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LeaseSummary, PropertySummary } from "@/lib/types/end-of-lease";

interface LeaseEndAlertProps {
  lease: LeaseSummary;
  property: PropertySummary;
  daysUntilEnd: number;
  onStartProcess: () => void;
  onDismiss?: () => void;
  className?: string;
}

const LEASE_TYPE_LABELS: Record<string, string> = {
  nu: "Location nue",
  meuble: "Meublé",
  colocation: "Colocation",
  saisonnier: "Saisonnier",
  mobilite: "Mobilité",
  etudiant: "Étudiant",
  commercial: "Commercial",
};

export function LeaseEndAlert({
  lease,
  property,
  daysUntilEnd,
  onStartProcess,
  onDismiss,
  className,
}: LeaseEndAlertProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Déterminer l'urgence
  const isUrgent = daysUntilEnd <= 30;
  const isWarning = daysUntilEnd <= 60 && daysUntilEnd > 30;

  // Formatter la date de fin
  const endDate = new Date(lease.date_fin!);
  const formattedDate = endDate.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={className}
    >
      <Card
        className={cn(
          "relative overflow-hidden transition-all duration-300",
          "border-2",
          isUrgent && "border-red-500/50 bg-red-50/50 dark:bg-red-950/20",
          isWarning && "border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20",
          !isUrgent && !isWarning && "border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20",
          isHovered && "shadow-lg scale-[1.01]"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Gradient de fond animé */}
        <div
          className={cn(
            "absolute inset-0 opacity-10",
            isUrgent && "bg-gradient-to-br from-red-500 to-orange-500",
            isWarning && "bg-gradient-to-br from-orange-500 to-yellow-500",
            !isUrgent && !isWarning && "bg-gradient-to-br from-blue-500 to-cyan-500"
          )}
        />

        <div className="relative p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
            {/* Icône avec animation */}
            <motion.div
              animate={{ rotate: isHovered ? [0, -10, 10, -10, 0] : 0 }}
              transition={{ duration: 0.5 }}
              className={cn(
                "flex-shrink-0 p-3 rounded-xl",
                isUrgent && "bg-red-500/20 text-red-600 dark:text-red-400",
                isWarning && "bg-orange-500/20 text-orange-600 dark:text-orange-400",
                !isUrgent && !isWarning && "bg-blue-500/20 text-blue-600 dark:text-blue-400"
              )}
            >
              {isUrgent ? (
                <AlertTriangle className="w-8 h-8" />
              ) : (
                <Calendar className="w-8 h-8" />
              )}
            </motion.div>

            {/* Contenu */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  variant="outline"
                  className={cn(
                    "font-medium",
                    isUrgent && "border-red-500 text-red-600",
                    isWarning && "border-orange-500 text-orange-600",
                    !isUrgent && !isWarning && "border-blue-500 text-blue-600"
                  )}
                >
                  <Clock className="w-3 h-3 mr-1" />
                  J-{daysUntilEnd}
                </Badge>
                <Badge variant="secondary" className="hidden sm:inline-flex">
                  {LEASE_TYPE_LABELS[lease.type_bail] || lease.type_bail}
                </Badge>
              </div>

              <h3 className="text-lg font-semibold text-foreground mb-1">
                Fin de bail prévue le {formattedDate}
              </h3>

              <div className="flex items-center text-muted-foreground text-sm mb-3">
                <Home className="w-4 h-4 mr-1.5 flex-shrink-0" />
                <span className="truncate">
                  {property.adresse_complete}, {(property as any).ville}
                </span>
              </div>

              <p className="text-sm text-muted-foreground">
                Voulez-vous anticiper les travaux et la remise en location ?
              </p>
            </div>

            {/* Bouton d'action */}
            <div className="flex flex-col sm:flex-row gap-2 md:flex-col lg:flex-row">
              <Button
                onClick={onStartProcess}
                size="lg"
                className={cn(
                  "group relative overflow-hidden font-semibold",
                  isUrgent && "bg-red-600 hover:bg-red-700",
                  isWarning && "bg-orange-600 hover:bg-orange-700",
                  !isUrgent && !isWarning && "bg-blue-600 hover:bg-blue-700"
                )}
              >
                <span className="relative z-10 flex items-center">
                  Lancer la préparation
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </span>
                <motion.div
                  className="absolute inset-0 bg-white/20"
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "100%" }}
                  transition={{ duration: 0.5 }}
                />
              </Button>

              {onDismiss && (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={onDismiss}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Plus tard
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Barre de progression du temps restant */}
        <div className="h-1 bg-black/5 dark:bg-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(0, 100 - (daysUntilEnd / 90) * 100)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn(
              "h-full",
              isUrgent && "bg-red-500",
              isWarning && "bg-orange-500",
              !isUrgent && !isWarning && "bg-blue-500"
            )}
          />
        </div>
      </Card>
    </motion.div>
  );
}

