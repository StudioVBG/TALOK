"use client";

import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Building2, Plus, Copy, Trash2, Sparkles, Wand2, 
  Globe, ChevronRight, Home, Car, Warehouse
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { cn } from "@/lib/utils";
import { BuildingVisualizer } from "./BuildingVisualizer";
import { 
  type BuildingUnit, 
  type UnitTemplateConfig,
  UNIT_TEMPLATES,
  generateUnitId,
  getNextPosition,
  getUnitStatusLabel,
} from "@/lib/types/building-v3";

/**
 * BuildingConfigStep - Configuration visuelle d'un immeuble SOTA 2026
 * 
 * Features :
 * - Visualisation isométrique interactive
 * - Ajout rapide de lots par templates
 * - Duplication multi-étages
 * - Import depuis cadastre (placeholder)
 * - Remplissage IA avec Tom
 */
export function BuildingConfigStep() {
  const { formData, updateFormData } = usePropertyWizardStore();
  
  // État local
  const [floors, setFloors] = useState<number>(formData.building_floors || 4);
  const [units, setUnits] = useState<BuildingUnit[]>(
    (formData.building_units as BuildingUnit[]) || []
  );
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [unitToDuplicate, setUnitToDuplicate] = useState<BuildingUnit | null>(null);
  const [duplicateFloors, setDuplicateFloors] = useState<number[]>([]);

  // Parties communes
  const [hasAscenseur, setHasAscenseur] = useState(formData.has_ascenseur || false);
  const [hasGardien, setHasGardien] = useState(formData.has_gardien || false);
  const [hasInterphone, setHasInterphone] = useState(formData.has_interphone || false);
  const [hasDigicode, setHasDigicode] = useState(formData.has_digicode || false);
  const [digicodeValue, setDigicodeValue] = useState((formData as any).digicode || "");
  const [interphoneValue, setInterphoneValue] = useState((formData as any).interphone || "");

  // Sync avec le store
  const syncToStore = useCallback((newUnits: BuildingUnit[], newFloors?: number) => {
    setUnits(newUnits);
    updateFormData({ 
      building_units: newUnits,
      building_floors: newFloors ?? floors,
      has_ascenseur: hasAscenseur,
      has_gardien: hasGardien,
      has_interphone: hasInterphone,
      has_digicode: hasDigicode,
    });
  }, [floors, hasAscenseur, hasGardien, hasInterphone, hasDigicode, updateFormData]);

  // Ajouter un lot
  const addUnit = useCallback((floor: number, template: UnitTemplateConfig) => {
    const newUnit: BuildingUnit = {
      id: generateUnitId(),
      building_id: "", // Sera rempli à la sauvegarde
      floor,
      position: getNextPosition(units, floor),
      type: template.type,
      surface: template.surface,
      nb_pieces: template.nb_pieces,
      loyer_hc: template.defaultLoyer || 0,
      charges: 0,
      depot_garantie: 0,
      status: "vacant",
      template: template.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    syncToStore([...units, newUnit]);
  }, [units, syncToStore]);

  // Supprimer un lot
  const removeUnit = useCallback((unitId: string) => {
    syncToStore(units.filter(u => u.id !== unitId));
  }, [units, syncToStore]);

  // Dupliquer un lot sur plusieurs étages
  const duplicateToFloors = useCallback(() => {
    if (!unitToDuplicate || duplicateFloors.length === 0) return;
    
    const newUnits = duplicateFloors.map(floor => ({
      ...unitToDuplicate,
      id: generateUnitId(),
      floor,
      position: getNextPosition([...units], floor),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    
    syncToStore([...units, ...newUnits]);
    setShowDuplicateDialog(false);
    setUnitToDuplicate(null);
    setDuplicateFloors([]);
  }, [unitToDuplicate, duplicateFloors, units, syncToStore]);

  // Appliquer un template global
  const applyGlobalTemplate = useCallback((unitsPerFloor: number, template: UnitTemplateConfig) => {
    const newUnits: BuildingUnit[] = [];
    
    for (let f = 0; f < floors; f++) {
      for (let u = 0; u < unitsPerFloor; u++) {
        newUnits.push({
          id: generateUnitId(),
          building_id: "",
          floor: f,
          position: String.fromCharCode(65 + u),
          type: template.type,
          surface: template.surface,
          nb_pieces: template.nb_pieces,
          loyer_hc: 0,
          charges: 0,
          depot_garantie: 0,
          status: "vacant",
          template: template.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }
    
    syncToStore(newUnits);
  }, [floors, syncToStore]);

  // Stats
  const stats = useMemo(() => ({
    totalUnits: units.filter(u => u.type !== "parking" && u.type !== "cave").length,
    totalParkings: units.filter(u => u.type === "parking").length,
    totalCaves: units.filter(u => u.type === "cave").length,
    totalSurface: units.reduce((acc, u) => acc + u.surface, 0),
  }), [units]);

  // Lots de l'étage sélectionné
  const selectedFloorUnits = useMemo(() => 
    selectedFloor !== null ? units.filter(u => u.floor === selectedFloor) : [],
  [selectedFloor, units]);

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 overflow-hidden">
      
      {/* ====== COLONNE GAUCHE : Visualisation Isométrique ====== */}
      <Card className="flex-1 min-w-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 overflow-hidden">
        <CardContent className="h-full p-4 flex flex-col">
          {/* Slider Étages */}
          <div className="mb-4">
            <div className="flex justify-between items-center text-sm mb-2">
              <Label className="text-slate-300">Nombre d'étages</Label>
              <Badge variant="outline" className="text-blue-300 border-blue-500/50">
                {floors}
              </Badge>
            </div>
            <Slider
              value={[floors]}
              onValueChange={([v]) => {
                setFloors(v);
                syncToStore(units, v);
              }}
              min={1}
              max={15}
              step={1}
              className="[&_[role=slider]]:bg-blue-500 [&_[role=slider]]:border-blue-400"
            />
          </div>

          {/* Visualiseur 3D */}
          <div className="flex-1 min-h-0">
            <BuildingVisualizer
              floors={floors}
              units={units}
              selectedFloor={selectedFloor}
              onFloorSelect={setSelectedFloor}
              onAddUnit={(floor) => {
                setSelectedFloor(floor);
                setShowQuickAdd(true);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* ====== COLONNE DROITE : Configuration ====== */}
      <div className="w-full lg:w-80 flex flex-col gap-3 overflow-y-auto">
        
        {/* Actions rapides */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-purple-500" />
              Actions rapides
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4">
            {/* Import Cadastre */}
            <Button 
              variant="outline" 
              size="sm"
              className="w-full justify-start gap-2 h-9 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
            >
              <Globe className="h-4 w-4 text-blue-500" />
              <span className="flex-1 text-left">Importer depuis Cadastre</span>
              <Badge variant="secondary" className="text-[10px]">Bientôt</Badge>
            </Button>
            
            {/* Remplissage IA */}
            <Button 
              variant="outline" 
              size="sm"
              className="w-full justify-start gap-2 h-9 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700"
            >
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="flex-1 text-left">Tom remplit pour moi</span>
            </Button>
            
            {/* Templates rapides */}
            <div className="pt-2 border-t space-y-1.5">
              <p className="text-[11px] text-muted-foreground font-medium">Templates rapides</p>
              <div className="grid grid-cols-2 gap-1.5">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    const t2 = UNIT_TEMPLATES.find(t => t.id === "t2")!;
                    applyGlobalTemplate(2, t2);
                  }}
                >
                  <Home className="h-3 w-3 mr-1" />
                  2×T2/étage
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    const t3 = UNIT_TEMPLATES.find(t => t.id === "t3")!;
                    applyGlobalTemplate(2, t3);
                  }}
                >
                  <Home className="h-3 w-3 mr-1" />
                  2×T3/étage
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    const studio = UNIT_TEMPLATES.find(t => t.id === "studio")!;
                    applyGlobalTemplate(4, studio);
                  }}
                >
                  <Home className="h-3 w-3 mr-1" />
                  4×Studio
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    // Mix : 1 T2 + 1 T3 par étage
                    const newUnits: BuildingUnit[] = [];
                    const t2 = UNIT_TEMPLATES.find(t => t.id === "t2")!;
                    const t3 = UNIT_TEMPLATES.find(t => t.id === "t3")!;
                    
                    for (let f = 0; f < floors; f++) {
                      newUnits.push({
                        id: generateUnitId(),
                        building_id: "",
                        floor: f,
                        position: "A",
                        type: t2.type,
                        surface: t2.surface,
                        nb_pieces: t2.nb_pieces,
                        loyer_hc: 0,
                        charges: 0,
                        depot_garantie: 0,
                        status: "vacant",
                        template: t2.id,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      });
                      newUnits.push({
                        id: generateUnitId(),
                        building_id: "",
                        floor: f,
                        position: "B",
                        type: t3.type,
                        surface: t3.surface,
                        nb_pieces: t3.nb_pieces,
                        loyer_hc: 0,
                        charges: 0,
                        depot_garantie: 0,
                        status: "vacant",
                        template: t3.id,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      });
                    }
                    syncToStore(newUnits);
                  }}
                >
                  <Home className="h-3 w-3 mr-1" />
                  T2+T3
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats temps réel */}
        <Card className="bg-gradient-to-br from-slate-50 to-blue-50/50 dark:from-slate-800 dark:to-blue-900/20">
          <CardContent className="p-4">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{stats.totalUnits}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Logements</p>
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{stats.totalParkings}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Parkings</p>
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{stats.totalCaves}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Caves</p>
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{stats.totalSurface}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">m² total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Parties communes */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm">Parties communes</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="ascenseur" className="text-sm">Ascenseur</Label>
              <Switch 
                id="ascenseur" 
                checked={hasAscenseur} 
                onCheckedChange={(v) => {
                  setHasAscenseur(v);
                  updateFormData({ has_ascenseur: v });
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="gardien" className="text-sm">Gardien</Label>
              <Switch 
                id="gardien" 
                checked={hasGardien} 
                onCheckedChange={(v) => {
                  setHasGardien(v);
                  updateFormData({ has_gardien: v });
                }}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="interphone" className="text-sm">Interphone</Label>
                <Switch
                  id="interphone"
                  checked={hasInterphone}
                  onCheckedChange={(v) => {
                    setHasInterphone(v);
                    updateFormData({ has_interphone: v });
                  }}
                />
              </div>
              {hasInterphone && (
                <Input
                  value={interphoneValue}
                  onChange={(e) => {
                    setInterphoneValue(e.target.value);
                    updateFormData({ interphone: e.target.value });
                  }}
                  placeholder="Ex: DUPONT, 042"
                  className="h-8 text-sm"
                />
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="digicode" className="text-sm">Digicode</Label>
                <Switch
                  id="digicode"
                  checked={hasDigicode}
                  onCheckedChange={(v) => {
                    setHasDigicode(v);
                    updateFormData({ has_digicode: v });
                  }}
                />
              </div>
              {hasDigicode && (
                <Input
                  value={digicodeValue}
                  onChange={(e) => {
                    setDigicodeValue(e.target.value);
                    updateFormData({ digicode: e.target.value });
                  }}
                  placeholder="Ex: 1234A, A5678"
                  className="h-8 text-sm"
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Liste des lots de l'étage sélectionné */}
        {selectedFloor !== null && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  {selectedFloor === 0 ? "RDC" : `Étage ${selectedFloor}`}
                </CardTitle>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-7 text-xs"
                  onClick={() => setShowQuickAdd(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Ajouter
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ScrollArea className="max-h-48">
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {selectedFloorUnits.map((unit) => (
                      <motion.div
                        key={unit.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border"
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-md flex items-center justify-center text-lg",
                          unit.type === "parking" && "bg-blue-100 dark:bg-blue-900",
                          unit.type === "cave" && "bg-amber-100 dark:bg-amber-900",
                          unit.type !== "parking" && unit.type !== "cave" && "bg-emerald-100 dark:bg-emerald-900"
                        )}>
                          {unit.type === "parking" ? "🚗" : unit.type === "cave" ? "🪨" : "🏠"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            Lot {unit.position} • {unit.template?.toUpperCase() || unit.type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {unit.surface} m² • {unit.nb_pieces > 0 ? `${unit.nb_pieces} pièce${unit.nb_pieces > 1 ? "s" : ""}` : ""}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 text-slate-400 hover:text-blue-500"
                            onClick={() => {
                              setUnitToDuplicate(unit);
                              setShowDuplicateDialog(true);
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 text-slate-400 hover:text-red-500"
                            onClick={() => removeUnit(unit.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  {selectedFloorUnits.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Aucun lot à cet étage
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ====== DIALOG : Ajout rapide de lot ====== */}
      <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-500" />
              Ajouter un lot • {selectedFloor === 0 ? "RDC" : `Étage ${selectedFloor}`}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-3 gap-3 py-4">
            {UNIT_TEMPLATES.map((template) => (
              <motion.button
                key={template.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  if (selectedFloor !== null) {
                    addUnit(selectedFloor, template);
                    setShowQuickAdd(false);
                  }
                }}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  "border-slate-200 dark:border-slate-700",
                  "hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500"
                )}
              >
                <span className="text-2xl">{template.icon}</span>
                <span className="text-sm font-medium">{template.label}</span>
                <span className="text-xs text-muted-foreground">{template.surface} m²</span>
              </motion.button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== DIALOG : Duplication multi-étages ====== */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-blue-500" />
              Dupliquer le lot
            </DialogTitle>
          </DialogHeader>
          
          {unitToDuplicate && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <p className="font-medium">
                  Lot {unitToDuplicate.position} • {unitToDuplicate.template?.toUpperCase()}
                </p>
                <p className="text-sm text-muted-foreground">
                  {unitToDuplicate.surface} m² • Étage {unitToDuplicate.floor === 0 ? "RDC" : unitToDuplicate.floor}
                </p>
              </div>

              <div>
                <Label className="text-sm mb-2 block">Dupliquer sur les étages :</Label>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: floors }, (_, i) => i).map((floor) => {
                    if (floor === unitToDuplicate.floor) return null;
                    const isSelected = duplicateFloors.includes(floor);
                    
                    return (
                      <Button
                        key={floor}
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        className="h-8"
                        onClick={() => {
                          setDuplicateFloors(prev => 
                            isSelected 
                              ? prev.filter(f => f !== floor)
                              : [...prev, floor]
                          );
                        }}
                      >
                        {floor === 0 ? "RDC" : `Ét. ${floor}`}
                      </Button>
                    );
                  })}
                </div>
                
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const allFloors = Array.from({ length: floors }, (_, i) => i)
                        .filter(f => f !== unitToDuplicate.floor);
                      setDuplicateFloors(allFloors);
                    }}
                  >
                    Tous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDuplicateFloors([])}
                  >
                    Aucun
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={duplicateToFloors}
              disabled={duplicateFloors.length === 0}
            >
              <Copy className="h-4 w-4 mr-2" />
              Dupliquer ({duplicateFloors.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { BuildingConfigStep as default };

