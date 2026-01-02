"use client";
// @ts-nocheck

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Building2,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Home,
  Calendar,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function SyndicOnboardingSitePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    address: "",
    postal_code: "",
    city: "",
    construction_year: "",
    total_units: "",
    total_floors: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name || !form.address || !form.postal_code || !form.city) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/copro/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          total_units: parseInt(form.total_units) || 0,
          total_floors: parseInt(form.total_floors) || 0,
          construction_year: parseInt(form.construction_year) || null,
        }),
      });

      if (!response.ok) throw new Error("Erreur création");

      const data = await response.json();

      toast({
        title: "Site créé",
        description: "Passons à l'ajout des lots.",
      });

      // Passer à l'étape suivante avec l'ID du site
      router.push(`/syndic/onboarding/units?siteId=${data.site?.id || data.id}`);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de créer le site.",
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
      className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50 p-6"
    >
      <div className="max-w-2xl mx-auto">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Étape 2 sur 4</span>
            <span className="text-sm font-medium text-indigo-600">50%</span>
          </div>
          <Progress value={50} className="h-2" />
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 mb-4">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 bg-clip-text text-transparent">
            Ajoutez votre premier site
          </h1>
          <p className="text-muted-foreground mt-2">
            Créez la fiche de votre première copropriété
          </p>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5 text-indigo-500" />
              Informations de la copropriété
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nom */}
              <div className="space-y-2">
                <Label htmlFor="name">Nom de la copropriété *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Résidence Les Jardins"
                  className="bg-white"
                  required
                />
              </div>

              {/* Adresse */}
              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Adresse *
                </Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="123 avenue de la République"
                  className="bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Code postal *</Label>
                  <Input
                    id="postal_code"
                    value={form.postal_code}
                    onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                    placeholder="75011"
                    className="bg-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ville *</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Paris"
                    className="bg-white"
                    required
                  />
                </div>
              </div>

              {/* Caractéristiques */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="total_units" className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-muted-foreground" />
                    Nombre de lots
                  </Label>
                  <Input
                    id="total_units"
                    type="number"
                    min="1"
                    value={form.total_units}
                    onChange={(e) => setForm({ ...form, total_units: e.target.value })}
                    placeholder="24"
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_floors">Nombre d'étages</Label>
                  <Input
                    id="total_floors"
                    type="number"
                    min="0"
                    value={form.total_floors}
                    onChange={(e) => setForm({ ...form, total_floors: e.target.value })}
                    placeholder="6"
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="construction_year" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Année
                  </Label>
                  <Input
                    id="construction_year"
                    type="number"
                    min="1800"
                    max="2030"
                    value={form.construction_year}
                    onChange={(e) => setForm({ ...form, construction_year: e.target.value })}
                    placeholder="1985"
                    className="bg-white"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Informations complémentaires sur la copropriété..."
                  rows={3}
                  className="bg-white resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/syndic/onboarding/profile")}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Retour
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      Continuer
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

