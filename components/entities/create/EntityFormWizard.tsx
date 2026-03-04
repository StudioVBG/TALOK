"use client";

/**
 * EntityFormWizard — Wizard partagé pour la création et l'édition d'entités juridiques
 *
 * Remplace la duplication entre new/page.tsx et [entityId]/edit/page.tsx.
 * Gère le stepper adaptatif (2 étapes pour "particulier", 5 sinon),
 * la validation par étape, et la navigation.
 */

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isValidSiret } from "@/lib/entities/siret-validation";
import { StepEntityType } from "@/components/entities/create/StepEntityType";
import { StepLegalInfo } from "@/components/entities/create/StepLegalInfo";
import { StepAddress } from "@/components/entities/create/StepAddress";
import { StepRepresentative } from "@/components/entities/create/StepRepresentative";
import { StepBankDetails } from "@/components/entities/create/StepBankDetails";
import type { EntityFormData } from "@/lib/entities/entity-form-utils";
import { getDefaultRegimeFiscal } from "@/lib/entities/entity-form-utils";

// ============================================
// TYPES & CONSTANTS
// ============================================

export const INITIAL_FORM_DATA: EntityFormData = {
  entityType: "",
  nom: "",
  formeJuridique: "",
  regimeFiscal: "ir",
  siret: "",
  capitalSocial: "",
  nombreParts: "",
  rcsVille: "",
  dateCreation: "",
  numeroTva: "",
  objetSocial: "Gestion de biens immobiliers",
  adresseSiege: "",
  codePostalSiege: "",
  villeSiege: "",
  emailEntite: "",
  telephoneEntite: "",
  representantMode: "self",
  representantPrenom: "",
  representantNom: "",
  representantQualite: "Gérant(e)",
  representantDateNaissance: "",
  iban: "",
  bic: "",
  banqueNom: "",
};

const ALL_STEPS = [
  { id: 1, label: "Type" },
  { id: 2, label: "Légal" },
  { id: 3, label: "Adresse" },
  { id: 4, label: "Représentant" },
  { id: 5, label: "Bancaire" },
];

const PARTICULIER_STEPS = [
  { id: 1, label: "Type" },
  { id: 5, label: "Bancaire" },
];

/** Entity type → Forme juridique auto-mapping */
export const ENTITY_TYPE_TO_FORME: Record<string, string> = {
  sci_ir: "SCI",
  sci_is: "SCI",
  sarl: "SARL",
  sarl_famille: "SARL",
  sas: "SAS",
  sasu: "SASU",
  eurl: "EURL",
  sa: "SA",
  snc: "SNC",
};

export interface EntityFormWizardProps {
  mode: "create" | "edit";
  initialData?: EntityFormData;
  /** Entity ID — required in edit mode */
  entityId?: string;
  /** Called on final submit — receives the form data */
  onSubmit: (formData: EntityFormData) => Promise<void>;
  /** Back link target when on step 1 */
  backHref: string;
  /** Page header */
  header: {
    title: string;
    subtitle: string;
    backLabel: string;
  };
  /** Submit button label */
  submitLabel: string;
  /** Submit loading label */
  submitLoadingLabel: string;
}

// ============================================
// COMPONENT
// ============================================

