"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Home,
  DoorOpen,
  Car,
  Store,
  Layers,
  Building2,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import Link from "next/link";
import type { BuildingUnitRow, BuildingUnitType, BuildingUnitTemplate } from "@/lib/supabase/database.types";

interface UnitsManagementClientProps {
  buildingId: string;
  buildingName: string;
  buildingCity: string;
  existingUnits: Partial<BuildingUnitRow>[];
}

interface UnitDraft {
  id: string;
  floor: number;
  position: string;
  type: BuildingUnitType;
  template: BuildingUnitTemplate | null;
  surface: number;
  nb_pieces: number;
  loyer_hc: number;
  charges: number;
  depot_garantie: number;
}

const unitTypes: { value: BuildingUnitType; label: string; icon: typeof Home }[] = [
  { value: "appartement", label: "Appartement", icon: Home },
  { value: "studio", label: "Studio", icon: DoorOpen },
  { value: "local_commercial", label: "Local commercial", icon: Store },
  { value: "parking", label: "Parking", icon: Car },
  { value: "cave", label: "Cave", icon: Layers },
  { value: "bureau", label: "Bureau", icon: Building2 },
];

const templates: { value: BuildingUnitTemplate; label: string }[] = [
  { value: "T1", label: "T1 (1 pièce)" },
  { value: "T2", label: "T2 (2 pièces)" },
  { value: "T3", label: "T3 (3 pièces)" },
  { value: "T4", label: "T4 (4 pièces)" },
  { value: "T5", label: "T5+ (5+ pièces)" },
  { value: "studio", label: "Studio" },
  { value: "parking", label: "Parking" },
  { value: "cave", label: "Cave" },
  { value: "bureau", label: "Bureau" },
];

function createEmptyUnit(): UnitDraft {
  return {
    id: crypto.randomUUID(),
    floor: 0,
    position: "",
    type: "appartement",
    template: "T2",
    surface: 0,
    nb_pieces: 2,
    loyer_hc: 0,
    charges: 0,
    depot_garantie: 0,
  };
}

export function UnitsManagementClient({
  buildingId,
  buildingName,
  buildingCity,
  existingUnits,
}: UnitsManagementClientProps) {
  const [units, setUnits] = useState<UnitDraft[]>(() =>
    existingUnits.length > 0
      ? existingUnits.map(u => ({
          id: u.id || crypto.randomUUID(),
          floor: u.floor || 0,
          position: u.position || "",
          type: (u.type as BuildingUnitType) || "appartement",
          template: u.template as BuildingUnitTemplate | null,
          surface: u.surface || 0,
          nb_pieces: u.nb_pieces || 0,
          loyer_hc: u.loyer_hc || 0,
          charges: u.charges || 0,
          depot_garantie: u.depot_garantie || 0,
        }))
      : [createEmptyUnit()]
  );
  const [isSaving, setIsSaving] = useState(false);

  const addUnit = () => {
    setUnits(prev => [...prev, createEmptyUnit()]);
  };

  const removeUnit = (id: string) => {
    setUnits(prev => prev.filter(u => u.id !== id));
  };

  const updateUnit = (id: string, field: keyof UnitDraft, value: unknown) => {
    setUnits(prev =>
      prev.map(u => (u.id === id ? { ...u, [field]: value } : u))
    );
  };

  const handleSave = async () => {
    // Validate
    const hasErrors = units.some(u => !u.position || u.surface <= 0);
    if (hasErrors) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/buildings/${buildingId}/units`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ units }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la sauvegarde");
      }

      toast.success("Lots enregistrés avec succès");
    } catch (error) {
      toast.error("Erreur lors de la sauvegarde des lots");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Back Button */}
      <Button variant="ghost" asChild className="mb-6">
        <Link href={`/owner/buildings/${buildingId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à l'immeuble
        </Link>
      </Button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          Gestion des lots
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          {buildingName}, {buildingCity}
        </p>
      </div>

      {/* Units List */}
      <div className="space-y-4 mb-8">
        {units.map((unit, index) => (
          <motion.div
            key={unit.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    Lot {index + 1}
                    {unit.position && ` - ${unit.position}`}
                  </CardTitle>
                  {units.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => removeUnit(unit.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Row 1: Type, Template, Floor, Position */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Type *</Label>
                    <Select
                      value={unit.type}
                      onValueChange={(v) => updateUnit(unit.id, "type", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {unitTypes.map(t => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Template</Label>
                    <Select
                      value={unit.template || ""}
                      onValueChange={(v) => updateUnit(unit.id, "template", v || null)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map(t => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Étage *</Label>
                    <Input
                      type="number"
                      value={unit.floor}
                      onChange={(e) => updateUnit(unit.id, "floor", parseInt(e.target.value) || 0)}
                      min={-5}
                      max={50}
                    />
                  </div>
                  <div>
                    <Label>Position/N° *</Label>
                    <Input
                      value={unit.position}
                      onChange={(e) => updateUnit(unit.id, "position", e.target.value)}
                      placeholder="ex: A, 101, Gauche"
                    />
                  </div>
                </div>

                {/* Row 2: Surface, Pieces */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Surface (m²) *</Label>
                    <Input
                      type="number"
                      value={unit.surface || ""}
                      onChange={(e) => updateUnit(unit.id, "surface", parseFloat(e.target.value) || 0)}
                      min={0}
                      step={0.5}
                    />
                  </div>
                  <div>
                    <Label>Nb pièces</Label>
                    <Input
                      type="number"
                      value={unit.nb_pieces || ""}
                      onChange={(e) => updateUnit(unit.id, "nb_pieces", parseInt(e.target.value) || 0)}
                      min={0}
                    />
                  </div>
                </div>

                {/* Row 3: Financial */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Loyer HC (€)</Label>
                    <Input
                      type="number"
                      value={unit.loyer_hc || ""}
                      onChange={(e) => updateUnit(unit.id, "loyer_hc", parseFloat(e.target.value) || 0)}
                      min={0}
                      step={10}
                    />
                  </div>
                  <div>
                    <Label>Charges (€)</Label>
                    <Input
                      type="number"
                      value={unit.charges || ""}
                      onChange={(e) => updateUnit(unit.id, "charges", parseFloat(e.target.value) || 0)}
                      min={0}
                      step={5}
                    />
                  </div>
                  <div>
                    <Label>Dépôt garantie (€)</Label>
                    <Input
                      type="number"
                      value={unit.depot_garantie || ""}
                      onChange={(e) => updateUnit(unit.id, "depot_garantie", parseFloat(e.target.value) || 0)}
                      min={0}
                      step={50}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <Button variant="outline" onClick={addUnit}>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un lot
        </Button>
        <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Enregistrement..." : "Enregistrer les lots"}
        </Button>
      </div>
    </div>
  );
}
