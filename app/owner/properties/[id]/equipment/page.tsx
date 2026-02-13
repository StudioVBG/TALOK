"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { EQUIPMENT_CATEGORIES, type EquipmentCategoryV3 } from "@/lib/types/property-v3";
import {
  listEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
} from "../actions-meters-diagnostics-equipment";
import {
  Plus, Trash2, Wrench, ArrowLeft, Loader2, Info,
} from "lucide-react";

const CONDITION_LABELS: Record<string, string> = {
  new: "Neuf",
  good: "Bon état",
  fair: "État correct",
  poor: "Usé",
  broken: "Hors service",
};

export default function EquipmentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const propertyId = params.id as string;

  const [equipment, setEquipment] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const loadEquipment = useCallback(async () => {
    setLoading(true);
    const result = await listEquipment(propertyId);
    if (result.success && result.data) {
      setEquipment(result.data);
    }
    setLoading(false);
  }, [propertyId]);

  useEffect(() => {
    loadEquipment();
  }, [loadEquipment]);

  const handleCreate = async () => {
    const result = await createEquipment(propertyId, {
      property_id: propertyId,
      category: "other",
      name: "Nouvel équipement",
      condition: "good",
      is_included_in_lease: true,
    });
    if (result.success) {
      toast({ title: "Équipement ajouté" });
      loadEquipment();
    } else {
      toast({ title: "Erreur", description: result.error, variant: "destructive" });
    }
  };

  const handleUpdate = async (eqId: string, field: string, value: any) => {
    setSaving(eqId);
    const result = await updateEquipment(propertyId, eqId, { [field]: value });
    if (!result.success) {
      toast({ title: "Erreur", description: result.error, variant: "destructive" });
    }
    setEquipment(prev => prev.map(e => e.id === eqId ? { ...e, [field]: value } : e));
    setSaving(null);
  };

  const handleDelete = async (eqId: string) => {
    const result = await deleteEquipment(propertyId, eqId);
    if (result.success) {
      setEquipment(prev => prev.filter(e => e.id !== eqId));
      toast({ title: "Équipement supprimé" });
    } else {
      toast({ title: "Erreur", description: result.error, variant: "destructive" });
    }
  };

  // Group equipment by category
  const groupedEquipment = equipment.reduce((acc, item) => {
    const cat = item.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="h-6 w-6" /> Équipements
          </h1>
          <Badge variant="secondary">{equipment.length}</Badge>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" /> Ajouter
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : equipment.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Wrench className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-lg mb-1">Aucun équipement</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Listez les équipements de votre bien pour l'inventaire et les EDL.
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" /> Ajouter un équipement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedEquipment).map(([category, items]) => {
            const catLabel = EQUIPMENT_CATEGORIES.find(c => c.value === category)?.label || category;
            return (
              <div key={category} className="space-y-3">
                <h2 className="text-lg font-semibold">{catLabel}</h2>
                {(items as any[]).map((item) => (
                  <Card key={item.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Nom</Label>
                            <Input
                              value={item.name || ""}
                              onBlur={(e) => handleUpdate(item.id, "name", e.target.value)}
                              onChange={(e) => setEquipment(prev => prev.map(eq => eq.id === item.id ? { ...eq, name: e.target.value } : eq))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Marque</Label>
                            <Input
                              value={item.brand || ""}
                              placeholder="Marque..."
                              onBlur={(e) => handleUpdate(item.id, "brand", e.target.value)}
                              onChange={(e) => setEquipment(prev => prev.map(eq => eq.id === item.id ? { ...eq, brand: e.target.value } : eq))}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">État</Label>
                            <Select
                              value={item.condition || "good"}
                              onValueChange={(v) => handleUpdate(item.id, "condition", v)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>{v}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                          {saving === item.id && <Loader2 className="h-3 w-3 animate-spin" />}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                            className="text-destructive hover:text-destructive h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Switch
                          checked={item.is_included_in_lease}
                          onCheckedChange={(v) => handleUpdate(item.id, "is_included_in_lease", v)}
                        />
                        <span className="text-xs text-muted-foreground">Inclus dans le bail</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 text-sm">
          Les équipements seront repris dans l'inventaire du mobilier et les états des lieux.
          Pour un meublé, le Décret n°2015-981 impose une liste minimale d'équipements.
        </AlertDescription>
      </Alert>
    </div>
  );
}
