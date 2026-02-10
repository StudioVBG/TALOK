"use client";

import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { formatDateLong } from "@/lib/billing-utils";

interface ReactivationBannerProps {
  periodEnd: string;
}

export function ReactivationBanner({ periodEnd }: ReactivationBannerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { mutate: reactivate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/billing/reactivate", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la reactivation");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Abonnement reactive",
        description: "Votre abonnement a ete reactive avec succes.",
      });
      queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-4"
      role="alert"
      aria-live="polite"
    >
      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-red-300 font-medium">Resiliation programmee</p>
        <p className="text-sm text-slate-400 mt-0.5">
          Votre abonnement sera desactive le <strong>{formatDateLong(periodEnd)}</strong>.
          Vous conservez l&apos;acces a toutes les fonctionnalites jusqu&apos;a cette date.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Vous conserverez votre forfait actuel sans interruption en reactivant.
        </p>
      </div>
      <Button
        size="sm"
        className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 flex-shrink-0"
        onClick={() => reactivate()}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
        ) : (
          <RefreshCw className="w-4 h-4 mr-1.5" aria-hidden="true" />
        )}
        Reactiver mon abonnement
      </Button>
    </motion.div>
  );
}
