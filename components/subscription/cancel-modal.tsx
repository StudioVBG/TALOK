"use client";

/**
 * CancelModal - Modal de résiliation d'abonnement
 * Propose des alternatives et collecte le feedback
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useSubscription } from "./subscription-provider";
import { PLANS, formatPrice, getDowngradeFeatures, FEATURE_LABELS } from "@/lib/subscriptions/plans";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Gift,
  HeartCrack,
  Loader2,
  MessageSquare,
  Pause,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface CancelModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = "reason" | "offers" | "confirm" | "success";

const CANCEL_REASONS = [
  { id: "too_expensive", label: "C'est trop cher", icon: "💸", offerPause: true },
  { id: "not_using", label: "Je n'utilise pas assez le service", icon: "📉", offerPause: true },
  { id: "missing_features", label: "Il manque des fonctionnalités", icon: "🔧", offerFeedback: true },
  { id: "switching_competitor", label: "Je passe à un autre service", icon: "↔️", offerFeedback: true },
  { id: "temporary", label: "C'est temporaire", icon: "⏸️", offerPause: true },
  { id: "other", label: "Autre raison", icon: "💬", offerFeedback: true },
];

export function CancelModal({ open, onClose, onSuccess }: CancelModalProps) {
  const { currentPlan, subscription, daysUntilRenewal, refresh } = useSubscription();
  const [step, setStep] = useState<Step>("reason");
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [cancelImmediately, setCancelImmediately] = useState(false);
  const { toast } = useToast();

  const currentPlanConfig = PLANS[currentPlan];
  const reason = CANCEL_REASONS.find((r) => r.id === selectedReason);
  const lostFeatures = getDowngradeFeatures(currentPlan, "gratuit");

  const resetAndClose = () => {
    setStep("reason");
    setSelectedReason(null);
    setFeedback("");
    setCancelImmediately(false);
    onClose();
  };

  const handleNextStep = () => {
    if (step === "reason" && selectedReason) {
      // Proposer des offres alternatives si applicable
      if (reason?.offerPause || reason?.offerFeedback) {
        setStep("offers");
      } else {
        setStep("confirm");
      }
    } else if (step === "offers") {
      setStep("confirm");
    }
  };

  const handleCancel = async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: selectedReason,
          feedback,
          immediately: cancelImmediately,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la résiliation");
      }

      setStep("success");
      await refresh();
      onSuccess?.();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    toast({
      title: "Pause d'abonnement",
      description:
        "Cette fonctionnalité sera bientôt disponible. Contactez-nous pour mettre votre abonnement en pause.",
    });
  };

  const handleGetOffer = async () => {
    toast({
      title: "Offre spéciale",
      description:
        "Un email va vous être envoyé avec une offre personnalisée. Restez connecté !",
    });
    resetAndClose();
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-lg bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border-slate-700/50" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Résiliation d&apos;abonnement</DialogTitle>
        <AnimatePresence mode="wait">
          {/* Step 1: Raison */}
          {step === "reason" && (
            <motion.div
              key="reason"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <HeartCrack className="w-5 h-5 text-red-400" />
                  </div>
                  <DialogTitle className="text-lg">
                    On est tristes de vous voir partir...
                  </DialogTitle>
                </div>
                <DialogDescription>
                  Dites-nous pourquoi vous souhaitez résilier pour nous aider à
                  améliorer notre service.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 space-y-3">
                <RadioGroup value={selectedReason || ""} onValueChange={setSelectedReason}>
                  {CANCEL_REASONS.map((reason) => (
                    <Label
                      key={reason.id}
                      htmlFor={reason.id}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all",
                        selectedReason === reason.id
                          ? "border-violet-500 bg-violet-500/10"
                          : "border-slate-700/50 hover:border-slate-600"
                      )}
                    >
                      <RadioGroupItem value={reason.id} id={reason.id} className="sr-only" />
                      <span className="text-xl">{reason.icon}</span>
                      <span className="text-slate-200">{reason.label}</span>
                      {selectedReason === reason.id && (
                        <Check className="w-4 h-4 text-violet-400 ml-auto" />
                      )}
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button variant="ghost" onClick={resetAndClose}>
                  Annuler
                </Button>
                <Button
                  onClick={handleNextStep}
                  disabled={!selectedReason}
                  className="bg-red-600 hover:bg-red-500"
                >
                  Continuer
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Offres alternatives */}
          {step === "offers" && (
            <motion.div
              key="offers"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <DialogHeader>
                <DialogTitle className="text-lg">
                  Avant de partir, on a peut-être une solution...
                </DialogTitle>
              </DialogHeader>

              <div className="mt-6 space-y-4">
                {reason?.offerPause && (
                  <div
                    className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 cursor-pointer hover:border-amber-500/50 transition-colors"
                    onClick={handlePause}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <Pause className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-amber-300">
                          Mettre en pause plutôt ?
                        </h4>
                        <p className="text-sm text-slate-400 mt-1">
                          Pausez votre abonnement jusqu&apos;à 3 mois sans perdre vos
                          données.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div
                  className="p-4 rounded-lg border border-violet-500/30 bg-violet-500/10 cursor-pointer hover:border-violet-500/50 transition-colors"
                  onClick={handleGetOffer}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                      <Gift className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-violet-300">
                        Recevoir une offre spéciale
                      </h4>
                      <p className="text-sm text-slate-400 mt-1">
                        On peut peut-être trouver un arrangement. Recevez une offre
                        personnalisée.
                      </p>
                    </div>
                  </div>
                </div>

                {reason?.offerFeedback && (
                  <div className="p-4 rounded-lg border border-slate-700/50 bg-slate-800/50">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-300">
                        Un commentaire à nous partager ?
                      </span>
                    </div>
                    <Textarea
                      placeholder="Dites-nous ce qui vous manque ou ce qu'on pourrait améliorer..."
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="bg-slate-900/50 border-slate-700 resize-none"
                      rows={3}
                    />
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-between">
                <Button variant="ghost" onClick={() => setStep("reason")}>
                  Retour
                </Button>
                <Button onClick={() => setStep("confirm")} variant="outline">
                  Je veux quand même résilier
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Confirmation */}
          {step === "confirm" && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                  </div>
                  <DialogTitle className="text-lg">Confirmer la résiliation</DialogTitle>
                </div>
              </DialogHeader>

              <div className="mt-6 space-y-4">
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-sm text-red-300">
                    ⚠️ En résiliant, vous perdrez l&apos;accès aux fonctionnalités
                    suivantes :
                  </p>
                  <ul className="mt-3 space-y-2">
                    {lostFeatures.slice(0, 5).map((feat) => (
                      <li key={feat} className="flex items-center gap-2 text-sm text-slate-400">
                        <XCircle className="w-4 h-4 text-red-400" />
                        {FEATURE_LABELS[feat]?.label || feat}
                      </li>
                    ))}
                    {lostFeatures.length > 5 && (
                      <li className="text-sm text-slate-500">
                        Et {lostFeatures.length - 5} autres fonctionnalités...
                      </li>
                    )}
                  </ul>
                </div>

                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <Label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cancelImmediately}
                      onChange={(e) => setCancelImmediately(e.target.checked)}
                      className="mt-1"
                    />
                    <div>
                      <span className="text-slate-200">Résilier immédiatement</span>
                      <p className="text-sm text-slate-500 mt-1">
                        {cancelImmediately
                          ? "Votre abonnement sera résilié immédiatement."
                          : `Votre abonnement restera actif jusqu'à la fin de la période actuelle (${daysUntilRenewal} jours restants).`}
                      </p>
                    </div>
                  </Label>
                </div>

                <p className="text-sm text-slate-500 text-center">
                  Vous pourrez toujours vous réabonner plus tard avec toutes vos
                  données intactes.
                </p>
              </div>

              <div className="mt-6 flex justify-between">
                <Button variant="ghost" onClick={() => setStep("offers")}>
                  Retour
                </Button>
                <Button
                  onClick={handleCancel}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-500"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Confirmer la résiliation</>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Success */}
          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Résiliation confirmée
              </h3>
              <p className="text-slate-400 mb-6">
                {cancelImmediately
                  ? "Votre abonnement a été résilié. Vous passez au plan Gratuit."
                  : `Votre abonnement sera résilié le ${new Date(subscription?.current_period_end || "").toLocaleDateString("fr-FR")}.`}
              </p>
              <Button onClick={resetAndClose}>Fermer</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

export default CancelModal;

