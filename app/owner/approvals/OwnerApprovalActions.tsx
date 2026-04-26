"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

interface Props {
  workOrderId: string;
}

export function OwnerApprovalActions({ workOrderId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const approve = async () => {
    setLoading("approve");
    try {
      const res = await fetch(`/api/work-orders/${workOrderId}/approve-booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Validation impossible");
      toast({
        title: "Validé",
        description: "Le prestataire a été notifié.",
      });
      router.refresh();
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Validation impossible",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const reject = async () => {
    setLoading("reject");
    try {
      const res = await fetch(`/api/work-orders/${workOrderId}/reject-booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Refus impossible");
      toast({
        title: "Réservation refusée",
        description: "Votre locataire a été notifié.",
      });
      router.refresh();
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Refus impossible",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
      setRejecting(false);
      setReason("");
    }
  };

  if (rejecting) {
    return (
      <div className="space-y-2">
        <Textarea
          placeholder="Raison du refus (optionnel, envoyée au locataire)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="min-h-[80px]"
          maxLength={500}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="destructive"
            size="sm"
            onClick={reject}
            disabled={loading !== null}
          >
            {loading === "reject" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <X className="mr-1.5 h-4 w-4" />
                Confirmer le refus
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRejecting(false);
              setReason("");
            }}
            disabled={loading !== null}
          >
            Annuler
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        size="sm"
        onClick={approve}
        disabled={loading !== null}
        className="bg-emerald-600 hover:bg-emerald-700 font-bold"
      >
        {loading === "approve" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Check className="mr-1.5 h-4 w-4" />
            Valider
          </>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setRejecting(true)}
        disabled={loading !== null}
      >
        <X className="mr-1.5 h-4 w-4" />
        Refuser
      </Button>
    </div>
  );
}
