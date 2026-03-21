"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLeaseWizardStore } from "@/features/leases/stores/lease-wizard.store";

/**
 * SOTA 2026: Champs specifiques location-gerance
 */
export function LocationGeranceFields() {
  const { redevanceGerance, fondsDescription, setGerance } = useLeaseWizardStore();

  return (
    <div className="space-y-4 rounded-lg border p-4 bg-purple-50/50">
      <h4 className="font-semibold text-purple-800">Location-gérance</h4>

      <div className="space-y-2">
        <Label>Redevance de gérance (€/mois)</Label>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={redevanceGerance || ""}
          onChange={(e) => setGerance({ redevanceGerance: parseFloat(e.target.value) || 0 })}
        />
      </div>

      <div className="space-y-2">
        <Label>Description du fonds de commerce</Label>
        <Textarea
          placeholder="Décrire le fonds de commerce (activité, clientèle, éléments corporels et incorporels)..."
          value={fondsDescription}
          onChange={(e) => setGerance({ fondsDescription: e.target.value })}
          rows={4}
        />
      </div>
    </div>
  );
}
