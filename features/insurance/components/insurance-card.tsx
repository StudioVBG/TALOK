"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Building, FileText, Pencil, Trash2 } from "lucide-react";
import { ExpiryBadge } from "./expiry-badge";
import { INSURANCE_TYPE_LABELS } from "@/lib/insurance/constants";
import { formatCoverage } from "@/lib/insurance/helpers";
import type { InsurancePolicyWithExpiry } from "@/lib/insurance/types";

interface InsuranceCardProps {
  policy: InsurancePolicyWithExpiry;
  onEdit?: (policy: InsurancePolicyWithExpiry) => void;
  onDelete?: (id: string) => void;
  showActions?: boolean;
}

export function InsuranceCard({ policy, onEdit, onDelete, showActions = true }: InsuranceCardProps) {
  const typeLabel = INSURANCE_TYPE_LABELS[policy.insurance_type] || policy.insurance_type;

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
            <Shield className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-base">{typeLabel}</CardTitle>
            <p className="text-sm text-muted-foreground">{policy.insurer_name}</p>
          </div>
        </div>
        <ExpiryBadge status={policy.expiry_status} daysLeft={policy.days_until_expiry} />
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Debut</p>
            <p className="font-medium">
              {new Date(policy.start_date).toLocaleDateString("fr-FR")}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Fin</p>
            <p className="font-medium">
              {new Date(policy.end_date).toLocaleDateString("fr-FR")}
            </p>
          </div>
          {policy.policy_number && (
            <div>
              <p className="text-muted-foreground">N° contrat</p>
              <p className="font-medium">{policy.policy_number}</p>
            </div>
          )}
          {policy.amount_covered_cents && (
            <div>
              <p className="text-muted-foreground">Couverture</p>
              <p className="font-medium">{formatCoverage(policy.amount_covered_cents)}</p>
            </div>
          )}
        </div>

        {policy.property_address && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building className="h-3.5 w-3.5" />
            {policy.property_address}
          </div>
        )}

        {policy.document_id && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            Attestation jointe
          </div>
        )}

        {showActions && (
          <div className="flex gap-2 pt-2">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(policy)}
                className="gap-1"
              >
                <Pencil className="h-3.5 w-3.5" />
                Modifier
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(policy.id)}
                className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
