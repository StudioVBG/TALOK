"use client";

import React from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { 
  Euro, Ruler, Coins, Car, ArrowUpDown, Shield, Key, 
  Video, UserCheck, Lock, Smartphone, Hash
} from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

// Types de parking
const PARKING_TYPES = [
  { value: "place_exterieure", label: "Place extérieure", icon: "🅿️" },
  { value: "place_couverte", label: "Place couverte", icon: "🏠" },
  { value: "box", label: "Box fermé", icon: "📦" },
  { value: "souterrain", label: "Souterrain", icon: "⬇️" },
];

// Gabarits de véhicules
const GABARITS = [
  { value: "2_roues", label: "2 roues", description: "Moto, scooter" },
  { value: "citadine", label: "Citadine", description: "Petite voiture" },
  { value: "berline", label: "Berline", description: "Voiture standard" },
  { value: "suv", label: "SUV", description: "Grand véhicule" },
  { value: "utilitaire", label: "Utilitaire", description: "Camionnette" },
];

// Types d'accès
const ACCESS_TYPES = [
  { value: "badge", label: "Badge", icon: Smartphone },
  { value: "telecommande", label: "Télécommande", icon: Key },
  { value: "cle", label: "Clé", icon: Lock },
  { value: "digicode", label: "Digicode", icon: Hash },
  { value: "acces_libre", label: "Accès libre", icon: Car },
];

