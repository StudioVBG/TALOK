"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Palette,
  Mail,
  Globe,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ColorPicker } from "./color-picker";
import { LogoUpload } from "./logo-upload";
import { LivePreview } from "./live-preview";
import {
  OrganizationBranding,
  WhiteLabelLevel,
  DEFAULT_BRANDING,
  hasWhiteLabelFeature,
} from "@/lib/white-label/types";

// ============================================
// TYPES
// ============================================

interface SetupWizardProps {
  level: WhiteLabelLevel;
  onComplete: (branding: Partial<OrganizationBranding>) => Promise<void>;
  onUploadAsset: (type: string, file: File) => Promise<string>;
  onSkip?: () => void;
  className?: string;
}

type Step = "welcome" | "identity" | "colors" | "email" | "preview" | "complete";

const STEPS: { id: Step; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: "welcome",
    label: "Bienvenue",
    icon: <Sparkles className="w-5 h-5" />,
    description: "Configuration de votre marque",
  },
  {
    id: "identity",
    label: "Identité",
    icon: <Building2 className="w-5 h-5" />,
    description: "Logo et nom",
  },
  {
    id: "colors",
    label: "Couleurs",
    icon: <Palette className="w-5 h-5" />,
    description: "Palette de couleurs",
  },
  {
    id: "email",
    label: "Emails",
    icon: <Mail className="w-5 h-5" />,
    description: "Configuration emails",
  },
  {
    id: "preview",
    label: "Aperçu",
    icon: <Globe className="w-5 h-5" />,
    description: "Vérification finale",
  },
  {
    id: "complete",
    label: "Terminé",
    icon: <Check className="w-5 h-5" />,
    description: "Configuration terminée",
  },
];

// ============================================
// COMPONENT
// ============================================

