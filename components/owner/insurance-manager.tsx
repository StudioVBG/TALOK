"use client";

import * as React from "react";
import {
  Shield,
  Plus,
  Calendar,
  AlertTriangle,
  Building2,
  Home,
  FileText,
  ExternalLink,
  Bell,
  Check,
  Clock,
} from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import type {
  InsurancePolicy,
  InsuranceType,
  InsuranceStatus,
} from "@/lib/types/multi-company";
import { INSURANCE_TYPE_LABELS } from "@/lib/types/multi-company";

// Couleurs par type d'assurance
const INSURANCE_COLORS: Record<InsuranceType, string> = {
  pno: "bg-blue-100 text-blue-800 border-blue-200",
  mri: "bg-indigo-100 text-indigo-800 border-indigo-200",
  habitation: "bg-green-100 text-green-800 border-green-200",
  loyers_impayes: "bg-amber-100 text-amber-800 border-amber-200",
  protection_juridique: "bg-purple-100 text-purple-800 border-purple-200",
  rc_proprietaire: "bg-slate-100 text-slate-800 border-slate-200",
  dommages_ouvrage: "bg-rose-100 text-rose-800 border-rose-200",
};

// Icônes par type
const INSURANCE_ICONS: Record<InsuranceType, React.ElementType> = {
  pno: Home,
  mri: Building2,
  habitation: Shield,
  loyers_impayes: FileText,
  protection_juridique: Shield,
  rc_proprietaire: Shield,
  dommages_ouvrage: Building2,
};

// Status badges
const STATUS_CONFIG: Record<
  InsuranceStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  active: { label: "Active", variant: "default" },
  en_attente: { label: "En attente", variant: "secondary" },
  resiliee: { label: "Résiliée", variant: "outline" },
  expiree: { label: "Expirée", variant: "destructive" },
  suspendue: { label: "Suspendue", variant: "destructive" },
};

interface InsuranceCardProps {
  policy: InsurancePolicy;
  onEdit?: (policy: InsurancePolicy) => void;
  onViewDetails?: (policy: InsurancePolicy) => void;
}

export function InsuranceCard({ policy, onEdit, onViewDetails }: InsuranceCardProps) {
  const Icon = INSURANCE_ICONS[policy.type_assurance];
  const daysUntilExpiry = differenceInDays(
    new Date(policy.date_echeance),
    new Date()
  );
  const isExpiringSoon = daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  const isExpired = daysUntilExpiry <= 0;

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-md cursor-pointer",
        isExpired && "border-red-300 bg-red-50/30",
        isExpiringSoon && !isExpired && "border-amber-300 bg-amber-50/30"
      )}
      onClick={() => onViewDetails?.(policy)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icône */}
          <div className={cn("p-3 rounded-lg", INSURANCE_COLORS[policy.type_assurance])}>
            <Icon className="h-5 w-5" />
          </div>

          {/* Contenu principal */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">
                {INSURANCE_TYPE_LABELS[policy.type_assurance]}
              </h3>
              <Badge variant={STATUS_CONFIG[policy.statut].variant}>
                {STATUS_CONFIG[policy.statut].label}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground mb-2">
              {policy.assureur_nom}
              {policy.numero_contrat && (
                <span className="ml-2 font-mono text-xs">
                  N° {policy.numero_contrat}
                </span>
              )}
            </p>

            {/* Dates */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span>
                  Échéance:{" "}
                  {format(new Date(policy.date_echeance), "d MMM yyyy", {
                    locale: fr,
                  })}
                </span>
              </div>

              {isExpiringSoon && !isExpired && (
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  <Clock className="h-3 w-3 mr-1" />
                  {daysUntilExpiry} jours
                </Badge>
              )}

              {isExpired && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Expirée
                </Badge>
              )}
            </div>

            {/* Prime */}
            {policy.prime_annuelle && (
              <div className="mt-2 text-sm">
                <span className="text-muted-foreground">Prime annuelle:</span>{" "}
                <span className="font-medium">
                  {policy.prime_annuelle.toLocaleString("fr-FR")} €
                </span>
              </div>
            )}
          </div>

          {/* Action */}
          {policy.espace_client_url && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                window.open(policy.espace_client_url!, "_blank");
              }}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface InsuranceListProps {
  policies: InsurancePolicy[];
  onAddNew?: () => void;
  onEdit?: (policy: InsurancePolicy) => void;
  emptyMessage?: string;
}

