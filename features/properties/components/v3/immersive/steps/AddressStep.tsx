"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { MapPin, Check, Building2, HelpCircle, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const POSTAL_CODE_TO_CITY: Record<string, string[]> = {
  "97200": ["Fort-de-France"],
  "97220": ["Le Robert", "La Trinité", "Le François"],
  "97232": ["Le Lamentin"],
  "97250": ["Sainte-Marie", "Le Marigot"],
  "97100": ["Basse-Terre"],
  "97400": ["Saint-Denis"],
  "75001": ["Paris 1er"],
  "75002": ["Paris 2e"],
  "75000": ["Paris"],
};

const DEPARTEMENT_NAMES: Record<string, string> = {
  "01": "Ain", "02": "Aisne", "03": "Allier", "04": "Alpes-de-Haute-Provence",
  "05": "Hautes-Alpes", "06": "Alpes-Maritimes", "07": "Ardèche", "08": "Ardennes",
  "09": "Ariège", "10": "Aube", "11": "Aude", "12": "Aveyron",
  "13": "Bouches-du-Rhône", "14": "Calvados", "15": "Cantal", "16": "Charente",
  "17": "Charente-Maritime", "18": "Cher", "19": "Corrèze", "2A": "Corse-du-Sud",
  "2B": "Haute-Corse", "21": "Côte-d'Or", "22": "Côtes-d'Armor", "23": "Creuse",
  "24": "Dordogne", "25": "Doubs", "26": "Drôme", "27": "Eure",
  "28": "Eure-et-Loir", "29": "Finistère", "30": "Gard", "31": "Haute-Garonne",
  "32": "Gers", "33": "Gironde", "34": "Hérault", "35": "Ille-et-Vilaine",
  "36": "Indre", "37": "Indre-et-Loire", "38": "Isère", "39": "Jura",
  "40": "Landes", "41": "Loir-et-Cher", "42": "Loire", "43": "Haute-Loire",
  "44": "Loire-Atlantique", "45": "Loiret", "46": "Lot", "47": "Lot-et-Garonne",
  "48": "Lozère", "49": "Maine-et-Loire", "50": "Manche", "51": "Marne",
  "52": "Haute-Marne", "53": "Mayenne", "54": "Meurthe-et-Moselle", "55": "Meuse",
  "56": "Morbihan", "57": "Moselle", "58": "Nièvre", "59": "Nord",
  "60": "Oise", "61": "Orne", "62": "Pas-de-Calais", "63": "Puy-de-Dôme",
  "64": "Pyrénées-Atlantiques", "65": "Hautes-Pyrénées", "66": "Pyrénées-Orientales",
  "67": "Bas-Rhin", "68": "Haut-Rhin", "69": "Rhône", "70": "Haute-Saône",
  "71": "Saône-et-Loire", "72": "Sarthe", "73": "Savoie", "74": "Haute-Savoie",
  "75": "Paris", "76": "Seine-Maritime", "77": "Seine-et-Marne", "78": "Yvelines",
  "79": "Deux-Sèvres", "80": "Somme", "81": "Tarn", "82": "Tarn-et-Garonne",
  "83": "Var", "84": "Vaucluse", "85": "Vendée", "86": "Vienne",
  "87": "Haute-Vienne", "88": "Vosges", "89": "Yonne", "90": "Territoire de Belfort",
  "91": "Essonne", "92": "Hauts-de-Seine", "93": "Seine-Saint-Denis", "94": "Val-de-Marne",
  "95": "Val-d'Oise",
  "971": "Guadeloupe", "972": "Martinique", "973": "Guyane", 
  "974": "La Réunion", "976": "Mayotte",
};

