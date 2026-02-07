"use client";

/**
 * Page /owner/entities/new — Création d'une nouvelle entité juridique (stepper 5 étapes)
 */

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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

const STEPS = [
  { id: 1, label: "Type" },
  { id: 2, label: "Légal" },
  { id: 3, label: "Adresse" },
  { id: 4, label: "Représentant" },
  { id: 5, label: "Bancaire" },
];

// ============================================
// PAGE
// ============================================

export default function NewEntityPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { addEntity } = useEntityStore();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<EntityFormData>(INITIAL_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateFormData = useCallback(
    (updates: Partial<EntityFormData>) => {
      setFormData((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const canProceed = useCallback((): boolean => {
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
    if (step < 5) {
      // Skip step 2 for "particulier"
      if (step === 1 && formData.entityType === "particulier") {
        setStep(5); // Jump to bank details
        return;
      }
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      if (step === 5 && formData.entityType === "particulier") {
        setStep(1);
        return;
      }
      setStep((s) => s - 1);
    } else {
      router.push("/owner/entities");
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const supabase = createClient();

      // Get profile.id — which is the FK value for legal_entities.owner_profile_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!profile) throw new Error("Profil non trouvé");

      // Map form data to DB
      const entityPayload = {
        owner_profile_id: profile.id,
        entity_type: formData.entityType || "sci_ir",
        nom: formData.nom || `Entité de ${profile.id.slice(0, 8)}`,
        forme_juridique: formData.formeJuridique || null,
        regime_fiscal: formData.regimeFiscal || "ir",
        siret: formData.siret.replace(/\s/g, "") || null,
        capital_social: formData.capitalSocial ? parseFloat(formData.capitalSocial) : null,
        date_creation: formData.dateCreation || null,
        numero_tva: formData.numeroTva || null,
        adresse_siege: formData.adresseSiege || null,
        code_postal_siege: formData.codePostalSiege || null,
        ville_siege: formData.villeSiege || null,
        iban: formData.iban.replace(/\s/g, "") || null,
        bic: formData.bic || null,
        banque_nom: formData.banqueNom || null,
        is_active: true,
      };

      const { data: newEntity, error } = await supabase
        .from("legal_entities")
        .insert(entityPayload)
        .select()
        .single();

      if (error) throw new Error(error.message);

      // Create associate (representative)
      if (formData.representantMode === "self") {
        await supabase.from("entity_associates").insert({
          legal_entity_id: (newEntity as Record<string, unknown>).id,
          profile_id: profile.id,
          nom: null,
          prenom: null,
          nombre_parts: 100,
          pourcentage_capital: 100,
          is_gerant: true,
          is_current: true,
          date_entree: new Date().toISOString().split("T")[0],
        });
      } else if (formData.representantNom) {
        await supabase.from("entity_associates").insert({
          legal_entity_id: (newEntity as Record<string, unknown>).id,
          nom: formData.representantNom,
          prenom: formData.representantPrenom,
          nombre_parts: 100,
          pourcentage_capital: 100,
          is_gerant: true,
          is_current: true,
          date_entree: new Date().toISOString().split("T")[0],
        });
      }

      // Update store
      addEntity({
        id: (newEntity as Record<string, unknown>).id as string,
        nom: entityPayload.nom,
        entityType: entityPayload.entity_type,
        legalForm: entityPayload.forme_juridique,
        fiscalRegime: entityPayload.regime_fiscal,
        siret: entityPayload.siret,
        codePostalSiege: entityPayload.code_postal_siege,
        villeSiege: entityPayload.ville_siege,
        isDefault: false,
        isActive: true,
        couleur: null,
        propertyCount: 0,
        activeLeaseCount: 0,
        hasIban: !!entityPayload.iban,
      });

      toast({
        title: "Entité créée",
        description: `${entityPayload.nom} a été créée avec succès.`,
      });

      router.push(`/owner/entities/${(newEntity as Record<string, unknown>).id}`);
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible de créer l'entité.",
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
          <StepLegalInfo formData={formData} onChange={updateFormData} />
        )}
        {step === 3 && (
          <StepAddress formData={formData} onChange={updateFormData} />
        )}
        {step === 4 && (
          <StepRepresentative formData={formData} onChange={updateFormData} />
        )}
        {step === 5 && (
          <StepBankDetails formData={formData} onChange={updateFormData} />
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
          <Button onClick={handleSubmit} disabled={isSubmitting}>
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
