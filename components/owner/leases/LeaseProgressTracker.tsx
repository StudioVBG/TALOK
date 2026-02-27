"use client";

import { cn } from "@/lib/utils";
import { 
  FileSignature, 
  ClipboardCheck, 
  Euro, 
  Key, 
  CheckCircle2,
  Loader2,
  Clock,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * SSOT 2026 — Statuts alignés avec la CHECK DB.
 * Migration : 20260108400000_lease_lifecycle_sota2026.sql
 */
export type LeaseProgressStatus =
  | "draft"              // Brouillon initial
  | "pending_signature"  // En attente de signatures
  | "partially_signed"   // Partiellement signé (colocation multi-signataires)
  | "fully_signed"       // Entièrement signé (attente EDL)
  | "active"             // Bail en cours
  | "terminated"         // Terminé
  | "archived"           // Archivé
  | "cancelled";         // Annulé

interface LeaseProgressTrackerProps {
  status: LeaseProgressStatus;
  hasSignedEdl: boolean;
  hasPaidInitial: boolean;
  hasKeysHandedOver?: boolean;
  className?: string;
  compact?: boolean;
}

export function LeaseProgressTracker({
  status,
  hasSignedEdl,
  hasPaidInitial,
  hasKeysHandedOver = false,
  className,
  compact = false
}: LeaseProgressTrackerProps) {
  
  const steps = [
    {
      id: "signature",
      label: "Signatures",
      description: "Bail signé par tous",
      detailDone: "Locataire et propriétaire ont signé",
      detailInProgress: "En attente de signatures",
      detailPending: "Les deux parties doivent signer",
      icon: FileSignature,
      isDone: ["fully_signed", "active", "terminated", "archived"].includes(status),
      isInProgress: ["pending_signature", "partially_signed"].includes(status)
    },
    {
      id: "edl",
      label: "État des lieux",
      description: "EDL d'entrée",
      detailDone: "État des lieux signé",
      detailInProgress: "EDL à compléter et signer",
      detailPending: "L'EDL sera créé après signature",
      icon: ClipboardCheck,
      // Ne pas marquer comme fait par défaut si on est "active" —
      // utiliser uniquement hasSignedEdl comme source de vérité
      isDone: hasSignedEdl,
      isInProgress: (status === "fully_signed" || status === "active") && !hasSignedEdl
    },
    {
      id: "payment",
      label: "1er paiement",
      description: "Loyer + dépôt",
      detailDone: "Premier versement reçu",
      detailInProgress: "En attente du paiement initial",
      detailPending: "Loyer + charges + dépôt de garantie",
      icon: Euro,
      // Ne pas assumer que le paiement est fait juste parce que le bail est actif
      isDone: hasPaidInitial,
      isInProgress: (status === "fully_signed" && hasSignedEdl && !hasPaidInitial) || (status === "active" && !hasPaidInitial)
    },
    {
      id: "keys",
      label: "Remise des clés",
      description: "Bail actif",
      detailDone: "Le locataire est installé !",
      detailInProgress: "Prêt pour la remise des clés — Générez le QR code",
      detailPending: "Étape finale",
      icon: Key,
      isDone: hasKeysHandedOver || (status === "active" && hasSignedEdl && hasPaidInitial && hasKeysHandedOver),
      isInProgress: !hasKeysHandedOver && ((status === "active" && hasSignedEdl && hasPaidInitial) || (hasSignedEdl && hasPaidInitial && status === "fully_signed"))
    }
  ];

  // Calculer le pourcentage de progression
  const completedSteps = steps.filter(s => s.isDone).length;
  const progressPercent = Math.round((completedSteps / steps.length) * 100);

  return (
    <TooltipProvider>
      <div className={cn("w-full", className)}>
        {/* Header avec pourcentage - SOTA 2026 */}
        {!compact && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-slate-700">
                Progression du bail
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={cn(
                    "h-full rounded-full",
                    progressPercent === 100 ? "bg-gradient-to-r from-emerald-500 to-green-500" : "bg-gradient-to-r from-blue-500 to-indigo-500"
                  )}
                />
              </div>
              <span className={cn(
                "text-sm font-bold",
                progressPercent === 100 ? "text-emerald-600" : "text-blue-600"
              )}>
                {progressPercent}%
              </span>
            </div>
          </div>
        )}

        {/* Steps */}
        <div className="relative flex justify-between items-start">
          {/* Ligne de fond */}
          <div className="absolute top-5 left-[10%] right-[10%] h-1 bg-slate-100 rounded-full -z-10" />
          
          {/* Ligne de progression active */}
          <motion.div 
            initial={{ width: "0%" }}
            animate={{ width: `${Math.max(0, (completedSteps - 0.5) / (steps.length - 1)) * 80}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute top-5 left-[10%] h-1 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full -z-10"
          />
          
          {steps.map((step, index) => {
            const Icon = step.icon;
            
            const tooltipContent = step.isDone 
              ? step.detailDone 
              : step.isInProgress 
              ? step.detailInProgress 
              : step.detailPending;
            
            return (
              <Tooltip key={step.id}>
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-center group relative flex-1 cursor-pointer">
                    {/* Cercle avec animation pulse pour l'étape en cours */}
                    <motion.div 
                      initial={false}
                      animate={{
                        scale: step.isInProgress ? [1, 1.05, 1] : 1,
                      }}
                      transition={step.isInProgress ? {
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      } : {}}
                      className="relative"
                    >
                      {/* Ring d'animation pour étape en cours */}
                      {step.isInProgress && (
                        <motion.div
                          animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="absolute inset-0 rounded-full bg-blue-400"
                        />
                      )}
                      
                      <motion.div 
                        initial={false}
                        animate={{
                          backgroundColor: step.isDone 
                            ? "#10b981" 
                            : step.isInProgress 
                            ? "#3b82f6" 
                            : "#f1f5f9",
                          boxShadow: step.isDone 
                            ? "0 0 0 4px rgba(16, 185, 129, 0.2)"
                            : step.isInProgress 
                            ? "0 0 0 4px rgba(59, 130, 246, 0.2)"
                            : "none"
                        }}
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center transition-all relative z-10",
                          step.isDone || step.isInProgress ? "text-white" : "text-slate-400"
                        )}
                      >
                        <AnimatePresence mode="wait">
                          {step.isDone ? (
                            <motion.div
                              key="done"
                              initial={{ scale: 0, rotate: -180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              exit={{ scale: 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 25 }}
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </motion.div>
                          ) : step.isInProgress ? (
                            <motion.div
                              key="progress"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <Icon className="w-5 h-5" />
                            </motion.div>
                          ) : (
                            <motion.div
                              key="pending"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <Icon className="w-5 h-5" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    </motion.div>

                    {/* Libellé & Description */}
                    <div className="mt-3 text-center px-1">
                      <p className={cn(
                        "text-xs font-bold uppercase tracking-tight transition-colors",
                        step.isDone ? "text-emerald-600" : step.isInProgress ? "text-blue-600" : "text-slate-400"
                      )}>
                        {step.label}
                      </p>
                      {!compact && (
                        <p className={cn(
                          "text-[10px] font-medium mt-0.5 leading-tight hidden sm:block transition-colors",
                          step.isDone ? "text-emerald-500" : step.isInProgress ? "text-blue-500" : "text-slate-400"
                        )}>
                          {step.description}
                        </p>
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent 
                  side="bottom" 
                  className={cn(
                    "px-3 py-2 text-sm font-medium",
                    step.isDone ? "bg-emerald-600" : step.isInProgress ? "bg-blue-600" : "bg-slate-700"
                  )}
                >
                  {tooltipContent}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Résumé textuel explicite des étapes */}
        {!compact && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-5"
          >
            {progressPercent === 100 ? (
              <div className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-50 to-green-50 rounded-full border border-emerald-200">
                <span className="text-lg">🎉</span>
                <span className="text-sm font-semibold text-emerald-700">
                  Bail actif - Tout est en ordre !
                </span>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-lg border border-slate-100 p-3">
                <div className="flex items-start gap-3">
                  {/* Étape en cours */}
                  {(() => {
                    const currentStep = steps.find(s => s.isInProgress);
                    const nextPendingStep = steps.find(s => !s.isDone && !s.isInProgress);
                    const CurrentIcon = currentStep?.icon || Clock;

                    if (!currentStep) return null;

                    return (
                      <>
                        <div className="p-1.5 rounded-full bg-blue-100 flex-shrink-0 mt-0.5">
                          <CurrentIcon className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800">
                            En cours : {currentStep.label}
                          </p>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            {currentStep.detailInProgress}
                          </p>
                          {nextPendingStep && (
                            <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                              <span>Ensuite :</span>
                              <span className="font-medium text-slate-500">{nextPendingStep.label}</span>
                              <span>— {nextPendingStep.detailPending}</span>
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-[10px] font-medium text-slate-400">
                            {completedSteps}/{steps.length} terminées
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </TooltipProvider>
  );
}
