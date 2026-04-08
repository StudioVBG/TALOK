"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Loader2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  calculatePreavis,
  OWNER_NOTICE_MOTIFS,
  type OwnerNoticeMotif,
  type BailType,
} from "@/lib/leases/preavis-calculator";

interface OwnerNoticeClientProps {
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
  } | null;
}

export function OwnerNoticeClient({
  lease,
  property,
  tenant,
}: OwnerNoticeClientProps) {
  const router = useRouter();
  const [motif, setMotif] = useState<OwnerNoticeMotif | "">("");
  const [motifDetail, setMotifDetail] = useState("");
  const [method, setMethod] = useState<string>("rar");
  const [sendDate, setSendDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Only active leases can receive notice
  const canGiveNotice = lease.statut === "active";

  // Non-renewable bail types where owner notice doesn't apply
  const noOwnerNotice = ["etudiant", "mobilite", "saisonnier", "bail_mobilite"];
  const ownerNoticeApplicable = !noOwnerNotice.includes(lease.type_bail);

  // Calculate preavis
  const preavis = calculatePreavis({
    typeBail: lease.type_bail as BailType,
    initiateur: "owner",
    isZoneTendue: property.zone_tendue,
    startDate: sendDate ? new Date(sendDate) : undefined,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!motif) {
      setError("Veuillez sélectionner un motif de congé");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/leases/${lease.id}/notice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initiator: "owner",
          notice_type: motif,
          notice_date: sendDate,
          end_date: preavis.effectiveEndDate.toISOString().split("T")[0],
          method,
          motif: motifDetail || undefined,
          preavis_months: preavis.months,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de l'envoi du congé");
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
              <Send className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-emerald-800 dark:text-emerald-300">
              Congé enregistré
            </h2>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Le congé a été enregistré. Le bail prendra fin le{" "}
              {preavis.effectiveEndDate.toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              .
            </p>
            <Button
              variant="outline"
              onClick={() => router.push(`/owner/leases/${lease.id}`)}
              className="mt-4"
            >
              Retour au bail
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
          <h1 className="text-lg font-semibold">Donner congé au locataire</h1>
          <p className="text-sm text-muted-foreground">{property.adresse}</p>
        </div>
      </div>

      {/* Warnings */}
      {!canGiveNotice && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
          <CardContent className="p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Le bail doit être actif pour donner congé (statut actuel : {lease.statut}).
            </p>
          </CardContent>
        </Card>
      )}

      {!ownerNoticeApplicable && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
          <CardContent className="p-4 flex gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Ce type de bail ({lease.type_bail}) ne permet pas au bailleur de donner
              congé. Le bail prend fin automatiquement à son terme.
            </p>
          </CardContent>
        </Card>
      )}

      {canGiveNotice && ownerNoticeApplicable && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tenant info */}
          {tenant && (
            <Card className="border-none shadow-sm bg-card">
              <CardContent className="p-4">
                <p className="text-sm">
                  <span className="text-muted-foreground">Locataire : </span>
                  <span className="font-medium">
                    {tenant.prenom} {tenant.nom}
                  </span>
                  <span className="text-muted-foreground"> ({tenant.email})</span>
                </p>
              </CardContent>
            </Card>
          )}

          {/* Motif */}
          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Motif du congé
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Motif légal *</Label>
                <Select
                  value={motif}
                  onValueChange={(v) => setMotif(v as OwnerNoticeMotif)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le motif" />
                  </SelectTrigger>
                  <SelectContent>
                    {OWNER_NOTICE_MOTIFS.map((m) => (
                      <SelectItem key={m.key} value={m.key}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Précisions (optionnel)</Label>
                <Textarea
                  value={motifDetail}
                  onChange={(e) => setMotifDetail(e.target.value)}
                  placeholder="Détails supplémentaires sur le motif..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Method and date */}
          <Card className="border-none shadow-sm bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Envoi du congé
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Mode d&apos;envoi *</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rar">
                        Lettre recommandée avec AR
                      </SelectItem>
                      <SelectItem value="huissier">
                        Acte d&apos;huissier
                      </SelectItem>
                      <SelectItem value="main_propre">
                        Remise en main propre
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Date d&apos;envoi *</Label>
                  <Input
                    type="date"
                    value={sendDate}
                    onChange={(e) => setSendDate(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preavis summary */}
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                Calcul du préavis
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm text-blue-700 dark:text-blue-400">
                <span>Durée du préavis :</span>
                <span className="font-medium">{preavis.months} mois</span>
                <span>Date de fin effective :</span>
                <span className="font-medium">
                  {preavis.effectiveEndDate.toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span>Envoi obligatoire par :</span>
                <span className="font-medium">
                  {preavis.requiredMethod === "rar_ou_huissier"
                    ? "RAR ou huissier"
                    : preavis.requiredMethod}
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
            <Button type="submit" disabled={submitting} variant="destructive">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi en cours…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Donner congé
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
