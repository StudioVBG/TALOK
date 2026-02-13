"use client";

import React, { useId } from "react";
import { motion } from "framer-motion";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Ruler, Info, TreePine } from "lucide-react";

export function DetailsStepTerrain() {
  const { formData, updateFormData } = usePropertyWizardStore();
  const baseId = useId();
  const propertyType = (formData.type as string) || "";

  const typeLabels: Record<string, string> = {
    terrain_nu: "Terrain nu",
    terrain_agricole: "Terrain agricole",
    exploitation_agricole: "Exploitation agricole",
  };

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto overflow-y-auto pb-8 gap-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Type label */}
        <div className="flex items-center gap-2 text-lg font-semibold text-primary">
          <TreePine className="h-5 w-5" />
          {typeLabels[propertyType] || "Terrain"}
        </div>

        {/* Surface */}
        <div className="space-y-2">
          <Label htmlFor={`${baseId}-surface`}>Surface du terrain (m²) *</Label>
          <div className="flex items-center gap-2">
            <Ruler className="h-4 w-4 text-muted-foreground" />
            <Input
              id={`${baseId}-surface`}
              type="number"
              min={0}
              step={0.01}
              placeholder="Ex: 500"
              value={formData.surface_terrain ?? formData.surface ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined;
                updateFormData({
                  surface_terrain: val,
                  surface: val,
                  surface_habitable_m2: val,
                });
              }}
            />
            <span className="text-sm text-muted-foreground">m²</span>
          </div>
        </div>

        {/* Constructible (terrain nu only) */}
        {propertyType === "terrain_nu" && (
          <div className="flex items-center gap-3">
            <Switch
              id={`${baseId}-constructible`}
              checked={(formData as any).is_constructible ?? false}
              onCheckedChange={(checked) => updateFormData({ is_constructible: checked } as any)}
            />
            <Label htmlFor={`${baseId}-constructible`}>Terrain constructible</Label>
          </div>
        )}

        {/* Construction year (exploitation only) */}
        {propertyType === "exploitation_agricole" && (
          <div className="space-y-2">
            <Label htmlFor={`${baseId}-year`}>Année de construction (bâtiments)</Label>
            <Input
              id={`${baseId}-year`}
              type="number"
              min={1600}
              max={new Date().getFullYear() + 5}
              placeholder="Ex: 1985"
              value={formData.construction_year ?? ""}
              onChange={(e) => updateFormData({ construction_year: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
        )}

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor={`${baseId}-description`}>Description</Label>
          <textarea
            id={`${baseId}-description`}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[100px] resize-y"
            placeholder="Description du terrain, accès, viabilisation..."
            value={formData.description ?? ""}
            onChange={(e) => updateFormData({ description: e.target.value })}
          />
        </div>

        {/* Info for agricultural */}
        {(propertyType === "terrain_agricole" || propertyType === "exploitation_agricole") && (
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-sm">
              Les baux ruraux sont régis par le Code rural et de la pêche maritime (articles L411-1 et suivants).
              La durée minimale est de 9 ans.
            </AlertDescription>
          </Alert>
        )}
      </motion.div>
    </div>
  );
}
