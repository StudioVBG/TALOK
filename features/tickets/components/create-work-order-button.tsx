"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Hammer } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { AssignProviderModal } from "./assign-provider-modal";

interface CreateWorkOrderButtonProps {
  ticketId: string;
  ticketCategory?: string | null;
  onCreated: () => void;
  disabled?: boolean;
}

export function CreateWorkOrderButton({
  ticketId,
  ticketCategory,
  onCreated,
  disabled,
}: CreateWorkOrderButtonProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<"idle" | "provider" | "details">("idle");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [dateIntervention, setDateIntervention] = useState("");
  const [coutEstime, setCoutEstime] = useState("");
  const [creating, setCreating] = useState(false);

  const handleProviderSelected = (providerId: string) => {
    setSelectedProvider(providerId);
    setStep("details");
  };

  const handleCreate = async () => {
    if (!selectedProvider) return;
    setCreating(true);

    try {
      const res = await fetch(`/api/v1/tickets/${ticketId}/create-work-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: selectedProvider,
          date_intervention_prevue: dateIntervention || null,
          cout_estime: coutEstime ? parseFloat(coutEstime) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur");
      }

      toast({ title: "Ordre de travail créé", description: "Le prestataire a été notifié." });
      setStep("idle");
      setSelectedProvider(null);
      setDateIntervention("");
      setCoutEstime("");
      onCreated();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setStep("provider")}
        disabled={disabled}
        className="gap-2"
      >
        <Hammer className="h-4 w-4" />
        Créer un ordre de travail
      </Button>

      {/* Step 1: Select provider */}
      {step === "provider" && (
        <AssignProviderModal
          open
          onOpenChange={(open) => !open && setStep("idle")}
          ticketId={ticketId}
          ticketCategory={ticketCategory}
          onAssigned={() => {
            // The assign modal calls the assign endpoint directly
            // For work order flow, we intercept and go to details step
            onCreated();
            setStep("idle");
          }}
        />
      )}

      {/* Step 2: Work order details */}
      <Dialog open={step === "details"} onOpenChange={(open) => !open && setStep("idle")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Détails de l'intervention</DialogTitle>
            <DialogDescription>
              Précisez la date et le coût estimé pour cet ordre de travail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="date-intervention">Date d'intervention prévue</Label>
              <Input
                id="date-intervention"
                type="date"
                value={dateIntervention}
                onChange={(e) => setDateIntervention(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cout-estime">Coût estimé (€)</Label>
              <Input
                id="cout-estime"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 150.00"
                value={coutEstime}
                onChange={(e) => setCoutEstime(e.target.value)}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setStep("idle")}
              >
                Annuler
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Confirmer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
