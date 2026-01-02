// =====================================================
// Onboarding Syndic - Étape 4: Lots / Unités
// =====================================================

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import {
  Home, Building2, ArrowRight, ArrowLeft, Trash2,
  Plus, Edit2, Check, X, Sparkles, Car, Warehouse
} from "lucide-react";

interface StoredBuilding {
  id: string;
  name: string;
  type: string;
  floors: number;
  hasElevator: boolean;
  unitsPerFloor: number;
  totalUnits: number;
}

interface CoproUnit {
  id: string;
  building_id: string;
  building_name: string;
  lot_number: string;
  type: 'appartement' | 'studio' | 'parking' | 'cave' | 'local_commercial' | 'autre';
  floor: number;
  surface_m2: number | null;
  rooms: number | null;
  occupation_mode: 'owner_occupied' | 'rented' | 'vacant' | 'unknown';
}

const UNIT_TYPES = [
  { value: 'appartement', label: 'Appartement', icon: Home },
  { value: 'studio', label: 'Studio', icon: Home },
  { value: 'parking', label: 'Parking / Box', icon: Car },
  { value: 'cave', label: 'Cave', icon: Warehouse },
  { value: 'local_commercial', label: 'Local commercial', icon: Building2 },
  { value: 'autre', label: 'Autre', icon: Home },
];