export function EntityFormWizard({
  mode,
  initialData,
  onSubmit,
  backHref,
  header,
  submitLabel,
  submitLoadingLabel,
}: EntityFormWizardProps) {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<EntityFormData>(
    initialData || INITIAL_FORM_DATA
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isParticulier = formData.entityType === "particulier";

  // Visible steps adapt for "particulier"
  const visibleSteps = useMemo(
    () => (isParticulier ? PARTICULIER_STEPS : ALL_STEPS),
    [isParticulier]
  );

  const updateFormData = useCallback(
    (updates: Partial<EntityFormData>) => {
      setFormData((prev) => {
        const next = { ...prev, ...updates };

        // Auto-fill forme juridique and régime fiscal when entity type changes (create mode only)
        if (
          updates.entityType &&
          updates.entityType !== prev.entityType
        ) {
          const forme = ENTITY_TYPE_TO_FORME[updates.entityType];
          next.formeJuridique = forme || "";
          next.regimeFiscal = getDefaultRegimeFiscal(updates.entityType);

          // Auto-set nom for "particulier"
          if (updates.entityType === "particulier" && !prev.nom) {
            next.nom = "Patrimoine personnel";
          }
        }

        return next;
      });

      // Clear errors for changed fields
      const keys = Object.keys(updates);
      if (keys.length > 0) {
        setErrors((prev) => {
          const next = { ...prev };
          for (const key of keys) {
            delete next[key];
          }
          return next;
        });
      }
    },
    []
  );

  // Validate a specific step — returns true if valid, sets errors otherwise
  const validateStep = useCallback(
    (stepNum: number): boolean => {
      const newErrors: Record<string, string> = {};

      switch (stepNum) {
        case 1:
          if (!formData.entityType) {
            newErrors.entityType =
              "Veuillez sélectionner un type de structure";
          }
          break;

        case 2:
          if (isParticulier) break;
          if (!formData.nom.trim()) {
            newErrors.nom = "La raison sociale est obligatoire";
          }
          if (!formData.formeJuridique) {
            newErrors.formeJuridique = "La forme juridique est obligatoire";
          }
          if (formData.siret) {
            const digits = formData.siret.replace(/\D/g, "");
            if (digits.length > 0 && digits.length !== 14) {
              newErrors.siret = "Le SIRET doit contenir 14 chiffres";
            } else if (digits.length === 14 && !isValidSiret(digits)) {
              newErrors.siret =
                "SIRET invalide (clé de contrôle incorrecte)";
            }
          }
          break;

        case 3:
          if (isParticulier) break;
          if (!formData.adresseSiege.trim()) {
            newErrors.adresseSiege = "L'adresse est obligatoire";
          }
          if (!formData.codePostalSiege) {
            newErrors.codePostalSiege = "Le code postal est obligatoire";
          } else if (!/^\d{5}$/.test(formData.codePostalSiege)) {
            newErrors.codePostalSiege =
              "Le code postal doit contenir 5 chiffres";
          }
          if (!formData.villeSiege.trim()) {
            newErrors.villeSiege = "La ville est obligatoire";
          }
          if (
            formData.emailEntite &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.emailEntite)
          ) {
            newErrors.emailEntite = "Format d'email invalide";
          }
          break;

        case 4:
          if (formData.representantMode === "other") {
            if (!formData.representantPrenom.trim()) {
              newErrors.representantPrenom = "Le prénom est obligatoire";
            }
            if (!formData.representantNom.trim()) {
              newErrors.representantNom = "Le nom est obligatoire";
            }
          }
          break;

        case 5:
          if (formData.iban) {
            const cleanIban = formData.iban.replace(/\s/g, "");
            if (cleanIban.length < 15 || cleanIban.length > 34) {
              newErrors.iban =
                "L'IBAN doit contenir entre 15 et 34 caractères";
            }
          }
          break;
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [formData, isParticulier]
  );

  const canProceed = useCallback((): boolean => {
    switch (step) {
      case 1:
        return !!formData.entityType;
      case 2:
        if (isParticulier) return true;
        return !!(formData.nom.trim() && formData.formeJuridique);
      case 3:
        if (isParticulier) return true;
        return !!(
          formData.adresseSiege.trim() &&
          formData.codePostalSiege &&
          formData.villeSiege.trim()
        );
      case 4:
        if (formData.representantMode === "other") {
          return !!(
            formData.representantPrenom.trim() &&
            formData.representantNom.trim()
          );
        }
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  }, [step, formData, isParticulier]);

  const handleNext = () => {
    if (!validateStep(step)) return;

    if (step < 5) {
      if (step === 1 && isParticulier) {
        setStep(5);
        return;
      }
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    setErrors({});
    if (step > 1) {
      if (step === 5 && isParticulier) {
        setStep(1);
        return;
      }
      setStep((s) => s - 1);
    } else {
      router.push(backHref);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(step)) return;
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLastStep = isParticulier ? step === 5 : step === 5;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push(backHref)}
          className="text-sm text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          {header.backLabel}
        </button>
        <h1 className="text-3xl font-bold">{header.title}</h1>
        <p className="text-muted-foreground">{header.subtitle}</p>
      </div>

      {/* Progress bar — adapts for "particulier" (2 steps) */}
      <div className="flex items-center gap-2">
        {visibleSteps.map((s, index) => {
          const isCompleted = step > s.id;
          const isCurrent = step === s.id;
          return (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 transition-colors",
                  isCompleted
                    ? "bg-primary text-primary-foreground"
                    : isCurrent
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-xs font-medium hidden sm:block",
                  isCompleted || isCurrent
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
              {index < visibleSteps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 rounded-full",
                    isCompleted ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="min-h-[300px]">
        {step === 1 && (
          <StepEntityType
            value={formData.entityType}
            onChange={(v) => updateFormData({ entityType: v })}
          />
        )}
        {step === 2 && (
          <StepLegalInfo
            formData={formData}
            onChange={updateFormData}
            errors={errors}
          />
        )}
        {step === 3 && (
          <StepAddress
            formData={formData}
            onChange={updateFormData}
            errors={errors}
          />
        )}
        {step === 4 && (
          <StepRepresentative
            formData={formData}
            onChange={updateFormData}
            errors={errors}
          />
        )}
        {step === 5 && (
          <StepBankDetails
            formData={formData}
            onChange={updateFormData}
            errors={errors}
            showNomField={isParticulier}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={handleBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Retour
        </Button>

        {!isLastStep ? (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Suivant
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !canProceed()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {submitLoadingLabel}
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                {submitLabel}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
