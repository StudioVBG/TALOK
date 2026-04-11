"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Send, AlertCircle } from "lucide-react";

interface SendConvocationsDialogProps {
  assemblyId: string;
  onClose: () => void;
  onSent: () => void;
}

const DELIVERY_METHODS = [
  {
    value: "email",
    label: "Email",
    description: "Envoi électronique simple (rapide, gratuit, pas de preuve légale forte)",
  },
  {
    value: "lre_numerique",
    label: "LRE numérique",
    description: "Lettre recommandée électronique (recommandée, valeur légale)",
  },
  {
    value: "postal_recommande",
    label: "LRAR postal",
    description: "Lettre recommandée avec accusé de réception (traditionnelle)",
  },
  {
    value: "postal_simple",
    label: "Courrier simple",
    description: "Courrier postal ordinaire",
  },
  {
    value: "hand_delivered",
    label: "Remise en main propre",
    description: "Remise en main propre contre émargement",
  },
];

export function SendConvocationsDialog({
  assemblyId,
  onClose,
  onSent,
}: SendConvocationsDialogProps) {
  const { toast } = useToast();
  const isSubmittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    delivery_method: "lre_numerique",
    convocation_document_url: "",
    ordre_du_jour_document_url: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    if (
      !confirm(
        "Confirmez l'envoi des convocations ? Une fois envoyées, l'assemblée passera en statut 'Convoquée'."
      )
    ) {
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      const payload: Record<string, any> = {
        delivery_method: form.delivery_method,
      };

      if (form.convocation_document_url.trim()) {
        payload.convocation_document_url = form.convocation_document_url.trim();
      }
      if (form.ordre_du_jour_document_url.trim()) {
        payload.ordre_du_jour_document_url = form.ordre_du_jour_document_url.trim();
      }

      const res = await fetch(`/api/copro/assemblies/${assemblyId}/convocations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de l'envoi");
      }

      const data = await res.json();

      toast({
        title: "Convocations créées",
        description: `${data.count} convocation(s) en attente d'envoi. L'assemblée est convoquée.`,
      });

      onSent();
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'envoyer les convocations",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl bg-slate-900 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-400" />
            Envoyer les convocations
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Les convocations seront créées pour tous les lots actifs du site et prêtes à être envoyées.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              Loi du 10 juillet 1965 : les convocations doivent être envoyées au moins{" "}
              <strong>21 jours</strong> avant la date de l'assemblée (sauf urgence justifiée).
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Mode d'envoi *</Label>
            <Select
              value={form.delivery_method}
              onValueChange={(value) => setForm({ ...form, delivery_method: value })}
              disabled={submitting}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    <div>
                      <div className="font-medium">{method.label}</div>
                      <div className="text-xs text-slate-500">{method.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">URL du document convocation (optionnel)</Label>
            <input
              type="url"
              placeholder="https://..."
              value={form.convocation_document_url}
              onChange={(e) => setForm({ ...form, convocation_document_url: e.target.value })}
              disabled={submitting}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
            />
            <p className="text-xs text-slate-500">PDF de la convocation (sera attaché aux envois)</p>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">URL de l'ordre du jour (optionnel)</Label>
            <input
              type="url"
              placeholder="https://..."
              value={form.ordre_du_jour_document_url}
              onChange={(e) => setForm({ ...form, ordre_du_jour_document_url: e.target.value })}
              disabled={submitting}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
            />
            <p className="text-xs text-slate-500">PDF de l'ordre du jour avec les résolutions</p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Envoyer les convocations
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
