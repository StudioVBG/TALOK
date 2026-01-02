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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft,
  CalendarIcon,
  Clock,
  MapPin,
  Save,
  Loader2,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Resolution {
  id: string;
  title: string;
  description: string;
  majority: string;
}

interface Assembly {
  id: string;
  title: string;
  type: string;
  date: string;
  time: string;
  location: string;
  description?: string;
  resolutions: Resolution[];
}

const majorityOptions = [
  { value: "simple", label: "Majorité simple (Art. 24)" },
  { value: "absolute", label: "Majorité absolue (Art. 25)" },
  { value: "double", label: "Double majorité (Art. 26)" },
  { value: "unanimity", label: "Unanimité" },
];

export default function EditAssemblyPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const assemblyId = params.id as string;

  const [assembly, setAssembly] = useState<Assembly | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchAssembly() {
      try {
        const response = await fetch(`/api/copro/assemblies/${assemblyId}`);
        if (response.ok) {
          const data = await response.json();
          setAssembly(data.assembly || data);
        }
      } catch (error) {
        console.error("Erreur chargement assemblée:", error);
      } finally {
        setLoading(false);
      }
    }
    if (assemblyId) fetchAssembly();
  }, [assemblyId]);

  const addResolution = () => {
    if (!assembly) return;
    setAssembly({
      ...assembly,
      resolutions: [
        ...assembly.resolutions,
        { id: Date.now().toString(), title: "", description: "", majority: "simple" },
      ],
    });
  };

  const removeResolution = (id: string) => {
    if (!assembly || assembly.resolutions.length <= 1) return;
    setAssembly({
      ...assembly,
      resolutions: assembly.resolutions.filter((r) => r.id !== id),
    });
  };

  const updateResolution = (id: string, field: keyof Resolution, value: string) => {
    if (!assembly) return;
    setAssembly({
      ...assembly,
      resolutions: assembly.resolutions.map((r) =>
        r.id === id ? { ...r, [field]: value } : r
      ),
    });
  };

  const handleSave = async () => {
    if (!assembly) return;

    if (!assembly.title || !assembly.location) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/copro/assemblies/${assemblyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assembly),
      });

      if (!response.ok) throw new Error("Erreur sauvegarde");

      toast({
        title: "Assemblée mise à jour",
        description: "Les modifications ont été enregistrées.",
      });

      router.push(`/syndic/assemblies/${assemblyId}`);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les modifications.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!assembly) {
    return (
      <div className="p-6">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="py-16 text-center">
            <CalendarIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Assemblée introuvable</h3>
            <Button asChild>
              <Link href="/syndic/assemblies">Retour aux assemblées</Link>
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
      className="p-6"
    >
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/syndic/assemblies/${assemblyId}`}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l'assemblée
          </Link>
          <h1 className="text-2xl font-bold">Modifier l'assemblée</h1>
        </div>

        <div className="space-y-6">
          {/* Informations générales */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-indigo-500" />
                Informations générales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titre *</Label>
                <Input
                  id="title"
                  value={assembly.title}
                  onChange={(e) => setAssembly({ ...assembly, title: e.target.value })}
                  className="bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-white",
                          !assembly.date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {assembly.date
                          ? format(new Date(assembly.date), "PPP", { locale: fr })
                          : "Sélectionner"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={new Date(assembly.date)}
                        onSelect={(date) =>
                          date && setAssembly({ ...assembly, date: date.toISOString() })
                        }
                        locale={fr}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time" className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Heure *
                  </Label>
                  <Input
                    id="time"
                    type="time"
                    value={assembly.time}
                    onChange={(e) => setAssembly({ ...assembly, time: e.target.value })}
                    className="bg-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Lieu *
                </Label>
                <Input
                  id="location"
                  value={assembly.location}
                  onChange={(e) => setAssembly({ ...assembly, location: e.target.value })}
                  className="bg-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={assembly.description || ""}
                  onChange={(e) => setAssembly({ ...assembly, description: e.target.value })}
                  rows={3}
                  className="bg-white resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Résolutions */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-500" />
                  Ordre du jour
                </CardTitle>
                <CardDescription>Résolutions à voter</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addResolution}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {assembly.resolutions.map((resolution, index) => (
                <div
                  key={resolution.id}
                  className="p-4 rounded-lg border border-slate-200 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Résolution {index + 1}
                    </span>
                    {assembly.resolutions.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeResolution(resolution.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <Input
                    value={resolution.title}
                    onChange={(e) => updateResolution(resolution.id, "title", e.target.value)}
                    placeholder="Titre de la résolution"
                    className="bg-white"
                  />

                  <Textarea
                    value={resolution.description}
                    onChange={(e) => updateResolution(resolution.id, "description", e.target.value)}
                    placeholder="Description..."
                    rows={2}
                    className="bg-white resize-none"
                  />

                  <Select
                    value={resolution.majority}
                    onValueChange={(value) => updateResolution(resolution.id, "majority", value)}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Type de majorité" />
                    </SelectTrigger>
                    <SelectContent>
                      {majorityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" asChild>
              <Link href={`/syndic/assemblies/${assemblyId}`}>Annuler</Link>
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-indigo-600 to-purple-600"
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