function getDepartementFromCP(codePostal: string): string | null {
  if (!codePostal || codePostal.length < 2) return null;
  if (codePostal.startsWith("97")) {
    const dromCode = codePostal.substring(0, 3);
    return DEPARTEMENT_NAMES[dromCode] ? dromCode : null;
  }
  if (codePostal.startsWith("20")) {
    const cp = parseInt(codePostal, 10);
    return cp < 20200 ? "2A" : "2B";
  }
  const deptCode = codePostal.substring(0, 2);
  return DEPARTEMENT_NAMES[deptCode] ? deptCode : null;
}

export function AddressStep() {
  const { formData, updateFormData } = usePropertyWizardStore();
  const [autoFilledDept, setAutoFilledDept] = useState<string | null>(null);
  
  const handleChange = (field: string, value: string) => {
    updateFormData({ [field]: value });
    
    if (field === "code_postal" && value.length === 5) {
      const cities = POSTAL_CODE_TO_CITY[value];
      if (cities && cities.length > 0) {
        updateFormData({ ville: cities[0] });
      }
      const deptCode = getDepartementFromCP(value);
      if (deptCode) {
        const deptName = DEPARTEMENT_NAMES[deptCode];
        updateFormData({ departement: deptName });
        setAutoFilledDept(deptName);
        setTimeout(() => setAutoFilledDept(null), 3000);
      }
    }
  };

  const detectedDept = useMemo(() => {
    if (!formData.code_postal || (formData.code_postal as string).length < 2) return null;
    const code = getDepartementFromCP(formData.code_postal as string);
    return code ? DEPARTEMENT_NAMES[code] : null;
  }, [formData.code_postal]);

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col justify-center max-w-xl mx-auto">
        <div className="space-y-4">
          {/* Adresse Complète avec Auto-complétion */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="adresse" className="text-sm font-medium">Adresse complète</Label>
              <span className="inline-flex items-center gap-1 text-[10px] text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded-full">
                <Sparkles className="h-2.5 w-2.5" />
                Auto-complétion
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent><p>Tapez 3 caractères pour voir les suggestions</p></TooltipContent>
              </Tooltip>
            </div>
            <AddressAutocomplete
              value={formData.adresse_complete as string || ""}
              onChange={(value) => handleChange("adresse_complete", value)}
              onSelect={({ adresse_complete, ville, code_postal, departement, latitude, longitude }) => {
                updateFormData({
                  adresse_complete,
                  ville,
                  code_postal,
                  departement,
                  latitude,
                  longitude,
                });
                if (departement) {
                  const deptName = DEPARTEMENT_NAMES[departement];
                  if (deptName) {
                    setAutoFilledDept(deptName);
                    setTimeout(() => setAutoFilledDept(null), 3000);
                  }
                }
              }}
              placeholder="Tapez une adresse..."
            />
          </div>

          {/* Complément */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Complément (Optionnel)</Label>
            <Input
              placeholder="Bâtiment, étage, porte..."
              className="h-11"
              value={formData.complement_adresse || ""}
              onChange={(e) => handleChange("complement_adresse", e.target.value)}
            />
          </div>

          {/* CP / Ville */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Code Postal *</Label>
              <Input
                placeholder="97200"
                maxLength={5}
                className={cn("h-11", !formData.code_postal && "border-red-300 bg-red-50/50")}
                value={formData.code_postal === "00000" ? "" : formData.code_postal || ""}
                onChange={(e) => handleChange("code_postal", e.target.value.replace(/\D/g, '').slice(0, 5))}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-sm font-medium">Ville *</Label>
              <Input
                placeholder="Fort-de-France"
                className={cn("h-11", !formData.ville && "border-red-300 bg-red-50/50")}
                value={formData.ville === "Ville à définir" ? "" : formData.ville || ""}
                onChange={(e) => handleChange("ville", e.target.value)}
              />
            </div>
          </div>

          {/* Département */}
          <AnimatePresence>
            {detectedDept && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Département détecté</p>
                  <p className="text-sm font-semibold">{detectedDept}</p>
                </div>
                {autoFilledDept && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </TooltipProvider>
  );
}
