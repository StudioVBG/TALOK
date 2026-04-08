"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface Retenue {
  type: string;
  label: string;
  amount_cents: number;
  justification?: string;
}

interface DepositRestitutionFormProps {
  depositId: string;
  depositAmountCents: number;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

const RETENUE_TYPES = [
  { value: "loyers_impayes", label: "Loyers impayés" },
  { value: "reparations_locatives", label: "Réparations locatives" },
  { value: "degradations", label: "Dégradations" },
  { value: "charges_impayes", label: "Charges impayées" },
  { value: "nettoyage", label: "Nettoyage" },
  { value: "autre", label: "Autre" },
];

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function DepositRestitutionForm({
  depositId,
  depositAmountCents,
  onSuccess,
  onError,
}: DepositRestitutionFormProps) {
  const [retenues, setRetenues] = useState<Retenue[]>([]);
  const [restitutionMethod, setRestitutionMethod] =
    useState<string>("bank_transfer");
  const [loading, setLoading] = useState(false);

  const totalRetenueCents = retenues.reduce(
    (sum, r) => sum + r.amount_cents,
    0
  );
  const restitutionCents = depositAmountCents - totalRetenueCents;

  function addRetenue() {
    setRetenues([
      ...retenues,
      { type: "autre", label: "", amount_cents: 0 },
    ]);
  }

  function removeRetenue(index: number) {
    setRetenues(retenues.filter((_, i) => i !== index));
  }

  function updateRetenue(index: number, updates: Partial<Retenue>) {
    setRetenues(
      retenues.map((r, i) => (i === index ? { ...r, ...updates } : r))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (restitutionCents < 0) {
      onError?.("Les retenues ne peuvent pas dépasser le montant du dépôt");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/deposits/${depositId}/restitute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restitution_amount_cents: restitutionCents,
          retenue_cents: totalRetenueCents,
          retenue_details: retenues.filter((r) => r.amount_cents > 0),
          restitution_method: restitutionMethod,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la restitution");
      }

      onSuccess?.();
    } catch (err) {
      onError?.(
        err instanceof Error ? err.message : "Erreur lors de la restitution"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Restitution du dépôt de garantie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 rounded-lg bg-muted/50 p-4">
            <div>
              <p className="text-xs text-muted-foreground">Dépôt initial</p>
              <p className="text-lg font-bold">
                {formatCents(depositAmountCents)} €
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Retenues</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">
                - {formatCents(totalRetenueCents)} €
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Restitution</p>
              <p
                className={`text-lg font-bold ${
                  restitutionCents >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatCents(restitutionCents)} €
              </p>
            </div>
          </div>

          {/* Retenues */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Retenues</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRetenue}
              >
                <Plus className="mr-1 h-3 w-3" />
                Ajouter
              </Button>
            </div>

            {retenues.map((retenue, index) => (
              <div
                key={index}
                className="flex items-end gap-2 rounded-lg border p-3"
              >
                <div className="flex-1">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={retenue.type}
                    onValueChange={(val) =>
                      updateRetenue(index, {
                        type: val,
                        label:
                          RETENUE_TYPES.find((t) => t.value === val)?.label ||
                          val,
                      })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RETENUE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-32">
                  <Label className="text-xs">Montant (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="h-9"
                    value={retenue.amount_cents / 100 || ""}
                    onChange={(e) =>
                      updateRetenue(index, {
                        amount_cents: Math.round(
                          parseFloat(e.target.value || "0") * 100
                        ),
                      })
                    }
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-red-500"
                  onClick={() => removeRetenue(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Restitution method */}
          <div className="space-y-2">
            <Label>Mode de restitution</Label>
            <Select
              value={restitutionMethod}
              onValueChange={setRestitutionMethod}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Virement bancaire</SelectItem>
                <SelectItem value="check">Chèque</SelectItem>
                <SelectItem value="sepa_credit">Virement SEPA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={loading || restitutionCents < 0}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Restitution en cours...
              </>
            ) : (
              `Restituer ${formatCents(restitutionCents)} €`
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
