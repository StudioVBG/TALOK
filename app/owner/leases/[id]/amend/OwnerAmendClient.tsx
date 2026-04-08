"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileEdit, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AmendmentForm } from "@/components/leases/AmendmentForm";
import { cn } from "@/lib/utils";

const AMENDMENT_TYPE_LABELS: Record<string, string> = {
  loyer_revision: "Révision du loyer",
  ajout_colocataire: "Ajout d'un colocataire",
  retrait_colocataire: "Retrait d'un colocataire",
  changement_charges: "Modification des charges",
  travaux: "Travaux",
  autre: "Autre modification",
};

interface Amendment {
  id: string;
  amendment_type: string;
  description: string;
  effective_date: string;
  old_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  signed_at: string | null;
  created_at: string;
}

interface OwnerAmendClientProps {
  lease: {
    id: string;
    type_bail: string;
    statut: string;
    loyer: number;
    charges_forfaitaires: number;
    property_address: string;
  };
  existingAmendments: Amendment[];
}

export function OwnerAmendClient({
  lease,
  existingAmendments,
}: OwnerAmendClientProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(existingAmendments.length === 0);

  const canAmend = lease.statut === "active" || lease.statut === "amended";

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
          <h1 className="text-lg font-semibold">Avenants au bail</h1>
          <p className="text-sm text-muted-foreground">
            {lease.property_address}
          </p>
        </div>
      </div>

      {/* Existing amendments */}
      {existingAmendments.length > 0 && (
        <Card className="border-none shadow-sm bg-card">
          <CardHeader className="pb-2 border-b border-border">
            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Avenants existants ({existingAmendments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border">
            {existingAmendments.map((amendment) => (
              <div key={amendment.id} className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileEdit className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">
                      {AMENDMENT_TYPE_LABELS[amendment.amendment_type] ||
                        amendment.amendment_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {amendment.signed_at ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-xs text-emerald-600">Signé</span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-xs text-amber-600">
                          En attente
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {amendment.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  Effet au{" "}
                  {new Date(amendment.effective_date).toLocaleDateString(
                    "fr-FR",
                    { day: "numeric", month: "long", year: "numeric" }
                  )}
                </p>
                {amendment.old_values &&
                  Object.keys(amendment.old_values).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(amendment.old_values).map(
                        ([key, oldVal]) => {
                          const newVal =
                            amendment.new_values?.[
                              key as keyof typeof amendment.new_values
                            ];
                          return (
                            <span
                              key={key}
                              className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded"
                            >
                              <span className="font-medium">{key}:</span>
                              <span className="line-through text-muted-foreground">
                                {String(oldVal)}
                              </span>
                              <span className="text-foreground">
                                {" "}
                                → {String(newVal)}
                              </span>
                            </span>
                          );
                        }
                      )}
                    </div>
                  )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* New amendment form */}
      {canAmend && showForm && (
        <AmendmentForm
          leaseId={lease.id}
          currentLease={{
            loyer: lease.loyer,
            charges_forfaitaires: lease.charges_forfaitaires,
            type_bail: lease.type_bail,
          }}
          onSuccess={() => {
            setShowForm(false);
            router.refresh();
          }}
          onCancel={
            existingAmendments.length > 0
              ? () => setShowForm(false)
              : undefined
          }
        />
      )}

      {canAmend && !showForm && (
        <Button
          onClick={() => setShowForm(true)}
          className="w-full"
          variant="outline"
        >
          <FileEdit className="h-4 w-4 mr-2" />
          Créer un nouvel avenant
        </Button>
      )}

      {!canAmend && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
          <CardContent className="p-4">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Les avenants ne peuvent être créés que pour les baux actifs (statut
              actuel : {lease.statut}).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
