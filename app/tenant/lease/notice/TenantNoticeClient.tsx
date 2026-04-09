"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Loader2,
  AlertTriangle,
  Info,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  calculatePreavis,
  REDUCED_NOTICE_REASONS,
  type BailType,
  type ReducedNoticeReason,
} from "@/lib/leases/preavis-calculator";

interface TenantNoticeClientProps {
  lease: {
    id: string;
    type_bail: string;
    statut: string;
    date_debut: string;
    date_fin: string | null;
    loyer: number;
    charges: number;
    depot_garantie: number;
  };
  property: {
    adresse: string;
    ville: string;
    code_postal: string;
    zone_tendue: boolean;
  };
  tenant: {
    prenom: string;
    nom: string;
    email: string;
  };
  owner: {
    prenom: string;
    nom: string;
  } | null;
}

export function TenantNoticeClient({
  lease,
  property,
  tenant,
  owner,
}: TenantNoticeClientProps) {
  const router = useRouter();
  const [requestReduced, setRequestReduced] = useState(false);
  const [reducedReason, setReducedReason] = useState<ReducedNoticeReason | "">("");
  const [forwardingAddress, setForwardingAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [sendDate, setSendDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const typeBail = lease.type_bail as BailType;

  // Calculate preavis
  const preavis = useMemo(
    () =>
      calculatePreavis({
        typeBail,
        initiateur: "tenant",
        isZoneTendue: property.zone_tendue,
        reducedReason: requestReduced ? reducedReason || null : null,
        startDate: sendDate ? new Date(sendDate) : undefined,
      }),
    [typeBail, property.zone_tendue, requestReduced, reducedReason, sendDate]
  );

  // Can the tenant request reduced notice?
  const canRequestReduced =
    typeBail === "nu" && !property.zone_tendue;

  // Auto-reduced for zone tendue
  const autoReduced = typeBail === "nu" && property.zone_tendue;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (requestReduced && !reducedReason) {
      setError("Veuillez sélectionner un motif pour le préavis réduit");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/leases/${lease.id}/notice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notice_date: sendDate,
          end_date: preavis.effectiveEndDate.toISOString().split("T")[0],
          reduced_notice: requestReduced || autoReduced,
          reason: requestReduced ? reducedReason : autoReduced ? "zone_tendue" : undefined,
          forwarding_address: forwardingAddress || undefined,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de l'envoi du préavis");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 p-4">
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800">
          <CardContent className="p-6 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">
              Préavis envoyé
            </h2>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Votre congé a été enregistré. Votre bail prendra fin le{" "}
              {preavis.effectiveEndDate.toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              .
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500">
              N&apos;oubliez pas d&apos;envoyer votre lettre de congé par courrier
              recommandé avec accusé de réception.
            </p>
            <Button
              variant="outline"
              onClick={() => router.push("/tenant/lease")}
              className="mt-4"
            >
              Retour à mon bail
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">Donner mon préavis</h1>
          <p className="text-sm text-muted-foreground">{property.adresse}</p>
        </div>
      </div>

      {lease.statut !== "active" ? (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
          <CardContent className="p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Le bail doit être actif pour donner votre préavis.
            </p>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Lease & property summary */}
          <Card className="border-none shadow-sm bg-card">
            <CardContent className="p-4 space-y-2">
              <div className="grid grid-cols-2 gap-y-1 text-sm">
                <span className="text-muted-foreground">Logement</span>
                <span>{property.adresse}</span>
                <span className="text-muted-foreground">Loyer + charges</span>
                <span>
                  {lease.loyer.toLocaleString("fr-FR")} € +{" "}
                  {lease.charges.toLocaleString("fr-FR")} €
                </span>
                {owner && (
                  <>
                    <span className="text-muted-foreground">Propriétaire</span>
                    <span>
                      {owner.prenom} {owner.nom}
                    </span>
                  </>
                )}
                <span className="text-muted-foreground">Type de bail</span>
                <span>{preavis.bailLabel}</span>
              </div>
            </CardContent>
          </Card>

          {/* Zone tendue notice */}
          {autoReduced && (
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
              <CardContent className="p-4 flex gap-3">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Votre logement est en zone tendue. Le préavis est
                  automatiquement réduit à <strong>1 mois</strong>.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Date */}
          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Date d&apos;envoi du préavis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Date d&apos;envoi *</Label>
                <Input
                  type="date"
                  value={sendDate}
                  onChange={(e) => setSendDate(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Reduced notice for nu bail */}
          {canRequestReduced && (
            <Card className="border-none shadow-sm bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">
                  Préavis réduit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="reduced-notice"
                    checked={requestReduced}
                    onCheckedChange={(v) => setRequestReduced(!!v)}
                  />
                  <Label htmlFor="reduced-notice" className="text-sm">
                    Je demande un préavis réduit à 1 mois
                  </Label>
                </div>
                {requestReduced && (
                  <div className="space-y-1.5">
                    <Label>Motif *</Label>
                    <Select
                      value={reducedReason}
                      onValueChange={(v) =>
                        setReducedReason(v as ReducedNoticeReason)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner le motif" />
                      </SelectTrigger>
                      <SelectContent>
                        {REDUCED_NOTICE_REASONS.map((r) => (
                          <SelectItem key={r.key} value={r.key}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Un justificatif sera demandé pour valider le motif.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Forwarding address */}
          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Informations complémentaires
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nouvelle adresse (optionnel)</Label>
                <Input
                  value={forwardingAddress}
                  onChange={(e) => setForwardingAddress(e.target.value)}
                  placeholder="Adresse de réexpédition du courrier"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Commentaire (optionnel)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Informations complémentaires..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Preavis summary */}
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                Récapitulatif du préavis
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm text-blue-700 dark:text-blue-400">
                <span>Durée du préavis :</span>
                <span className="font-medium">
                  {preavis.months} mois
                  {preavis.isReduced && " (réduit)"}
                </span>
                <span>Date de fin du bail :</span>
                <span className="font-medium">
                  {preavis.effectiveEndDate.toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span>Dépôt de garantie :</span>
                <span className="font-medium">
                  {lease.depot_garantie.toLocaleString("fr-FR")} €
                  <span className="font-normal text-xs ml-1">
                    (restitué sous 1 mois après l&apos;EDL de sortie)
                  </span>
                </span>
              </div>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi en cours…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Donner mon préavis
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
