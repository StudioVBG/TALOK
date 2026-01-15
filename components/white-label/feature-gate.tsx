"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  WhiteLabelLevel,
  WhiteLabelFeature,
  hasWhiteLabelFeature,
  getRequiredLevel,
  WHITE_LABEL_LEVEL_INFO,
  WHITE_LABEL_FEATURE_INFO,
} from "@/lib/white-label/types";

interface FeatureGateProps {
  feature: WhiteLabelFeature;
  currentLevel: WhiteLabelLevel;
  children: ReactNode;
  showUpgradePrompt?: boolean;
  onUpgrade?: () => void;
  className?: string;
}

/**
 * Composant qui affiche ou masque du contenu selon le niveau white-label
 */
export function FeatureGate({
  feature,
  currentLevel,
  children,
  showUpgradePrompt = true,
  onUpgrade,
  className,
}: FeatureGateProps) {
  const isAvailable = hasWhiteLabelFeature(currentLevel, feature);
  const requiredLevel = getRequiredLevel(feature);
  const featureInfo = WHITE_LABEL_FEATURE_INFO[feature];
  const requiredLevelInfo = WHITE_LABEL_LEVEL_INFO[requiredLevel];

  if (isAvailable) {
    return <>{children}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  return (
    <div className={cn("relative", className)}>
      {/* Contenu flouté/désactivé */}
      <div className="opacity-40 pointer-events-none select-none blur-[1px]">
        {children}
      </div>

      {/* Overlay avec message d'upgrade */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-lg"
      >
        <div className="text-center p-6 max-w-sm">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Lock className="w-6 h-6 text-white" />
          </div>

          <h3 className="font-semibold text-slate-900 mb-2">
            {featureInfo.label}
          </h3>

          <p className="text-sm text-slate-600 mb-4">
            {featureInfo.description}
          </p>

          <Badge variant="secondary" className="mb-4">
            Disponible avec {requiredLevelInfo.plan}
          </Badge>

          {onUpgrade && (
            <Button onClick={onUpgrade} className="w-full">
              <Sparkles className="w-4 h-4 mr-2" />
              Passer à {requiredLevelInfo.label}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

interface FeatureBadgeProps {
  feature: WhiteLabelFeature;
  currentLevel: WhiteLabelLevel;
  showTooltip?: boolean;
}

/**
 * Badge indiquant si une feature est disponible
 */
export function FeatureBadge({
  feature,
  currentLevel,
  showTooltip = true,
}: FeatureBadgeProps) {
  const isAvailable = hasWhiteLabelFeature(currentLevel, feature);
  const requiredLevel = getRequiredLevel(feature);
  const featureInfo = WHITE_LABEL_FEATURE_INFO[feature];
  const requiredLevelInfo = WHITE_LABEL_LEVEL_INFO[requiredLevel];

  const badge = (
    <Badge
      variant={isAvailable ? "default" : "secondary"}
      className={cn(
        "text-xs",
        isAvailable
          ? "bg-green-100 text-green-700 hover:bg-green-100"
          : "bg-slate-100 text-slate-500"
      )}
    >
      {isAvailable ? (
        "Disponible"
      ) : (
        <>
          <Lock className="w-3 h-3 mr-1" />
          {requiredLevelInfo.plan}
        </>
      )}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{featureInfo.label}</p>
          <p className="text-xs text-slate-400">{featureInfo.description}</p>
          {!isAvailable && (
            <p className="text-xs text-amber-400 mt-1">
              Requiert {requiredLevelInfo.plan} ({requiredLevelInfo.price})
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface FeatureListProps {
  currentLevel: WhiteLabelLevel;
  features?: WhiteLabelFeature[];
  showAll?: boolean;
  onUpgrade?: () => void;
}

/**
 * Liste des features avec leur disponibilité
 */
export function FeatureList({
  currentLevel,
  features,
  showAll = false,
  onUpgrade,
}: FeatureListProps) {
  const allFeatures: WhiteLabelFeature[] = features || [
    'custom_logo',
    'primary_color',
    'company_name',
    'custom_email_from',
    'custom_email_logo',
    'custom_favicon',
    'secondary_color',
    'accent_color',
    'custom_email_footer',
    'custom_email_colors',
    'branded_login_page',
    'remove_powered_by',
    'custom_domain',
    'custom_css',
    'sso_saml',
    'sso_oidc',
  ];

  const displayFeatures = showAll
    ? allFeatures
    : allFeatures.filter((f) => hasWhiteLabelFeature(currentLevel, f) || getRequiredLevel(f) === 'basic');

  // Grouper par catégorie
  const grouped = displayFeatures.reduce((acc, feature) => {
    const category = WHITE_LABEL_FEATURE_INFO[feature].category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(feature);
    return acc;
  }, {} as Record<string, WhiteLabelFeature[]>);

  const categoryLabels: Record<string, string> = {
    branding: "Identité visuelle",
    email: "Emails",
    domain: "Domaine",
    advanced: "Avancé",
  };

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([category, categoryFeatures]) => (
        <div key={category}>
          <h4 className="text-sm font-medium text-slate-500 mb-3">
            {categoryLabels[category]}
          </h4>
          <div className="space-y-2">
            {categoryFeatures.map((feature) => {
              const info = WHITE_LABEL_FEATURE_INFO[feature];
              const isAvailable = hasWhiteLabelFeature(currentLevel, feature);
              const requiredLevel = getRequiredLevel(feature);

              return (
                <div
                  key={feature}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    isAvailable
                      ? "bg-white border-slate-200"
                      : "bg-slate-50 border-slate-100"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        isAvailable
                          ? "bg-blue-100 text-blue-600"
                          : "bg-slate-200 text-slate-400"
                      )}
                    >
                      {isAvailable ? (
                        <Sparkles className="w-4 h-4" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p
                        className={cn(
                          "text-sm font-medium",
                          isAvailable ? "text-slate-900" : "text-slate-500"
                        )}
                      >
                        {info.label}
                      </p>
                      <p className="text-xs text-slate-400">{info.description}</p>
                    </div>
                  </div>

                  <FeatureBadge feature={feature} currentLevel={currentLevel} />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {currentLevel !== "premium" && onUpgrade && (
        <Button onClick={onUpgrade} variant="outline" className="w-full">
          <Sparkles className="w-4 h-4 mr-2" />
          Débloquer plus de fonctionnalités
        </Button>
      )}
    </div>
  );
}

export default FeatureGate;