export default function OnboardingUnitsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [buildings, setBuildings] = useState<StoredBuilding[]>([]);
  const [units, setUnits] = useState<CoproUnit[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [editingUnit, setEditingUnit] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Charger les données depuis localStorage
  useEffect(() => {
    const storedBuildings = localStorage.getItem('syndic_onboarding_buildings');
    const storedUnits = localStorage.getItem('syndic_onboarding_units');

    if (storedBuildings) {
      const buildingsData = JSON.parse(storedBuildings) as StoredBuilding[];
      setBuildings(buildingsData);
      
      if (storedUnits) {
        setUnits(JSON.parse(storedUnits));
      } else {
        // Générer les unités automatiquement
        const generatedUnits = generateUnitsFromBuildings(buildingsData);
        setUnits(generatedUnits);
      }

      if (buildingsData.length > 0) {
        setSelectedBuilding(buildingsData[0].id);
      }
    } else {
      // Pas de buildings, rediriger
      router.push('/syndic/onboarding/buildings');
    }

    setLoading(false);
  }, [router]);

  // Générer automatiquement les unités depuis les buildings
  function generateUnitsFromBuildings(buildingsData: StoredBuilding[]): CoproUnit[] {
    const generatedUnits: CoproUnit[] = [];
    let lotCounter = 1;

    buildingsData.forEach(building => {
      for (let floor = 0; floor < building.floors; floor++) {
        for (let unitNum = 1; unitNum <= building.unitsPerFloor; unitNum++) {
          const lotNumber = String(lotCounter).padStart(3, '0');
          generatedUnits.push({
            id: `unit-${lotCounter}`,
            building_id: building.id,
            building_name: building.name,
            lot_number: lotNumber,
            type: building.type === 'garage' ? 'parking' : 'appartement',
            floor: floor,
            surface_m2: null,
            rooms: null,
            occupation_mode: 'unknown'
          });
          lotCounter++;
        }
      }
    });

    return generatedUnits;
  }

  const updateUnit = (unitId: string, updates: Partial<CoproUnit>) => {
    setUnits(prev => prev.map(unit => 
      unit.id === unitId ? { ...unit, ...updates } : unit
    ));
  };

  const deleteUnit = (unitId: string) => {
    setUnits(prev => prev.filter(unit => unit.id !== unitId));
  };

  const addUnit = () => {
    if (!selectedBuilding) return;

    const building = buildings.find(b => b.id === selectedBuilding);
    if (!building) return;

    const buildingUnits = units.filter(u => u.building_id === selectedBuilding);
    const maxLot = Math.max(...units.map(u => parseInt(u.lot_number)), 0);
    const newLotNumber = String(maxLot + 1).padStart(3, '0');

    const newUnit: CoproUnit = {
      id: `unit-new-${Date.now()}`,
      building_id: selectedBuilding,
      building_name: building.name,
      lot_number: newLotNumber,
      type: 'appartement',
      floor: 0,
      surface_m2: null,
      rooms: null,
      occupation_mode: 'unknown'
    };

    setUnits(prev => [...prev, newUnit]);
    setEditingUnit(newUnit.id);
  };

  const handleSubmit = async () => {
    setSaving(true);

    try {
      // Valider qu'au moins un lot existe
      if (units.length === 0) {
        toast({
          title: "Erreur",
          description: "Vous devez avoir au moins un lot.",
          variant: "destructive"
        });
        setSaving(false);
        return;
      }

      // Sauvegarder dans localStorage
      localStorage.setItem('syndic_onboarding_units', JSON.stringify(units));

      // Passer à l'étape suivante
      router.push('/syndic/onboarding/tantiemes');
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la sauvegarde.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredUnits = selectedBuilding 
    ? units.filter(u => u.building_id === selectedBuilding)
    : units;

  const currentBuilding = buildings.find(b => b.id === selectedBuilding);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-xl font-bold text-white mb-2">Configuration des lots</h2>
        <p className="text-slate-400">
          Vérifiez et complétez les informations de chaque lot (appartements, parkings, caves...).
        </p>
      </motion.div>

      {/* Sélection du bâtiment */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap gap-2"
      >
        {buildings.map((building) => {
          const buildingUnitCount = units.filter(u => u.building_id === building.id).length;
          const isSelected = selectedBuilding === building.id;
          
          return (
            <button
              key={building.id}
              onClick={() => setSelectedBuilding(building.id)}
              className={`
                px-4 py-2 rounded-lg border transition-all
                ${isSelected 
                  ? 'bg-violet-500 border-violet-400 text-white' 
                  : 'bg-white/5 border-white/10 text-slate-300 hover:border-violet-400/50'}
              `}
            >
              <span className="font-medium">{building.name}</span>
              <Badge className="ml-2 bg-white/20">{buildingUnitCount} lots</Badge>
            </button>
          );
        })}
      </motion.div>

      {/* Tableau des lots */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-white/10 bg-white/5">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Home className="w-5 h-5 text-violet-400" />
              {currentBuilding?.name || 'Tous les lots'}
            </CardTitle>
            <Button onClick={addUnit} size="sm" className="bg-violet-500 hover:bg-violet-600">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un lot
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-slate-400">N° Lot</TableHead>
                    <TableHead className="text-slate-400">Type</TableHead>
                    <TableHead className="text-slate-400">Étage</TableHead>
                    <TableHead className="text-slate-400">Surface</TableHead>
                    <TableHead className="text-slate-400">Pièces</TableHead>
                    <TableHead className="text-slate-400">Occupation</TableHead>
                    <TableHead className="text-slate-400 w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnits.map((unit) => (
                    <TableRow key={unit.id} className="border-white/10">
                      <TableCell>
                        {editingUnit === unit.id ? (
                          <Input
                            value={unit.lot_number}
                            onChange={(e) => updateUnit(unit.id, { lot_number: e.target.value })}
                            className="w-20 bg-white/5 border-white/10 text-white"
                          />
                        ) : (
                          <span className="text-white font-mono">{unit.lot_number}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingUnit === unit.id ? (
                          <Select 
                            value={unit.type} 
                            onValueChange={(v) => updateUnit(unit.id, { type: v as CoproUnit['type'] })}
                          >
                            <SelectTrigger className="w-36 bg-white/5 border-white/10 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              {UNIT_TYPES.map((type) => (
                                <SelectItem 
                                  key={type.value} 
                                  value={type.value}
                                  className="text-white focus:bg-slate-700"
                                >
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={
                            unit.type === 'appartement' || unit.type === 'studio'
                              ? 'bg-cyan-500/20 text-cyan-400'
                              : unit.type === 'parking'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-slate-500/20 text-slate-400'
                          }>
                            {UNIT_TYPES.find(t => t.value === unit.type)?.label || unit.type}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingUnit === unit.id ? (
                          <Input
                            type="number"
                            value={unit.floor}
                            onChange={(e) => updateUnit(unit.id, { floor: parseInt(e.target.value) || 0 })}
                            className="w-16 bg-white/5 border-white/10 text-white"
                          />
                        ) : (
                          <span className="text-slate-300">
                            {unit.floor === 0 ? 'RDC' : `${unit.floor}e`}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingUnit === unit.id ? (
                          <Input
                            type="number"
                            value={unit.surface_m2 || ''}
                            onChange={(e) => updateUnit(unit.id, { surface_m2: parseFloat(e.target.value) || null })}
                            placeholder="m²"
                            className="w-20 bg-white/5 border-white/10 text-white"
                          />
                        ) : (
                          <span className="text-slate-300">
                            {unit.surface_m2 ? `${unit.surface_m2} m²` : '-'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingUnit === unit.id ? (
                          <Input
                            type="number"
                            value={unit.rooms || ''}
                            onChange={(e) => updateUnit(unit.id, { rooms: parseInt(e.target.value) || null })}
                            className="w-16 bg-white/5 border-white/10 text-white"
                          />
                        ) : (
                          <span className="text-slate-300">
                            {unit.rooms ? `${unit.rooms}p` : '-'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingUnit === unit.id ? (
                          <Select 
                            value={unit.occupation_mode} 
                            onValueChange={(v) => updateUnit(unit.id, { occupation_mode: v as CoproUnit['occupation_mode'] })}
                          >
                            <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              <SelectItem value="owner_occupied" className="text-white focus:bg-slate-700">Occupant</SelectItem>
                              <SelectItem value="rented" className="text-white focus:bg-slate-700">Loué</SelectItem>
                              <SelectItem value="vacant" className="text-white focus:bg-slate-700">Vacant</SelectItem>
                              <SelectItem value="unknown" className="text-white focus:bg-slate-700">Inconnu</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={
                            unit.occupation_mode === 'owner_occupied'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : unit.occupation_mode === 'rented'
                              ? 'bg-blue-500/20 text-blue-400'
                              : unit.occupation_mode === 'vacant'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-slate-500/20 text-slate-400'
                          }>
                            {unit.occupation_mode === 'owner_occupied' ? 'Occupant' :
                             unit.occupation_mode === 'rented' ? 'Loué' :
                             unit.occupation_mode === 'vacant' ? 'Vacant' : 'Inconnu'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {editingUnit === unit.id ? (
                            <>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => setEditingUnit(null)}
                                className="h-8 w-8 text-emerald-400 hover:bg-emerald-500/20"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                onClick={() => deleteUnit(unit.id)}
                                className="h-8 w-8 text-red-400 hover:bg-red-500/20"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => setEditingUnit(unit.id)}
                              className="h-8 w-8 text-slate-400 hover:text-white"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t border-white/10 pt-4">
            <div className="text-sm text-slate-400">
              <span className="font-semibold text-white">{units.length}</span> lots au total
            </div>
          </CardFooter>
        </Card>
      </motion.div>

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex justify-between pt-4"
      >
        <Button 
          variant="outline" 
          onClick={() => router.push('/syndic/onboarding/buildings')}
          className="border-white/10 text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={saving || units.length === 0}
          className="bg-gradient-to-r from-violet-500 to-purple-600"
        >
          {saving ? (
            <>
              <Sparkles className="w-4 h-4 mr-2 animate-spin" />
              Sauvegarde...
            </>
          ) : (
            <>
              Continuer vers les tantièmes
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </motion.div>
    </div>
  );
}

