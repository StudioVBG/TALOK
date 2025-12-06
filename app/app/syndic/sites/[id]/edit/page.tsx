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
  ArrowLeft,
  Building2,
  MapPin,
  Save,
  Loader2,
  Home,
  Calendar,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Site {
  id: string;
  name: string;
  address: string;
  postal_code: string;
  city: string;
  description?: string;
  construction_year?: number;
  total_floors?: number;
  total_units?: number;
}

export default function EditSitePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const siteId = params.id as string;

  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchSite() {
      try {
        const response = await fetch(`/api/copro/sites/${siteId}`);
        if (response.ok) {
          const data = await response.json();
          setSite(data.site || data);
        }
      } catch (error) {
        console.error("Erreur chargement site:", error);
      } finally {
        setLoading(false);
      }
    }
    if (siteId) fetchSite();
  }, [siteId]);

  const handleSave = async () => {
    if (!site) return;

    if (!site.name || !site.address || !site.postal_code || !site.city) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/copro/sites/${siteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(site),
      });

      if (!response.ok) throw new Error("Erreur sauvegarde");

      toast({
        title: "Site mis à jour",
        description: "Les modifications ont été enregistrées.",
      });

      router.push(`/app/syndic/sites/${siteId}`);
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

  if (!site) {
    return (
      <div className="p-6">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="py-16 text-center">
            <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Site introuvable</h3>
            <Button asChild>
              <Link href="/app/syndic/sites">Retour aux sites</Link>
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
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/app/syndic/sites/${siteId}`}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au site
          </Link>
          <h1 className="text-2xl font-bold">Modifier le site</h1>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-500" />
              Informations du site
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Nom */}
            <div className="space-y-2">
              <Label htmlFor="name">Nom de la copropriété *</Label>
              <Input
                id="name"
                value={site.name}
                onChange={(e) => setSite({ ...site, name: e.target.value })}
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
                value={site.address}
                onChange={(e) => setSite({ ...site, address: e.target.value })}
                className="bg-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postal_code">Code postal *</Label>
                <Input
                  id="postal_code"
                  value={site.postal_code}
                  onChange={(e) => setSite({ ...site, postal_code: e.target.value })}
                  className="bg-white"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ville *</Label>
                <Input
                  id="city"
                  value={site.city}
                  onChange={(e) => setSite({ ...site, city: e.target.value })}
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
                  min="0"
                  value={site.total_units || ""}
                  onChange={(e) => setSite({ ...site, total_units: parseInt(e.target.value) || 0 })}
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_floors">Nombre d'étages</Label>
                <Input
                  id="total_floors"
                  type="number"
                  min="0"
                  value={site.total_floors || ""}
                  onChange={(e) => setSite({ ...site, total_floors: parseInt(e.target.value) || 0 })}
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
                  value={site.construction_year || ""}
                  onChange={(e) => setSite({ ...site, construction_year: parseInt(e.target.value) || undefined })}
                  className="bg-white"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={site.description || ""}
                onChange={(e) => setSite({ ...site, description: e.target.value })}
                rows={4}
                className="bg-white resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-4">
              <Button variant="outline" asChild>
                <Link href={`/app/syndic/sites/${siteId}`}>Annuler</Link>
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
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

