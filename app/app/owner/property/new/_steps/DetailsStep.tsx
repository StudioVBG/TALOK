"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, AlertCircle, Check } from "lucide-react";
import StepFrame from "../_components/StepFrame";
import WizardFooter from "../_components/WizardFooter";
import { useNewProperty } from "../_store/useNewProperty";
import { cn } from "@/lib/utils";
import { z } from "zod";

// Schéma de validation
const detailsSchema = z.object({
  surface_m2: z.number().min(0).max(9999.99).optional().nullable(),
  rooms_count: z.number().int().min(0).max(50).optional().nullable(),
  floor: z.number().int().min(-2).max(50).optional().nullable(),
  elevator: z.boolean().optional(),
  dpe_classe_energie: z.enum(["A", "B", "C", "D", "E", "F", "G"]).optional().nullable(),
  dpe_classe_climat: z.enum(["A", "B", "C", "D", "E", "F", "G"]).optional().nullable(),
  dpe_consommation: z.number().min(0).optional().nullable(),
  dpe_emissions: z.number().min(0).optional().nullable(),
  permis_louer_requis: z.boolean().optional(),
  permis_louer_numero: z.string().optional().nullable(),
  permis_louer_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

const DPE_CLASSES = ["A", "B", "C", "D", "E", "F", "G"] as const;

export default function DetailsStep() {
  const { draft, patch, next, prev } = useNewProperty();
  const reduced = useReducedMotion();

  const [surface, setSurface] = useState<string>(draft.details?.surface_m2?.toString() || "");
  const [roomsCount, setRoomsCount] = useState<string>(draft.details?.rooms_count?.toString() || "");
  const [floor, setFloor] = useState<string>(draft.details?.floor?.toString() || "");
  const [elevator, setElevator] = useState<boolean>(draft.details?.elevator ?? false);
  const [dpeClasseEnergie, setDpeClasseEnergie] = useState<string>(draft.details?.dpe_classe_energie || "");
  const [dpeClasseClimat, setDpeClasseClimat] = useState<string>(draft.details?.dpe_classe_climat || "");
  const [dpeConsommation, setDpeConsommation] = useState<string>(draft.details?.dpe_consommation?.toString() || "");
  const [dpeEmissions, setDpeEmissions] = useState<string>(draft.details?.dpe_emissions?.toString() || "");
  const [permisLouerRequis, setPermisLouerRequis] = useState<boolean>(draft.details?.permis_louer_requis ?? false);
  const [permisLouerNumero, setPermisLouerNumero] = useState<string>(draft.details?.permis_louer_numero || "");
  const [permisLouerDate, setPermisLouerDate] = useState<string>(draft.details?.permis_louer_date || "");

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Mise à jour du store
  useEffect(() => {
    patch({
      details: {
        surface_m2: surface ? parseFloat(surface) : null,
        rooms_count: roomsCount ? parseInt(roomsCount, 10) : null,
        floor: floor ? parseInt(floor, 10) : null,
        elevator,
        dpe_classe_energie: (dpeClasseEnergie ? dpeClasseEnergie as "A" | "B" | "C" | "D" | "E" | "F" | "G" : null),
        dpe_classe_climat: (dpeClasseClimat ? dpeClasseClimat as "A" | "B" | "C" | "D" | "E" | "F" | "G" : null),
        dpe_consommation: dpeConsommation ? parseFloat(dpeConsommation) : null,
        dpe_emissions: dpeEmissions ? parseFloat(dpeEmissions) : null,
        permis_louer_requis: permisLouerRequis,
        permis_louer_numero: permisLouerNumero || null,
        permis_louer_date: permisLouerDate || null,
      },
    });
  }, [
    surface,
    roomsCount,
    floor,
    elevator,
    dpeClasseEnergie,
    dpeClasseClimat,
    dpeConsommation,
    dpeEmissions,
    permisLouerRequis,
    permisLouerNumero,
    permisLouerDate,
    patch,
  ]);

  const handleContinue = () => {
    // Validation
    const result = detailsSchema.safeParse({
      surface_m2: surface ? parseFloat(surface) : null,
      rooms_count: roomsCount ? parseInt(roomsCount, 10) : null,
      floor: floor ? parseInt(floor, 10) : null,
      elevator,
      dpe_classe_energie: dpeClasseEnergie || null,
      dpe_classe_climat: dpeClasseClimat || null,
      dpe_consommation: dpeConsommation ? parseFloat(dpeConsommation) : null,
      dpe_emissions: dpeEmissions ? parseFloat(dpeEmissions) : null,
      permis_louer_requis: permisLouerRequis,
      permis_louer_numero: permisLouerNumero || null,
      permis_louer_date: permisLouerDate || null,
    });

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(newErrors);
      return;
    }

    setErrors({});
    next();
  };

  return (
    <StepFrame k="DETAILS">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Étape 3 — Détails du bien</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Précisez les caractéristiques principales du bien
          </p>
        </div>

        {/* Message d'aide */}
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
          className="rounded-lg border bg-muted/50 p-4 flex items-start gap-3"
        >
          <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Vous pourrez affiner ces informations plus tard. Les champs marqués d'un astérisque (*) sont requis.
          </p>
        </motion.div>

        <div className="space-y-6">
          {/* Surface et nombre de pièces */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="surface" className="text-sm font-semibold">
                Surface (m²)
              </Label>
              <Input
                id="surface"
                name="surface"
                type="number"
                min="0"
                max="9999.99"
                step="0.01"
                value={surface}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0 && parseFloat(val) <= 9999.99)) {
                    setSurface(val);
                  }
                }}
                placeholder="Ex: 45.5"
                className="min-h-[44px]"
                aria-invalid={!!errors.surface_m2}
                aria-describedby={errors.surface_m2 ? "surface-error" : undefined}
              />
              {errors.surface_m2 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  id="surface-error"
                  className="text-sm text-destructive flex items-center gap-1"
                  role="alert"
                >
                  <AlertCircle className="h-4 w-4" />
                  {errors.surface_m2}
                </motion.p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="rooms_count" className="text-sm font-semibold">
                Nombre de pièces
              </Label>
              <Input
                id="rooms_count"
                name="rooms_count"
                type="number"
                min="0"
                max="50"
                value={roomsCount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || (!isNaN(parseInt(val, 10)) && parseInt(val, 10) >= 0 && parseInt(val, 10) <= 50)) {
                    setRoomsCount(val);
                  }
                }}
                placeholder="Ex: 3"
                className="min-h-[44px]"
                aria-invalid={!!errors.rooms_count}
                aria-describedby={errors.rooms_count ? "rooms_count-error" : undefined}
              />
              {errors.rooms_count && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  id="rooms_count-error"
                  className="text-sm text-destructive flex items-center gap-1"
                  role="alert"
                >
                  <AlertCircle className="h-4 w-4" />
                  {errors.rooms_count}
                </motion.p>
              )}
            </div>
          </div>

          {/* Étage et ascenseur */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="floor" className="text-sm font-semibold">
                Étage
              </Label>
              <Input
                id="floor"
                name="floor"
                type="number"
                min="-2"
                max="50"
                value={floor}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || (!isNaN(parseInt(val, 10)) && parseInt(val, 10) >= -2 && parseInt(val, 10) <= 50)) {
                    setFloor(val);
                  }
                }}
                placeholder="Ex: 2 (ou -1 pour sous-sol)"
                className="min-h-[44px]"
                aria-invalid={!!errors.floor}
                aria-describedby={errors.floor ? "floor-error" : undefined}
              />
              {errors.floor && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  id="floor-error"
                  className="text-sm text-destructive flex items-center gap-1"
                  role="alert"
                >
                  <AlertCircle className="h-4 w-4" />
                  {errors.floor}
                </motion.p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Ascenseur</Label>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="elevator"
                  checked={elevator}
                  onCheckedChange={(checked) => setElevator(checked === true)}
                  className="min-h-[44px] min-w-[44px]"
                />
                <Label htmlFor="elevator" className="text-sm font-normal cursor-pointer">
                  Le bien dispose d'un ascenseur
                </Label>
              </div>
            </div>
          </div>

          {/* DPE - Classe énergie et climat */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold">Diagnostic de Performance Énergétique (DPE)</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dpe_classe_energie" className="text-sm font-semibold">
                  Classe énergie
                </Label>
                <Select value={dpeClasseEnergie} onValueChange={setDpeClasseEnergie}>
                  <SelectTrigger id="dpe_classe_energie" name="dpe_classe_energie" className="min-h-[44px]">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {DPE_CLASSES.map((classe) => (
                      <SelectItem key={classe} value={classe}>
                        {classe}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dpe_classe_climat" className="text-sm font-semibold">
                  Classe climat (GES)
                </Label>
                <Select value={dpeClasseClimat} onValueChange={setDpeClasseClimat}>
                  <SelectTrigger id="dpe_classe_climat" name="dpe_classe_climat" className="min-h-[44px]">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {DPE_CLASSES.map((classe) => (
                      <SelectItem key={classe} value={classe}>
                        {classe}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Consommation et émissions */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dpe_consommation" className="text-sm font-semibold">
                  Consommation (kWh/m²/an)
                </Label>
                <Input
                  id="dpe_consommation"
                  name="dpe_consommation"
                  type="number"
                  min="0"
                  value={dpeConsommation}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0)) {
                      setDpeConsommation(val);
                    }
                  }}
                  placeholder="Ex: 150"
                  className="min-h-[44px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dpe_emissions" className="text-sm font-semibold">
                  Émissions (kg CO₂/m²/an)
                </Label>
                <Input
                  id="dpe_emissions"
                  name="dpe_emissions"
                  type="number"
                  min="0"
                  value={dpeEmissions}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0)) {
                      setDpeEmissions(val);
                    }
                  }}
                  placeholder="Ex: 25"
                  className="min-h-[44px]"
                />
              </div>
            </div>
          </div>

          {/* Permis de louer */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold">Permis de louer</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="permis_louer_requis"
                  checked={permisLouerRequis}
                  onCheckedChange={(checked) => setPermisLouerRequis(checked === true)}
                  className="min-h-[44px] min-w-[44px]"
                />
                <Label htmlFor="permis_louer_requis" className="text-sm font-normal cursor-pointer">
                  Un permis de louer est requis pour ce bien
                </Label>
              </div>

              {permisLouerRequis && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: reduced ? 0 : 0.2 }}
                  className="grid gap-4 md:grid-cols-2"
                >
                  <div className="space-y-2">
                    <Label htmlFor="permis_louer_numero" className="text-sm font-semibold">
                      Numéro du permis
                    </Label>
                    <Input
                      id="permis_louer_numero"
                      name="permis_louer_numero"
                      value={permisLouerNumero}
                      onChange={(e) => setPermisLouerNumero(e.target.value)}
                      placeholder="Ex: PL-2024-001"
                      className="min-h-[44px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="permis_louer_date" className="text-sm font-semibold">
                      Date d'obtention
                    </Label>
                    <Input
                      id="permis_louer_date"
                      name="permis_louer_date"
                      type="date"
                      value={permisLouerDate}
                      onChange={(e) => setPermisLouerDate(e.target.value)}
                      className="min-h-[44px]"
                      aria-invalid={!!errors.permis_louer_date}
                      aria-describedby={errors.permis_louer_date ? "permis_louer_date-error" : undefined}
                    />
                    {errors.permis_louer_date && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        id="permis_louer_date-error"
                        className="text-sm text-destructive flex items-center gap-1"
                        role="alert"
                      >
                        <AlertCircle className="h-4 w-4" />
                        {errors.permis_louer_date}
                      </motion.p>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      <WizardFooter
        primary="Continuer"
        onPrimary={handleContinue}
        onBack={prev}
        hint="Vous pourrez compléter plus tard."
      />
    </StepFrame>
  );
}
