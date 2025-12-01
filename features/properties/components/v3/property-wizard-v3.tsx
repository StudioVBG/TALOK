"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import dynamic from "next/dynamic";
import { usePropertyWizardStore, WizardStep } from "@/features/properties/stores/wizard-store";
import { ImmersiveWizardLayout } from "./immersive/ImmersiveWizardLayout";
import { StepSkeleton } from "./step-skeleton";
import { Confetti } from "@/components/ui/confetti";
import { TomAssistant } from "@/components/ai/tom-assistant";
import { ImportStep } from "./immersive/steps/ImportStep";
import type { Property } from "@/lib/types";

// Dynamically import steps for code splitting
const TypeStep = dynamic(() => import("./immersive/steps/TypeStep").then((mod) => ({ default: mod.TypeStep })), {
  loading: () => <StepSkeleton />,
  ssr: false,
});
const AddressStep = dynamic(() => import("./immersive/steps/AddressStep").then((mod) => ({ default: mod.AddressStep })), {
  loading: () => <StepSkeleton />,
  ssr: false,
});
const DetailsStep = dynamic(() => import("./immersive/steps/DetailsStep").then((mod) => ({ default: mod.DetailsStep })), {
  loading: () => <StepSkeleton />,
  ssr: false,
});
const RoomsStep = dynamic(() => import("./immersive/steps/RoomsStep").then((mod) => ({ default: mod.RoomsStep })), {
  loading: () => <StepSkeleton />,
  ssr: false,
});
const PhotosStep = dynamic(() => import("./immersive/steps/PhotosStep").then((mod) => ({ default: mod.PhotosStep })), {
  loading: () => <StepSkeleton />,
  ssr: false,
});
const RecapStep = dynamic(() => import("./immersive/steps/RecapStep").then((mod) => ({ default: mod.RecapStep })), {
  loading: () => <StepSkeleton />,
  ssr: false,
});

const stepComponents: Record<WizardStep, React.ElementType> = {
  type_bien: TypeStep,
  address: AddressStep,
  details: DetailsStep,
  rooms: RoomsStep,
  photos: PhotosStep,
  recap: RecapStep,
};

// Types de biens qui n'ont PAS d'étape "rooms"
// ⚠️ Aligné avec wizard-store.ts et TypeStep.tsx
const TYPES_WITHOUT_ROOMS_STEP = [
  "parking", 
  "box", 
  "local_commercial", 
  "bureaux", 
  "entrepot", 
  "fonds_de_commerce"
];

// Titres des étapes selon le type de bien
function getStepTitle(step: WizardStep, propertyType: string): string {
  const titles: Record<WizardStep, string> = {
    type_bien: "Quel type de bien souhaitez-vous ajouter ?",
    address: "Où se situe votre bien ?",
    details: propertyType === "parking" 
      ? "Quelques détails sur le parking" 
      : propertyType === "commercial" || propertyType === "bureau"
        ? "Quelques détails sur le local"
        : "Quelques détails sur le logement",
    rooms: "Organisez les pièces",
    photos: "Ajoutez les photos de votre bien",
    recap: "Récapitulatif et publication",
  };
  return titles[step];
}

function getStepDescription(step: WizardStep, propertyType: string): string {
  const descriptions: Record<WizardStep, string> = {
    type_bien: "Choisissez le type de bien qui correspond le mieux à votre annonce.",
    address: "L'adresse est essentielle pour les futurs locataires.",
    details: propertyType === "parking"
      ? "Surface et type de stationnement."
      : propertyType === "commercial" || propertyType === "bureau"
        ? "Surface et caractéristiques du local."
        : "Ces informations nous aident à mieux présenter votre bien.",
    rooms: "Décrivez l'agencement intérieur de votre logement.",
    photos: "Mettez en valeur votre bien avec de belles images.",
    recap: "Vérifiez tout avant de publier votre annonce.",
  };
  return descriptions[step];
}

// Fonction pour obtenir le nombre total d'étapes selon le type de bien
function getTotalSteps(propertyType: string): number {
  if (TYPES_WITHOUT_ROOMS_STEP.includes(propertyType)) {
    return 5; // Sans l'étape rooms
  }
  return 6;
}

// Fonction pour obtenir l'index actuel ajusté
function getAdjustedStepIndex(currentStep: WizardStep, propertyType: string): number {
  const stepsOrder: WizardStep[] = ['type_bien', 'address', 'details', 'rooms', 'photos', 'recap'];
  const applicableSteps = TYPES_WITHOUT_ROOMS_STEP.includes(propertyType)
    ? stepsOrder.filter(step => step !== 'rooms')
    : stepsOrder;
  return applicableSteps.indexOf(currentStep) + 1;
}

interface PropertyWizardV3Props {
  propertyId?: string;
  initialData?: Partial<Property>;
  onSuccess?: (propertyId: string) => void;
  onCancel?: () => void;
}