export function SetupWizard({
  level,
  onComplete,
  onUploadAsset,
  onSkip,
  className,
}: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [branding, setBranding] = useState<Partial<OrganizationBranding>>({
    ...DEFAULT_BRANDING,
  });
  const [isLoading, setIsLoading] = useState(false);

  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const updateBranding = useCallback(
    <K extends keyof OrganizationBranding>(field: K, value: OrganizationBranding[K]) => {
      setBranding((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleNext = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  }, [currentStepIndex]);

  const handlePrev = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  }, [currentStepIndex]);

  const handleComplete = useCallback(async () => {
    setIsLoading(true);
    try {
      await onComplete(branding);
      setCurrentStep("complete");
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setIsLoading(false);
    }
  }, [branding, onComplete]);

  const handleLogoUpload = useCallback(
    (type: string) => async (file: File) => {
      const url = await onUploadAsset(type, file);
      if (type === "logo") {
        updateBranding("logo_url", url);
      } else if (type === "email_logo") {
        updateBranding("email_logo_url", url);
      }
      return url;
    },
    [onUploadAsset, updateBranding]
  );

  return (
    <div className={cn("max-w-4xl mx-auto", className)}>
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-500">
            Étape {currentStepIndex + 1} sur {STEPS.length}
          </span>
          <span className="text-sm font-medium text-slate-700">
            {Math.round(progress)}%
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-between mb-8 px-4">
        {STEPS.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              "flex items-center",
              index < STEPS.length - 1 && "flex-1"
            )}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                index < currentStepIndex
                  ? "bg-green-500 text-white"
                  : index === currentStepIndex
                  ? "bg-blue-500 text-white"
                  : "bg-slate-100 text-slate-400"
              )}
            >
              {index < currentStepIndex ? (
                <Check className="w-5 h-5" />
              ) : (
                step.icon
              )}
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-1 mx-2 rounded",
                  index < currentStepIndex ? "bg-green-500" : "bg-slate-200"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl border border-slate-200 p-8"
        >
          {/* Welcome */}
          {currentStep === "welcome" && (
            <div className="text-center max-w-md mx-auto">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">
                Bienvenue dans la configuration White-Label
              </h2>
              <p className="text-slate-600 mb-8">
                En quelques étapes, personnalisez votre plateforme avec votre identité visuelle.
                Vos utilisateurs verront votre marque, pas la nôtre.
              </p>
              <div className="flex flex-col gap-3">
                <Button size="lg" onClick={handleNext} className="w-full">
                  Commencer la configuration
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                {onSkip && (
                  <Button variant="ghost" onClick={onSkip}>
                    Passer pour l'instant
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Identity */}
          {currentStep === "identity" && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Identité de marque
              </h2>
              <p className="text-slate-500 mb-8">
                Définissez le nom et le logo de votre entreprise
              </p>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Nom de l'entreprise</Label>
                    <Input
                      id="company_name"
                      value={branding.company_name || ""}
                      onChange={(e) => updateBranding("company_name", e.target.value)}
                      placeholder="Mon Entreprise"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tagline">Slogan (optionnel)</Label>
                    <Input
                      id="tagline"
                      value={branding.tagline || ""}
                      onChange={(e) => updateBranding("tagline", e.target.value)}
                      placeholder="Votre slogan accrocheur"
                    />
                  </div>

                  <LogoUpload
                    value={branding.logo_url}
                    onChange={(url) => updateBranding("logo_url", url)}
                    onUpload={handleLogoUpload("logo")}
                    label="Logo de l'entreprise"
                    description="Format recommandé : PNG transparent, 200x50px minimum"
                  />
                </div>

                {/* Preview */}
                <div className="bg-slate-50 rounded-xl p-6">
                  <p className="text-sm font-medium text-slate-500 mb-4">Aperçu</p>
                  <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center gap-3">
                      {branding.logo_url ? (
                        <img
                          src={branding.logo_url}
                          alt="Logo"
                          className="h-10 w-auto"
                        />
                      ) : (
                        <span
                          className="text-xl font-bold"
                          style={{ color: branding.primary_color }}
                        >
                          🏠 {branding.company_name || "Mon Entreprise"}
                        </span>
                      )}
                    </div>
                    {branding.tagline && (
                      <p className="mt-2 text-sm text-slate-500">{branding.tagline}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Colors */}
          {currentStep === "colors" && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Palette de couleurs
              </h2>
              <p className="text-slate-500 mb-8">
                Choisissez les couleurs qui représentent votre marque
              </p>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <ColorPicker
                    value={branding.primary_color || DEFAULT_BRANDING.primary_color!}
                    onChange={(color) => updateBranding("primary_color", color)}
                    label="Couleur principale"
                    description="Utilisée pour les boutons et éléments importants"
                    defaultValue={DEFAULT_BRANDING.primary_color}
                  />

                  {hasWhiteLabelFeature(level, "secondary_color") && (
                    <ColorPicker
                      value={branding.secondary_color || DEFAULT_BRANDING.secondary_color!}
                      onChange={(color) => updateBranding("secondary_color", color)}
                      label="Couleur secondaire"
                      description="Pour les éléments d'accent"
                      defaultValue={DEFAULT_BRANDING.secondary_color}
                    />
                  )}

                  {hasWhiteLabelFeature(level, "accent_color") && (
                    <ColorPicker
                      value={branding.accent_color || DEFAULT_BRANDING.accent_color!}
                      onChange={(color) => updateBranding("accent_color", color)}
                      label="Couleur d'accent"
                      description="Pour les messages de succès"
                      defaultValue={DEFAULT_BRANDING.accent_color}
                    />
                  )}
                </div>

                {/* Preview */}
                <div className="bg-slate-50 rounded-xl p-6">
                  <p className="text-sm font-medium text-slate-500 mb-4">Aperçu</p>
                  <div className="space-y-4">
                    <Button
                      className="w-full"
                      style={{ backgroundColor: branding.primary_color }}
                    >
                      Bouton principal
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      style={{
                        borderColor: branding.secondary_color,
                        color: branding.secondary_color,
                      }}
                    >
                      Bouton secondaire
                    </Button>
                    <div
                      className="p-3 rounded-lg text-white text-center text-sm"
                      style={{ backgroundColor: branding.accent_color }}
                    >
                      Message de succès
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Email */}
          {currentStep === "email" && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Configuration des emails
              </h2>
              <p className="text-slate-500 mb-8">
                Personnalisez l'apparence des emails envoyés à vos utilisateurs
              </p>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email_from_name">Nom de l'expéditeur</Label>
                    <Input
                      id="email_from_name"
                      value={branding.email_from_name || ""}
                      onChange={(e) => updateBranding("email_from_name", e.target.value)}
                      placeholder="Support Mon Entreprise"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email_from_address">Adresse email</Label>
                    <Input
                      id="email_from_address"
                      type="email"
                      value={branding.email_from_address || ""}
                      onChange={(e) => updateBranding("email_from_address", e.target.value)}
                      placeholder="noreply@monentreprise.com"
                    />
                  </div>

                  <LogoUpload
                    value={branding.email_logo_url}
                    onChange={(url) => updateBranding("email_logo_url", url)}
                    onUpload={handleLogoUpload("email_logo")}
                    label="Logo pour les emails"
                    description="Apparaît en haut de chaque email"
                    previewSize="sm"
                  />
                </div>

                {/* Preview email header */}
                <div className="bg-slate-50 rounded-xl p-6">
                  <p className="text-sm font-medium text-slate-500 mb-4">Aperçu email</p>
                  <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
                    {branding.email_logo_url ? (
                      <img
                        src={branding.email_logo_url}
                        alt="Logo email"
                        className="h-12 mx-auto mb-4"
                      />
                    ) : (
                      <h1
                        className="text-xl font-bold mb-4"
                        style={{ color: branding.primary_color }}
                      >
                        🏠 {branding.company_name || "Mon Entreprise"}
                      </h1>
                    )}
                    <div className="text-sm text-slate-500">
                      De :{" "}
                      <span className="font-medium">
                        {branding.email_from_name || "Mon Entreprise"}
                      </span>{" "}
                      &lt;{branding.email_from_address || "noreply@example.com"}&gt;
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          {currentStep === "preview" && (
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Vérification finale
              </h2>
              <p className="text-slate-500 mb-8">
                Vérifiez que tout est correct avant de valider
              </p>

              <LivePreview branding={branding} className="h-[400px]" />
            </div>
          )}

          {/* Complete */}
          {currentStep === "complete" && (
            <div className="text-center max-w-md mx-auto py-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">
                Configuration terminée !
              </h2>
              <p className="text-slate-600 mb-8">
                Votre marque blanche est maintenant configurée. Vos utilisateurs verront
                votre identité visuelle sur toute la plateforme.
              </p>
              <Button size="lg">
                Accéder à mon tableau de bord
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}

          {/* Navigation */}
          {currentStep !== "welcome" && currentStep !== "complete" && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
              <Button variant="ghost" onClick={handlePrev}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Précédent
              </Button>

              {currentStep === "preview" ? (
                <Button onClick={handleComplete} disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Terminer la configuration
                </Button>
              ) : (
                <Button onClick={handleNext}>
                  Suivant
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default SetupWizard;
