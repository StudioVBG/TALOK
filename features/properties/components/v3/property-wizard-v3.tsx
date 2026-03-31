"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import dynamic from "next/dynamic";
import { usePropertyWizardStore, WizardStep, WizardMode } from "@/features/properties/stores/wizard-store";
import { ImmersiveWizardLayout } from "./immersive/ImmersiveWizardLayout";
import { StepSkeleton } from "./step-skeleton";
import { Confetti } from "@/components/ui/confetti";
import { ImportStep } from "./immersive/steps/ImportStep";
import type { Property } from "@/lib/types";
import { propertySchemaV3 } from "@/lib/validations/property-v3";
import { propertiesService } from "@/features/properties/services/properties.service";
import { TYPES_WITHOUT_ROOMS } from "@/lib/properties/constants";

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
const FeaturesStep = dynamic(() => import("./immersive/steps/FeaturesStep").then((mod) => ({ default: mod.FeaturesStep })), {
  loading: () => <StepSkeleton />,
  ssr: false,
});
const PublishStep = dynamic(() => import("./immersive/steps/PublishStep").then((mod) => ({ default: mod.PublishStep })), {
  loading: () => <StepSkeleton />,
  ssr: false,
});
const RecapStep = dynamic(() => import("./immersive/steps/RecapStep").then((mod) => ({ default: mod.RecapStep })), {
  loading: () => <StepSkeleton />,
  ssr: false,
});

// SOTA 2026 - Étape de configuration d'immeuble
const BuildingConfigStep = dynamic(
  () => import("./immersive/steps/BuildingConfigStep").then((mod) => ({ default: mod.BuildingConfigStep })),
  {
    loading: () => <StepSkeleton />,
    ssr: false,
  }
);

const stepComponents: Record<WizardStep, React.ElementType> = {
  type_bien: TypeStep,
  address: AddressStep,
  details: DetailsStep,
  rooms: RoomsStep,
  photos: PhotosStep,
  features: FeaturesStep,
  publish: PublishStep,
  recap: RecapStep,
  building_config: BuildingConfigStep,  // SOTA 2026
};

// Types de biens qui n'ont PAS d'étape "rooms"
// Source unique : @/lib/properties/constants (TYPES_WITHOUT_ROOMS)
const TYPES_WITHOUT_ROOMS_STEP = TYPES_WITHOUT_ROOMS;

// Titres des étapes selon le type de bien
function getStepTitle(step: WizardStep, propertyType: string): string {
  const titles: Record<WizardStep, string> = {
    type_bien: "Quel type de bien souhaitez-vous ajouter ?",
    address: propertyType === "immeuble" 
      ? "Où se situe votre immeuble ?"
      : "Où se situe votre bien ?",
    building_config: "Configurez votre immeuble",  // SOTA 2026
    details: propertyType === "parking" 
      ? "Quelques détails sur le parking" 
      : propertyType === "commercial" || propertyType === "bureau"
        ? "Quelques détails sur le local"
        : "Quelques détails sur le logement",
    rooms: "Organisez les pièces",
    photos: "Ajoutez les photos de votre bien",
    features: "Équipements & caractéristiques",
    publish: "Disponibilité & visibilité",
    recap: "Récapitulatif et publication",
  };
  return titles[step];
}

function getStepDescription(step: WizardStep, propertyType: string): string {
  const descriptions: Record<WizardStep, string> = {
    type_bien: "Choisissez le type de bien qui correspond le mieux à votre annonce.",
    address: propertyType === "immeuble"
      ? "L'adresse de votre immeuble est essentielle."
      : "L'adresse est essentielle pour les futurs locataires.",
    building_config: "Définissez les étages et ajoutez vos lots en quelques clics.",  // SOTA 2026
    details: propertyType === "parking"
      ? "Surface et type de stationnement."
      : propertyType === "commercial" || propertyType === "bureau"
        ? "Surface et caractéristiques du local."
        : "Ces informations nous aident à mieux présenter votre bien.",
    rooms: "Décrivez l'agencement intérieur de votre logement.",
    photos: propertyType === "immeuble"
      ? "Ajoutez des photos de la façade et des parties communes."
      : "Mettez en valeur votre bien avec de belles images.",
    features: "Quels sont les atouts et équipements de votre bien ?",
    publish: "Définissez quand et comment votre annonce sera visible.",
    recap: "Vérifiez tout avant de publier votre annonce.",
  };
  return descriptions[step];
}