export function PropertyWizardV3({ propertyId, initialData, onSuccess, onCancel }: PropertyWizardV3Props) {
  const router = useRouter();
  const { toast } = useToast();
  const { currentStep, propertyId: storePropertyId, loadProperty, updateFormData, formData, syncStatus, setStep, reset } = usePropertyWizardStore();
  const [showConfetti, setShowConfetti] = useState(false);
  const [showImportStep, setShowImportStep] = useState(!propertyId); // Afficher import step seulement si création
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Initialisation du store avec les données existantes si propertyId est fourni
  const [isInitializing, setIsInitializing] = useState(!!propertyId);

  useEffect(() => {
    if (propertyId && (!storePropertyId || storePropertyId !== propertyId)) {
      setIsInitializing(true);
      loadProperty(propertyId).then(() => {
        // ✅ Si on édite un bien existant, on va directement au récapitulatif
        usePropertyWizardStore.getState().setStep('recap');
        setIsInitializing(false);
      });
    } else {
      setIsInitializing(false);
    }
  }, [propertyId, storePropertyId, loadProperty]);

  const handleImport = async (url: string) => {
    setIsAnalyzing(true);
    try {
        const response = await fetch("/api/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
        });
        const { data, error } = await response.json();
        
        if (error) throw new Error(error);
        
        // Pré-remplir le store avec les données scrapées
        updateFormData({
            type: data.type,
            adresse_complete: data.titre, // Fallback titre comme adresse temporaire
            surface: data.surface,
            loyer_hc: data.loyer_hc,
            code_postal: data.code_postal,
            // On pourrait aussi pré-charger la description etc.
        });
        
        // Passer à l'étape suivante (Address pour corriger l'adresse)
        // On skip TypeStep car on l'a deviné
        usePropertyWizardStore.getState().setStep('address'); 
        setShowImportStep(false);

        toast({
            title: "Import réussi !",
            description: "Vérifiez les informations récupérées.",
        });
    } catch (err) {
        console.error(err);
        toast({
            title: "Erreur d'import",
            description: "Impossible de récupérer les infos. Veuillez remplir manuellement.",
            variant: "destructive",
        });
        // En cas d'erreur, on laisse l'utilisateur continuer manuellement
        setShowImportStep(false);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const CurrentStepComponent = useMemo(() => {
    if (isInitializing) return StepSkeleton;
    return stepComponents[currentStep] || TypeStep;
  }, [currentStep, isInitializing]);

  const handleFinish = async () => {
    if (!storePropertyId) {
      toast({
        title: "Erreur",
        description: "Impossible de publier : le bien n'a pas été initialisé.",
        variant: "destructive",
      });
      return;
    }
    
    // 🎉 Déclencher le confetti avant la redirection
    setShowConfetti(true);
    
    toast({
      title: "🎉 Bien enregistré !",
      description: "Votre annonce est prête. Redirection en cours...",
    });
    
    // Attendre un peu pour voir le confetti
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 🔧 Réinitialiser le wizard après publication pour permettre une nouvelle création
    const finishedPropertyId = storePropertyId;
    reset();
    
    onSuccess?.(finishedPropertyId);
  };

  // Validation pour activer le bouton "Continuer"
  const canGoNext = () => {
    if (syncStatus === 'saving') return false;
    
    switch (currentStep) {
      case 'type_bien': return !!formData.type;
      case 'address': 
        return !!formData.adresse_complete && 
               formData.adresse_complete.length > 5 && 
               !!formData.code_postal && formData.code_postal !== "00000" && 
               !!formData.ville && formData.ville !== "Ville à définir";
      case 'details': return ((formData.surface_habitable_m2 || formData.surface || 0) > 0) && ((formData.loyer_hc || 0) > 0);
      case 'rooms': return true;
      case 'photos': return true;
      case 'recap': return true;
      default: return true;
    }
  };

  // Type de bien actuel
  const propertyType = (formData.type as string) || "";
  
  const currentStepIndex = useMemo(() => {
    return getAdjustedStepIndex(currentStep, propertyType);
  }, [currentStep, propertyType]);

  const totalSteps = useMemo(() => {
    return getTotalSteps(propertyType);
  }, [propertyType]);

  // En mode édition (propertyId présent), masquer la sidebar des étapes
  const isEditMode = !!propertyId;

  // ✅ Logique de navigation personnalisée pour le mode édition
  const nextLabelText = useMemo(() => {
    if (isEditMode && currentStep !== 'recap') return "Valider";
    if (currentStep === 'recap') return isEditMode ? "Enregistrer & Quitter" : "Publier";
    return "Continuer";
  }, [isEditMode, currentStep]);

  const backLabelText = isEditMode && currentStep !== 'recap' ? "Annuler" : "Retour";

  const handleNextStep = isEditMode && currentStep !== 'recap' ? () => setStep('recap') : undefined;
  const handlePrevStep = isEditMode && currentStep !== 'recap' ? () => setStep('recap') : undefined;

  // Si on est sur l'étape d'import initiale (création seulement)
  if (showImportStep && !isInitializing) {
      return (
          <ImmersiveWizardLayout
            title="Bienvenue"
            subtitle="Commençons par définir votre bien."
            stepIndex={0}
            totalSteps={totalSteps}
            canGoNext={false} // Pas de bouton "Suivant" standard ici
            hideSteps={true} // On cache la sidebar pour cette étape spéciale
            onFinish={() => {}}
          >
             <ImportStep 
                onImport={handleImport} 
                onSkip={() => setShowImportStep(false)} 
                isAnalyzing={isAnalyzing}
             />
          </ImmersiveWizardLayout>
      );
  }

  return (
    <>
      <TomAssistant />
      {/* 🎉 Confetti de célébration */}
      <Confetti trigger={showConfetti} particleCount={80} />
      
      <ImmersiveWizardLayout
        title={getStepTitle(currentStep, propertyType)}
        subtitle={getStepDescription(currentStep, propertyType)}
        stepIndex={currentStepIndex}
        totalSteps={totalSteps}
        canGoNext={canGoNext()}
        nextLabel={nextLabelText}
        backLabel={backLabelText}
        onFinish={handleFinish}
        hideSteps={isEditMode}
        onNextStep={handleNextStep}
        onPrevStep={handlePrevStep}
      >
        <CurrentStepComponent />
      </ImmersiveWizardLayout>
    </>
  );
}
