"use client";

import React, { useState, useId, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  METER_TYPES,
  EQUIPMENT_CATEGORIES,
  FURNISHED_MANDATORY_EQUIPMENT,
  type MeterTypeV3,
  type EquipmentCategoryV3,
  type EquipmentConditionV3,
} from "@/lib/types/property-v3";
import { cn } from "@/lib/utils";
import {
  Plus, Trash2, Gauge, Wrench, Info,
  Zap, Flame, Droplets, Thermometer,
  CheckCircle2, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";

// Temporary types for local state (will be synced to server via actions)
interface LocalMeter {
  id: string;
  meter_type: MeterTypeV3;
  meter_number: string;
  location: string;
  is_individual: boolean;
  provider: string;
}

interface LocalEquipment {
  id: string;
  category: EquipmentCategoryV3;
  name: string;
  brand: string;
  condition: EquipmentConditionV3;
  is_included_in_lease: boolean;
}

const METER_ICONS: Record<string, React.ElementType> = {
  electricity: Zap,
  gas: Flame,
  water: Droplets,
  hot_water: Droplets,
  heating: Thermometer,
};

// DOM-TOM specific providers
const PROVIDER_SUGGESTIONS: Record<string, string[]> = {
  electricity: ["EDF", "Engie", "TotalEnergies", "EDF Martinique", "EDF Guadeloupe", "EDF Réunion", "EDM Mayotte"],
  gas: ["GRDF", "Engie", "TotalEnergies"],
  water: ["Veolia", "Suez", "Saur", "SIAEAG", "Odyssi", "SMDS"],
  hot_water: ["Collectif", "Individuel"],
  heating: ["Collectif", "Individuel"],
};

let tempIdCounter = 0;
function tempId(): string {
  return `temp-eq-${Date.now()}-${++tempIdCounter}`;
}

export function EquipmentsMetersStep() {
  const { formData, updateFormData } = usePropertyWizardStore();
  const baseId = useId();
  const isFurnished = formData.meuble === true;

  // Local state for meters and equipment (stored in formData.metadata)
  const [meters, setMeters] = useState<LocalMeter[]>(() => {
    const saved = (formData as any)._meters;
    return Array.isArray(saved) ? saved : [];
  });

  const [equipment, setEquipment] = useState<LocalEquipment[]>(() => {
    const saved = (formData as any)._equipment;
    return Array.isArray(saved) ? saved : [];
  });

  const [showMeters, setShowMeters] = useState(true);
  const [showEquipment, setShowEquipment] = useState(true);

  // Sync to wizard store
  const syncToStore = useCallback((newMeters: LocalMeter[], newEquipment: LocalEquipment[]) => {
    updateFormData({
      _meters: newMeters,
      _equipment: newEquipment,
    } as any);
  }, [updateFormData]);

  // === METERS ===

  const addMeter = () => {
    const newMeter: LocalMeter = {
      id: tempId(),
      meter_type: "electricity",
      meter_number: "",
      location: "",
      is_individual: true,
      provider: "",
    };
    const updated = [...meters, newMeter];
    setMeters(updated);
    syncToStore(updated, equipment);
  };

  const updateMeter = (id: string, field: keyof LocalMeter, value: any) => {
    const updated = meters.map(m => m.id === id ? { ...m, [field]: value } : m);
    setMeters(updated);
    syncToStore(updated, equipment);
  };

  const removeMeter = (id: string) => {
    const updated = meters.filter(m => m.id !== id);
    setMeters(updated);
    syncToStore(updated, equipment);
  };

  // === EQUIPMENT ===

  const addEquipment = (preset?: { name: string; category: EquipmentCategoryV3 }) => {
    const newItem: LocalEquipment = {
      id: tempId(),
      category: preset?.category || "other",
      name: preset?.name || "",
      brand: "",
      condition: "good",
      is_included_in_lease: true,
    };
    const updated = [...equipment, newItem];
    setEquipment(updated);
    syncToStore(meters, updated);
  };

  const updateEquipmentItem = (id: string, field: keyof LocalEquipment, value: any) => {
    const updated = equipment.map(e => e.id === id ? { ...e, [field]: value } : e);
    setEquipment(updated);
    syncToStore(meters, updated);
  };

  const removeEquipment = (id: string) => {
    const updated = equipment.filter(e => e.id !== id);
    setEquipment(updated);
    syncToStore(meters, updated);
  };

  // Check furnished mandatory equipment
  const missingMandatory = isFurnished
    ? FURNISHED_MANDATORY_EQUIPMENT.filter(
        req => !equipment.some(e => e.name.toLowerCase().includes(req.name.toLowerCase().slice(0, 10)))
      )
    : [];

  const addAllMandatory = () => {
    const toAdd = missingMandatory.map(req => ({
      id: tempId(),
      category: req.category as EquipmentCategoryV3,
      name: req.name,
      brand: "",
      condition: "good" as const,
      is_included_in_lease: true,
    }));
    const updated = [...equipment, ...toAdd];
    setEquipment(updated);
    syncToStore(meters, updated);
  };

  return (
    <div className="h-full flex flex-col max-w-3xl mx-auto overflow-y-auto pb-8 gap-6">
      {/* === METERS SECTION === */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <button
          type="button"
          onClick={() => setShowMeters(!showMeters)}
          className="flex items-center gap-2 text-lg font-semibold w-full text-left"
        >
          <Gauge className="h-5 w-5 text-primary" />
          <span>Compteurs</span>
          <Badge variant="secondary" className="ml-auto mr-2">{meters.length}</Badge>
          {showMeters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <AnimatePresence>
          {showMeters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-3"
            >
              {meters.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                  Aucun compteur ajouté. Les relevés de compteurs sont importants pour les EDL.
                </p>
              )}

              {meters.map((meter, index) => {
                const MeterIcon = METER_ICONS[meter.meter_type] || Gauge;
                return (
                  <motion.div
                    key={meter.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="rounded-xl border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MeterIcon className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">Compteur #{index + 1}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMeter(meter.id)}
                        className="text-destructive hover:text-destructive h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Type *</Label>
                        <Select
                          value={meter.meter_type}
                          onValueChange={(v) => updateMeter(meter.id, "meter_type", v)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {METER_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.icon} {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">N° compteur</Label>
                        <Input
                          className="h-9"
                          placeholder="Ex: 09 123 456 789"
                          value={meter.meter_number}
                          onChange={(e) => updateMeter(meter.id, "meter_number", e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Emplacement</Label>
                        <Input
                          className="h-9"
                          placeholder="Ex: Placard entrée, sous-sol..."
                          value={meter.location}
                          onChange={(e) => updateMeter(meter.id, "location", e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Fournisseur</Label>
                        <Input
                          className="h-9"
                          placeholder="Ex: EDF, Engie..."
                          value={meter.provider}
                          list={`${baseId}-providers-${meter.meter_type}`}
                          onChange={(e) => updateMeter(meter.id, "provider", e.target.value)}
                        />
                        <datalist id={`${baseId}-providers-${meter.meter_type}`}>
                          {(PROVIDER_SUGGESTIONS[meter.meter_type] || []).map(p => (
                            <option key={p} value={p} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={meter.is_individual}
                        onCheckedChange={(v) => updateMeter(meter.id, "is_individual", v)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {meter.is_individual ? "Compteur individuel" : "Compteur collectif"}
                      </span>
                    </div>
                  </motion.div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                onClick={addMeter}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" /> Ajouter un compteur
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* === EQUIPMENT SECTION === */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        <button
          type="button"
          onClick={() => setShowEquipment(!showEquipment)}
          className="flex items-center gap-2 text-lg font-semibold w-full text-left"
        >
          <Wrench className="h-5 w-5 text-primary" />
          <span>Équipements détaillés</span>
          <Badge variant="secondary" className="ml-auto mr-2">{equipment.length}</Badge>
          {showEquipment ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <AnimatePresence>
          {showEquipment && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-3"
            >
              {/* Furnished mandatory equipment alert */}
              {isFurnished && missingMandatory.length > 0 && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <strong>Meublé : {missingMandatory.length} équipement(s) obligatoire(s) manquant(s)</strong>
                        <p className="text-xs mt-1">Selon le Décret n°2015-981, un logement meublé doit comporter au minimum ces équipements.</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addAllMandatory}
                        className="shrink-0 text-amber-700 border-amber-300 hover:bg-amber-100"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Tout ajouter
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {isFurnished && missingMandatory.length === 0 && equipment.length > 0 && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Tous les équipements obligatoires du Décret n°2015-981 sont présents.
                  </AlertDescription>
                </Alert>
              )}

              {equipment.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="rounded-xl border bg-card p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Équipement #{index + 1}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeEquipment(item.id)}
                      className="text-destructive hover:text-destructive h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nom *</Label>
                      <Input
                        className="h-9"
                        placeholder="Ex: Réfrigérateur, Lave-linge..."
                        value={item.name}
                        onChange={(e) => updateEquipmentItem(item.id, "name", e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Catégorie</Label>
                      <Select
                        value={item.category}
                        onValueChange={(v) => updateEquipmentItem(item.id, "category", v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EQUIPMENT_CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Marque</Label>
                      <Input
                        className="h-9"
                        placeholder="Ex: Bosch, Samsung..."
                        value={item.brand}
                        onChange={(e) => updateEquipmentItem(item.id, "brand", e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">État</Label>
                      <Select
                        value={item.condition}
                        onValueChange={(v) => updateEquipmentItem(item.id, "condition", v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">Neuf</SelectItem>
                          <SelectItem value="good">Bon état</SelectItem>
                          <SelectItem value="fair">État correct</SelectItem>
                          <SelectItem value="poor">Usé</SelectItem>
                          <SelectItem value="broken">Hors service</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={item.is_included_in_lease}
                      onCheckedChange={(v) => updateEquipmentItem(item.id, "is_included_in_lease", v)}
                    />
                    <span className="text-xs text-muted-foreground">
                      Inclus dans le bail
                    </span>
                  </div>
                </motion.div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() => addEquipment()}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" /> Ajouter un équipement
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* Info box */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 text-sm">
          Les compteurs et équipements détaillés seront utilisés automatiquement
          lors de la création des états des lieux (EDL) et de l'inventaire du mobilier.
        </AlertDescription>
      </Alert>
    </div>
  );
}
