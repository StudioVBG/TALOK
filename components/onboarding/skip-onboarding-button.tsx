"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ArrowRight, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { firstLoginService } from "@/features/onboarding/services/first-login.service";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/types";

interface SkipOnboardingButtonProps {
  profileId: string;
  role: UserRole;
  variant?: "link" | "button" | "icon";
  className?: string;
  onSkip?: () => void;
}

// Configuration des restrictions par rôle quand l'onboarding est sauté
const SKIP_RESTRICTIONS: Record<UserRole, string[]> = {
  owner: [
    "Vous ne pourrez pas recevoir de paiements tant que votre IBAN n'est pas configuré",
    "Vos baux générés n'auront pas vos informations complètes",
    "Certaines fonctionnalités avancées seront limitées",
  ],
  tenant: [
    "Vous ne pourrez pas signer votre bail",
    "Le paiement du loyer sera indisponible",
    "Votre dossier locataire sera incomplet",
  ],
  provider: [
    "Vous ne recevrez pas de demandes d'intervention",
    "Votre profil ne sera pas visible des propriétaires",
    "La facturation sera désactivée",
  ],
  guarantor: [
    "Vous ne pourrez pas signer l'acte de cautionnement",
    "Le locataire ne pourra pas finaliser son dossier",
  ],
  admin: [],
  syndic: [
    "La gestion des copropriétés sera limitée",
    "Les tantièmes ne seront pas configurés",
  ],
};

export function SkipOnboardingButton({
  profileId,
  role,
  variant = "link",
  className,
  onSkip,
}: SkipOnboardingButtonProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const router = useRouter();

  const restrictions = SKIP_RESTRICTIONS[role] || [];

  const handleSkip = async () => {
    setIsSkipping(true);

    try {
      await firstLoginService.skipOnboarding(profileId);

      if (onSkip) {
        onSkip();
      } else {
        // Rediriger vers le dashboard
        router.push(`/${role}/dashboard`);
      }
    } catch (error) {
      console.error("Erreur lors du skip:", error);
    } finally {
      setIsSkipping(false);
      setShowConfirmDialog(false);
    }
  };

  return (
    <>
      {variant === "link" && (
        <button
          onClick={() => setShowConfirmDialog(true)}
          className={cn(
            "text-sm text-slate-400 hover:text-slate-300 underline-offset-4 hover:underline transition-colors",
            className
          )}
        >
          Passer pour l'instant
        </button>
      )}

      {variant === "button" && (
        <Button
          variant="ghost"
          onClick={() => setShowConfirmDialog(true)}
          className={cn("text-slate-500 hover:text-slate-700", className)}
        >
          <Clock className="w-4 h-4 mr-2" />
          Plus tard
        </Button>
      )}

      {variant === "icon" && (
        <button
          onClick={() => setShowConfirmDialog(true)}
          className={cn(
            "p-2 rounded-full hover:bg-slate-100 transition-colors",
            className
          )}
          title="Passer l'onboarding"
        >
          <Clock className="w-5 h-5 text-slate-400" />
        </button>
      )}

      {/* Dialog de confirmation */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <DialogTitle className="text-center">
              Passer la configuration ?
            </DialogTitle>
            <DialogDescription className="text-center">
              Vous pourrez toujours compléter votre profil plus tard depuis les
              paramètres.
            </DialogDescription>
          </DialogHeader>

          {restrictions.length > 0 && (
            <div className="my-4 p-4 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-sm font-medium text-amber-800 mb-2">
                Limitations si vous passez :
              </p>
              <ul className="space-y-1.5">
                {restrictions.map((restriction, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-amber-700"
                  >
                    <span className="text-amber-500 mt-0.5">•</span>
                    {restriction}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowConfirmDialog(false)}
            >
              Continuer la configuration
            </Button>
            <Button
              variant="default"
              className="flex-1 bg-slate-800 hover:bg-slate-900"
              onClick={handleSkip}
              disabled={isSkipping}
            >
              {isSkipping ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
                  />
                  Chargement...
                </>
              ) : (
                <>
                  Passer pour l'instant
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Composant pour la bannière de reprise
export function ResumeOnboardingBanner({
  profileId,
  role,
  progressPercent,
  className,
}: {
  profileId: string;
  role: UserRole;
  progressPercent: number;
  className?: string;
}) {
  const [isDismissed, setIsDismissed] = useState(false);
  const router = useRouter();

  const handleResume = async () => {
    await firstLoginService.resumeOnboarding(profileId);
    router.push(`/${role}/onboarding`);
  };

  if (isDismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={cn(
          "relative overflow-hidden rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4",
          className
        )}
      >
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-blue-100 transition-colors"
        >
          <X className="w-4 h-4 text-blue-400" />
        </button>

        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <Clock className="w-6 h-6 text-blue-600" />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-blue-900">
              Votre profil est à {progressPercent}%
            </h4>
            <p className="text-sm text-blue-700">
              Complétez votre configuration pour profiter de toutes les
              fonctionnalités.
            </p>
          </div>

          <Button
            onClick={handleResume}
            className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Reprendre
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 rounded-full bg-blue-100 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 1, delay: 0.5 }}
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default SkipOnboardingButton;