interface PropertyWizardV3Props {
  propertyId?: string;
  initialData?: Partial<Property>;
  onSuccess?: (propertyId: string) => void;
  onCancel?: () => void;
}

export function PropertyWizardV3({ propertyId, initialData, onSuccess, onCancel }: PropertyWizardV3Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  // Mapping interne des étapes pour calculs (doit correspondre à wizard-store.ts)
  const STEPS_ORDER: WizardStep[] = ['type_bien', 'address', 'details', 'rooms', 'photos', 'features', 'publish', 'recap'];
  const FAST_STEPS: WizardStep[] = ['type_bien', 'address', 'photos', 'recap'];
  const BUILDING_STEPS: WizardStep[] = ['type_bien', 'address', 'building_config', 'photos', 'recap'];

  const { 
    currentStep, 
    propertyId: storePropertyId, 
    loadProperty, 
    updateFormData, 
    formData, 
    syncStatus, 
    setStep, 
    mode,
    setMode,
    reset,
    pendingPhotoUrls,
    photoImportStatus,
    importPendingPhotos,
    initializeDraft,
  } = usePropertyWizardStore();

  const getApplicableSteps = useCallback((type: string, currentMode: WizardMode) => {
    if (type === 'immeuble') return BUILDING_STEPS;
    let steps = currentMode === 'fast' ? FAST_STEPS : STEPS_ORDER;
    if (type && TYPES_WITHOUT_ROOMS_STEP.includes(type)) {
      return steps.filter(s => s !== 'rooms');
    }
    return steps;
  }, []);

  const totalSteps = useMemo(() => {
    return getApplicableSteps(formData.type as string || "", mode).length;
  }, [formData.type, mode, getApplicableSteps]);

  const currentStepIndex = useMemo(() => {
    const applicableSteps = getApplicableSteps(formData.type as string || "", mode);
    return applicableSteps.indexOf(currentStep) + 1;
  }, [currentStep, formData.type, mode, getApplicableSteps]);
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

  // 🆕 Import automatique des photos quand le propertyId devient disponible
  useEffect(() => {
    if (storePropertyId && pendingPhotoUrls.length > 0 && photoImportStatus === 'idle') {
      console.info(`[Wizard] PropertyId disponible, lancement de l'import de ${pendingPhotoUrls.length} photos...`);
      importPendingPhotos();
    }
  }, [storePropertyId, pendingPhotoUrls.length, photoImportStatus, importPendingPhotos]);

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
        // ⚠️ Ne JAMAIS utiliser le titre comme adresse !
        const formUpdate: Record<string, any> = {
            type: data.type || "appartement",
        };
        
        // Adresse : utiliser l'adresse complète ou l'adresse simple
        if (data.adresse_complete) {
            formUpdate.adresse_complete = data.adresse_complete;
        } else if (data.adresse) {
            formUpdate.adresse_complete = data.adresse;
        }
        // Ne pas pré-remplir avec le titre, l'utilisateur devra saisir manuellement
        
        // Code postal et ville
        if (data.code_postal) {
            formUpdate.code_postal = data.code_postal;
        }
        if (data.ville) {
            formUpdate.ville = data.ville;
        }
        
        // Description du bien (pour affichage / notes)
        if (data.description && data.description.length > 50) {
            formUpdate.description = data.description;
        }
        
        // Autres données de base
        if (data.surface) {
            formUpdate.surface = data.surface;
            formUpdate.surface_habitable_m2 = data.surface;
        }
        if (data.nb_pieces) formUpdate.nb_pieces = data.nb_pieces;
        if (data.nb_chambres) formUpdate.nb_chambres = data.nb_chambres;
        if (data.loyer_hc) formUpdate.loyer_hc = data.loyer_hc;
        
        // 🆕 Détails avancés extraits
        if (data.meuble !== null && data.meuble !== undefined) {
            formUpdate.meuble = data.meuble;
        }
        if (data.dpe_classe_energie) {
            formUpdate.dpe_classe_energie = data.dpe_classe_energie.toUpperCase();
        }
        // ✅ GES -> dpe_classe_climat (nom de la colonne en BDD)
        if (data.dpe_ges) {
            formUpdate.dpe_classe_climat = data.dpe_ges.toUpperCase();
        }
        if (data.etage !== null && data.etage !== undefined) {
            formUpdate.etage = data.etage;
        }
        if (data.ascenseur !== null && data.ascenseur !== undefined) {
            formUpdate.ascenseur = data.ascenseur;
        }
        
        // ✅ Mapper vers les bons noms de champs (has_xxx)
        if (data.balcon) formUpdate.has_balcon = true;
        if (data.terrasse) formUpdate.has_terrasse = true;
        if (data.cave) formUpdate.has_cave = true;
        if (data.jardin) formUpdate.has_jardin = true;
        
        // 🏠 Visite virtuelle (Matterport, Nodalview, etc.)
        if (data.visite_virtuelle_url) {
            formUpdate.visite_virtuelle_url = data.visite_virtuelle_url;
            console.info(`[Wizard] Visite virtuelle détectée: ${data.visite_virtuelle_url}`);
        }
        
        // ✅ Chauffage : mapper vers les bons champs du schéma
        // chauffage_type dans le schéma = mode (individuel/collectif/aucun)
        // chauffage_energie dans le schéma = source d'énergie (gaz/electricite/fioul/bois/etc.)
        if (data.chauffage_type || data.chauffage_mode) {
            // Mapper l'énergie de chauffage (gaz, electrique, fioul, etc.)
            const energieMapping: Record<string, string> = {
                gaz: 'gaz',
                electrique: 'electricite',
                électrique: 'electricite',
                pac: 'electricite', // Pompe à chaleur = électrique
                fioul: 'fioul',
                bois: 'bois',
            };
            
            const modeMapping: Record<string, string> = {
                collectif: 'collectif',
                individuel: 'individuel',
            };
            
            // Si chauffage_type contient une énergie, la mapper
            if (data.chauffage_type && energieMapping[data.chauffage_type]) {
                formUpdate.chauffage_energie = energieMapping[data.chauffage_type];
            }
            
            // Si chauffage_mode contient un mode, le mapper
            if (data.chauffage_mode && modeMapping[data.chauffage_mode]) {
                formUpdate.chauffage_type = modeMapping[data.chauffage_mode];
            }
            // Si chauffage_type contient un mode (individuel/collectif)
            else if (data.chauffage_type && modeMapping[data.chauffage_type]) {
                formUpdate.chauffage_type = modeMapping[data.chauffage_type];
            }
        }
        
        // 🆕 IMPORTANT: Créer le draft AVANT de mettre à jour les données
        // Sinon le propertyId n'existe pas et les pièces/photos ne peuvent pas être sauvegardées
        const detectedType = (formUpdate.type || "appartement") as any;
        console.info(`[Wizard] Création du draft avec type: ${detectedType}`);
        await initializeDraft(detectedType);
        
        // Maintenant on peut mettre à jour les données
        updateFormData(formUpdate);
        
        // 🆕 Stocker les URLs des photos pour import en arrière-plan
        if (data.photos && data.photos.length > 0) {
            usePropertyWizardStore.getState().setPendingPhotoUrls(data.photos);
            console.info(`[Wizard] ${data.photos.length} photos en attente d'import`);
        }
        
        // Passer à l'étape suivante (Address pour corriger/compléter l'adresse)
        usePropertyWizardStore.getState().setStep('address'); 
        setShowImportStep(false);

        // Feedback adapté selon la qualité de l'extraction
        const quality = data.extraction_quality || {};
        const missingFields = [];
        if (!quality.has_address) missingFields.push("adresse");
        if (!quality.has_postal_code) missingFields.push("code postal");
        if (!quality.has_city) missingFields.push("ville");
        
        // Compter les champs trouvés
        const foundFields = [];
        if (data.surface) foundFields.push("surface");
        if (data.loyer_hc) foundFields.push("loyer");
        if (data.nb_pieces) foundFields.push("pièces");
        if (data.meuble !== null) foundFields.push("meublé");
        if (data.dpe_classe_energie) foundFields.push("DPE");
        if (data.chauffage_type) foundFields.push("chauffage");
        if (data.etage !== null) foundFields.push("étage");
        
        // Message avec info photos
        const photosInfo = quality.photos_count > 0 
            ? ` 📷 ${quality.photos_count} photo(s) en import.`
            : "";
        
        if (missingFields.length > 0) {
            toast({
                title: "Import partiel",
                description: `${foundFields.length} info(s) récupérées. Complétez : ${missingFields.join(", ")}.${photosInfo}`,
                variant: "default",
            });
        } else {
            const detailsInfo = foundFields.length > 3 
                ? `${foundFields.length} informations récupérées !` 
                : `Infos : ${foundFields.join(", ")}.`;
            toast({
                title: "✨ Import réussi !",
                description: `${detailsInfo}${photosInfo}`,
            });
        }
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

    // Validation Zod finale avant publication
    const validation = propertySchemaV3.safeParse(formData);
    if (!validation.success) {
      const firstErrors = validation.error.errors.slice(0, 3);
      const errorMessages = firstErrors.map((e) => e.message).join(", ");
      toast({
        title: "Données incomplètes",
        description: errorMessages || "Veuillez vérifier les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    // SOTA 2026: Persister les lots d'immeuble avant publication
    if (formData.type === "immeuble" && (formData.building_units as unknown[] | undefined)?.length) {
      const units = (formData.building_units as Array<{ floor: number; position: string; type: string; surface: number; nb_pieces: number; loyer_hc: number; charges: number; depot_garantie: number; status?: string; template?: string }>) ?? [];
      try {
        const res = await fetch(`/api/properties/${storePropertyId}/building-units`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            building_floors: formData.building_floors ?? 1,
            has_ascenseur: formData.has_ascenseur,
            has_gardien: formData.has_gardien,
            has_interphone: formData.has_interphone,
            has_digicode: formData.has_digicode,
            has_local_velo: formData.has_local_velo,
            has_local_poubelles: formData.has_local_poubelles,
            units: units.map((u) => ({
              floor: u.floor,
              position: u.position ?? "A",
              type: u.type,
              surface: u.surface,
              nb_pieces: u.nb_pieces ?? 0,
              loyer_hc: u.loyer_hc ?? 0,
              charges: u.charges ?? 0,
              depot_garantie: u.depot_garantie ?? 0,
              status: u.status ?? "vacant",
              template: u.template ?? null,
            })),
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Erreur enregistrement lots");
        }
      } catch (err) {
        toast({
          title: "Erreur immeuble",
          description: err instanceof Error ? err.message : "Impossible d'enregistrer les lots.",
          variant: "destructive",
        });
        return;
      }
    }
    
    try {
      await propertiesService.submitProperty(storePropertyId);
    } catch (err) {
      toast({
        title: "Publication impossible",
        description: err instanceof Error ? err.message : "Le bien n'a pas pu être soumis.",
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
  // SOTA 2026: Validation améliorée avec feedback détaillé
  const canGoNext = () => {
    // Permettre la navigation même pendant la sauvegarde (optimistic UI)
    // Seulement bloquer si erreur critique
    // Note: syncStatus === 'saving' ne bloque plus pour éviter les blocages

    switch (currentStep) {
      case 'type_bien': return !!formData.type;
      case 'address':
        return !!formData.adresse_complete &&
               formData.adresse_complete.length > 5 &&
               !!formData.code_postal && formData.code_postal !== "00000" &&
               !!formData.ville && formData.ville !== "Ville à définir";
      case 'details':
        const hasSurface = (formData.surface_habitable_m2 || formData.surface || 0) > 0;
        const hasLoyer = (formData.loyer_hc || 0) > 0;
        const hasChauffage = !!(formData as any).chauffage_type;
        const needsChauffageEnergie = (formData as any).chauffage_type && (formData as any).chauffage_type !== "aucun";
        const hasChauffageEnergie = needsChauffageEnergie ? !!(formData as any).chauffage_energie : true;
        const hasEauChaude = !!(formData as any).eau_chaude_type;

        // Debug: Log des champs manquants pour faciliter le diagnostic
        if (process.env.NODE_ENV === 'development') {
          const missing: string[] = [];
          if (!hasSurface) missing.push('Surface');
          if (!hasLoyer) missing.push('Loyer HC');
          if (!hasChauffage) missing.push('Type chauffage');
          if (!hasChauffageEnergie) missing.push('Énergie chauffage');
          if (!hasEauChaude) missing.push('Eau chaude');
          if (missing.length > 0) {
            console.log('[Wizard] Champs manquants étape details:', missing.join(', '));
          }
        }

        return hasSurface && hasLoyer && hasChauffage && hasChauffageEnergie && hasEauChaude;
      case 'building_config':
        return (formData.building_floors ?? 0) > 0 && ((formData.building_units as unknown[] | undefined)?.length ?? 0) > 0;
      case 'rooms': return true;
      case 'photos': return true;
      case 'features': return true;
      case 'publish': return true;
      case 'recap': return true;
      default: return true;
    }
  };

  // Type de bien actuel
  const propertyType = (formData.type as string) || "";
  
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
