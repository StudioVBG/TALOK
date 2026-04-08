"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  Palette,
  Image,
  Type,
  Save,
  Loader2,
  Eye,
} from "lucide-react";

interface WhiteLabelConfig {
  id?: string;
  brand_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string | null;
  font_family: string;
  company_name: string;
  show_powered_by_talok: boolean;
  custom_email_sender: string | null;
}

interface BrandingEditorProps {
  config: WhiteLabelConfig | null;
  onSave: (config: Partial<WhiteLabelConfig>) => Promise<void>;
}

export function BrandingEditor({ config, onSave }: BrandingEditorProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState<Partial<WhiteLabelConfig>>({
    brand_name: config?.brand_name || "",
    logo_url: config?.logo_url || null,
    favicon_url: config?.favicon_url || null,
    primary_color: config?.primary_color || "#2563EB",
    secondary_color: config?.secondary_color || null,
    font_family: config?.font_family || "Manrope",
    company_name: config?.company_name || "",
    show_powered_by_talok: config?.show_powered_by_talok ?? true,
    custom_email_sender: config?.custom_email_sender || null,
  });

  const updateField = useCallback(<K extends keyof WhiteLabelConfig>(
    field: K,
    value: WhiteLabelConfig[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      toast({
        title: "Branding enregistre",
        description: "Vos modifications sont en ligne.",
      });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer les modifications.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Logo & Visual */}
      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="w-5 h-5 text-indigo-600" />
            Logo et identite visuelle
          </CardTitle>
          <CardDescription>
            Personnalisez le logo et les images de votre interface
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="brand_name">Nom de marque</Label>
              <Input
                id="brand_name"
                value={formData.brand_name || ""}
                onChange={(e) => updateField("brand_name", e.target.value)}
                placeholder="Mon Agence Immobiliere"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_name">Raison sociale</Label>
              <Input
                id="company_name"
                value={formData.company_name || ""}
                onChange={(e) => updateField("company_name", e.target.value)}
                placeholder="SARL Mon Agence"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo_url">URL du logo</Label>
              <Input
                id="logo_url"
                value={formData.logo_url || ""}
                onChange={(e) => updateField("logo_url", e.target.value || null)}
                placeholder="https://exemple.com/logo.png"
              />
              <p className="text-xs text-muted-foreground">
                Format recommande : PNG ou SVG, fond transparent, 200x60px min.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="favicon_url">URL du favicon</Label>
              <Input
                id="favicon_url"
                value={formData.favicon_url || ""}
                onChange={(e) => updateField("favicon_url", e.target.value || null)}
                placeholder="https://exemple.com/favicon.ico"
              />
              <p className="text-xs text-muted-foreground">
                Format : ICO ou PNG 32x32px
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Colors & Typography */}
      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-purple-600" />
            Couleurs et typographie
          </CardTitle>
          <CardDescription>
            Definissez les couleurs et la police de votre marque
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="primary_color">Couleur principale</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="primary_color"
                  value={formData.primary_color || "#2563EB"}
                  onChange={(e) => updateField("primary_color", e.target.value)}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                />
                <Input
                  value={formData.primary_color || "#2563EB"}
                  onChange={(e) => updateField("primary_color", e.target.value)}
                  className="flex-1 font-mono"
                  maxLength={7}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary_color">Couleur secondaire</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="secondary_color"
                  value={formData.secondary_color || "#7C3AED"}
                  onChange={(e) => updateField("secondary_color", e.target.value)}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                />
                <Input
                  value={formData.secondary_color || "#7C3AED"}
                  onChange={(e) => updateField("secondary_color", e.target.value || null)}
                  className="flex-1 font-mono"
                  maxLength={7}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="font_family">Police</Label>
              <div className="flex items-center gap-2">
                <Type className="w-5 h-5 text-muted-foreground" />
                <Input
                  id="font_family"
                  value={formData.font_family || "Manrope"}
                  onChange={(e) => updateField("font_family", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Color preview */}
          {showPreview && (
            <div className="mt-4 p-4 rounded-xl border">
              <p className="text-sm font-medium mb-3">Apercu</p>
              <div className="flex items-center gap-4">
                <div
                  className="w-20 h-10 rounded-lg"
                  style={{ backgroundColor: formData.primary_color || "#2563EB" }}
                />
                <div
                  className="w-20 h-10 rounded-lg"
                  style={{ backgroundColor: formData.secondary_color || "#7C3AED" }}
                />
                <Button
                  size="sm"
                  style={{ backgroundColor: formData.primary_color || "#2563EB" }}
                >
                  Bouton exemple
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Options */}
      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Options avancees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Afficher &quot;Powered by Talok&quot;</p>
              <p className="text-sm text-muted-foreground">
                Affiche une mention Talok en bas de page
              </p>
            </div>
            <Switch
              checked={formData.show_powered_by_talok ?? true}
              onCheckedChange={(v) => updateField("show_powered_by_talok", v)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom_email_sender">Email expediteur personnalise</Label>
            <Input
              id="custom_email_sender"
              type="email"
              value={formData.custom_email_sender || ""}
              onChange={(e) => updateField("custom_email_sender", e.target.value || null)}
              placeholder="noreply@monagence.fr"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setShowPreview(!showPreview)}
        >
          <Eye className="w-4 h-4 mr-2" />
          {showPreview ? "Masquer l'apercu" : "Apercu"}
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isSaving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}
