"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ClipboardCheck,
  Save,
  Loader2,
  Plus,
  Trash2,
  Camera,
  Key,
  Zap,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Section {
  id: string;
  name: string;
  items: Array<{
    id?: string;
    name: string;
    condition: "neuf" | "bon" | "moyen" | "mauvais" | "tres_mauvais" | null;
    notes: string;
  }>;
}

interface MeterReading {
  id?: string;
  meter_id: string;
  type: string;
  meter_number?: string;
  location?: string;
  reading_value: string;
  unit: string;
  photo_path?: string;
}

interface KeyItem {
  type: string;
  quantite: number;
  notes?: string;
}

interface Inspection {
  id: string;
  type: "entree" | "sortie";
  status: string;
  property_address?: string;
  sections: Section[];
  observations_generales: string;
  keys: KeyItem[];
  meter_readings: MeterReading[];
}

const stateOptions = [
  { value: "neuf", label: "Neuf", color: "bg-blue-100 text-blue-700" },
  { value: "bon", label: "Bon état", color: "bg-green-100 text-green-700" },
  { value: "moyen", label: "État moyen", color: "bg-amber-100 text-amber-700" },
  { value: "mauvais", label: "Mauvais état", color: "bg-red-100 text-red-700" },
  { value: "tres_mauvais", label: "Très mauvais", color: "bg-red-200 text-red-900" },
];

const DEFAULT_KEY_TYPES = [
  "Clé Porte d'entrée",
  "Badge Immeuble",
  "Digicode / Code d'accès",
  "Clé Boîte aux lettres",
  "Clé Garage / Parking",
  "Clé Cave",
  "Télécommande Portail",
];

const METER_TYPES_LIST = [
  { type: "electricity", label: "Électricité", unit: "kWh", icon: <Zap className="h-4 w-4" /> },
  { type: "gas", label: "Gaz", unit: "m³", icon: <Zap className="h-4 w-4" /> },
  { type: "water", label: "Eau", unit: "m³", icon: <Zap className="h-4 w-4" /> },
];

