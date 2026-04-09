"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  DIAGNOSTIC_TYPES,
  DIAGNOSTIC_SHORT_LABELS,
  computeExpiryDate,
  type DiagnosticType,
  type PropertyDiagnostic,
} from "@/lib/validations/diagnostics";

interface DiagnosticFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  /** If provided, we're editing; otherwise creating */
  diagnostic?: PropertyDiagnostic | null;
  /** Pre-selected type for creation */
  preselectedType?: DiagnosticType;
  onSaved: () => void;
}

const DPE_RESULTS = ["A", "B", "C", "D", "E", "F", "G"];
const BINARY_RESULTS = ["positif", "negatif"];

function getResultOptions(type: DiagnosticType): string[] | null {
  if (type === "dpe") return DPE_RESULTS;
  if (type === "amiante" || type === "plomb") return BINARY_RESULTS;
  return null;
}

export function DiagnosticFormDialog({
  open,
  onOpenChange,
  propertyId,
  diagnostic,
  preselectedType,
  onSaved,
}: DiagnosticFormDialogProps) {
  const isEditing = !!diagnostic;
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<DiagnosticType>(
    diagnostic?.diagnostic_type as DiagnosticType ?? preselectedType ?? "dpe"
  );
  const [performedDate, setPerformedDate] = useState(
    diagnostic?.performed_date ?? new Date().toISOString().split("T")[0]
  );
  const [result, setResult] = useState(diagnostic?.result ?? "");
  const [diagnostiqueurName, setDiagnostiqueurName] = useState(
    diagnostic?.diagnostiqueur_name ?? ""
  );
  const [diagnostiqueurCert, setDiagnostiqueurCert] = useState(
    diagnostic?.diagnostiqueur_certification ?? ""
  );
  const [notes, setNotes] = useState(diagnostic?.notes ?? "");

  const resultOptions = getResultOptions(type);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const expiryDate = computeExpiryDate(type, performedDate, result || null);

      if (isEditing && diagnostic) {
        const res = await fetch(`/api/diagnostics/${diagnostic.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            performed_date: performedDate,
            expiry_date: expiryDate,
            result: result || null,
            diagnostiqueur_name: diagnostiqueurName || null,
            diagnostiqueur_certification: diagnostiqueurCert || null,
            notes: notes || null,
          }),
        });
        if (!res.ok) throw new Error("Erreur lors de la modification");
      } else {
        const res = await fetch("/api/diagnostics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            property_id: propertyId,
            diagnostic_type: type,
            performed_date: performedDate,
            expiry_date: expiryDate,
            result: result || null,
            diagnostiqueur_name: diagnostiqueurName || null,
            diagnostiqueur_certification: diagnostiqueurCert || null,
            notes: notes || null,
          }),
        });
        if (!res.ok) throw new Error("Erreur lors de la création");
      }

      toast({
        title: isEditing ? "Diagnostic modifié" : "Diagnostic ajouté",
        description: `${DIAGNOSTIC_SHORT_LABELS[type]} enregistré avec succès.`,
      });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier le diagnostic" : "Ajouter un diagnostic"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEditing && !preselectedType && (
            <div className="space-y-2">
              <Label>Type de diagnostic</Label>
              <Select value={type} onValueChange={(v) => setType(v as DiagnosticType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAGNOSTIC_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {DIAGNOSTIC_SHORT_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Date de réalisation</Label>
            <Input
              type="date"
              value={performedDate}
              onChange={(e) => setPerformedDate(e.target.value)}
              required
            />
          </div>

          {resultOptions && (
            <div className="space-y-2">
              <Label>Résultat</Label>
              <Select value={result} onValueChange={setResult}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {resultOptions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r === "positif" ? "Positif (présence)" : r === "negatif" ? "Négatif (absence)" : `Classe ${r}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Nom du diagnostiqueur</Label>
            <Input
              value={diagnostiqueurName}
              onChange={(e) => setDiagnostiqueurName(e.target.value)}
              placeholder="Ex: Cabinet Dupont Diagnostics"
            />
          </div>

          <div className="space-y-2">
            <Label>N certification</Label>
            <Input
              value={diagnostiqueurCert}
              onChange={(e) => setDiagnostiqueurCert(e.target.value)}
              placeholder="Ex: CERT-12345"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes optionnelles..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? "Modifier" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
