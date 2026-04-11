"use client";

import { useState, useEffect, useRef } from "react";
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
  CalendarIcon,
  Loader2,
  MapPin,
  Save,
  Video,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

type AssemblyType = "ordinaire" | "extraordinaire" | "concertation" | "consultation_ecrite";

const ASSEMBLY_TYPES: { value: AssemblyType; label: string }[] = [
  { value: "ordinaire", label: "AG Ordinaire" },
  { value: "extraordinaire", label: "AG Extraordinaire" },
  { value: "concertation", label: "Concertation" },
  { value: "consultation_ecrite", label: "Consultation écrite" },
];

export default function EditAssemblyPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const isSubmittingRef = useRef(false);

  const assemblyId = params?.id as string;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string>("draft");

  const [form, setForm] = useState({
    assembly_type: "ordinaire" as AssemblyType,
    title: "",
    scheduled_date: "",
    scheduled_time: "18:00",
    location: "",
    location_address: "",
    online_meeting_url: "",
    is_hybrid: false,
    quorum_required: "",
    fiscal_year: "",
    description: "",
    notes: "",
  });

  useEffect(() => {
    if (!assemblyId) return;

    const loadAssembly = async () => {
      try {
        const res = await fetch(`/api/copro/assemblies/${assemblyId}`);
        if (!res.ok) {
          if (res.status === 404) {
            toast({ title: "Assemblée introuvable", variant: "destructive" });
            router.push("/syndic/assemblies");
            return;
          }
          throw new Error("Erreur de chargement");
        }

        const data = await res.json();
        const assembly = data.assembly;

        if (!["draft", "convened"].includes(assembly.status)) {
          toast({
            title: "Modification impossible",
            description: `Les assemblées en statut '${assembly.status}' ne peuvent plus être modifiées`,
            variant: "destructive",
          });
          router.push(`/syndic/assemblies/${assemblyId}`);
          return;
        }

        setStatus(assembly.status);
        const scheduledDate = new Date(assembly.scheduled_at);
        setForm({
          assembly_type: assembly.assembly_type,
          title: assembly.title,
          scheduled_date: scheduledDate.toISOString().split("T")[0],
          scheduled_time: scheduledDate.toTimeString().slice(0, 5),
          location: assembly.location || "",
          location_address: assembly.location_address || "",
          online_meeting_url: assembly.online_meeting_url || "",
          is_hybrid: assembly.is_hybrid || false,
          quorum_required: assembly.quorum_required?.toString() || "",
          fiscal_year: assembly.fiscal_year?.toString() || "",
          description: assembly.description || "",
          notes: assembly.notes || "",
        });
      } catch (error) {
        toast({
          title: "Erreur",
          description: error instanceof Error ? error.message : "Impossible de charger",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadAssembly();
  }, [assemblyId, router, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    if (!form.title || form.title.length < 3) {
      toast({ title: "Titre trop court", variant: "destructive" });
      return;
    }
    if (!form.scheduled_date) {
      toast({ title: "Date requise", variant: "destructive" });
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      const scheduledAt = new Date(`${form.scheduled_date}T${form.scheduled_time}:00`).toISOString();

      const payload = {
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

      const res = await fetch(`/api/copro/assemblies/${assemblyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de la sauvegarde");
      }

      toast({ title: "Assemblée mise à jour" });
      router.push(`/syndic/assemblies/${assemblyId}`);
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de sauvegarder",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-12 w-96 bg-white/10" />
          <Skeleton className="h-64 bg-white/10" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <Link href={`/syndic/assemblies/${assemblyId}`}>
            <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <CalendarIcon className="h-6 w-6 text-violet-400" />
              Modifier l'assemblée
            </h1>
            <p className="text-slate-400">Statut actuel : {status === "draft" ? "Brouillon" : "Convoquée"}</p>
          </div>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="bg-white/5 border-white/10 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Type *</Label>
                <Select
                  value={form.assembly_type}
                  onValueChange={(value: AssemblyType) => setForm({ ...form, assembly_type: value })}
                  disabled={submitting}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSEMBLY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title" className="text-slate-300">
                  Titre *
                </Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  disabled={submitting}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Date *</Label>
                  <Input
                    type="date"
                    value={form.scheduled_date}
                    onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                    required
                    disabled={submitting}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Heure *</Label>
                  <Input
                    type="time"
                    value={form.scheduled_time}
                    onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                    required
                    disabled={submitting}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Exercice</Label>
                  <Input
                    type="number"
                    min="2020"
                    max="2100"
                    value={form.fiscal_year}
                    onChange={(e) => setForm({ ...form, fiscal_year: e.target.value })}
                    disabled={submitting}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Quorum (tantièmes)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.quorum_required}
                    onChange={(e) => setForm({ ...form, quorum_required: e.target.value })}
                    disabled={submitting}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <MapPin className="h-5 w-5 text-violet-400" />
                Lieu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Lieu</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  disabled={submitting}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Adresse</Label>
                <Input
                  value={form.location_address}
                  onChange={(e) => setForm({ ...form, location_address: e.target.value })}
                  disabled={submitting}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300 flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Lien visio
                </Label>
                <Input
                  type="url"
                  value={form.online_meeting_url}
                  onChange={(e) => setForm({ ...form, online_meeting_url: e.target.value })}
                  disabled={submitting}
                  className="bg-white/5 border-white/10 text-white"
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
                <Label htmlFor="is_hybrid" className="text-slate-300 cursor-pointer">
                  Assemblée hybride
                </Label>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 backdrop-blur">
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  disabled={submitting}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Notes internes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  disabled={submitting}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Link href={`/syndic/assemblies/${assemblyId}`}>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Annuler
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
