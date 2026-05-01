"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  FileText,
  Building2,
  User,
  Euro,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";

type Mandate = {
  id: string;
  mandate_number: string;
  mandate_type: "gestion" | "location" | "syndic" | "transaction";
  start_date: string;
  end_date: string | null;
  tacit_renewal: boolean;
  management_fee_type: "percentage" | "fixed";
  management_fee_rate: number | null;
  management_fee_fixed_cents: number | null;
  property_ids: string[];
  agency: { prenom: string; nom: string; email: string } | null;
  owner: { prenom: string; nom: string; email: string } | null;
  agency_entity: {
    raison_sociale: string;
    siret: string;
    adresse: string;
  } | null;
};

interface Props {
  token: string;
  mandate: Mandate;
}

const MANDATE_TYPE_LABEL: Record<Mandate["mandate_type"], string> = {
  gestion: "Mandat de gestion locative",
  location: "Mandat de location",
  syndic: "Mandat de syndic",
  transaction: "Mandat de transaction",
};

function formatDate(iso: string | null): string {
  if (!iso) return "Indéterminée";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatFees(m: Mandate): string {
  if (m.management_fee_type === "percentage") {
    return `${m.management_fee_rate ?? 0}% du loyer encaissé HT`;
  }
  const eur = (m.management_fee_fixed_cents ?? 0) / 100;
  return `${eur.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € / mois`;
}

export function MandateSignatureFlow({ token, mandate }: Props) {
  const { toast } = useToast();
  const [accepted, setAccepted] = useState(false);
  const [acknowledgedConditions, setAcknowledgedConditions] = useState(false);
  const [signatureName, setSignatureName] = useState(
    mandate.owner ? `${mandate.owner.prenom} ${mandate.owner.nom}`.trim() : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [refuseDialogOpen, setRefuseDialogOpen] = useState(false);
  const [refuseReason, setRefuseReason] = useState("");
  const [outcome, setOutcome] = useState<"signed" | "refused" | null>(null);

  const canSign = accepted && acknowledgedConditions && signatureName.trim().length >= 3;

  const handleSign = async () => {
    if (!canSign) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/agency/mandates/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sign",
          signature_name: signatureName.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Erreur ${res.status}`);
      setOutcome("signed");
      toast({
        title: "Mandat signé",
        description: "Votre signature a été enregistrée et l'agence a été notifiée.",
      });
    } catch (err) {
      toast({
        title: "Échec de la signature",
        description: err instanceof Error ? err.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefuse = async () => {
    if (refuseReason.trim().length < 5) {
      toast({
        title: "Motif requis",
        description: "Indiquez un motif de refus (≥ 5 caractères).",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/agency/mandates/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refuse",
          refuse_reason: refuseReason.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Erreur ${res.status}`);
      setOutcome("refused");
      toast({ title: "Mandat refusé", description: "L'agence a été notifiée." });
    } catch (err) {
      toast({
        title: "Échec",
        description: err instanceof Error ? err.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      setRefuseDialogOpen(false);
    }
  };

  if (outcome === "signed") {
    return (
      <SuccessScreen
        emoji="✅"
        title="Mandat signé"
        message="Merci. Votre mandat est désormais actif. Vous recevrez un email de confirmation et l'agence va commencer la gestion de vos biens."
      />
    );
  }

  if (outcome === "refused") {
    return (
      <SuccessScreen
        emoji="🚫"
        title="Mandat refusé"
        message="Votre refus a été enregistré. L'agence a été informée et pourra vous recontacter pour discuter."
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-2">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-bold">Signature de votre mandat</h1>
          <p className="text-muted-foreground">
            Lisez attentivement les conditions ci-dessous avant de signer.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {MANDATE_TYPE_LABEL[mandate.mandate_type]}
            </CardTitle>
            <CardDescription>Mandat n° {mandate.mandate_number}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              icon={<Building2 className="w-4 h-4" />}
              label="Agence mandataire"
              value={
                mandate.agency_entity?.raison_sociale ||
                (mandate.agency
                  ? `${mandate.agency.prenom} ${mandate.agency.nom}`.trim()
                  : "—")
              }
              sub={
                mandate.agency_entity?.siret
                  ? `SIRET ${mandate.agency_entity.siret}`
                  : mandate.agency_entity?.adresse ?? undefined
              }
            />
            <Field
              icon={<User className="w-4 h-4" />}
              label="Mandant (vous)"
              value={
                mandate.owner
                  ? `${mandate.owner.prenom} ${mandate.owner.nom}`.trim()
                  : "—"
              }
              sub={mandate.owner?.email}
            />
            <Field
              icon={<Calendar className="w-4 h-4" />}
              label="Période"
              value={`Du ${formatDate(mandate.start_date)} au ${formatDate(mandate.end_date)}`}
              sub={
                mandate.tacit_renewal
                  ? "Reconduction tacite activée"
                  : "Pas de reconduction tacite"
              }
            />
            <Field
              icon={<Euro className="w-4 h-4" />}
              label="Honoraires de gestion"
              value={formatFees(mandate)}
            />
            <Field
              icon={<Building2 className="w-4 h-4" />}
              label="Biens couverts"
              value={`${mandate.property_ids?.length ?? 0} bien(s)`}
              sub="Le détail figure dans votre espace propriétaire après signature."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conditions à accepter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="ack-conditions"
                checked={acknowledgedConditions}
                onCheckedChange={(v) => setAcknowledgedConditions(v === true)}
              />
              <Label htmlFor="ack-conditions" className="text-sm leading-relaxed">
                Je reconnais avoir pris connaissance des conditions du mandat,
                notamment les honoraires, la durée, les modalités de
                reconduction et de résiliation. Je comprends que ces conditions
                constituent un engagement contractuel.
              </Label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="accept"
                checked={accepted}
                onCheckedChange={(v) => setAccepted(v === true)}
              />
              <Label htmlFor="accept" className="text-sm leading-relaxed">
                J'accepte de confier à l'agence ci-dessus la gestion locative de
                mes biens dans les conditions énoncées, et j'autorise la
                signature électronique du présent mandat. Ma signature
                électronique a la même valeur juridique qu'une signature
                manuscrite (eIDAS — signature électronique simple).
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="signature-name">Votre nom complet (signature)</Label>
              <input
                id="signature-name"
                type="text"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="Prénom Nom"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-medium tracking-wide focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">
                Saisissez votre nom complet tel qu'il apparaîtra sur le mandat
                signé.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          {refuseDialogOpen ? (
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-base">Motif de refus</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={refuseReason}
                  onChange={(e) => setRefuseReason(e.target.value)}
                  placeholder="Expliquez brièvement la raison du refus..."
                  rows={3}
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => setRefuseDialogOpen(false)}
                    disabled={submitting}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleRefuse}
                    disabled={submitting}
                  >
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Confirmer le refus
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => setRefuseDialogOpen(true)}
                disabled={submitting}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Refuser le mandat
              </Button>
              <Button onClick={handleSign} disabled={!canSign || submitting} size="lg">
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Signer le mandat
              </Button>
            </>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Talok — Signature électronique simple (SES) horodatée et tracée par
          adresse IP. Pour toute question, contactez l'agence à{" "}
          {mandate.agency?.email ?? "support@talok.fr"}.
        </p>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="font-medium">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SuccessScreen({
  emoji,
  title,
  message,
}: {
  emoji: string;
  title: string;
  message: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="text-center p-8 max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl">
        <div className="text-6xl mb-4">{emoji}</div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          {title}
        </h1>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