export function DetailsStepParking() {
  const { formData, updateFormData } = usePropertyWizardStore();

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

  const toggleAccess = (accessType: string) => {
    const currentAccess = ((formData as any).parking_acces as string[]) || [];
    const newAccess = currentAccess.includes(accessType)
      ? currentAccess.filter(a => a !== accessType)
      : [...currentAccess, accessType];
    updateFormData({ parking_acces: newAccess });
  };

  const currentAccess = ((formData as any).parking_acces as string[]) || [];

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col max-w-3xl mx-auto overflow-y-auto">
        <div className="space-y-4 pb-4">
          
          {/* Section 1: Type de parking */}
          <div className="bg-card p-4 rounded-xl border">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
                <Car className="h-4 w-4" />
              </div>
              <Label className="text-sm font-medium">Type de stationnement</Label>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {PARKING_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => updateFormData({ parking_type: type.value })}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    (formData as any).parking_type === type.value
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <span className="text-2xl block mb-1">{type.icon}</span>
                  <span className="text-xs font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Numéro & Niveau */}
          <div className="grid grid-cols-2 gap-4">
            {/* Numéro de place */}
            <div className="bg-card p-4 rounded-xl border">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                  <Hash className="h-4 w-4" />
                </div>
                <Label className="text-sm font-medium">N° de place</Label>
              </div>
              <Input
                type="text"
                placeholder="Ex: A42, P-12..."
                className="h-12 text-lg font-bold"
                value={(formData as any).parking_numero || ""}
                onChange={(e) => updateFormData({ parking_numero: e.target.value })}
              />
            </div>

            {/* Niveau */}
            <div className="bg-card p-4 rounded-xl border">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                  <ArrowUpDown className="h-4 w-4" />
                </div>
                <Label className="text-sm font-medium">Niveau</Label>
              </div>
              <Input
                type="text"
                placeholder="Ex: -1, RDC, +2..."
                className="h-12 text-lg font-bold"
                value={(formData as any).parking_niveau || ""}
                onChange={(e) => updateFormData({ parking_niveau: e.target.value })}
              />
            </div>
          </div>

          {/* Section 3: Gabarit */}
          <div className="bg-card p-4 rounded-xl border">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                <Car className="h-4 w-4" />
              </div>
              <Label className="text-sm font-medium">Gabarit maximum accepté</Label>
            </div>
            <div className="flex flex-wrap gap-2">
              {GABARITS.map((gabarit) => (
                <button
                  key={gabarit.value}
                  type="button"
                  onClick={() => updateFormData({ parking_gabarit: gabarit.value })}
                  className={`px-4 py-2 rounded-lg border-2 transition-all ${
                    (formData as any).parking_gabarit === gabarit.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <span className="text-sm font-medium">{gabarit.label}</span>
                  <span className="text-xs text-muted-foreground ml-1">({gabarit.description})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 4: Surface (optionnel pour box) */}
          {(formData as any).parking_type === "box" && (
            <div className="bg-card p-4 rounded-xl border">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                  <Ruler className="h-4 w-4" />
                </div>
                <Label className="text-sm font-medium">Surface du box</Label>
                <Badge variant="secondary" className="text-[10px]">Optionnel</Badge>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0"
                  className="pr-10 h-12 text-xl font-bold"
                  value={formData.surface || ""}
                  onChange={(e) => handleChange("surface", e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">m²</span>
              </div>
            </div>
          )}

          {/* Section 5: Accès */}
          <div className="bg-card p-4 rounded-xl border">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                <Key className="h-4 w-4" />
              </div>
              <Label className="text-sm font-medium">Type(s) d'accès</Label>
            </div>
            <div className="flex flex-wrap gap-3">
              {ACCESS_TYPES.map((access) => {
                const Icon = access.icon;
                const isSelected = currentAccess.includes(access.value);
                return (
                  <button
                    key={access.value}
                    type="button"
                    onClick={() => toggleAccess(access.value)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                      isSelected
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-border hover:border-green-300"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{access.label}</span>
                    {isSelected && <span className="text-green-600">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 6: Sécurité */}
          <div className="bg-card p-4 rounded-xl border">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 bg-red-100 text-red-600 rounded-lg flex items-center justify-center">
                <Shield className="h-4 w-4" />
              </div>
              <Label className="text-sm font-medium">Sécurité</Label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {/* Portail sécurisé */}
              <div 
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  (formData as any).parking_portail_securise 
                    ? "border-red-500 bg-red-50" 
                    : "border-border hover:border-red-300"
                }`}
                onClick={() => updateFormData({ parking_portail_securise: !(formData as any).parking_portail_securise })}
              >
                <Lock className={`h-6 w-6 mx-auto mb-2 ${(formData as any).parking_portail_securise ? "text-red-600" : "text-muted-foreground"}`} />
                <p className="text-xs font-medium text-center">Portail sécurisé</p>
              </div>
              
              {/* Vidéosurveillance */}
              <div 
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  (formData as any).parking_video_surveillance 
                    ? "border-red-500 bg-red-50" 
                    : "border-border hover:border-red-300"
                }`}
                onClick={() => updateFormData({ parking_video_surveillance: !(formData as any).parking_video_surveillance })}
              >
                <Video className={`h-6 w-6 mx-auto mb-2 ${(formData as any).parking_video_surveillance ? "text-red-600" : "text-muted-foreground"}`} />
                <p className="text-xs font-medium text-center">Vidéosurveillance</p>
              </div>
              
              {/* Gardien */}
              <div 
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  (formData as any).parking_gardien 
                    ? "border-red-500 bg-red-50" 
                    : "border-border hover:border-red-300"
                }`}
                onClick={() => updateFormData({ parking_gardien: !(formData as any).parking_gardien })}
              >
                <UserCheck className={`h-6 w-6 mx-auto mb-2 ${(formData as any).parking_gardien ? "text-red-600" : "text-muted-foreground"}`} />
                <p className="text-xs font-medium text-center">Gardien</p>
              </div>
            </div>
          </div>

          {/* Section 7: Loyer & Charges */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card p-4 rounded-xl border">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                  <Euro className="h-4 w-4" />
                </div>
                <Label className="text-sm font-medium">Loyer</Label>
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
              <span className="text-sm text-muted-foreground">Total : </span>
              <span className="text-xl font-bold text-primary">{((formData.loyer_hc || 0) + (formData.charges_mensuelles || 0)).toFixed(0)} €</span>
              <span className="text-sm text-muted-foreground"> /mois</span>
            </motion.div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

