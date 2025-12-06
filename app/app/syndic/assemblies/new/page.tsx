"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft,
  Building2,
  CalendarIcon,
  Clock,
  MapPin,
  Users,
  FileText,
  Plus,
  Trash2,
  Loader2,
  Send,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format, addDays, setHours, setMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const assemblyTypes = [
  { value: "ordinary", label: "AG Ordinaire", description: "Assemblée annuelle obligatoire" },
  { value: "extraordinary", label: "AG Extraordinaire", description: "Assemblée exceptionnelle" },
];

interface Site {
  id: string;
  name: string;
  address: string;
  total_owners: number;
}

interface Resolution {
  id: string;
  title: string;
  description: string;
  majority: "simple" | "absolute" | "double" | "unanimity";
}

const majorityOptions = [
  { value: "simple", label: "Majorité simple (Art. 24)", description: "Majorité des voix exprimées" },
  { value: "absolute", label: "Majorité absolue (Art. 25)", description: "Majorité de tous les copropriétaires" },
  { value: "double", label: "Double majorité (Art. 26)", description: "2/3 des voix de tous les copropriétaires" },
  { value: "unanimity", label: "Unanimité", description: "Accord de tous les copropriétaires" },
];

export default function NewAssemblyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const preselectedSiteId = searchParams.get("siteId");

  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);

  const [form, setForm] = useState({
    site_id: preselectedSiteId || "",
    type: "ordinary",
    title: "",
    date: addDays(new Date(), 30),
    time: "18:00",
    location: "",
    description: "",
  });

  const [resolutions, setResolutions] = useState<Resolution[]>([
    { id: "1", title: "", description: "", majority: "simple" },
  ]);

  useEffect(() => {
    async function fetchSites() {
      try {
        const response = await fetch("/api/copro/sites");
        if (response.ok) {
          const data = await response.json();
          setSites(data.sites || data || []);
        }
      } catch (error) {
        console.error("Erreur chargement sites:", error);
      } finally {
        setLoadingSites(false);
      }
    }
    fetchSites();
  }, []);

  const addResolution = () => {
    setResolutions([
      ...resolutions,
      { id: Date.now().toString(), title: "", description: "", majority: "simple" },
    ]);
  };

  const removeResolution = (id: string) => {
    if (resolutions.length > 1) {
      setResolutions(resolutions.filter((r) => r.id !== id));
    }
  };

  const updateResolution = (id: string, field: keyof Resolution, value: string) => {
    setResolutions(
      resolutions.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.site_id || !form.title || !form.location) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    const validResolutions = resolutions.filter((r) => r.title.trim());
    if (validResolutions.length === 0) {
      toast({
        title: "Résolutions requises",
        description: "Ajoutez au moins une résolution à l'ordre du jour.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/copro/assemblies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          resolutions: validResolutions,
        }),
      });

      if (!response.ok) throw new Error("Erreur création");

      toast({
        title: "Assemblée planifiée",
        description: "Les convocations seront envoyées aux copropriétaires.",
      });

      router.push(`/app/syndic/assemblies`);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de créer l'assemblée.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6"
    >
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/app/syndic/assemblies"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux assemblées
          </Link>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 bg-clip-text text-transparent">
            Planifier une assemblée
          </h1>
          <p className="text-muted-foreground mt-1">
            Organisez une assemblée générale de copropriété
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations générales */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-indigo-500" />
                Informations générales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Site */}
              <div className="space-y-2">
                <Label htmlFor="site_id" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Site concerné *
                </Label>
                <Select
                  value={form.site_id}
                  onValueChange={(value) => setForm({ ...form, site_id: value })}
                  disabled={loadingSites}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={loadingSites ? "Chargement..." : "Sélectionner un site"} />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type */}
              <div className="space-y-2">
                <Label>Type d'assemblée *</Label>
                <div className="grid grid-cols-2 gap-3">
                  {assemblyTypes.map((type) => (
                    <div
                      key={type.value}
                      onClick={() => setForm({ ...form, type: type.value })}
                      className={cn(
                        "p-3 rounded-lg border-2 cursor-pointer transition-all",
                        form.type === type.value
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      )}
                    >
                      <p className="font-medium text-sm">{type.label}</p>
                      <p className="text-xs text-muted-foreground">{type.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Titre */}
              <div className="space-y-2">
                <Label htmlFor="title">Titre *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex: Assemblée Générale Ordinaire 2025"
                  className="bg-white"
                  required
                />
              </div>

              {/* Date et Heure */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-white",
                          !form.date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.date ? format(form.date, "PPP", { locale: fr }) : "Sélectionner"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={form.date}
                        onSelect={(date) => date && setForm({ ...form, date })}
                        locale={fr}
                        initialFocus
                        disabled={(date) => date < new Date()}
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
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="bg-white"
                    required
                  />
                </div>
              </div>

              {/* Lieu */}
              <div className="space-y-2">
                <Label htmlFor="location" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Lieu *
                </Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Adresse complète du lieu de réunion"
                  className="bg-white"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Informations complémentaires..."
                  rows={3}
                  className="bg-white resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Ordre du jour */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-indigo-500" />
                  Ordre du jour
                </CardTitle>
                <CardDescription>Résolutions à voter lors de l'assemblée</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addResolution}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {resolutions.map((resolution, index) => (
                <div
                  key={resolution.id}
                  className="p-4 rounded-lg border border-slate-200 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Résolution {index + 1}
                    </span>
                    {resolutions.length > 1 && (
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
                          <div>
                            <span className="font-medium">{option.label}</span>
                            <span className="text-muted-foreground text-xs ml-2">
                              {option.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1">
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Planifier l'assemblée
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}

