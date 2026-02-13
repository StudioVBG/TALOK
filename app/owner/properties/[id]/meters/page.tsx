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
import { METER_TYPES, type MeterTypeV3 } from "@/lib/types/property-v3";
import {
  listMeters,
  createMeter,
  updateMeter,
  deleteMeter,
} from "../actions-meters-diagnostics-equipment";
import {
  Plus, Trash2, Gauge, ArrowLeft, Save,
  Zap, Flame, Droplets, Thermometer, Loader2,
} from "lucide-react";

const METER_ICONS: Record<string, React.ElementType> = {
  electricity: Zap,
  gas: Flame,
  water: Droplets,
  hot_water: Droplets,
  heating: Thermometer,
};

export default function MetersPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const propertyId = params.id as string;

  const [meters, setMeters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const loadMeters = useCallback(async () => {
    setLoading(true);
    const result = await listMeters(propertyId);
    if (result.success && result.data) {
      setMeters(result.data);
    }
    setLoading(false);
  }, [propertyId]);

  useEffect(() => {
    loadMeters();
  }, [loadMeters]);

  const handleCreate = async () => {
    const result = await createMeter(propertyId, {
      property_id: propertyId,
      meter_type: "electricity",
      is_individual: true,
    });
    if (result.success) {
      toast({ title: "Compteur ajouté" });
      loadMeters();
    } else {
      toast({ title: "Erreur", description: result.error, variant: "destructive" });
    }
  };

  const handleUpdate = async (meterId: string, field: string, value: any) => {
    setSaving(meterId);
    const result = await updateMeter(propertyId, meterId, { [field]: value });
    if (!result.success) {
      toast({ title: "Erreur", description: result.error, variant: "destructive" });
    }
    // Optimistic update
    setMeters(prev => prev.map(m => m.id === meterId ? { ...m, [field]: value } : m));
    setSaving(null);
  };

  const handleDelete = async (meterId: string) => {
    const result = await deleteMeter(propertyId, meterId);
    if (result.success) {
      setMeters(prev => prev.filter(m => m.id !== meterId));
      toast({ title: "Compteur supprimé" });
    } else {
      toast({ title: "Erreur", description: result.error, variant: "destructive" });
    }
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gauge className="h-6 w-6" /> Compteurs
          </h1>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" /> Ajouter
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : meters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Gauge className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-lg mb-1">Aucun compteur</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Ajoutez les compteurs de votre bien pour faciliter les EDL.
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" /> Ajouter un compteur
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {meters.map((meter) => {
            const MeterIcon = METER_ICONS[meter.meter_type] || Gauge;
            const meterLabel = METER_TYPES.find(t => t.value === meter.meter_type)?.label || meter.meter_type;
            return (
              <Card key={meter.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MeterIcon className="h-4 w-4 text-primary" />
                      {meterLabel}
                      {saving === meter.id && <Loader2 className="h-3 w-3 animate-spin" />}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(meter.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={meter.meter_type}
                        onValueChange={(v) => handleUpdate(meter.id, "meter_type", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {METER_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.icon} {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>N° compteur</Label>
                      <Input
                        value={meter.meter_number || ""}
                        placeholder="N° PDL/PCE..."
                        onBlur={(e) => handleUpdate(meter.id, "meter_number", e.target.value)}
                        onChange={(e) => setMeters(prev => prev.map(m => m.id === meter.id ? { ...m, meter_number: e.target.value } : m))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Emplacement</Label>
                      <Input
                        value={meter.location || ""}
                        placeholder="Placard entrée, sous-sol..."
                        onBlur={(e) => handleUpdate(meter.id, "location", e.target.value)}
                        onChange={(e) => setMeters(prev => prev.map(m => m.id === meter.id ? { ...m, location: e.target.value } : m))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fournisseur</Label>
                      <Input
                        value={meter.provider || ""}
                        placeholder="EDF, Engie..."
                        onBlur={(e) => handleUpdate(meter.id, "provider", e.target.value)}
                        onChange={(e) => setMeters(prev => prev.map(m => m.id === meter.id ? { ...m, provider: e.target.value } : m))}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={meter.is_individual}
                      onCheckedChange={(v) => handleUpdate(meter.id, "is_individual", v)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {meter.is_individual ? "Compteur individuel" : "Compteur collectif"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Alert className="bg-blue-50 border-blue-200">
        <Gauge className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 text-sm">
          Les compteurs et leurs numéros seront automatiquement repris dans les états des lieux (EDL).
          Pensez à relever les index lors de chaque entrée/sortie.
        </AlertDescription>
      </Alert>
    </div>
  );
}
