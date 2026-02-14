"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, FileText, PenLine, ClipboardCheck } from "lucide-react";

export interface PropertyLifecycleChecklistProps {
  propertyId: string;
  /** Présence d'un bail (draft, pending_signature, fully_signed, active) */
  existingLease: { id: string; statut: string } | null;
  isLeaseActive: boolean;
  isLeaseSigned: boolean;
  edlIsSigned: boolean;
  edlDraft: { id: string } | null;
}

/**
 * Checklist des prochaines étapes : Créer le bail → Signer → EDL → Activation / Remise des clés.
 * Affiche l'état d'avancement dynamique pour guider l'owner.
 */
export function PropertyLifecycleChecklist({
  propertyId,
  existingLease,
  isLeaseActive,
  isLeaseSigned,
  edlIsSigned,
  edlDraft,
}: PropertyLifecycleChecklistProps) {
  const step1Done = !!existingLease;
  const step2Done = isLeaseSigned || isLeaseActive;
  const step3Done = edlIsSigned;
  const step4Done = isLeaseActive;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Prochaines étapes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 1. Créer le bail */}
        <div className="flex items-start gap-3">
          {step1Done ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" aria-hidden />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium ${step1Done ? "text-muted-foreground line-through" : "text-foreground"}`}>
              1. Créer le bail
            </p>
            {!step1Done && (
              <Button asChild variant="outline" size="sm" className="mt-1.5 w-full justify-start">
                <Link href={`/owner/leases/new?propertyId=${propertyId}`}>
                  <FileText className="mr-2 h-4 w-4" />
                  Créer un bail
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* 2. Signer le bail */}
        <div className="flex items-start gap-3">
          {step2Done ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" aria-hidden />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium ${step2Done ? "text-muted-foreground line-through" : "text-foreground"}`}>
              2. Signer le bail
            </p>
            {existingLease && !step2Done && (
              <Button asChild variant="outline" size="sm" className="mt-1.5 w-full justify-start">
                <Link href={`/owner/leases/${existingLease.id}?tab=preview`}>
                  <PenLine className="mr-2 h-4 w-4" />
                  Voir le bail et signer
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* 3. État des lieux */}
        <div className="flex items-start gap-3">
          {step3Done ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" aria-hidden />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium ${step3Done ? "text-muted-foreground line-through" : "text-foreground"}`}>
              3. État des lieux d&apos;entrée
            </p>
            {existingLease && !step3Done && step2Done && (
              <Button asChild variant="outline" size="sm" className="mt-1.5 w-full justify-start">
                <Link
                  href={
                    edlDraft
                      ? `/owner/inspections/${edlDraft.id}`
                      : `/owner/inspections/new?propertyId=${propertyId}&leaseId=${existingLease.id}`
                  }
                >
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  {edlDraft ? "Continuer l'EDL" : "Créer l'EDL d'entrée"}
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* 4. Activer / Remise des clés */}
        <div className="flex items-start gap-3">
          {step4Done ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" aria-hidden />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium ${step4Done ? "text-muted-foreground line-through" : "text-foreground"}`}>
              4. Activation et remise des clés
            </p>
            {step4Done && (
              <p className="text-xs text-muted-foreground mt-1">Bail actif. Clés remises (EDL).</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
