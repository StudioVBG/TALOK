"use client";

/**
 * Page /owner/entities/[entityId]/edit — Modification d'une entité juridique (stepper 5 étapes)
 */

import { useState, useCallback, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { createClient } from "@/lib/supabase/client";
import { useEntityStore } from "@/stores/useEntityStore";
import { StepEntityType } from "@/components/entities/create/StepEntityType";
import { StepLegalInfo } from "@/components/entities/create/StepLegalInfo";
import { StepAddress } from "@/components/entities/create/StepAddress";
import { StepRepresentative } from "@/components/entities/create/StepRepresentative";
import { StepBankDetails } from "@/components/entities/create/StepBankDetails";
import { cn } from "@/lib/utils";
import { isValidSiret } from "@/lib/entities/siret-validation";
import type { EntityFormData } from "@/lib/entities/entity-form-utils";

const STEPS = [
  { id: 1, label: "Type" },
  { id: 2, label: "Légal" },
  { id: 3, label: "Adresse" },
  { id: 4, label: "Représentant" },
  { id: 5, label: "Bancaire" },
];

export default function EditEntityPage() {
  const router = useRouter();
  const params = useParams<{ entityId: string }>();
  const entityId = params.entityId;
  const { toast } = useToast();
  const { updateEntity: updateStoreEntity } = useEntityStore();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<EntityFormData | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing entity data
  useEffect(() => {
    async function loadEntity() {
      try {
        const supabase = createClient();
        const { data: entity, error } = await supabase
          .from("legal_entities")
          .select("*")
          .eq("id", entityId)
          .single();

        if (error || !entity) {
          toast({
            title: "Erreur",
            description: "Entité non trouvée.",
            variant: "destructive",
          });
          router.push("/owner/entities");
          return;
        }

        const e = entity as Record<string, unknown>;

        // Load associate for representative data
        const { data: associates } = await supabase
          .from("entity_associates")
          .select("*")
          .eq("legal_entity_id", entityId)
          .eq("is_current", true)
          .eq("is_gerant", true)
          .limit(1);

        const gerant = (associates?.[0] || null) as Record<string, unknown> | null;

        // Check if representative is the owner (has profile_id) or external
        const hasSelfRepresentant = gerant?.profile_id != null;

        // Extract email/telephone from metadata
        const metadata = (e.metadata as Record<string, unknown>) || {};

        setFormData({
          entityType: (e.entity_type as string) || "",
          nom: (e.nom as string) || "",
          formeJuridique: (e.forme_juridique as string) || "",
          regimeFiscal: (e.regime_fiscal as string) || "ir",
          siret: (e.siret as string) || "",
          capitalSocial: e.capital_social != null ? String(e.capital_social) : "",
          nombreParts: e.nombre_parts != null ? String(e.nombre_parts) : "",
          rcsVille: (e.rcs_ville as string) || "",
          dateCreation: (e.date_creation as string) || "",
          numeroTva: (e.numero_tva as string) || "",
          objetSocial: "Gestion de biens immobiliers",
          adresseSiege: (e.adresse_siege as string) || "",
          codePostalSiege: (e.code_postal_siege as string) || "",
          villeSiege: (e.ville_siege as string) || "",
          emailEntite: (metadata.email as string) || "",
          telephoneEntite: (metadata.telephone as string) || "",
          representantMode: hasSelfRepresentant ? "self" : "other",
          representantPrenom: (gerant?.prenom as string) || "",
          representantNom: (gerant?.nom as string) || "",
          representantQualite: "Gérant(e)",
          representantDateNaissance: (gerant?.date_naissance as string) || "",
          iban: (e.iban as string) || "",
          bic: (e.bic as string) || "",
          banqueNom: (e.banque_nom as string) || "",
        });
      } catch {
        toast({
          title: "Erreur",
          description: "Impossible de charger l'entité.",
          variant: "destructive",
        });
        router.push("/owner/entities");
      } finally {
        setIsLoading(false);
      }
    }

    loadEntity();
  }, [entityId, router, toast]);

  const updateFormData = useCallback(
    (updates: Partial<EntityFormData>) => {
      setFormData((prev) => (prev ? { ...prev, ...updates } : prev));
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

  // Validate a specific step
  const validateStep = useCallback(
    (stepNum: number): boolean => {
      if (!formData) return false;
      const newErrors: Record<string, string> = {};
      const isParticulier = formData.entityType === "particulier";

      switch (stepNum) {
        case 1:
          if (!formData.entityType) {
            newErrors.entityType = "Veuillez sélectionner un type de structure";
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
              newErrors.siret = "SIRET invalide (clé de contrôle incorrecte)";
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
            newErrors.codePostalSiege = "Le code postal doit contenir 5 chiffres";
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
              newErrors.iban = "L'IBAN doit contenir entre 15 et 34 caractères";
            }
          }
          break;
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [formData]
  );

  const canProceed = useCallback((): boolean => {
    if (!formData) return false;
    switch (step) {
      case 1:
        return !!formData.entityType;
      case 2:
        if (formData.entityType === "particulier") return true;
        return !!(formData.nom && formData.formeJuridique);
      case 3:
        if (formData.entityType === "particulier") return true;
        return !!(formData.adresseSiege && formData.codePostalSiege && formData.villeSiege);
      case 4:
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  }, [step, formData]);

  const handleNext = () => {
    if (!formData) return;
    if (!validateStep(step)) return;
    if (step < 5) {
      if (step === 1 && formData.entityType === "particulier") {
        setStep(5);
        return;
      }
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (!formData) return;
    setErrors({});
    if (step > 1) {
      if (step === 5 && formData.entityType === "particulier") {
        setStep(1);
        return;
      }
      setStep((s) => s - 1);
    } else {
      router.push(`/owner/entities/${entityId}`);
    }
  };

  const handleSubmit = async () => {
    if (!formData) return;
    if (!validateStep(step)) return;
    setIsSubmitting(true);

    try {
      // Utiliser le server action avec validation Zod et vérification ownership
      const { updateEntity } = await import("../../actions");

      const entityPayload = {
        id: entityId,
        entity_type: formData.entityType || "sci_ir",
        nom: formData.nom,
        forme_juridique: formData.formeJuridique || undefined,
        regime_fiscal: formData.regimeFiscal || "ir",
        siret: formData.siret.replace(/\s/g, "") || undefined,
        capital_social: formData.capitalSocial ? parseFloat(formData.capitalSocial) : undefined,
        nombre_parts: formData.nombreParts ? parseInt(formData.nombreParts, 10) : undefined,
        rcs_ville: formData.rcsVille || undefined,
        date_creation: formData.dateCreation || undefined,
        numero_tva: formData.numeroTva || undefined,
        adresse_siege: formData.adresseSiege || undefined,
        code_postal_siege: formData.codePostalSiege || undefined,
        ville_siege: formData.villeSiege || undefined,
        iban: formData.iban.replace(/\s/g, "") || undefined,
        bic: formData.bic || undefined,
        banque_nom: formData.banqueNom || undefined,
        email_entite: formData.emailEntite || undefined,
        telephone_entite: formData.telephoneEntite || undefined,
      };

      const result = await updateEntity(entityPayload as any);

      if (!result.success) throw new Error(result.error || "Erreur lors de la mise à jour");

      // Update store
      updateStoreEntity(entityId, {
        nom: entityPayload.nom,
        entityType: entityPayload.entity_type,
        legalForm: entityPayload.forme_juridique,
        fiscalRegime: entityPayload.regime_fiscal,
        siret: entityPayload.siret,
        codePostalSiege: entityPayload.code_postal_siege,
        villeSiege: entityPayload.ville_siege,
        hasIban: !!entityPayload.iban,
      });

      toast({
        title: "Entité modifiée",
        description: `${entityPayload.nom} a été mise à jour.`,
      });

      router.push(`/owner/entities/${entityId}`);
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible de modifier l'entité.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !formData) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push(`/owner/entities/${entityId}`)}
          className="text-sm text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Retour à la fiche
        </button>
        <h1 className="text-3xl font-bold">Modifier l&apos;entité</h1>
        <p className="text-muted-foreground">
          {formData.nom || "Entité juridique"}
        </p>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        {STEPS.map((s) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <div
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 transition-colors",
                step > s.id
                  ? "bg-primary text-primary-foreground"
                  : step === s.id
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {step > s.id ? <Check className="h-4 w-4" /> : s.id}
            </div>
            <span
              className={cn(
                "text-xs font-medium hidden sm:block",
                step >= s.id
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {s.label}
            </span>
            {s.id < STEPS.length && (
              <div
                className={cn(
                  "flex-1 h-0.5 rounded-full",
                  step > s.id ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        ))}
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
          <StepLegalInfo formData={formData} onChange={updateFormData} errors={errors} />
        )}
        {step === 3 && (
          <StepAddress formData={formData} onChange={updateFormData} errors={errors} />
        )}
        {step === 4 && (
          <StepRepresentative formData={formData} onChange={updateFormData} errors={errors} />
        )}
        {step === 5 && (
          <StepBankDetails formData={formData} onChange={updateFormData} errors={errors} />
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
                Enregistrement...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Enregistrer les modifications
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
