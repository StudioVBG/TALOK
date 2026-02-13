"use client";

import React, { useMemo, useId } from "react";
import { motion } from "framer-motion";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TAX_REGIMES } from "@/lib/types/property-v3";
import { isDomTomPostalCode } from "@/lib/validations/property-v3";
import { cn } from "@/lib/utils";
import {
  Euro, AlertTriangle, Info, Calculator, Building2,
  Receipt, Landmark, ShieldCheck
} from "lucide-react";

// Rent control zones in France
const RENT_CONTROL_ZONES = [
  { value: "paris", label: "Paris" },
  { value: "paris_agglo", label: "Agglomération parisienne (Plaine Commune, Est Ensemble, etc.)" },
  { value: "lille", label: "Lille" },
  { value: "lyon", label: "Lyon" },
  { value: "villeurbanne", label: "Villeurbanne" },
  { value: "montpellier", label: "Montpellier" },
  { value: "bordeaux", label: "Bordeaux" },
] as const;

const HABITATION_TYPES = [
  "appartement", "maison", "studio", "villa", "chambre",
  "colocation", "saisonnier", "case_creole", "bungalow", "logement_social",
];

export function LoyerChargesStep() {
  const { formData, updateFormData } = usePropertyWizardStore();
  const baseId = useId();
  const propertyType = (formData.type as string) || "";
  const isHabitation = HABITATION_TYPES.includes(propertyType);
  const isFurnished = formData.meuble === true;
  const isDomTom = formData.code_postal ? isDomTomPostalCode(formData.code_postal) : false;

  // Auto-calculate deposit based on furnished/unfurnished
  const suggestedDeposit = useMemo(() => {
    const loyer = formData.loyer_hc || 0;
    if (isFurnished) return loyer * 2; // 2 months for furnished
    return loyer; // 1 month for unfurnished
  }, [formData.loyer_hc, isFurnished]);

  const handleDepositAutoCalc = () => {
    updateFormData({ depot_garantie: suggestedDeposit });
  };

  return (
    <div className="h-full flex flex-col max-w-3xl mx-auto overflow-y-auto pb-8 gap-6">
      {/* Section: Loyer */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Euro className="h-5 w-5 text-primary" />
          <h3>Loyer et charges</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Loyer HC */}
          <div className="space-y-2">
            <Label htmlFor={`${baseId}-loyer`}>Loyer hors charges (€/mois) *</Label>
            <Input
              id={`${baseId}-loyer`}
              type="number"
              min={0}
              step={0.01}
              placeholder="Ex: 750"
              value={formData.loyer_hc ?? ""}
              onChange={(e) => updateFormData({ loyer_hc: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>

          {/* Charges */}
          <div className="space-y-2">
            <Label htmlFor={`${baseId}-charges`}>Charges mensuelles (€/mois)</Label>
            <Input
              id={`${baseId}-charges`}
              type="number"
              min={0}
              step={0.01}
              placeholder="Ex: 80"
              value={formData.charges_mensuelles ?? ""}
              onChange={(e) => updateFormData({ charges_mensuelles: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
        </div>

        {/* Charges type */}
        <div className="space-y-2">
          <Label htmlFor={`${baseId}-charges-type`}>Type de charges</Label>
          <Select
            value={formData.charges_type || "provision"}
            onValueChange={(value) => updateFormData({ charges_type: value as 'provision' | 'forfait' })}
          >
            <SelectTrigger id={`${baseId}-charges-type`}>
              <SelectValue placeholder="Type de charges" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="provision">Provision sur charges (régularisation annuelle)</SelectItem>
              <SelectItem value="forfait">Forfait de charges (montant fixe)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.section>

      {/* Section: Dépôt de garantie */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3>Dépôt de garantie</h3>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor={`${baseId}-depot`}>Montant du dépôt de garantie (€)</Label>
            <Input
              id={`${baseId}-depot`}
              type="number"
              min={0}
              step={0.01}
              placeholder="Ex: 750"
              value={formData.depot_garantie ?? ""}
              onChange={(e) => updateFormData({ depot_garantie: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
          {isHabitation && formData.loyer_hc && (
            <button
              type="button"
              onClick={handleDepositAutoCalc}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors whitespace-nowrap"
            >
              <Calculator className="h-3.5 w-3.5" />
              {isFurnished ? "2 mois" : "1 mois"} = {suggestedDeposit}€
            </button>
          )}
        </div>

        {isHabitation && (
          <p className="text-xs text-muted-foreground">
            {isFurnished
              ? "Logement meublé : le dépôt de garantie ne peut excéder 2 mois de loyer HC."
              : "Logement nu : le dépôt de garantie ne peut excéder 1 mois de loyer HC."}
          </p>
        )}
      </motion.section>

      {/* Section: Encadrement des loyers */}
      {isHabitation && !isDomTom && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Building2 className="h-5 w-5 text-primary" />
            <h3>Encadrement des loyers</h3>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id={`${baseId}-rent-controlled`}
              checked={formData.is_rent_controlled ?? false}
              onCheckedChange={(checked) => updateFormData({
                is_rent_controlled: checked,
                rent_control_zone: checked ? formData.rent_control_zone : undefined,
                loyer_reference: checked ? formData.loyer_reference : undefined,
                loyer_reference_majore: checked ? formData.loyer_reference_majore : undefined,
              })}
            />
            <Label htmlFor={`${baseId}-rent-controlled`}>Ce bien est en zone d'encadrement des loyers</Label>
          </div>

          {formData.is_rent_controlled && (
            <div className="space-y-4 pl-4 border-l-2 border-primary/20">
              {/* Zone */}
              <div className="space-y-2">
                <Label htmlFor={`${baseId}-zone`}>Zone d'encadrement</Label>
                <Select
                  value={formData.rent_control_zone || ""}
                  onValueChange={(value) => updateFormData({ rent_control_zone: value })}
                >
                  <SelectTrigger id={`${baseId}-zone`}>
                    <SelectValue placeholder="Sélectionnez la zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {RENT_CONTROL_ZONES.map((zone) => (
                      <SelectItem key={zone.value} value={zone.value}>
                        {zone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Loyer de référence */}
                <div className="space-y-2">
                  <Label htmlFor={`${baseId}-ref`}>Loyer de référence (€/m²)</Label>
                  <Input
                    id={`${baseId}-ref`}
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Ex: 25.50"
                    value={formData.loyer_reference ?? ""}
                    onChange={(e) => updateFormData({ loyer_reference: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </div>

                {/* Loyer de référence majoré */}
                <div className="space-y-2">
                  <Label htmlFor={`${baseId}-ref-maj`}>Loyer de référence majoré (€/m²)</Label>
                  <Input
                    id={`${baseId}-ref-maj`}
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Ex: 30.60"
                    value={formData.loyer_reference_majore ?? ""}
                    onChange={(e) => updateFormData({ loyer_reference_majore: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </div>
              </div>

              {/* Complément de loyer */}
              <div className="space-y-2">
                <Label htmlFor={`${baseId}-complement`}>Complément de loyer (€/mois, optionnel)</Label>
                <Input
                  id={`${baseId}-complement`}
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="Ex: 50"
                  value={formData.complement_loyer ?? ""}
                  onChange={(e) => updateFormData({ complement_loyer: e.target.value ? Number(e.target.value) : undefined })}
                />
                {(formData.complement_loyer ?? 0) > 0 && (
                  <div className="space-y-2 mt-2">
                    <Label htmlFor={`${baseId}-complement-justif`}>Justification du complément *</Label>
                    <Input
                      id={`${baseId}-complement-justif`}
                      placeholder="Ex: Vue exceptionnelle, terrasse panoramique..."
                      value={formData.complement_loyer_justification ?? ""}
                      onChange={(e) => updateFormData({ complement_loyer_justification: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Le complément de loyer doit être justifié par des caractéristiques exceptionnelles
                      (localisation, confort, équipements).
                    </p>
                  </div>
                )}
              </div>

              {/* Rent control warning */}
              {formData.loyer_reference_majore && formData.loyer_hc && formData.surface_habitable_m2 && (
                (() => {
                  const maxRent = formData.loyer_reference_majore * formData.surface_habitable_m2 + (formData.complement_loyer || 0);
                  const isOverLimit = formData.loyer_hc > maxRent;
                  return isOverLimit ? (
                    <Alert variant="destructive" className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Votre loyer ({formData.loyer_hc}€) dépasse le plafond autorisé ({maxRent.toFixed(0)}€ = {formData.loyer_reference_majore}€/m² × {formData.surface_habitable_m2}m²
                        {formData.complement_loyer ? ` + ${formData.complement_loyer}€ complément` : ""}).
                      </AlertDescription>
                    </Alert>
                  ) : null;
                })()
              )}
            </div>
          )}
        </motion.section>
      )}

      {/* DOM-TOM alert */}
      {isDomTom && (
        <Alert className="bg-amber-50 border-amber-200">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Zone DOM-TOM détectée.</strong> L'encadrement des loyers ne s'applique pas dans les DOM-TOM.
            Des réglementations spécifiques peuvent s'appliquer (taxe ordures ménagères, assurance catastrophe naturelle).
          </AlertDescription>
        </Alert>
      )}

      {/* Section: Régime fiscal */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Landmark className="h-5 w-5 text-primary" />
          <h3>Régime fiscal</h3>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${baseId}-tax`}>Régime fiscal applicable</Label>
          <Select
            value={formData.tax_regime || ""}
            onValueChange={(value) => updateFormData({ tax_regime: value })}
          >
            <SelectTrigger id={`${baseId}-tax`}>
              <SelectValue placeholder="Sélectionnez le régime fiscal" />
            </SelectTrigger>
            <SelectContent>
              {TAX_REGIMES.map((regime) => (
                <SelectItem key={regime.value} value={regime.value}>
                  <div className="flex flex-col">
                    <span>{regime.label}</span>
                    <span className="text-xs text-muted-foreground">{regime.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tax regime recommendation */}
        {isHabitation && !formData.tax_regime && (
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-sm">
              {isFurnished
                ? "Pour un meublé, le régime LMNP (Micro-BIC ou réel) est généralement le plus avantageux."
                : "Pour un logement nu, le micro-foncier est le plus simple si vos revenus fonciers < 15 000€/an."}
            </AlertDescription>
          </Alert>
        )}
      </motion.section>

      {/* Summary card */}
      {(formData.loyer_hc ?? 0) > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl border bg-card p-4 space-y-2"
        >
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Receipt className="h-4 w-4 text-primary" />
            Récapitulatif financier
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">Loyer HC</div>
            <div className="font-medium text-right">{formData.loyer_hc?.toFixed(2)} €</div>
            <div className="text-muted-foreground">Charges ({formData.charges_type === 'forfait' ? 'forfait' : 'provisions'})</div>
            <div className="font-medium text-right">{(formData.charges_mensuelles || 0).toFixed(2)} €</div>
            <div className="text-muted-foreground font-semibold border-t pt-1">Total CC</div>
            <div className="font-bold text-right border-t pt-1">
              {((formData.loyer_hc || 0) + (formData.charges_mensuelles || 0)).toFixed(2)} €
            </div>
            <div className="text-muted-foreground">Dépôt de garantie</div>
            <div className="font-medium text-right">{(formData.depot_garantie || 0).toFixed(2)} €</div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
