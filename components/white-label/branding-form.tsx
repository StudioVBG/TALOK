"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Palette,
  Mail,
  Globe,
  Code,
  Key,
  Save,
  RotateCcw,
  Eye,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ColorPicker } from "./color-picker";
import { LogoUpload } from "./logo-upload";
import { FeatureGate, FeatureBadge } from "./feature-gate";
import {
  WhiteLabelLevel,
  OrganizationBranding,
  hasWhiteLabelFeature,
  WHITE_LABEL_LEVEL_INFO,
  DEFAULT_BRANDING,
} from "@/lib/white-label/types";

interface BrandingFormProps {
  branding: Partial<OrganizationBranding>;
  level: WhiteLabelLevel;
  organizationId: string;
  onSave: (updates: Partial<OrganizationBranding>) => Promise<void>;
  onUploadAsset: (type: string, file: File) => Promise<string>;
  onUpgrade?: () => void;
  className?: string;
}

export function BrandingForm({
  branding,
  level,
  organizationId,
  onSave,
  onUploadAsset,
  onUpgrade,
  className,
}: BrandingFormProps) {
  const [formData, setFormData] = useState<Partial<OrganizationBranding>>({
    ...DEFAULT_BRANDING,
    ...branding,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState("identity");

  // Détecter les changements
  useEffect(() => {
    const changed = JSON.stringify(formData) !== JSON.stringify({ ...DEFAULT_BRANDING, ...branding });
    setHasChanges(changed);
  }, [formData, branding]);

  const updateField = useCallback(
    <K extends keyof OrganizationBranding>(
      field: K,
      value: OrganizationBranding[K]
    ) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  }, [formData, onSave]);

  const handleReset = useCallback(() => {
    setFormData({ ...DEFAULT_BRANDING, ...branding });
  }, [branding]);

  const handleLogoUpload = useCallback(
    async (type: string) => async (file: File) => {
      const url = await onUploadAsset(type, file);
      const fieldMap: Record<string, keyof OrganizationBranding> = {
        logo: "logo_url",
        logo_dark: "logo_dark_url",
        favicon: "favicon_url",
        login_bg: "login_background_url",
        email_logo: "email_logo_url",
      };
      updateField(fieldMap[type], url);
      return url;
    },
    [onUploadAsset, updateField]
  );

  const levelInfo = WHITE_LABEL_LEVEL_INFO[level];

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header avec niveau actuel */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Configuration White-Label
          </h2>
          <p className="text-sm text-slate-500">
            Personnalisez l'apparence de votre plateforme
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={cn(
              "px-3 py-1",
              level === "premium"
                ? "border-violet-500 text-violet-600 bg-violet-50"
                : level === "full"
                ? "border-blue-500 text-blue-600 bg-blue-50"
                : level === "basic"
                ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                : "border-slate-300 text-slate-500"
            )}
          >
            {levelInfo.label}
          </Badge>

          {level !== "premium" && onUpgrade && (
            <Button variant="outline" size="sm" onClick={onUpgrade}>
              Upgrade
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="identity" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Identité</span>
          </TabsTrigger>
          <TabsTrigger value="colors" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">Couleurs</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            <span className="hidden sm:inline">Emails</span>
          </TabsTrigger>
          <TabsTrigger value="domain" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">Domaine</span>
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <Code className="w-4 h-4" />
            <span className="hidden sm:inline">Avancé</span>
          </TabsTrigger>
        </TabsList>

        {/* Identité */}
        <TabsContent value="identity" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Identité de marque</CardTitle>
              <CardDescription>
                Nom, logo et informations de base de votre entreprise
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Nom de l'entreprise */}
              <FeatureGate
                feature="company_name"
                currentLevel={level}
                onUpgrade={onUpgrade}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Nom de l'entreprise</Label>
                    <FeatureBadge feature="company_name" currentLevel={level} />
                  </div>
                  <Input
                    value={formData.company_name || ""}
                    onChange={(e) => updateField("company_name", e.target.value)}
                    placeholder="Votre entreprise"
                  />
                </div>
              </FeatureGate>

              {/* Tagline */}
              <FeatureGate
                feature="company_name"
                currentLevel={level}
                onUpgrade={onUpgrade}
              >
                <div className="space-y-2">
                  <Label>Slogan (optionnel)</Label>
                  <Input
                    value={formData.tagline || ""}
                    onChange={(e) => updateField("tagline", e.target.value)}
                    placeholder="Votre slogan"
                  />
                </div>
              </FeatureGate>

              <Separator />

              {/* Logo principal */}
              <FeatureGate
                feature="custom_logo"
                currentLevel={level}
                onUpgrade={onUpgrade}
              >
                <div className="grid md:grid-cols-2 gap-6">
                  <LogoUpload
                    value={formData.logo_url}
                    onChange={(url) => updateField("logo_url", url)}
                    onUpload={handleLogoUpload("logo")}
                    label="Logo principal"
                    description="Utilisé dans la navigation et les documents"
                    previewSize="md"
                  />

                  <LogoUpload
                    value={formData.logo_dark_url}
                    onChange={(url) => updateField("logo_dark_url", url)}
                    onUpload={handleLogoUpload("logo_dark")}
                    label="Logo (mode sombre)"
                    description="Version pour le thème sombre"
                    previewSize="md"
                  />
                </div>
              </FeatureGate>

              {/* Favicon */}
              <FeatureGate
                feature="custom_favicon"
                currentLevel={level}
                onUpgrade={onUpgrade}
              >
                <LogoUpload
                  value={formData.favicon_url}
                  onChange={(url) => updateField("favicon_url", url)}
                  onUpload={handleLogoUpload("favicon")}
                  label="Favicon"
                  description="Icône affichée dans les onglets du navigateur (32x32px recommandé)"
                  previewSize="sm"
                  aspectRatio="square"
                />
              </FeatureGate>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Couleurs */}
        <TabsContent value="colors" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Palette de couleurs</CardTitle>
              <CardDescription>
                Personnalisez les couleurs de votre interface
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Couleur principale */}
              <FeatureGate
                feature="primary_color"
                currentLevel={level}
                onUpgrade={onUpgrade}
              >
                <ColorPicker
                  value={formData.primary_color || DEFAULT_BRANDING.primary_color!}
                  onChange={(color) => updateField("primary_color", color)}
                  label="Couleur principale"
                  description="Couleur des boutons, liens et éléments principaux"
                  defaultValue={DEFAULT_BRANDING.primary_color}
                />
              </FeatureGate>

              {/* Couleur secondaire */}
              <FeatureGate
                feature="secondary_color"
                currentLevel={level}
                onUpgrade={onUpgrade}
              >
                <ColorPicker
                  value={formData.secondary_color || DEFAULT_BRANDING.secondary_color!}
                  onChange={(color) => updateField("secondary_color", color)}
                  label="Couleur secondaire"
                  description="Utilisée pour les éléments secondaires et accents"
                  defaultValue={DEFAULT_BRANDING.secondary_color}
                />
              </FeatureGate>

              {/* Couleur d'accent */}
              <FeatureGate
                feature="accent_color"
                currentLevel={level}
                onUpgrade={onUpgrade}
              >
                <ColorPicker
                  value={formData.accent_color || DEFAULT_BRANDING.accent_color!}
                  onChange={(color) => updateField("accent_color", color)}
                  label="Couleur d'accent"
                  description="Pour les notifications de succès et validations"
                  defaultValue={DEFAULT_BRANDING.accent_color}
                />
              </FeatureGate>

              {/* Prévisualisation */}
              <Separator />
              <div className="space-y-3">
                <Label>Prévisualisation</Label>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-lg"
                      style={{ backgroundColor: formData.primary_color }}
                    />
                    <div>
                      <p className="font-semibold" style={{ color: formData.primary_color }}>
                        {formData.company_name || "Votre entreprise"}
                      </p>
                      <p className="text-sm text-slate-500">
                        {formData.tagline || "Votre slogan"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      style={{ backgroundColor: formData.primary_color }}
                    >
                      Bouton principal
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      style={{
                        borderColor: formData.secondary_color,
                        color: formData.secondary_color,
                      }}
                    >
                      Secondaire
                    </Button>
                    <Badge style={{ backgroundColor: formData.accent_color }}>
                      Succès
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Emails */}
        <TabsContent value="email" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration des emails</CardTitle>
              <CardDescription>
                Personnalisez l'apparence des emails envoyés à vos utilisateurs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email expéditeur */}
              <FeatureGate
                feature="custom_email_from"
                currentLevel={level}
                onUpgrade={onUpgrade}
              >
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom de l'expéditeur</Label>
                    <Input
                      value={formData.email_from_name || ""}
                      onChange={(e) => updateField("email_from_name", e.target.value)}
                      placeholder="Support Mon Entreprise"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Adresse email</Label>
                    <Input
                      type="email"
                      value={formData.email_from_address || ""}
                      onChange={(e) => updateField("email_from_address", e.target.value)}
                      placeholder="noreply@monentreprise.com"
                    />
                  </div>
                </div>
              </FeatureGate>

              {/* Reply-to */}
              <FeatureGate
                feature="custom_email_footer"
                currentLevel={level}
                onUpgrade={onUpgrade}
              >
                <div className="space-y-2">
                  <Label>Adresse de réponse</Label>
                  <Input
                    type="email"
                    value={formData.email_reply_to || ""}
                    onChange={(e) => updateField("email_reply_to", e.target.value)}
                    placeholder="support@monentreprise.com"
                  />
                </div>
              </FeatureGate>

              <Separator />

              {/* Logo email */}
              <FeatureGate
                feature="custom_email_logo"
                currentLevel={level}
                onUpgrade={onUpgrade}
              >
                <LogoUpload
                  value={formData.email_logo_url}
                  onChange={(url) => updateField("email_logo_url", url)}
                  onUpload={handleLogoUpload("email_logo")}
                  label="Logo dans les emails"
                  description="Logo affiché en haut des emails (max 200px de large)"
                  previewSize="md"
                  aspectRatio="wide"
                />
              </FeatureGate>

              {/* Couleur email */}
              <FeatureGate
                feature="custom_email_colors"
                currentLevel={level}
                onUpgrade={onUpgrade}
              >
                <ColorPicker
                  value={formData.email_primary_color || formData.primary_color || DEFAULT_BRANDING.email_primary_color!}
                  onChange={(color) => updateField("email_primary_color", color)}
                  label="Couleur principale des emails"
                  description="Couleur des boutons et liens dans les emails"
                  defaultValue={DEFAULT_BRANDING.email_primary_color}
                />
              </FeatureGate>

              {/* Footer personnalisé */}
              <FeatureGate
                feature="custom_email_footer"
                currentLevel={level}
                onUpgrade={onUpgrade}
              >
                <div className="space-y-2">
                  <Label>Pied de page personnalisé (HTML)</Label>
                  <Textarea
                    value={formData.email_footer_html || ""}
                    onChange={(e) => updateField("email_footer_html", e.target.value)}
                    placeholder="<p>© 2026 Mon Entreprise - Tous droits réservés</p>"
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>
              </FeatureGate>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Domaine */}
        <TabsContent value="domain" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Domaine personnalisé</CardTitle>
              <CardDescription>
                Utilisez votre propre domaine pour accéder à la plateforme
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FeatureGate
                feature="custom_domain"
                currentLevel={level}
                onUpgrade={onUpgrade}
              >
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    La configuration des domaines personnalisés se fait dans la section dédiée.
                    Vous pourrez y ajouter vos domaines et suivre leur vérification.
                  </p>
                  <Button variant="outline">
                    <Globe className="w-4 h-4 mr-2" />
                    Gérer les domaines
                  </Button>
                </div>
              </FeatureGate>

              <Separator className="my-6" />

              {/* Page de connexion */}
              <FeatureGate
                feature="branded_login_page"
                currentLevel={level}
                onUpgrade={onUpgrade}
              >
                <div className="space-y-4">
                  <h4 className="font-medium">Page de connexion personnalisée</h4>

                  <LogoUpload
                    value={formData.login_background_url}
                    onChange={(url) => updateField("login_background_url", url)}
                    onUpload={handleLogoUpload("login_bg")}
                    label="Image de fond"
                    description="Image affichée sur la page de connexion"
                    previewSize="lg"
                    aspectRatio="wide"
                  />

                  <ColorPicker
                    value={formData.login_background_color || "#f8fafc"}
                    onChange={(color) => updateField("login_background_color", color)}
                    label="Couleur de fond alternative"
                    description="Utilisée si aucune image n'est définie"
                    defaultValue="#f8fafc"
                  />
                </div>
              </FeatureGate>

              <Separator className="my-6" />

              {/* Remove powered by */}
              <FeatureGate
                feature="remove_powered_by"
                currentLevel={level}
                onUpgrade={onUpgrade}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Supprimer "Powered by Talok"</Label>
                    <p className="text-sm text-slate-500">
                      Retire toute mention de Talok dans l'interface
                    </p>
                  </div>
                  <Switch
                    checked={formData.remove_powered_by || false}
                    onCheckedChange={(checked) => updateField("remove_powered_by", checked)}
                  />
                </div>
              </FeatureGate>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Avancé */}
        <TabsContent value="advanced" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Options avancées</CardTitle>
              <CardDescription>
                Configuration CSS personnalisé et SSO
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* CSS personnalisé */}
              <FeatureGate
                feature="custom_css"
                currentLevel={level}
                onUpgrade={onUpgrade}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>CSS personnalisé</Label>
                    <FeatureBadge feature="custom_css" currentLevel={level} />
                  </div>
                  <Textarea
                    value={formData.custom_css || ""}
                    onChange={(e) => updateField("custom_css", e.target.value)}
                    placeholder={`:root {\n  --custom-variable: #000;\n}\n\n.my-custom-class {\n  /* styles */\n}`}
                    rows={10}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500">
                    CSS injecté sur toutes les pages. Utilisez avec précaution.
                  </p>
                </div>
              </FeatureGate>

              <Separator />

              {/* SSO */}
              <FeatureGate
                feature="sso_saml"
                currentLevel={level}
                onUpgrade={onUpgrade}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Single Sign-On (SSO)</Label>
                      <p className="text-sm text-slate-500">
                        Permet à vos utilisateurs de se connecter via votre fournisseur d'identité
                      </p>
                    </div>
                    <Switch
                      checked={formData.sso_enabled || false}
                      onCheckedChange={(checked) => updateField("sso_enabled", checked)}
                    />
                  </div>

                  {formData.sso_enabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-4 pt-4"
                    >
                      <div className="space-y-2">
                        <Label>Type de SSO</Label>
                        <div className="flex gap-4">
                          <Button
                            variant={formData.sso_provider === "saml" ? "default" : "outline"}
                            onClick={() => updateField("sso_provider", "saml")}
                          >
                            SAML 2.0
                          </Button>
                          <Button
                            variant={formData.sso_provider === "oidc" ? "default" : "outline"}
                            onClick={() => updateField("sso_provider", "oidc")}
                          >
                            OpenID Connect
                          </Button>
                        </div>
                      </div>

                      <p className="text-sm text-slate-600">
                        La configuration SSO complète nécessite des informations techniques
                        de votre fournisseur d'identité. Contactez notre support pour l'assistance.
                      </p>
                    </motion.div>
                  )}
                </div>
              </FeatureGate>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex items-center justify-between sticky bottom-0 bg-white py-4 border-t border-slate-200">
        <div className="text-sm text-slate-500">
          {hasChanges ? (
            <span className="text-amber-600">Modifications non enregistrées</span>
          ) : (
            "Aucune modification"
          )}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || isSaving}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Réinitialiser
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}

export default BrandingForm;
