"use client";

import { cn } from "@/lib/utils";
import { 
  FileSignature, 
  ClipboardCheck, 
  Euro, 
  Key, 
  CheckCircle2, 
  Circle 
} from "lucide-react";
import { motion } from "framer-motion";

// ✅ SOTA 2026: Tous les statuts de bail possibles
export type LeaseProgressStatus = 
  | "draft"              // Brouillon initial
  | "sent"               // Envoyé pour signature
  | "pending_signature"  // En attente de signatures
  | "partially_signed"   // Partiellement signé
  | "pending_owner_signature" // Locataire signé, attente propriétaire
  | "fully_signed"       // Entièrement signé (attente EDL)
  | "active"             // Bail en cours
  | "notice_given"       // Congé donné (préavis)
  | "amended"            // Avenant en cours
  | "terminated"         // Terminé
  | "archived";          // Archivé

interface LeaseProgressTrackerProps {
  status: LeaseProgressStatus;
  hasSignedEdl: boolean;
  hasPaidInitial: boolean;
  className?: string;
}

export function LeaseProgressTracker({ 
  status, 
  hasSignedEdl, 
  hasPaidInitial,
  className 
}: LeaseProgressTrackerProps) {
  
  const steps = [
    { 
      id: "signature", 
      label: "Signature", 
      description: "Bail signé par tous",
      icon: FileSignature, 
      isDone: ["fully_signed", "active", "notice_given", "terminated"].includes(status),
      isInProgress: ["sent", "pending_signature", "partially_signed", "pending_owner_signature"].includes(status)
    },
    { 
      id: "edl", 
      label: "État des lieux", 
      description: "EDL d'entrée signé",
      icon: ClipboardCheck, 
      isDone: hasSignedEdl || status === "active",
      isInProgress: status === "fully_signed" && !hasSignedEdl
    },
    { 
      id: "payment", 
      label: "Paiement", 
      description: "1er loyer & caution",
      icon: Euro, 
      isDone: hasPaidInitial || status === "active",
      isInProgress: status === "active" && !hasPaidInitial
    },
    { 
      id: "keys", 
      label: "Remise des clés", 
      description: "Bail activé",
      icon: Key, 
      isDone: status === "active",
      isInProgress: hasSignedEdl && status === "fully_signed"
    }
  ];

  return (
    <div className={cn("w-full py-6", className)}>
      <div className="relative flex justify-between items-start max-w-4xl mx-auto">
        {/* Ligne de fond */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-100 -z-10" />
        
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;
          
          return (
            <div key={step.id} className="flex flex-col items-center group relative flex-1">
              {/* Rond du step */}
              <motion.div 
                initial={false}
                animate={{
                  scale: step.isInProgress ? 1.1 : 1,
                  backgroundColor: step.isDone ? "#10b981" : step.isInProgress ? "#3b82f6" : "#f1f5f9",
                }}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm transition-colors",
                  step.isDone ? "text-white" : step.isInProgress ? "text-white" : "text-slate-400"
                )}
              >
                {step.isDone ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </motion.div>

              {/* Libellé & Description */}
              <div className="mt-3 text-center px-2">
                <p className={cn(
                  "text-xs font-bold uppercase tracking-tight",
                  step.isDone ? "text-emerald-600" : step.isInProgress ? "text-blue-600" : "text-slate-500"
                )}>
                  {step.label}
                </p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-tight hidden md:block">
                  {step.description}
                </p>
              </div>

              {/* Ligne de progression active */}
              {!isLast && step.isDone && (
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  className="absolute top-5 left-1/2 w-full h-0.5 bg-emerald-500 -z-10 origin-left"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

