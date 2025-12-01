"use client";
// @ts-nocheck

import { useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Home, 
  Car, 
  Wifi, 
  Wind, 
  Droplets, 
  UtensilsCrossed, 
  Sofa,
  TreePine,
  Building2,
  Sparkles
} from "lucide-react";
import StepFrame from "../_components/StepFrame";
import WizardFooter from "../_components/WizardFooter";
import { useNewProperty } from "../_store/useNewProperty";
import { cn } from "@/lib/utils";

interface FeatureGroup {
  id: string;
  label: string;
  icon: typeof Home;
  features: Feature[];
}

interface Feature {
  id: string;
  label: string;
  description?: string;
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: "exterieur",
    label: "Extérieur",
    icon: TreePine,
    features: [
      { id: "balcon", label: "Balcon" },
      { id: "terrasse", label: "Terrasse" },
      { id: "jardin", label: "Jardin" },
      { id: "cour", label: "Cour" },
      { id: "parking", label: "Parking" },
      { id: "box", label: "Box" },
      { id: "cave", label: "Cave" },
      { id: "grenier", label: "Grenier" },
    ],
  },
  {
    id: "equipements",
    label: "Équipements",
    icon: UtensilsCrossed,
    features: [
      { id: "lave_linge", label: "Lave-linge" },
      { id: "lave_vaisselle", label: "Lave-vaisselle" },
      { id: "four", label: "Four" },
      { id: "micro_ondes", label: "Micro-ondes" },
      { id: "refrigerateur", label: "Réfrigérateur" },
      { id: "congelateur", label: "Congélateur" },
      { id: "plaque_cuisson", label: "Plaque de cuisson" },
    ],
  },
  {
    id: "confort",
    label: "Confort",
    icon: Sofa,
    features: [
      { id: "climatisation", label: "Climatisation" },
      { id: "chauffage_individuel", label: "Chauffage individuel" },
      { id: "chauffage_collectif", label: "Chauffage collectif" },
      { id: "cheminee", label: "Cheminée" },
      { id: "interphone", label: "Interphone" },
      { id: "digicode", label: "Digicode" },
      { id: "ascenseur", label: "Ascenseur" },
    ],
  },
  {
    id: "technologie",
    label: "Technologie",
    icon: Wifi,
    features: [
      { id: "fibre_optique", label: "Fibre optique" },
      { id: "wifi", label: "Wi-Fi" },
      { id: "videophone", label: "Vidéophone" },
      { id: "alarme", label: "Alarme" },
    ],
  },
  {
    id: "autres",
    label: "Autres",
    icon: Sparkles,
    features: [
      { id: "meuble", label: "Meublé" },
      { id: "double_vitrage", label: "Double vitrage" },
      { id: "volets", label: "Volets" },
      { id: "store", label: "Store" },
      { id: "piscine", label: "Piscine" },
      { id: "jacuzzi", label: "Jacuzzi" },
      { id: "sauna", label: "Sauna" },
    ],
  },
];

export default function FeaturesStep() {
  const { draft, patch, prev, next } = useNewProperty();
  const reduced = useReducedMotion();
  
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(
    new Set(draft.features || [])
  );

  const handleToggleFeature = useCallback((featureId: string) => {
    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(featureId)) {
        next.delete(featureId);
      } else {
        next.add(featureId);
      }
      patch({ features: Array.from(next) });
      return next;
    });
  }, [patch]);

  return (
    <StepFrame k="FEATURES">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Caractéristiques et équipements</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sélectionnez les caractéristiques et équipements de votre bien
          </p>
        </div>

        {/* Groupes de caractéristiques */}
        <div className="space-y-6">
          {FEATURE_GROUPS.map((group, groupIndex) => (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: reduced ? 0 : 0.2,
                delay: reduced ? 0 : groupIndex * 0.05
              }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <group.icon className="h-4 w-4" />
                    {group.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.features.map((feature) => {
                      const isSelected = selectedFeatures.has(feature.id);
                      return (
                        <motion.div
                          key={feature.id}
                          whileHover={{ scale: reduced ? 1 : 1.01 }}
                          whileTap={{ scale: reduced ? 1 : 0.98 }}
                        >
                          <div
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition",
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-muted hover:border-primary/30"
                            )}
                            onClick={() => handleToggleFeature(feature.id)}
                          >
                            <Checkbox
                              id={`feature-${feature.id}`}
                              checked={isSelected}
                              onCheckedChange={() => handleToggleFeature(feature.id)}
                            />
                            <Label
                              htmlFor={`feature-${feature.id}`}
                              className="text-sm font-normal cursor-pointer flex-1"
                            >
                              {feature.label}
                            </Label>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Message d'aide */}
        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground">
            Ces informations aideront les locataires à mieux comprendre votre bien. Vous pourrez les modifier plus tard.
          </p>
        </div>
      </div>

      <WizardFooter
        primary="Continuer — Publication"
        onPrimary={next}
        onBack={prev}
        hint="Parfait, on passe aux options de publication 📢"
      />
    </StepFrame>
  );
}
