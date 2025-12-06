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
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  name: string;
  state: "bon" | "moyen" | "mauvais" | "neuf";
  observations: string;
}

interface Inspection {
  id: string;
  type: "entree" | "sortie";
  date_inspection: string;
  property_id: string;
  property_address?: string;
  tenant_name?: string;
  sections: Section[];
  observations_generales?: string;
}

const stateOptions = [
  { value: "neuf", label: "Neuf", color: "bg-green-100 text-green-700" },
  { value: "bon", label: "Bon état", color: "bg-blue-100 text-blue-700" },
  { value: "moyen", label: "État moyen", color: "bg-amber-100 text-amber-700" },
  { value: "mauvais", label: "Mauvais état", color: "bg-red-100 text-red-700" },
];

const defaultSections = [
  "Entrée",
  "Séjour",
  "Cuisine",
  "Chambre 1",
  "Salle de bain",
  "WC",
  "Balcon/Terrasse",
  "Cave/Parking",
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
        const response = await fetch(`/api/edl/${inspectionId}`);
        if (response.ok) {
          const data = await response.json();
          setInspection(data.inspection || data);
        }
      } catch (error) {
        console.error("Erreur chargement état des lieux:", error);
      } finally {
        setLoading(false);
      }
    }
    if (inspectionId) fetchInspection();
  }, [inspectionId]);

  const addSection = () => {
    if (!inspection) return;
    const newSection: Section = {
      id: Date.now().toString(),
      name: "",
      state: "bon",
      observations: "",
    };
    setInspection({
      ...inspection,
      sections: [...inspection.sections, newSection],
    });
  };

  const removeSection = (sectionId: string) => {
    if (!inspection) return;
    setInspection({
      ...inspection,
      sections: inspection.sections.filter((s) => s.id !== sectionId),
    });
  };

  const updateSection = (sectionId: string, field: keyof Section, value: string) => {
    if (!inspection) return;
    setInspection({
      ...inspection,
      sections: inspection.sections.map((s) =>
        s.id === sectionId ? { ...s, [field]: value } : s
      ),
    });
  };

  const handleSave = async () => {
    if (!inspection) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/edl/${inspectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inspection),
      });

      if (!response.ok) throw new Error("Erreur sauvegarde");

      toast({
        title: "État des lieux sauvegardé",
        description: "Les modifications ont été enregistrées.",
      });

      router.push(`/app/owner/inspections/${inspectionId}`);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder l'état des lieux.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="p-6">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="py-16 text-center">
            <ClipboardCheck className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">État des lieux introuvable</h3>
            <Button asChild>
              <Link href="/app/owner/inspections">Retour aux états des lieux</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen"
    >
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/app/owner/inspections/${inspectionId}`}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au détail
          </Link>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">
                Modifier l'état des lieux {inspection.type === "entree" ? "d'entrée" : "de sortie"}
              </h1>
              {inspection.property_address && (
                <p className="text-muted-foreground mt-1">{inspection.property_address}</p>
              )}
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Sauvegarder
            </Button>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {inspection.sections.map((section, index) => (
            <Card key={section.id} className="bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      Section {index + 1}
                    </span>
                    <Input
                      value={section.name}
                      onChange={(e) => updateSection(section.id, "name", e.target.value)}
                      placeholder="Nom de la pièce"
                      className="max-w-xs bg-white"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSection(section.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>État général</Label>
                    <Select
                      value={section.state}
                      onValueChange={(value) => updateSection(section.id, "state", value)}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stateOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <span className={cn("px-2 py-0.5 rounded text-xs", option.color)}>
                              {option.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button variant="outline" size="sm" className="w-full">
                      <Camera className="mr-2 h-4 w-4" />
                      Ajouter des photos
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observations</Label>
                  <Textarea
                    value={section.observations}
                    onChange={(e) => updateSection(section.id, "observations", e.target.value)}
                    placeholder="Décrivez l'état de cette pièce..."
                    rows={3}
                    className="bg-white resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add section button */}
          <Button
            variant="outline"
            onClick={addSection}
            className="w-full border-dashed"
          >
            <Plus className="mr-2 h-4 w-4" />
            Ajouter une section
          </Button>

          {/* Observations générales */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Observations générales</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={inspection.observations_generales || ""}
                onChange={(e) =>
                  setInspection({ ...inspection, observations_generales: e.target.value })
                }
                placeholder="Remarques générales sur l'état du logement..."
                rows={4}
                className="bg-white resize-none"
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" asChild>
              <Link href={`/app/owner/inspections/${inspectionId}`}>Annuler</Link>
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Sauvegarder
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

