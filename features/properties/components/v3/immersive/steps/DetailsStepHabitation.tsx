"use client";

import React from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import {
  Euro, Ruler, Coins, ArrowUpDown, Sofa, HelpCircle,
  Flame, Droplet, Snowflake, Zap, Home, ThermometerSun,
  Building2, FileText, Briefcase
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RentEstimation } from "../RentEstimation";
import { Badge } from "@/components/ui/badge";

// Classes DPE avec couleurs officielles
const DPE_CLASSES = [
  { value: "A", label: "A", color: "bg-green-600", description: "< 70 kWh/m²/an" },
  { value: "B", label: "B", color: "bg-lime-500", description: "70-110 kWh/m²/an" },
  { value: "C", label: "C", color: "bg-yellow-400", description: "110-180 kWh/m²/an" },
  { value: "D", label: "D", color: "bg-amber-400", description: "180-250 kWh/m²/an" },
  { value: "E", label: "E", color: "bg-orange-500", description: "250-330 kWh/m²/an" },
  { value: "F", label: "F", color: "bg-red-500", description: "330-420 kWh/m²/an" },
  { value: "G", label: "G", color: "bg-red-700", description: "> 420 kWh/m²/an" },
  { value: "NC", label: "N/C", color: "bg-gray-400", description: "Non communiqué / En cours" },
];

const GES_CLASSES = [
  { value: "A", label: "A", color: "bg-violet-200" },
  { value: "B", label: "B", color: "bg-violet-300" },
  { value: "C", label: "C", color: "bg-violet-400" },
  { value: "D", label: "D", color: "bg-violet-500" },
  { value: "E", label: "E", color: "bg-violet-600" },
  { value: "F", label: "F", color: "bg-violet-700" },
  { value: "G", label: "G", color: "bg-violet-800" },
  { value: "NC", label: "N/C", color: "bg-gray-400" },
];