export function InsuranceList({
  policies,
  onAddNew,
  onEdit,
  emptyMessage = "Aucune assurance enregistrée",
}: InsuranceListProps) {
  // Grouper par statut
  const activePolicies = policies.filter((p) => p.statut === "active");
  const expiringPolicies = activePolicies.filter((p) => {
    const days = differenceInDays(new Date(p.date_echeance), new Date());
    return days <= 30 && days > 0;
  });

  return (
    <div className="space-y-6">
      {/* Header avec stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Vos assurances</h2>
          <p className="text-sm text-muted-foreground">
            {activePolicies.length} assurance{activePolicies.length !== 1 ? "s" : ""} active
            {activePolicies.length !== 1 ? "s" : ""}
            {expiringPolicies.length > 0 && (
              <span className="text-amber-600">
                {" "}
                · {expiringPolicies.length} à renouveler
              </span>
            )}
          </p>
        </div>

        {onAddNew && (
          <Button onClick={onAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        )}
      </div>

      {/* Alerte si assurances expirant bientôt */}
      {expiringPolicies.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900">
                  {expiringPolicies.length} assurance
                  {expiringPolicies.length !== 1 ? "s" : ""} à renouveler
                </p>
                <p className="text-sm text-amber-700">
                  Pensez à vérifier vos contrats avant leur échéance
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des polices */}
      {policies.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{emptyMessage}</p>
            {onAddNew && (
              <Button variant="outline" onClick={onAddNew}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter une assurance
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {policies.map((policy) => (
            <InsuranceCard key={policy.id} policy={policy} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

// Composant de résumé pour le dashboard
interface InsuranceSummaryProps {
  policies: InsurancePolicy[];
  className?: string;
}

export function InsuranceSummary({ policies, className }: InsuranceSummaryProps) {
  const activePolicies = policies.filter((p) => p.statut === "active");
  const totalPremium = activePolicies.reduce(
    (sum, p) => sum + (p.prime_annuelle || 0),
    0
  );

  const expiringCount = activePolicies.filter((p) => {
    const days = differenceInDays(new Date(p.date_echeance), new Date());
    return days <= 30 && days > 0;
  }).length;

  const nextExpiry = activePolicies
    .sort(
      (a, b) =>
        new Date(a.date_echeance).getTime() - new Date(b.date_echeance).getTime()
    )
    .find((p) => new Date(p.date_echeance) > new Date());

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Assurances
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Contrats actifs</span>
            <span className="font-semibold">{activePolicies.length}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Primes annuelles</span>
            <span className="font-semibold">
              {totalPremium.toLocaleString("fr-FR")} €
            </span>
          </div>

          {expiringCount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-amber-600">À renouveler</span>
              <Badge variant="outline" className="text-amber-600">
                {expiringCount}
              </Badge>
            </div>
          )}

          {nextExpiry && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Prochaine échéance:{" "}
                <span className="font-medium">
                  {format(new Date(nextExpiry.date_echeance), "d MMMM yyyy", {
                    locale: fr,
                  })}
                </span>
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Types d'assurance recommandés selon le contexte
interface InsuranceRecommendation {
  type: InsuranceType;
  reason: string;
  priority: "high" | "medium" | "low";
}

export function getInsuranceRecommendations(
  existingPolicies: InsurancePolicy[],
  propertyCount: number,
  hasBuildings: boolean,
  hasLeases: boolean
): InsuranceRecommendation[] {
  const recommendations: InsuranceRecommendation[] = [];
  const existingTypes = new Set(existingPolicies.map((p) => p.type_assurance));

  // PNO recommandée si propriétés sans PNO
  if (propertyCount > 0 && !existingTypes.has("pno")) {
    recommendations.push({
      type: "pno",
      reason: "Protection essentielle pour vos biens en location",
      priority: "high",
    });
  }

  // MRI recommandée si immeubles
  if (hasBuildings && !existingTypes.has("mri")) {
    recommendations.push({
      type: "mri",
      reason: "Couverture complète pour vos immeubles",
      priority: "high",
    });
  }

  // GLI recommandée si baux actifs
  if (hasLeases && !existingTypes.has("loyers_impayes")) {
    recommendations.push({
      type: "loyers_impayes",
      reason: "Sécurisez vos revenus locatifs",
      priority: "medium",
    });
  }

  // Protection juridique
  if (propertyCount > 2 && !existingTypes.has("protection_juridique")) {
    recommendations.push({
      type: "protection_juridique",
      reason: "Assistance juridique en cas de litige",
      priority: "low",
    });
  }

  return recommendations;
}
