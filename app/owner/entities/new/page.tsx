"use client";

/**
 * Page /owner/entities/new — Création d'une nouvelle entité juridique (stepper 5 étapes)
 *
 * Corrections apportées :
 * - Validation stricte par étape (canProceed + validateStep avec erreurs inline)
 * - Utilisation de la Server Action createEntity (validation Zod côté serveur)
 * - Auto-remplissage forme juridique et régime fiscal depuis le type d'entité
 * - Stepper adaptatif pour le type "particulier" (2 étapes au lieu de 5)
 * - Sauvegarde email/téléphone/dateNaissance/qualité (données auparavant perdues)
 */

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useEntityStore } from "@/stores/useEntityStore";
import { createEntity } from "@/app/owner/entities/actions";
import { StepEntityType } from "@/components/entities/create/StepEntityType";
import { StepLegalInfo } from "@/components/entities/create/StepLegalInfo";
import { StepAddress } from "@/components/entities/create/StepAddress";
import { StepRepresentative } from "@/components/entities/create/StepRepresentative";
import { StepBankDetails } from "@/components/entities/create/StepBankDetails";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

export interface EntityFormData {
  // Step 1: Type
  entityType: string;

  // Step 2: Legal info
  nom: string;
  formeJuridique: string;
  regimeFiscal: string;
  siret: string;
  capitalSocial: string;
  dateCreation: string;
  numeroTva: string;
  objetSocial: string;

  // Step 3: Address
  adresseSiege: string;
  codePostalSiege: string;
  villeSiege: string;
  emailEntite: string;
  telephoneEntite: string;

  // Step 4: Representative
  representantMode: "self" | "other";
  representantPrenom: string;
  representantNom: string;
  representantQualite: string;
  representantDateNaissance: string;

  // Step 5: Bank
  iban: string;
  bic: string;
  banqueNom: string;
}

const INITIAL_DATA: EntityFormData = {
  entityType: "",
  nom: "",
  formeJuridique: "",
  regimeFiscal: "ir",
  siret: "",
  capitalSocial: "",
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

// Entity type → Forme juridique auto-mapping
const ENTITY_TYPE_TO_FORME: Record<string, string> = {
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

// Régime fiscal constraints
const FORCE_IS_TYPES = ["sci_is", "sas", "sasu", "sa"];

function getDefaultRegimeFiscal(entityType: string): string {
  if (FORCE_IS_TYPES.includes(entityType)) return "is";
  return "ir";
}

export function isRegimeFiscalLocked(entityType: string): boolean {
  return FORCE_IS_TYPES.includes(entityType);
}

// ============================================
// PAGE
// ============================================

export default function NewEntityPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { addEntity } = useEntityStore();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<EntityFormData>(INITIAL_DATA);
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

        // Auto-fill forme juridique and régime fiscal when entity type changes
        if (updates.entityType && updates.entityType !== prev.entityType) {
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
      router.push("/owner/entities");
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(step)) return;
    setIsSubmitting(true);

    try {
      const result = await createEntity({
        entity_type: formData.entityType as Parameters<
          typeof createEntity
        >[0]["entity_type"],
        nom: formData.nom || "Patrimoine personnel",
        forme_juridique: formData.formeJuridique || undefined,
        regime_fiscal:
          (formData.regimeFiscal as "ir" | "is" | "ir_option_is" | "is_option_ir") ||
          undefined,
        siret: formData.siret.replace(/\s/g, "") || undefined,
        capital_social: formData.capitalSocial
          ? parseFloat(formData.capitalSocial)
          : undefined,
        date_creation: formData.dateCreation || undefined,
        numero_tva: formData.numeroTva || undefined,
        adresse_siege: formData.adresseSiege || undefined,
        code_postal_siege: formData.codePostalSiege || undefined,
        ville_siege: formData.villeSiege || undefined,
        pays_siege: "France",
        iban: formData.iban.replace(/\s/g, "") || undefined,
        bic: formData.bic || undefined,
        banque_nom: formData.banqueNom || undefined,
        representant_mode: formData.representantMode,
        representant_prenom: formData.representantPrenom || undefined,
        representant_nom: formData.representantNom || undefined,
        representant_qualite: formData.representantQualite || undefined,
        representant_date_naissance:
          formData.representantDateNaissance || undefined,
        email_entite: formData.emailEntite || undefined,
        telephone_entite: formData.telephoneEntite || undefined,
      });

      if (!result.success) {
        toast({
          title: "Erreur",
          description: result.error,
          variant: "destructive",
        });
        return;
      }

      const entityId = result.data?.id;

      // Update client store
      addEntity({
        id: entityId!,
        nom: formData.nom || "Patrimoine personnel",
        entityType: formData.entityType,
        legalForm: formData.formeJuridique || null,
        fiscalRegime: formData.regimeFiscal || null,
        siret: formData.siret.replace(/\s/g, "") || null,
        codePostalSiege: formData.codePostalSiege || null,
        villeSiege: formData.villeSiege || null,
        isDefault: false,
        isActive: true,
        couleur: null,
        propertyCount: 0,
        activeLeaseCount: 0,
        hasIban: !!formData.iban,
      });

      toast({
        title: "Entité créée",
        description: `${formData.nom || "Patrimoine personnel"} a été créée avec succès.`,
      });

      router.push(`/owner/entities/${entityId}`);
    } catch (err) {
      toast({
        title: "Erreur",
        description:
          err instanceof Error ? err.message : "Impossible de créer l'entité.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push("/owner/entities")}
          className="text-sm text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Mes entités
        </button>
        <h1 className="text-3xl font-bold">Nouvelle entité</h1>
        <p className="text-muted-foreground">
          Configurez votre structure juridique en quelques étapes
        </p>
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

        {step < 5 ? (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Suivant
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isSubmitting || !canProceed()}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Création...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Créer l&apos;entité
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