export default function EditInspectionPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const inspectionId = params.id as string;

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchInspection() {
      try {
        // 1. Récupérer l'EDL de base
        const response = await fetch(`/api/edl/${inspectionId}`);
        if (!response.ok) throw new Error("Erreur chargement EDL");
        const data = await response.json();
        
        // 2. Récupérer les compteurs
        const metersRes = await fetch(`/api/edl/${inspectionId}/meter-readings`);
        const metersData = await metersRes.json();

        // Fusionner les relevés existants avec les compteurs manquants
        const existingReadings = (metersData.readings || []).map(r => ({
          id: r.id,
          meter_id: r.meter_id,
          type: r.meter?.type,
          meter_number: r.meter?.meter_number || r.meter?.serial_number || "",
          location: r.meter?.location || "",
          reading_value: r.reading_value != null && !isNaN(parseFloat(r.reading_value)) ? String(r.reading_value) : "",
          unit: r.reading_unit || r.meter?.unit,
          photo_path: r.photo_path
        }));

        const missingReadings = (metersData.missing_meters || []).map(m => ({
          meter_id: m.id,
          type: m.type,
          meter_number: m.meter_number || m.serial_number || "",
          location: m.location || "",
          reading_value: "",
          unit: m.unit,
        }));

        const allMeterReadings = [...existingReadings, ...missingReadings];

        // 3. Grouper les items par pièce
        const sectionsMap = new Map<string, any[]>();
        (data.items || []).forEach(item => {
          const roomItems = sectionsMap.get(item.room_name) || [];
          roomItems.push({
            id: item.id,
            name: item.item_name,
            condition: item.condition,
            notes: item.notes || ""
          });
          sectionsMap.set(item.room_name, roomItems);
        });

        const sections = Array.from(sectionsMap.entries()).map(([name, items]) => ({
          id: name, // Utiliser le nom comme ID temporaire
          name,
          items
        }));

        setInspection({
          id: data.edl.id,
          type: data.edl.type,
          status: data.edl.status,
          property_address: data.edl.lease?.property?.adresse_complete,
          observations_generales: data.edl.general_notes || "",
          keys: data.edl.keys || [],
          meter_readings: allMeterReadings,
          sections: sections
        });
      } catch (error) {
        console.error("Erreur chargement état des lieux:", error);
        toast({ title: "Erreur", description: "Impossible de charger l'EDL", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
    if (inspectionId) fetchInspection();
  }, [inspectionId, toast]);

  const handleSave = async () => {
    if (!inspection) return;
    setSaving(true);
    try {
      // 1. Sauvegarder l'EDL (notes, clés, sections)
      const response = await fetch(`/api/edl/${inspectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inspection),
      });

      if (!response.ok) throw new Error("Erreur sauvegarde EDL");

      // 2. Sauvegarder les compteurs (toujours sauvegarder les numéros et localisations)
      for (const mr of inspection.meter_readings) {
        const val = parseFloat(mr.reading_value);
        const hasValidValue = !isNaN(val);

        if (mr.id) {
          // Mise à jour d'un relevé existant
          const res = await fetch(`/api/edl/${inspectionId}/meter-readings/${mr.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              corrected_value: hasValidValue ? val : null,
              meter_number: mr.meter_number,
              location: mr.location
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Erreur inconnue" }));
            throw new Error(`Erreur compteur ${mr.type}: ${err.error}`);
          }
        } else {
          // Création d'un nouveau relevé ou simplement mise à jour du compteur
          const res = await fetch(`/api/edl/${inspectionId}/meter-readings`, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "x-meter-type": mr.type
            },
            body: JSON.stringify({ 
              meter_id: mr.meter_id,
              reading_value: hasValidValue ? val : null,
              reading_unit: mr.unit,
              meter_number: mr.meter_number,
              location: mr.location
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Erreur inconnue" }));
            throw new Error(`Erreur nouveau compteur ${mr.type}: ${err.error}`);
          }
        }
      }

      toast({ title: "État des lieux mis à jour", description: "Les modifications ont été enregistrées." });
      router.push(`/owner/inspections/${inspectionId}`);
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder les modifications.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addKey = () => {
    setInspection({
      ...inspection,
      keys: [...inspection.keys, { type: "Clé Porte d'entrée", quantite: 1, notes: "" }]
    });
  };

  const removeKey = (index: number) => {
    const newKeys = [...inspection.keys];
    newKeys.splice(index, 1);
    setInspection({ ...inspection, keys: newKeys });
  };

  const updateKey = (index: number, field: keyof KeyItem, value: any) => {
    const newKeys = [...inspection.keys];
    newKeys[index] = { ...newKeys[index], [field]: value };
    setInspection({ ...inspection, keys: newKeys });
  };

  const updateMeter = (index: number, field: keyof MeterReading, value: string) => {
    const newMeters = [...inspection.meter_readings];
    newMeters[index] = { ...newMeters[index], [field]: value };
    setInspection({ ...inspection, meter_readings: newMeters });
  };

  const addMeterReading = (type: string) => {
    const meterType = METER_TYPES_LIST.find(m => m.type === type);
    setInspection({
      ...inspection,
      meter_readings: [
        ...inspection.meter_readings,
        {
          meter_id: `temp_${Date.now()}`,
          type: type,
          meter_number: "",
          location: "",
          reading_value: "",
          unit: meterType?.unit || "unit"
        }
      ]
    });
  };

  const handlePhotoUpload = async (index: number, file: File) => {
    const meter = inspection.meter_readings[index];
    const formData = new FormData();
    formData.append("photo", file);
    formData.append("meter_id", meter.meter_id);
    if (meter.meter_number) formData.append("meter_number", meter.meter_number);
    if (meter.location) formData.append("location", meter.location);

    try {
      toast({ title: "Analyse en cours...", description: "Nous extrayons l'index de la photo." });
      const response = await fetch(`/api/edl/${inspectionId}/meter-readings`, {
        method: "POST",
        body: formData,
        headers: {
          "x-meter-type": meter.type
        }
      });

      if (response.ok) {
        const data = await response.json();
        const newMeters = [...inspection.meter_readings];
        newMeters[index] = {
          ...newMeters[index],
          id: data.reading.id,
          meter_id: data.reading.meter_id, // Mise à jour de l'ID réel si c'était un temp_
          meter_number: data.reading.meter?.meter_number,
          reading_value: data.reading.reading_value != null ? String(data.reading.reading_value) : "",
          photo_path: data.reading.photo_path
        };
        setInspection({ ...inspection, meter_readings: newMeters });
        toast({ title: "Succès", description: "Photo enregistrée et index extrait." });
      } else {
        const err = await response.json();
        throw new Error(err.error || "Erreur lors de l'upload");
      }
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Impossible d'uploader la photo.", variant: "destructive" });
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  if (!inspection) return <div className="p-6 text-center"><h3 className="text-lg font-semibold">EDL introuvable</h3></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-50 min-h-screen pb-20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <Link href={`/owner/inspections/${inspectionId}`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2 transition-colors">
              <ArrowLeft className="h-4 w-4" /> Retour au détail
            </Link>
            <h1 className="text-2xl font-bold">Modifier l&apos;état des lieux {inspection.type === "entree" ? "d'entrée" : "de sortie"}</h1>
            <p className="text-muted-foreground">{inspection.property_address}</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg px-8">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Enregistrer les modifications
          </Button>
        </div>

        <div className="space-y-8">
          {/* Section Compteurs */}
          <Card className="border-amber-100 shadow-sm">
            <CardHeader className="bg-amber-50/50 border-b border-amber-100">
              <CardTitle className="text-lg flex items-center gap-2 text-amber-900">
                <Zap className="h-5 w-5" /> Relevés des compteurs
              </CardTitle>
              <CardDescription>Mettez à jour les index relevés au moment de l&apos;EDL</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {inspection.meter_readings.map((mr, i) => (
                  <div key={i} className="space-y-4 p-4 border rounded-xl bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b pb-2 mb-2">
                      <span className="font-bold uppercase text-[10px] tracking-wider text-slate-500">
                        {mr.type === 'water' ? '💧 Eau' : mr.type === 'electricity' ? '⚡ Électricité' : mr.type === 'gas' ? '🔥 Gaz' : mr.type}
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-slate-50">
                        {mr.id ? "Enregistré" : "Nouveau"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground">N° Compteur</Label>
                        <Input 
                          value={mr.meter_number || ""} 
                          onChange={(e) => updateMeter(i, 'meter_number', e.target.value)}
                          placeholder="Ex: 123456"
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-muted-foreground">Localisation</Label>
                        <Input 
                          value={mr.location || ""} 
                          onChange={(e) => updateMeter(i, 'location', e.target.value)}
                          placeholder="Ex: Cuisine, Palier..."
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Index relevé</Label>
                      <div className="flex gap-2">
                        <Input 
                          type="number" 
                          value={mr.reading_value || ""} 
                          onChange={(e) => updateMeter(i, 'reading_value', e.target.value)}
                          className="text-lg font-mono font-bold"
                          placeholder="00000"
                        />
                        <div className="bg-slate-100 px-3 flex items-center rounded-md font-bold text-slate-500">{mr.unit}</div>
                        
                        <div className="relative">
                          <Input
                            type="file"
                            id={`meter-photo-${i}`}
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handlePhotoUpload(i, e.target.files[0]);
                              }
                            }}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className={cn(
                              "h-10 w-10 shrink-0 transition-all",
                              mr.photo_path ? "text-green-600 border-green-200 bg-green-50" : "text-indigo-600 border-indigo-100"
                            )}
                            onClick={() => document.getElementById(`meter-photo-${i}`)?.click()}
                            title="Prendre une photo"
                          >
                            <Camera className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {mr.photo_path && <p className="text-[10px] text-green-600 font-medium flex items-center gap-1">✅ Photo enregistrée</p>}
                  </div>
                ))}
                {inspection.meter_readings.length === 0 && (
                  <p className="text-sm text-slate-400 italic md:col-span-2 text-center py-4">Aucun compteur enregistré sur cet EDL.</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-4 border-t">
                <span className="text-sm text-muted-foreground mr-2 self-center">Ajouter un relevé :</span>
                {METER_TYPES_LIST.map((m) => (
                  <Button
                    key={m.type}
                    variant="outline"
                    size="sm"
                    onClick={() => addMeterReading(m.type)}
                    className="gap-2 border-dashed"
                  >
                    {m.icon}
                    {m.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Section Clés */}
          <Card className="border-indigo-100 shadow-sm">
            <CardHeader className="bg-indigo-50/50 border-b border-indigo-100">
              <CardTitle className="text-lg flex items-center gap-2 text-indigo-900">
                <Key className="h-5 w-5" /> Trousseau de clés
              </CardTitle>
              <CardDescription>Liste des clés et badges remis au locataire</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {inspection.keys.map((key, i) => (
                <div key={i} className="flex flex-col md:flex-row gap-4 p-4 border rounded-xl bg-white shadow-sm relative group">
                  <div className="flex-1 space-y-2">
                    <Label>Type</Label>
                    <Select value={key.type} onValueChange={(v) => updateKey(i, 'type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DEFAULT_KEY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        <SelectItem value="Autre">Autre...</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-full md:w-24 space-y-2">
                    <Label>Quantité</Label>
                    <Input 
                      type="number" 
                      value={key.quantite || 0} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        updateKey(i, 'quantite', isNaN(val) ? 0 : val);
                      }} 
                    />
                  </div>
                  <div className="flex-[2] space-y-2">
                    <Label>Notes</Label>
                    <Input value={key.notes} onChange={(e) => updateKey(i, 'notes', e.target.value)} placeholder="Ex: Marque, état..." />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeKey(i)} className="text-red-400 hover:text-red-600 md:self-end">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={addKey} className="w-full border-dashed border-2 py-8 text-indigo-600 hover:bg-indigo-50">
                <Plus className="mr-2 h-4 w-4" /> Ajouter une clé ou un badge
              </Button>
            </CardContent>
          </Card>

          {/* Section Pièces (Items) */}
          <div className="space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2 ml-1">
              <ClipboardCheck className="h-5 w-5 text-indigo-600" /> État des pièces et équipements
            </h3>
            {inspection.sections.map((section, sectionIdx) => (
              <Card key={sectionIdx} className="shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50 border-b py-3">
                  <div className="flex items-center justify-between">
                    <Input 
                      value={section.name} 
                      onChange={(e) => {
                        const newSections = [...inspection.sections];
                        newSections[sectionIdx].name = e.target.value;
                        setInspection({...inspection, sections: newSections});
                      }}
                      className="max-w-xs font-bold bg-transparent border-none focus-visible:ring-0 px-0 h-auto text-lg"
                    />
                    <Badge variant="secondary">{section.items.length} éléments</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {section.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="p-4 space-y-3 hover:bg-slate-50/50 transition-colors">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <span className="font-medium text-slate-700">{item.name}</span>
                          <div className="flex flex-wrap gap-2">
                            {stateOptions.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => {
                                  const newSections = [...inspection.sections];
                                  newSections[sectionIdx].items[itemIdx].condition = opt.value;
                                  setInspection({...inspection, sections: newSections});
                                }}
                                className={cn(
                                  "px-3 py-1 rounded-full text-xs font-bold border transition-all",
                                  item.condition === opt.value ? opt.color + " border-current shadow-sm" : "bg-white text-slate-400 border-slate-200"
                                )}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <Textarea 
                          value={item.notes} 
                          onChange={(e) => {
                            const newSections = [...inspection.sections];
                            newSections[sectionIdx].items[itemIdx].notes = e.target.value;
                            setInspection({...inspection, sections: newSections});
                          }}
                          placeholder="Notes sur l'état..."
                          className="bg-white resize-none text-sm h-20"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Observations Générales */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Observations générales</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea 
                value={inspection.observations_generales} 
                onChange={(e) => setInspection({...inspection, observations_generales: e.target.value})}
                placeholder="Remarques globales sur le logement..."
                className="min-h-[150px] text-base"
              />
            </CardContent>
          </Card>
        </div>

        {/* Floating Save Button Mobile */}
        <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 md:hidden">
          <Button onClick={handleSave} disabled={saving} className="w-full max-w-md bg-indigo-600 h-14 text-lg font-bold shadow-2xl">
            {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            Enregistrer
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
