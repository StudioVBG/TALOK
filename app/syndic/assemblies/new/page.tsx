"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
  Building2,
  CalendarIcon,
  Loader2,
  MapPin,
  Save,
  Video,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Site {
  id: string;
  name: string;
  address_line1?: string;
  postal_code?: string;
  city?: string;
  total_tantiemes_general?: number;
}

const ASSEMBLY_TYPES = [
  { value: "ordinaire", label: "AG Ordinaire", description: "Assemblée annuelle obligatoire" },
  { value: "extraordinaire", label: "AG Extraordinaire", description: "Assemblée exceptionnelle" },
  {
    value: "concertation",
    label: "Concertation",
    description: "Réunion sans vote (information, consultation)",
  },
  {
    value: "consultation_ecrite",
    label: "Consultation écrite",
    description: "Vote par correspondance sans réunion",
  },
];

export default function NewAssemblyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const isSubmittingRef = useRef(false);

  const [loadingSites, setLoadingSites] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);

  const [form, setForm] = useState({
    site_id: "",
    assembly_type: "ordinaire" as "ordinaire" | "extraordinaire" | "concertation" | "consultation_ecrite",
    title: "",
    scheduled_date: "",
    scheduled_time: "18:00",
    location: "",
    location_address: "",
    online_meeting_url: "",
    is_hybrid: false,
    quorum_required: "",
    fiscal_year: new Date().getFullYear().toString(),
    description: "",
    notes: "",
  });

  useEffect(() => {
    const loadSites = async () => {
      try {
        const res = await fetch("/api/copro/sites");
        if (!res.ok) throw new Error("Impossible de charger les sites");
        const data = await res.json();
        setSites(Array.isArray(data) ? data : []);
      } catch (error) {
        toast({
          title: "Erreur",
          description: error instanceof Error ? error.message : "Erreur de chargement",
          variant: "destructive",
        });
      } finally {
        setLoadingSites(false);
      }
    };
    loadSites();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    // Validations
    if (!form.site_id) {
      toast({ title: "Site requis", description: "Sélectionnez une copropriété", variant: "destructive" });
      return;
    }
    if (!form.title || form.title.length < 3) {
      toast({ title: "Titre requis", description: "Au moins 3 caractères", variant: "destructive" });
      return;
    }
    if (!form.scheduled_date) {
      toast({ title: "Date requise", description: "Choisissez une date", variant: "destructive" });
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      const scheduledAt = new Date(`${form.scheduled_date}T${form.scheduled_time}:00`).toISOString();

      const payload = {
        site_id: form.site_id,
        assembly_type: form.assembly_type,
        title: form.title.trim(),
        scheduled_at: scheduledAt,
        fiscal_year: form.fiscal_year ? parseInt(form.fiscal_year, 10) : undefined,
        location: form.location.trim() || undefined,
        location_address: form.location_address.trim() || undefined,
        online_meeting_url: form.online_meeting_url.trim() || undefined,
        is_hybrid: form.is_hybrid,
        quorum_required: form.quorum_required ? parseInt(form.quorum_required, 10) : undefined,
        description: form.description.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };

      const res = await fetch("/api/copro/assemblies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de la création");
      }

      const assembly = await res.json();

      toast({
        title: "Assemblée créée",
        description: `${assembly.reference_number || assembly.title} a été créée en brouillon`,
      });

      router.push(`/syndic/assemblies/${assembly.id}`);
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de créer l'assemblée",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="p-0">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <Link href="/syndic/assemblies">
            <Button variant="ghost" size="sm" className="text-foreground hover:text-foreground hover:bg-muted">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <CalendarIcon className="h-6 w-6 text-violet-600" />
              Nouvelle assemblée générale
            </h1>
            <p className="text-muted-foreground">Créez une AG en brouillon — vous pourrez ensuite ajouter les résolutions</p>
          </div>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Site selection */}
          <Card className="">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Building2 className="h-5 w-5 text-violet-600" />
                Copropriété
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Choisissez la copropriété concernée
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="site_id" className="text-foreground">
                Site *
              </Label>
              {loadingSites ? (
                <div className="text-muted-foreground text-sm">Chargement des sites...</div>
              ) : sites.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-500/10 p-3 text-sm text-amber-100">
                  Aucune copropriété disponible.{" "}
                  <Link href="/syndic/sites" className="underline">
                    Créez votre premier site
                  </Link>
                </div>
              ) : (
                <Select
                  value={form.site_id}
                  onValueChange={(value) => setForm({ ...form, site_id: value })}
                  disabled={submitting}
                >
                  <SelectTrigger id="site_id" className=" text-foreground">
                    <SelectValue placeholder="Sélectionner une copropriété" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                        {site.city && ` — ${site.city}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* Type & title */}
          <Card className="">
            <CardHeader>
              <CardTitle className="text-foreground">Nature de l'assemblée</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Type *</Label>
                <Select
                  value={form.assembly_type}
                  onValueChange={(value: typeof form.assembly_type) => setForm({ ...form, assembly_type: value })}
                  disabled={submitting}
                >
                  <SelectTrigger className=" text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSEMBLY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title" className="text-foreground">
                  Titre *
                </Label>
                <Input
                  id="title"
                  placeholder="Ex: AG Annuelle 2026"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  disabled={submitting}
                  className=" text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduled_date" className="text-foreground">
                    Date *
                  </Label>
                  <Input
                    id="scheduled_date"
                    type="date"
                    value={form.scheduled_date}
                    onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                    required
                    disabled={submitting}
                    className=" text-foreground"
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduled_time" className="text-foreground">
                    Heure *
                  </Label>
                  <Input
                    id="scheduled_time"
                    type="time"
                    value={form.scheduled_time}
                    onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                    required
                    disabled={submitting}
                    className=" text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fiscal_year" className="text-foreground">
                    Exercice concerné
                  </Label>
                  <Input
                    id="fiscal_year"
                    type="number"
                    min="2020"
                    max="2100"
                    value={form.fiscal_year}
                    onChange={(e) => setForm({ ...form, fiscal_year: e.target.value })}
                    disabled={submitting}
                    className=" text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quorum_required" className="text-foreground">
                    Quorum requis (tantièmes)
                  </Label>
                  <Input
                    id="quorum_required"
                    type="number"
                    min="0"
                    placeholder="Optionnel"
                    value={form.quorum_required}
                    onChange={(e) => setForm({ ...form, quorum_required: e.target.value })}
                    disabled={submitting}
                    className=" text-foreground"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card className="">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <MapPin className="h-5 w-5 text-violet-600" />
                Lieu et modalités
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location" className="text-foreground">
                  Lieu (description courte)
                </Label>
                <Input
                  id="location"
                  placeholder="Ex: Salle polyvalente"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  disabled={submitting}
                  className=" text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location_address" className="text-foreground">
                  Adresse complète
                </Label>
                <Input
                  id="location_address"
                  placeholder="12 rue des Lilas, 75001 Paris"
                  value={form.location_address}
                  onChange={(e) => setForm({ ...form, location_address: e.target.value })}
                  disabled={submitting}
                  className=" text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="online_meeting_url" className="text-foreground flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Lien visio (optionnel)
                </Label>
                <Input
                  id="online_meeting_url"
                  type="url"
                  placeholder="https://meet.google.com/..."
                  value={form.online_meeting_url}
                  onChange={(e) => setForm({ ...form, online_meeting_url: e.target.value })}
                  disabled={submitting}
                  className=" text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="is_hybrid"
                  type="checkbox"
                  checked={form.is_hybrid}
                  onChange={(e) => setForm({ ...form, is_hybrid: e.target.checked })}
                  disabled={submitting}
                  className="h-4 w-4 rounded border-white/30 bg-transparent"
                />
                <Label htmlFor="is_hybrid" className="text-foreground cursor-pointer">
                  Assemblée hybride (présentiel + visio)
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card className="">
            <CardHeader>
              <CardTitle className="text-foreground">Description et notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description" className="text-foreground">
                  Description (publique)
                </Label>
                <Textarea
                  id="description"
                  placeholder="Contexte de l'assemblée, sujets principaux..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  disabled={submitting}
                  className=" text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-foreground">
                  Notes internes (privées)
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Notes privées non visibles des copropriétaires"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  disabled={submitting}
                  className=" text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Link href="/syndic/assemblies">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                className="border-input text-foreground hover:bg-muted"
              >
                Annuler
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={submitting || loadingSites || sites.length === 0}
              className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Créer l'assemblée
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
