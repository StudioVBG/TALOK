"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeaseWizardStore } from "@/features/leases/stores/lease-wizard.store";

/**
 * SOTA 2026: Champs specifiques bail professionnel
 */
export function ProfessionalFields() {
  const { activiteAutorisee, indexationType, setCommercial } = useLeaseWizardStore();

  return (
    <div className="space-y-4 rounded-lg border p-4 bg-blue-50/50">
      <h4 className="font-semibold text-blue-800">Bail professionnel</h4>

      <div className="space-y-2">
        <Label>Activité exercée</Label>
        <Input
          placeholder="Ex: Cabinet médical, bureau d'architecte..."
          value={activiteAutorisee}
          onChange={(e) => setCommercial({ activiteAutorisee: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Indice de révision</Label>
        <Select
          value={indexationType}
          onValueChange={(v) => setCommercial({ indexationType: v as "ILC" | "ILAT" | "IRL" | "" })}
        >
          <SelectTrigger><SelectValue placeholder="Choisir l'indice" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ILAT">ILAT — Activités Tertiaires</SelectItem>
            <SelectItem value="IRL">IRL — Référence des Loyers</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
