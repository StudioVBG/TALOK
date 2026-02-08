"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { EntityFormData } from "@/app/owner/entities/new/page";

interface StepBankDetailsProps {
  formData: EntityFormData;
  onChange: (updates: Partial<EntityFormData>) => void;
  errors?: Record<string, string>;
  showNomField?: boolean;
}

export function StepBankDetails({
  formData,
  onChange,
  errors,
  showNomField,
}: StepBankDetailsProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Coordonnées bancaires</h2>
        <p className="text-muted-foreground text-sm">
          Pour recevoir les loyers et configurer Stripe Connect
        </p>
      </div>

      {/* Nom field for "particulier" type (skipped legal step) */}
      {showNomField && (
        <div className="space-y-2">
          <Label htmlFor="nom-particulier">
            Nom de l&apos;entité
          </Label>
          <Input
            id="nom-particulier"
            value={formData.nom}
            onChange={(e) => onChange({ nom: e.target.value })}
            placeholder="Patrimoine personnel"
          />
          <p className="text-xs text-muted-foreground">
            Un nom pour identifier votre patrimoine en nom propre
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* IBAN */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="iban">IBAN</Label>
          <Input
            id="iban"
            value={formData.iban}
            onChange={(e) => {
              const v = e.target.value
                .toUpperCase()
                .replace(/[^A-Z0-9\s]/g, "");
              onChange({ iban: v });
            }}
            placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
            className={`font-mono ${errors?.iban ? "border-destructive" : ""}`}
          />
          {errors?.iban ? (
            <p className="text-xs text-destructive">{errors.iban}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              L&apos;IBAN sera utilisé pour les virements de loyers
            </p>
          )}
        </div>

        {/* BIC */}
        <div className="space-y-2">
          <Label htmlFor="bic">BIC / SWIFT</Label>
          <Input
            id="bic"
            value={formData.bic}
            onChange={(e) =>
              onChange({ bic: e.target.value.toUpperCase() })
            }
            placeholder="BNPAFRPP"
            className="font-mono"
          />
        </div>

        {/* Banque */}
        <div className="space-y-2">
          <Label htmlFor="banqueNom">Nom de la banque</Label>
          <Input
            id="banqueNom"
            value={formData.banqueNom}
            onChange={(e) => onChange({ banqueNom: e.target.value })}
            placeholder="BNP Paribas"
          />
        </div>
      </div>

      {/* Info box */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <p className="font-medium mb-1">Stripe Connect</p>
        <p className="text-muted-foreground">
          Vous pourrez configurer Stripe Connect pour cette entité après sa
          création. Cela permettra de recevoir les paiements en ligne
          directement sur le compte de l&apos;entité.
        </p>
      </div>
    </div>
  );
}
