"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Building2,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Home,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Building {
  id: string;
  name: string;
  floors: string;
  units_count: string;
}

export default function SyndicOnboardingBuildingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const siteId = searchParams.get("siteId");

  const [loading, setLoading] = useState(false);
  const [buildings, setBuildings] = useState<Building[]>([
    { id: "1", name: "", floors: "", units_count: "" },
  ]);

  const addBuilding = () => {
    setBuildings([
      ...buildings,
      { id: Date.now().toString(), name: "", floors: "", units_count: "" },
    ]);
  };

  const removeBuilding = (id: string) => {
    if (buildings.length > 1) {
      setBuildings(buildings.filter((b) => b.id !== id));
    }
  };

  const updateBuilding = (id: string, field: keyof Building, value: string) => {
    setBuildings(
      buildings.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validBuildings = buildings.filter((b) => b.name.trim());
    if (validBuildings.length === 0) {
      toast({
        title: "Au moins un bâtiment",
        description: "Ajoutez au moins un bâtiment avec un nom.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/copro/buildings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_id: siteId,
          buildings: validBuildings.map((b) => ({
            name: b.name,
            floors: parseInt(b.floors) || 0,
            units_count: parseInt(b.units_count) || 0,
          })),
        }),
      });

      if (!response.ok) throw new Error("Erreur création");

      toast({
        title: "Bâtiments créés",
        description: "Passons à la configuration des tantièmes.",
      });

      router.push(`/app/syndic/onboarding/tantiemes?siteId=${siteId}`);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de créer les bâtiments.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.push(`/app/syndic/onboarding/tantiemes?siteId=${siteId}`);
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
            <span className="text-sm font-medium text-muted-foreground">Étape 2b sur 4</span>
            <span className="text-sm font-medium text-indigo-600">55%</span>
          </div>
          <Progress value={55} className="h-2" />
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 mb-4">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 bg-clip-text text-transparent">
            Bâtiments
          </h1>
          <p className="text-muted-foreground mt-2">
            Définissez les bâtiments de votre copropriété (optionnel)
          </p>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5 text-indigo-500" />
                Liste des bâtiments
              </CardTitle>
              <CardDescription>
                Si votre copropriété a plusieurs bâtiments, ajoutez-les ici
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addBuilding}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {buildings.map((building, index) => (
                <div
                  key={building.id}
                  className="p-4 rounded-lg border border-slate-200 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Bâtiment {index + 1}
                    </span>
                    {buildings.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeBuilding(building.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Nom du bâtiment</Label>
                    <Input
                      value={building.name}
                      onChange={(e) => updateBuilding(building.id, "name", e.target.value)}
                      placeholder="Ex: Bâtiment A, Tour Nord..."
                      className="bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nombre d'étages</Label>
                      <Input
                        type="number"
                        min="0"
                        value={building.floors}
                        onChange={(e) => updateBuilding(building.id, "floors", e.target.value)}
                        placeholder="6"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nombre de lots</Label>
                      <Input
                        type="number"
                        min="0"
                        value={building.units_count}
                        onChange={(e) => updateBuilding(building.id, "units_count", e.target.value)}
                        placeholder="24"
                        className="bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Actions */}
              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/app/syndic/onboarding/site`)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Retour
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={handleSkip}>
                    Passer cette étape
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        Continuer
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

