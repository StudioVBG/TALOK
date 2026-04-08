"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileEdit, Loader2, Plus, Trash2 } from "lucide-react";
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

const AMENDMENT_TYPES = [
  { value: "loyer_revision", label: "Révision du loyer" },
  { value: "ajout_colocataire", label: "Ajout d'un colocataire" },
  { value: "retrait_colocataire", label: "Retrait d'un colocataire" },
  { value: "changement_charges", label: "Modification des charges" },
  { value: "travaux", label: "Travaux" },
  { value: "autre", label: "Autre modification" },
] as const;

type AmendmentType = typeof AMENDMENT_TYPES[number]["value"];

interface AmendmentFormProps {
  leaseId: string;
  currentLease: {
    loyer: number;
    charges_forfaitaires: number;
    type_bail: string;
  };
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface FieldChange {
  field: string;
  oldValue: string;
  newValue: string;
}

export function AmendmentForm({
  leaseId,
  currentLease,
  onSuccess,
  onCancel,
}: AmendmentFormProps) {
  const router = useRouter();
  const [type, setType] = useState<AmendmentType | "">("");
  const [description, setDescription] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [changes, setChanges] = useState<FieldChange[]>([
    { field: "", oldValue: "", newValue: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill old values for rent revision
  function handleTypeChange(value: AmendmentType) {
    setType(value);
    if (value === "loyer_revision") {
      setChanges([
        {
          field: "loyer",
          oldValue: String(currentLease.loyer),
          newValue: "",
        },
      ]);
    } else if (value === "changement_charges") {
      setChanges([
        {
          field: "charges_forfaitaires",
          oldValue: String(currentLease.charges_forfaitaires),
          newValue: "",
        },
      ]);
    } else {
      setChanges([{ field: "", oldValue: "", newValue: "" }]);
    }
  }

  function addChange() {
    setChanges([...changes, { field: "", oldValue: "", newValue: "" }]);
  }

  function removeChange(index: number) {
    if (changes.length <= 1) return;
    setChanges(changes.filter((_, i) => i !== index));
  }

  function updateChange(index: number, key: keyof FieldChange, value: string) {
    const updated = [...changes];
    updated[index] = { ...updated[index], [key]: value };
    setChanges(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!type || !description || !effectiveDate) {
      setError("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setSubmitting(true);
    setError(null);

    const oldValues: Record<string, string> = {};
    const newValues: Record<string, string> = {};
    for (const change of changes) {
      if (change.field) {
        oldValues[change.field] = change.oldValue;
        newValues[change.field] = change.newValue;
      }
    }

    try {
      const res = await fetch(`/api/leases/${leaseId}/amend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amendment_type: type,
          description,
          effective_date: effectiveDate,
          old_values: oldValues,
          new_values: newValues,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors de la création de l'avenant");
        return;
      }

      onSuccess?.();
      router.refresh();
    } catch {
      setError("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-none shadow-sm bg-card">
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileEdit className="h-4 w-4 text-blue-500" />
          Créer un avenant
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type */}
          <div className="space-y-1.5">
            <Label htmlFor="amendment-type">Type de modification *</Label>
            <Select
              value={type}
              onValueChange={(v) => handleTypeChange(v as AmendmentType)}
            >
              <SelectTrigger id="amendment-type">
                <SelectValue placeholder="Sélectionner le type" />
              </SelectTrigger>
              <SelectContent>
                {AMENDMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="amendment-desc">Description *</Label>
            <Textarea
              id="amendment-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez les modifications apportées au bail..."
              rows={3}
            />
          </div>

          {/* Effective date */}
          <div className="space-y-1.5">
            <Label htmlFor="amendment-date">Date d&apos;effet *</Label>
            <Input
              id="amendment-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          {/* Changes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Modifications</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addChange}
                className="h-7 text-xs gap-1"
              >
                <Plus className="h-3 w-3" />
                Ajouter
              </Button>
            </div>
            {changes.map((change, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                <div>
                  {index === 0 && (
                    <Label className="text-xs text-muted-foreground">Champ</Label>
                  )}
                  <Input
                    value={change.field}
                    onChange={(e) => updateChange(index, "field", e.target.value)}
                    placeholder="ex: loyer"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  {index === 0 && (
                    <Label className="text-xs text-muted-foreground">
                      Ancienne valeur
                    </Label>
                  )}
                  <Input
                    value={change.oldValue}
                    onChange={(e) => updateChange(index, "oldValue", e.target.value)}
                    placeholder="ex: 800"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  {index === 0 && (
                    <Label className="text-xs text-muted-foreground">
                      Nouvelle valeur
                    </Label>
                  )}
                  <Input
                    value={change.newValue}
                    onChange={(e) => updateChange(index, "newValue", e.target.value)}
                    placeholder="ex: 850"
                    className="h-9 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeChange(index)}
                  disabled={changes.length <= 1}
                  className="h-9 w-9"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Annuler
              </Button>
            )}
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création…
                </>
              ) : (
                "Créer l'avenant"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
