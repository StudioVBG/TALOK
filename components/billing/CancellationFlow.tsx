"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Pause,
  ArrowDownRight,
  MessageSquare,
  Shield,
  Check,
  Phone,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { formatDateLong } from "@/lib/billing-utils";
import type { CancellationReason } from "@/types/billing";
import Link from "next/link";

const REASONS: { value: CancellationReason; label: string }[] = [
  { value: "too_expensive", label: "Trop cher pour mon usage" },
  { value: "missing_features", label: "Fonctionnalites manquantes" },
  { value: "technical_issues", label: "Problemes techniques" },
  { value: "switching_competitor", label: "J'utilise un autre service" },
  { value: "temporary", label: "Besoin temporaire termine" },
  { value: "other", label: "Autre raison" },
];

interface CancellationFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodEnd: string;
}

export function CancellationFlow({ open, onOpenChange, periodEnd }: CancellationFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reason, setReason] = useState<CancellationReason | null>(null);
  const [detail, setDetail] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { mutate: cancel, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, reason_detail: detail || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'annulation");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Resiliation programmee",
        description: `Votre abonnement restera actif jusqu'au ${formatDateLong(periodEnd)}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      onOpenChange(false);
      resetState();
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { mutate: pause, isPending: isPausing } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/billing/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration_months: 1 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la mise en pause");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Abonnement mis en pause",
        description: "Votre abonnement est suspendu pour 1 mois. Vos donnees sont conservees.",
      });
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      onOpenChange(false);
      resetState();
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function resetState() {
    setStep(1);
    setReason(null);
    setDetail("");
    setConfirmed(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetState(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && "Pourquoi souhaitez-vous resilier ?"}
            {step === 2 && "Avant de partir..."}
            {step === 3 && "Confirmer la resiliation"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Votre retour nous aide a ameliorer Talok."}
            {step === 2 && "Nous avons peut-etre une solution pour vous."}
            {step === 3 && "Relisez les consequences avant de confirmer."}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* Step 1: Reason */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="py-4 space-y-2"
            >
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className={`w-full text-left p-3 rounded-lg border transition-all hover:border-violet-500/50 hover:bg-violet-500/5 ${reason === r.value ? "border-violet-500 bg-violet-500/10" : "border-slate-700"}`}
                >
                  <span className="text-sm text-slate-200">{r.label}</span>
                </button>
              ))}
              {reason === "other" && (
                <textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="Dites-nous en plus..."
                  className="w-full mt-2 p-3 rounded-lg border border-slate-700 bg-slate-900/50 text-sm text-slate-200 placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                  rows={3}
                  aria-label="Detail de la raison"
                />
              )}
            </motion.div>
          )}

          {/* Step 2: Retention */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="py-4 space-y-3"
            >
              {(reason === "too_expensive" || reason === "temporary") && (
                <div className="p-4 rounded-lg border border-violet-500/30 bg-violet-500/5">
                  <div className="flex items-start gap-3">
                    <Pause className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-slate-200">Mettre en pause 1 a 3 mois</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Suspendez votre abonnement sans perdre vos donnees. Vous retrouverez tout a votre retour.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 border-violet-500/30 text-violet-400 hover:text-violet-300"
                        onClick={() => pause()}
                        disabled={isPausing}
                      >
                        {isPausing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Pause className="w-4 h-4 mr-1.5" aria-hidden="true" />}
                        Mettre en pause
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {reason === "too_expensive" && (
                <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                  <div className="flex items-start gap-3">
                    <ArrowDownRight className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-slate-200">Passer a un forfait moins cher</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Reduisez vos couts sans tout perdre.
                      </p>
                      <Button size="sm" variant="outline" className="mt-3 border-emerald-500/30 text-emerald-400" asChild>
                        <Link href="/pricing">Voir les forfaits</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {reason === "missing_features" && (
                <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-slate-200">Dites-nous ce qui vous manque</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Notre equipe produit priorise les demandes utilisateurs.
                      </p>
                      <Button size="sm" variant="outline" className="mt-3 border-amber-500/30 text-amber-400" asChild>
                        <a href="mailto:support@talok.fr?subject=Feature%20request">Envoyer un retour</a>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {reason === "technical_issues" && (
                <div className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/5">
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-slate-200">Appel support gratuit</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Notre equipe technique peut resoudre votre probleme rapidement.
                      </p>
                      <Button size="sm" variant="outline" className="mt-3 border-blue-500/30 text-blue-400" asChild>
                        <a href="mailto:support@talok.fr?subject=Probleme%20technique">Contacter le support</a>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <Button
                variant="ghost"
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={() => setStep(3)}
              >
                Je maintiens ma decision
              </Button>
            </motion.div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="py-4 space-y-4"
            >
              <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                <p className="text-sm font-medium text-red-300 mb-2">Consequences de la resiliation :</p>
                <ul className="text-sm text-slate-400 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" aria-hidden="true" />
                    Acces maintenu jusqu&apos;au {formatDateLong(periodEnd)}
                  </li>
                  <li className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" aria-hidden="true" />
                    Donnees conservees 6 mois
                  </li>
                  <li className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" aria-hidden="true" />
                    Reactivation possible a tout moment
                  </li>
                  <li className="flex items-center gap-2">
                    <X className="w-3.5 h-3.5 text-red-400 flex-shrink-0" aria-hidden="true" />
                    Retour au forfait Gratuit (1 bien) apres la date d&apos;echeance
                  </li>
                  <li className="flex items-center gap-2">
                    <X className="w-3.5 h-3.5 text-red-400 flex-shrink-0" aria-hidden="true" />
                    Fonctionnalites premium desactivees
                  </li>
                </ul>
              </div>

              <label className="flex items-start gap-3 cursor-pointer" htmlFor="cancel-confirm">
                <Checkbox
                  id="cancel-confirm"
                  checked={confirmed}
                  onCheckedChange={(checked) => setConfirmed(checked === true)}
                  className="mt-0.5"
                />
                <span className="text-sm text-slate-300">
                  J&apos;ai compris les consequences et je souhaite resilier mon abonnement.
                </span>
              </label>
            </motion.div>
          )}
        </AnimatePresence>

        <DialogFooter className="gap-2">
          {step === 1 && (
            <>
              <Button variant="outline" className="border-slate-700" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!reason}
              >
                Continuer
              </Button>
            </>
          )}
          {step === 2 && (
            <Button variant="outline" className="border-slate-700" onClick={() => setStep(1)}>
              Retour
            </Button>
          )}
          {step === 3 && (
            <>
              <Button variant="outline" className="border-slate-700" onClick={() => { onOpenChange(false); resetState(); }}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                className="bg-red-600 hover:bg-red-500"
                onClick={() => cancel()}
                disabled={!confirmed || isPending}
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <X className="w-4 h-4 mr-2" aria-hidden="true" />
                )}
                Confirmer l&apos;annulation
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
