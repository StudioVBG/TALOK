"use client";

import React from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { 
  Euro, Ruler, Coins, ArrowUpDown, Building2, Store, 
  Accessibility, Snowflake, Wifi, ShieldAlert, ShoppingCart,
  Truck, DoorOpen, Warehouse, ChefHat, Briefcase, Package
} from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";

// Types de locaux
const LOCAL_TYPES = [
  { value: "boutique", label: "Boutique", icon: Store, description: "Commerce de détail" },
  { value: "restaurant", label: "Restaurant", icon: ChefHat, description: "Restauration" },
  { value: "bureaux", label: "Bureaux", icon: Briefcase, description: "Espace de travail" },
  { value: "atelier", label: "Atelier", icon: Warehouse, description: "Production/Artisanat" },
  { value: "stockage", label: "Stockage", icon: Package, description: "Entreposage" },
  { value: "autre", label: "Autre", icon: Building2, description: "Autre activité" },
];

// Équipements professionnels
const PRO_EQUIPMENTS = [
  { key: "local_has_vitrine", label: "Vitrine", icon: DoorOpen, description: "Façade vitrée" },
  { key: "local_access_pmr", label: "Accès PMR", icon: Accessibility, description: "Accessible handicapés" },
  { key: "local_clim", label: "Climatisation", icon: Snowflake, description: "Clim installée" },
  { key: "local_fibre", label: "Fibre optique", icon: Wifi, description: "Internet très haut débit" },
  { key: "local_alarme", label: "Alarme", icon: ShieldAlert, description: "Système de sécurité" },
  { key: "local_rideau_metal", label: "Rideau métallique", icon: DoorOpen, description: "Protection devanture" },
  { key: "local_acces_camion", label: "Accès camion", icon: Truck, description: "Livraison poids lourds" },
  { key: "local_parking_clients", label: "Parking clients", icon: ShoppingCart, description: "Places de stationnement" },
];

