"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useLeaseWizardStore } from "@/features/leases/stores/lease-wizard.store";

/**
 * SOTA 2026: Champs specifiques baux commerciaux (Code de Commerce Art. L.145-1+)
 */
export function CommercialFields() {
  const { destinationBail, activiteAutorisee, indexationType, sousLocationAutorisee, droitPreference, setCommercial } = useLeaseWizardStore();

  return (
    <div className="space-y-4 rounded-lg border p-4 bg-amber-50/50">
      <h4 className="font-semibold text-amber-800">Clauses commerciales</h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Destination du bail</Label>
          <Input
            placeholder="Ex: Commerce de détail, restauration..."
            value={destinationBail}
            onChange={(e) => setCommercial({ destinationBail: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Activité autorisée</Label>
          <Input
            placeholder="Ex: Vente de vêtements"
            value={activiteAutorisee}
            onChange={(e) => setCommercial({ activiteAutorisee: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Indice d'indexation</Label>
        <Select
          value={indexationType}
          onValueChange={(v) => setCommercial({ indexationType: v as "ILC" | "ILAT" | "IRL" | "" })}
        >
          <SelectTrigger><SelectValue placeholder="Choisir l'indice" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ILC">ILC — Indice des Loyers Commerciaux</SelectItem>
            <SelectItem value="ILAT">ILAT — Indice des Loyers des Activités Tertiaires</SelectItem>
            <SelectItem value="IRL">IRL — Indice de Référence des Loyers</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={sousLocationAutorisee}
            onCheckedChange={(v) => setCommercial({ sousLocationAutorisee: !!v })}
          />
          <Label className="text-sm">Sous-location autorisée</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={droitPreference}
            onCheckedChange={(v) => setCommercial({ droitPreference: !!v })}
          />
          <Label className="text-sm">Droit de préférence</Label>
        </div>
      </div>
    </div>
  );
}
