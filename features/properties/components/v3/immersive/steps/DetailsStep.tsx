"use client";

import React from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { Euro, Ruler, Coins, Home, Car, Building2, ArrowUpDown, Sofa, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RentEstimation } from "../RentEstimation";

const TYPES_WITHOUT_ROOMS = ["parking", "box", "local_commercial", "bureaux", "entrepot", "fonds_de_commerce"];

export function DetailsStep() {
  const { formData, updateFormData } = usePropertyWizardStore();

  const propertyType = (formData.type as string) || "";
  const showRooms = !TYPES_WITHOUT_ROOMS.includes(propertyType);
  const isParking = propertyType === "parking" || propertyType === "box";
  const isHabitation = ["appartement", "maison", "studio", "colocation", "saisonnier"].includes(propertyType);
  const showEtageAscenseur = ["appartement", "studio", "colocation", "local_commercial", "bureaux", "entrepot", "fonds_de_commerce"].includes(propertyType);

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
      <div className="h-full flex flex-col justify-center max-w-2xl mx-auto">
        <div className="space-y-4">
          {/* Row 1: Surface + Type/Étage */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card p-4 rounded-xl border">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                  <Ruler className="h-4 w-4" />
                </div>
                <Label className="text-sm font-medium">Surface</Label>
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

            {isParking ? (
              <div className="bg-card p-4 rounded-xl border">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
                    <Car className="h-4 w-4" />
                  </div>
                  <Label className="text-sm font-medium">Type</Label>
                </div>
                <Select value={(formData.parking_type as string) || "exterieur"} onValueChange={(v) => updateFormData({ parking_type: v })}>
                  <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="box">Box fermé</SelectItem>
                    <SelectItem value="couvert">Couvert</SelectItem>
                    <SelectItem value="exterieur">Extérieur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : showEtageAscenseur ? (
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
            ) : null}
          </div>

          {/* Row 2: Ascenseur + Meublé */}
          {(showEtageAscenseur || isHabitation) && (
            <div className="grid grid-cols-2 gap-4">
              {showEtageAscenseur && (
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
              {isHabitation && (
                <div className="bg-card p-4 rounded-xl border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                      <Sofa className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">Meublé</span>
                    <Tooltip>
                      <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent><p className="text-xs">Logement équipé</p></TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch checked={!!formData.meuble} onCheckedChange={(c) => updateFormData({ meuble: c })} />
                </div>
              )}
            </div>
          )}

          {/* Info pièces */}
          {showRooms && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <Home className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-300">Configuration des pièces à l&apos;étape suivante</p>
            </div>
          )}

          {/* Estimation de loyer IA */}
          {(formData.surface || formData.surface_habitable_m2) && formData.code_postal && !formData.loyer_hc && (
            <RentEstimation />
          )}

          {/* Row 3: Loyer + Charges */}
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