export function DetailsStepPro() {
  const { formData, updateFormData } = usePropertyWizardStore();

  const propertyType = (formData.type as string) || "";
  const isEntrepot = propertyType === "entrepot";
  const isBureaux = propertyType === "bureaux";
  const isCommerce = ["local_commercial", "fonds_de_commerce"].includes(propertyType);

  const handleChange = (field: string, value: string) => {
    const numValue = value === "" ? null : parseFloat(value);
    if (numValue === null || !isNaN(numValue)) {
      if (field === "surface") {
        updateFormData({ surface: numValue, local_surface_totale: numValue });
      } else {
        updateFormData({ [field]: numValue });
      }
    }
  };

  const toggleEquipment = (key: string) => {
    updateFormData({ [key]: !(formData as any)[key] });
  };

  // Filtrer les équipements selon le type de local
  const relevantEquipments = PRO_EQUIPMENTS.filter(eq => {
    if (isEntrepot) {
      return ["local_alarme", "local_acces_camion", "local_fibre"].includes(eq.key);
    }
    if (isBureaux) {
      return ["local_access_pmr", "local_clim", "local_fibre", "local_alarme"].includes(eq.key);
    }
    return true; // Commerce : tous les équipements
  });

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col max-w-3xl mx-auto overflow-y-auto">
        <div className="space-y-4 pb-4">
          
          {/* Section 1: Type de local (sauf si déjà défini par le type de bien) */}
          {isCommerce && (
            <div className="bg-card p-4 rounded-xl border">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
                  <Store className="h-4 w-4" />
                </div>
                <Label className="text-sm font-medium">Type de local</Label>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {LOCAL_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => updateFormData({ local_type: type.value })}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        (formData as any).local_type === type.value
                          ? "border-primary bg-primary/10 shadow-md"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Icon className={`h-5 w-5 mb-1 ${
                        (formData as any).local_type === type.value ? "text-primary" : "text-muted-foreground"
                      }`} />
                      <span className="text-sm font-medium block">{type.label}</span>
                      <span className="text-xs text-muted-foreground">{type.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Surface & Étage */}
          <div className="grid grid-cols-2 gap-4">
            {/* Surface */}
            <div className="bg-card p-4 rounded-xl border">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                  <Ruler className="h-4 w-4" />
                </div>
                <Label className="text-sm font-medium">Surface totale</Label>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0"
                  className="pr-10 h-12 text-xl font-bold"
                  value={(formData as any).local_surface_totale || formData.surface || ""}
                  onChange={(e) => handleChange("surface", e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">m²</span>
              </div>
            </div>

            {/* Étage */}
            <div className="bg-card p-4 rounded-xl border">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                  <ArrowUpDown className="h-4 w-4" />
                </div>
                <Label className="text-sm font-medium">Étage / Niveau</Label>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min="-5"
                  placeholder="0"
                  className="pr-12 h-12 text-xl font-bold"
                  value={formData.etage ?? ""}
                  onChange={(e) => handleChange("etage", e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {formData.etage === 0 ? "RDC" : formData.etage && formData.etage < 0 ? "sous-sol" : "étage"}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Hauteur sous plafond (pour entrepôt) */}
          {isEntrepot && (
            <div className="bg-card p-4 rounded-xl border">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                  <Building2 className="h-4 w-4" />
                </div>
                <Label className="text-sm font-medium">Hauteur sous plafond</Label>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="0"
                  className="pr-10 h-12 text-xl font-bold"
                  value={(formData as any).hauteur_plafond || ""}
                  onChange={(e) => handleChange("hauteur_plafond", e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">m</span>
              </div>
            </div>
          )}

          {/* Section 4: Équipements */}
          <div className="bg-card p-4 rounded-xl border">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
              <Label className="text-sm font-medium">Équipements & Caractéristiques</Label>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {relevantEquipments.map((eq) => {
                const Icon = eq.icon;
                const isSelected = !!(formData as any)[eq.key];
                return (
                  <button
                    key={eq.key}
                    type="button"
                    onClick={() => toggleEquipment(eq.key)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      isSelected
                        ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                        : "border-border hover:border-green-300"
                    }`}
                  >
                    <Icon className={`h-6 w-6 mx-auto mb-2 ${
                      isSelected ? "text-green-600" : "text-muted-foreground"
                    }`} />
                    <p className="text-xs font-medium">{eq.label}</p>
                    {isSelected && (
                      <span className="text-green-600 text-lg">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 5: Nombre de bureaux/pièces (pour bureaux) */}
          {isBureaux && (
            <div className="bg-card p-4 rounded-xl border">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center">
                  <Briefcase className="h-4 w-4" />
                </div>
                <Label className="text-sm font-medium">Nombre de bureaux/espaces</Label>
              </div>
              <Input
                type="number"
                min="1"
                placeholder="1"
                className="h-12 text-xl font-bold w-32"
                value={formData.nb_pieces || ""}
                onChange={(e) => handleChange("nb_pieces", e.target.value)}
              />
            </div>
          )}

          {/* Section 6: Loyer & Charges */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card p-4 rounded-xl border">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                  <Euro className="h-4 w-4" />
                </div>
                <Label className="text-sm font-medium">Loyer HT/HC</Label>
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
              <p className="text-xs text-muted-foreground mt-1">Hors taxes et hors charges</p>
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
              <p className="text-xs text-muted-foreground mt-1">Provisions sur charges</p>
            </div>
          </div>

          {/* Info type de bail */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <Store className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {isEntrepot 
                ? "Un bail professionnel ou commercial sera proposé selon votre activité."
                : isBureaux 
                  ? "Bail professionnel recommandé pour les bureaux."
                  : "Bail commercial 3/6/9 ou dérogatoire selon la durée souhaitée."
              }
            </p>
          </div>

          {/* Total */}
          {(formData.loyer_hc || 0) > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center p-3 bg-primary/5 rounded-xl border border-primary/20">
              <span className="text-sm text-muted-foreground">Total mensuel : </span>
              <span className="text-xl font-bold text-primary">{((formData.loyer_hc || 0) + (formData.charges_mensuelles || 0)).toFixed(0)} €</span>
              <span className="text-sm text-muted-foreground"> HT</span>
            </motion.div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