export function DetailsStepHabitation() {
  const { formData, updateFormData } = usePropertyWizardStore();

  const propertyType = (formData.type as string) || "";
  const showEtage = ["appartement", "studio", "colocation"].includes(propertyType);

  const handleChange = (field: string, value: string) => {
    const numValue = value === "" ? null : parseFloat(value);
    if (numValue === null || !isNaN(numValue)) {
      if (field === "surface") {
        updateFormData({ surface: numValue, surface_habitable_m2: numValue });
      } else {
        updateFormData({ [field]: numValue });
      }
    }
  };

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col max-w-3xl mx-auto overflow-y-auto">
        <div className="space-y-4 pb-4">
          {/* Section 1: Surface & Étage */}
          <div className="grid grid-cols-2 gap-4">
            {/* Surface */}
            <div className="bg-card p-4 rounded-xl border">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                  <Ruler className="h-4 w-4" />
                </div>
                <Label className="text-sm font-medium">Surface habitable</Label>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0"
                  className="pr-10 h-12 text-xl font-bold"
                  value={formData.surface_habitable_m2 || formData.surface || ""}
                  onChange={(e) => handleChange("surface", e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">m²</span>
              </div>
            </div>

            {/* Étage (si applicable) */}
            {showEtage ? (
              <div className="bg-card p-4 rounded-xl border">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                  <Label className="text-sm font-medium">Étage</Label>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    className="pr-12 h-12 text-xl font-bold"
                    value={formData.etage ?? ""}
                    onChange={(e) => handleChange("etage", e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {formData.etage === 0 ? "RDC" : "étage"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-card p-4 rounded-xl border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                    <Home className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">Terrain (m²)</span>
                </div>
                <Input
                  type="number"
                  placeholder="0"
                  className="w-24 h-10 text-right font-bold"
                  value={(formData as any).surface_terrain || ""}
                  onChange={(e) => handleChange("surface_terrain", e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Section 1b: Usage principal (OBLIGATOIRE) */}
          <div className="bg-card p-4 rounded-xl border">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 bg-teal-100 text-teal-600 rounded-lg flex items-center justify-center">
                <Briefcase className="h-4 w-4" />
              </div>
              <Label className="text-sm font-medium">Usage principal</Label>
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Obligatoire</Badge>
            </div>
            <Select
              value={(formData as any).usage_principal || ""}
              onValueChange={(v) => updateFormData({ usage_principal: v })}
            >
              <SelectTrigger className="h-10"><SelectValue placeholder="Sélectionnez l'usage..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="habitation">Habitation principale</SelectItem>
                <SelectItem value="habitation_secondaire">Résidence secondaire</SelectItem>
                <SelectItem value="mixte">Usage mixte (habitation + professionnel)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Section 1c: Description (RECOMMANDÉ) */}
          <div className="bg-card p-4 rounded-xl border">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center">
                <FileText className="h-4 w-4" />
              </div>
              <Label className="text-sm font-medium">Description du bien</Label>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Recommandé</Badge>
            </div>
            <Textarea
              placeholder="Décrivez votre bien : points forts, caractéristiques, environnement..."
              className="min-h-[100px] resize-none"
              value={(formData as any).description || ""}
              onChange={(e) => updateFormData({ description: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Une bonne description augmente vos chances de trouver un locataire rapidement
            </p>
          </div>

          {/* Section 2: Ascenseur + Meublé */}
          <div className="grid grid-cols-2 gap-4">
            {showEtage && (
              <div className="bg-card p-4 rounded-xl border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">Ascenseur</span>
                </div>
                <Switch checked={!!formData.ascenseur} onCheckedChange={(c) => updateFormData({ ascenseur: c })} />
              </div>
            )}
            <div className="bg-card p-4 rounded-xl border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                  <Sofa className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Meublé</span>
                <Tooltip>
                  <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent><p className="text-xs">Location meublée (mobilier inclus)</p></TooltipContent>
                </Tooltip>
              </div>
              <Switch checked={!!formData.meuble} onCheckedChange={(c) => updateFormData({ meuble: c })} />
            </div>
          </div>

          {/* Section 3: DPE (OBLIGATOIRE) */}
          <div className="bg-card p-4 rounded-xl border">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                <Zap className="h-4 w-4" />
              </div>
              <Label className="text-sm font-medium">Diagnostic de Performance Énergétique (DPE)</Label>
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Obligatoire</Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* Classe énergie */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Classe énergie</Label>
                <div className="flex gap-1">
                  {DPE_CLASSES.map((dpe) => (
                    <button
                      key={dpe.value}
                      type="button"
                      onClick={() => updateFormData({ dpe_classe_energie: dpe.value })}
                      className={`flex-1 h-10 rounded-md font-bold text-white transition-all ${dpe.color} ${
                        formData.dpe_classe_energie === dpe.value 
                          ? "ring-2 ring-offset-2 ring-primary scale-110" 
                          : "opacity-60 hover:opacity-100"
                      }`}
                    >
                      {dpe.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Classe GES -> stocké dans dpe_classe_climat en BDD */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Émissions GES</Label>
                <div className="flex gap-1">
                  {GES_CLASSES.map((ges) => (
                    <button
                      key={ges.value}
                      type="button"
                      onClick={() => updateFormData({ dpe_classe_climat: ges.value })}
                      className={`flex-1 h-10 rounded-md font-bold text-white transition-all ${ges.color} ${
                        (formData as any).dpe_classe_climat === ges.value 
                          ? "ring-2 ring-offset-2 ring-primary scale-110" 
                          : "opacity-60 hover:opacity-100"
                      }`}
                    >
                      {ges.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Valeurs numériques DPE (optionnel mais recommandé) */}
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Consommation (kWh/m²/an)
                </Label>
                <Input
                  type="number"
                  placeholder="Ex: 150"
                  className="h-9"
                  value={(formData as any).dpe_consommation || ""}
                  onChange={(e) => handleChange("dpe_consommation", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Émissions GES (kg CO₂/m²/an)
                </Label>
                <Input
                  type="number"
                  placeholder="Ex: 25"
                  className="h-9"
                  value={(formData as any).dpe_emissions || ""}
                  onChange={(e) => handleChange("dpe_emissions", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Chauffage & Eau chaude */}
          <div className="grid grid-cols-2 gap-4">
            {/* Chauffage */}
            <div className="bg-card p-4 rounded-xl border">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
                  <Flame className="h-4 w-4" />
                </div>
                <Label className="text-sm font-medium">Chauffage</Label>
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Obligatoire</Badge>
              </div>
              <div className="space-y-2">
                <Select 
                  value={(formData as any).chauffage_type || ""} 
                  onValueChange={(v) => updateFormData({ chauffage_type: v })}
                >
                  <SelectTrigger className="h-10"><SelectValue placeholder="Type..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individuel">Individuel</SelectItem>
                    <SelectItem value="collectif">Collectif</SelectItem>
                    <SelectItem value="aucun">Aucun</SelectItem>
                  </SelectContent>
                </Select>
                {(formData as any).chauffage_type && (formData as any).chauffage_type !== "aucun" && (
                  <Select 
                    value={(formData as any).chauffage_energie || ""} 
                    onValueChange={(v) => updateFormData({ chauffage_energie: v })}
                  >
                    <SelectTrigger className="h-10"><SelectValue placeholder="Énergie..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="electricite">Électricité</SelectItem>
                      <SelectItem value="gaz">Gaz</SelectItem>
                      <SelectItem value="fioul">Fioul</SelectItem>
                      <SelectItem value="bois">Bois</SelectItem>
                      <SelectItem value="reseau_urbain">Réseau urbain</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Eau chaude */}
            <div className="bg-card p-4 rounded-xl border">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                  <Droplet className="h-4 w-4" />
                </div>
                <Label className="text-sm font-medium">Eau chaude</Label>
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Obligatoire</Badge>
              </div>
              <Select 
                value={(formData as any).eau_chaude_type || ""} 
                onValueChange={(v) => updateFormData({ eau_chaude_type: v })}
              >
                <SelectTrigger className="h-10"><SelectValue placeholder="Type..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="electrique_indiv">Électrique individuel</SelectItem>
                  <SelectItem value="gaz_indiv">Gaz individuel</SelectItem>
                  <SelectItem value="collectif">Collectif</SelectItem>
                  <SelectItem value="solaire">Solaire</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section 5: Climatisation */}
          <div className="bg-card p-4 rounded-xl border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-cyan-100 text-cyan-600 rounded-lg flex items-center justify-center">
                  <Snowflake className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">Climatisation</span>
              </div>
              <div className="flex items-center gap-2">
                <Select 
                  value={(formData as any).clim_presence || "aucune"} 
                  onValueChange={(v) => updateFormData({ clim_presence: v })}
                >
                  <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aucune">Aucune</SelectItem>
                    <SelectItem value="fixe">Fixe</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                  </SelectContent>
                </Select>
                {(formData as any).clim_presence === "fixe" && (
                  <Select 
                    value={(formData as any).clim_type || ""} 
                    onValueChange={(v) => updateFormData({ clim_type: v })}
                  >
                    <SelectTrigger className="w-28 h-9"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="split">Split</SelectItem>
                      <SelectItem value="gainable">Gainable</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>

          {/* Info pièces */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
            <Home className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">Configuration des pièces à l&apos;étape suivante</p>
          </div>

          {/* Estimation de loyer IA */}
          {(formData.surface || formData.surface_habitable_m2) && formData.code_postal && !formData.loyer_hc && (
            <RentEstimation />
          )}

          {/* Section Loyer & Charges */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card p-4 rounded-xl border">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                  <Euro className="h-4 w-4" />
                </div>
                <Label className="text-sm font-medium">Loyer HC</Label>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0"
                  className="pr-8 h-12 text-xl font-bold"
                  value={formData.loyer_hc || ""}
                  onChange={(e) => handleChange("loyer_hc", e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
              </div>
            </div>

            <div className="bg-card p-4 rounded-xl border">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
                  <Coins className="h-4 w-4" />
                </div>
                <Label className="text-sm font-medium">Charges</Label>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0"
                  className="pr-8 h-12 text-xl font-bold"
                  value={formData.charges_mensuelles || ""}
                  onChange={(e) => handleChange("charges_mensuelles", e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
              </div>
            </div>
          </div>

          {/* Total */}
          {(formData.loyer_hc || 0) > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center p-3 bg-primary/5 rounded-xl border border-primary/20">
              <span className="text-sm text-muted-foreground">Total CC : </span>
              <span className="text-xl font-bold text-primary">{((formData.loyer_hc || 0) + (formData.charges_mensuelles || 0)).toFixed(0)} €</span>
              <span className="text-sm text-muted-foreground"> /mois</span>
            </motion.div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

