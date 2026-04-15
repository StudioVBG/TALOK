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
import { Loader2, Send, AlertCircle, CheckCircle2, XCircle, Mail } from "lucide-react";

interface SendConvocationsDialogProps {
  assemblyId: string;
  onClose: () => void;
  onSent: () => void;
}

interface SendResultItem {
  convocationId: string;
  recipientName: string;
  method: string;
  success: boolean;
  trackingNumber?: string;
  error?: string;
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
  const [step, setStep] = useState<"form" | "sending" | "results">("form");
  const [sendResults, setSendResults] = useState<SendResultItem[]>([]);
  const [sendSummary, setSendSummary] = useState({ total: 0, sent: 0, failed: 0 });

  const [form, setForm] = useState({
    delivery_method: "email",
    convocation_document_url: "",
    ordre_du_jour_document_url: "",
  });

  const needsDocument = ["lrar", "lre_numerique", "postal_recommande", "postal_simple"].includes(form.delivery_method);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    if (needsDocument && !form.convocation_document_url.trim()) {
      toast({
        title: "Document requis",
        description: "Un PDF de convocation est obligatoire pour l'envoi postal ou recommandé.",
        variant: "destructive",
      });
      return;
    }

    if (
      !confirm(
        "Confirmez l'envoi des convocations ? Une fois envoyées, l'assemblée passera en statut 'Convoquée'."
      )
    ) {
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);
    setStep("sending");

    try {
      // Étape 1 : Créer les convocations en base (status='pending')
      const createPayload: Record<string, any> = {
        delivery_method: form.delivery_method,
      };

      if (form.convocation_document_url.trim()) {
        createPayload.convocation_document_url = form.convocation_document_url.trim();
      }
      if (form.ordre_du_jour_document_url.trim()) {
        createPayload.ordre_du_jour_document_url = form.ordre_du_jour_document_url.trim();
      }

      const createRes = await fetch(`/api/copro/assemblies/${assemblyId}/convocations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPayload),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de la création des convocations");
      }

      const createData = await createRes.json();
      const convocationIds = (createData.convocations || []).map((c: any) => c.id);

      if (convocationIds.length === 0) {
        throw new Error("Aucune convocation créée");
      }

      // Étape 2 : Dispatcher les convocations (envoi réel)
      const sendRes = await fetch(`/api/copro/assemblies/${assemblyId}/send-convocations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ convocationIds }),
      });

      if (!sendRes.ok) {
        const err = await sendRes.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de l'envoi des convocations");
      }

      const sendData = await sendRes.json();
      setSendResults(sendData.results || []);
      setSendSummary({ total: sendData.total, sent: sendData.sent, failed: sendData.failed });
      setStep("results");

      if (sendData.failed === 0) {
        toast({
          title: "Convocations envoyées",
          description: `${sendData.sent} convocation(s) envoyée(s) avec succès.`,
        });
      } else {
        toast({
          title: "Envoi partiel",
          description: `${sendData.sent} envoyée(s), ${sendData.failed} en échec.`,
          variant: "destructive",
        });
      }

      onSent();
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'envoyer les convocations",
        variant: "destructive",
      });
      setStep("form");
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-slate-900 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-400" />
            Envoyer les convocations
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {step === "results"
              ? "Résultat de l'envoi des convocations"
              : "Les convocations seront envoyées à tous les copropriétaires du site."}
          </DialogDescription>
        </DialogHeader>

        {step === "sending" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
            <p className="text-slate-300">Envoi des convocations en cours...</p>
          </div>
        )}

        {step === "results" && (
          <div className="space-y-3">
            <div className="flex gap-3 text-sm">
              <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300">
                {sendSummary.sent} envoyée{sendSummary.sent > 1 ? "s" : ""}
              </span>
              {sendSummary.failed > 0 && (
                <span className="px-2 py-1 rounded bg-red-500/20 text-red-300">
                  {sendSummary.failed} en échec
                </span>
              )}
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {sendResults.map((r) => (
                <div
                  key={r.convocationId}
                  className="flex items-start gap-2 p-2 rounded-lg bg-white/5 text-sm"
                >
                  {r.success ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 mt-0.5 text-red-400 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{r.recipientName}</p>
                    {r.success && r.trackingNumber && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        N° suivi : {r.trackingNumber}
                      </p>
                    )}
                    {!r.success && r.error && (
                      <p className="text-xs text-red-400 mt-0.5">{r.error}</p>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 shrink-0">
                    {r.method === "email" ? "Email" : r.method === "hand_delivered" ? "Main propre" : "LRAR"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "form" && (
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

            {needsDocument && (
              <div className="space-y-2">
                <Label className="text-slate-300">URL du document convocation (PDF) *</Label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={form.convocation_document_url}
                  onChange={(e) => setForm({ ...form, convocation_document_url: e.target.value })}
                  disabled={submitting}
                  required={needsDocument}
                  className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                />
                <p className="text-xs text-slate-500">PDF de la convocation qui sera envoyé par courrier</p>
              </div>
            )}

            {!needsDocument && (
              <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 p-3 text-sm text-blue-200 flex items-start gap-3">
                <Mail className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  La convocation sera envoyée par email avec l'ordre du jour et un lien vers l'espace copropriétaire.
                </p>
              </div>
            )}

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
        )}

        {step === "results" && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={onClose}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Fermer
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
