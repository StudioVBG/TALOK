"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import { ownerProfileOnboardingSchema } from "@/lib/validations/onboarding";
import { TomOnboarding } from "@/components/ai/tom-onboarding";
import { UpdateOwnerProfileArgs } from "@/lib/ai/tools-schema";
import { apiClient } from "@/lib/api-client";

export default function OwnerProfileOnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    type: "particulier" as "particulier" | "societe",
    raison_sociale: "",
    siren: "",
    siret: "",
    tva: "",
    ubo: "",
  });

  useEffect(() => {
    // Charger le brouillon si disponible
    onboardingService.getDraft().then((draft) => {
      if (draft?.data && draft.role === "owner") {
        setFormData((prev) => ({
          ...prev,
          ...(draft.data as any),
        }));
      }
    });
  }, []);

  // Cette fonction est appelée par Tom à chaque fois qu'il extrait des infos
  const handleTomUpdate = (data: UpdateOwnerProfileArgs) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  // Cette fonction est appelée quand Tom a fini la conversation
  const handleTomComplete = async () => {
    setLoading(true);

    try {
      // On valide ce qu'on a récolté (Tom a déjà structuré, mais on revérifie)
      const validated = ownerProfileOnboardingSchema.parse(formData);

      // Créer ou mettre à jour le profil propriétaire via API sécurisée
      await apiClient.put("/me/owner-profile", {
        type: validated.type,
        siret: validated.siret || null,
        tva: validated.tva || null,
        raison_sociale: validated.type === "societe" ? (validated as any).raison_sociale || null : null,
      });

      // Sauvegarder le brouillon et marquer terminé
      await onboardingService.saveDraft("owner_profile", validated, "owner");
      await onboardingService.markStepCompleted("owner_profile", "owner");

      toast({
        title: "Profil configuré avec succès !",
        description: "Merci Tom ! Redirection vers l'étape suivante...",
      });

      // Rediriger vers les paramètres financiers
      router.push("/owner/onboarding/finance");
    } catch (error: unknown) {
      console.error(error);
      toast({
        title: "Erreur de sauvegarde",
        description: "Il manque peut-être des informations. Tom va vous aider.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-5 gap-8">
        
        {/* Colonne gauche : Infos contextuelles */}
        <div className="hidden md:flex md:col-span-2 flex-col justify-center space-y-6 p-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Bienvenue.</h1>
            <p className="text-lg text-muted-foreground">Configurons votre espace propriétaire ensemble.</p>
          </div>
          
          <div className="space-y-4">
            <div className="p-4 bg-card rounded-xl shadow-sm border border-border">
              <div className="text-sm font-medium text-muted-foreground mb-1">Type</div>
              <div className="text-lg font-semibold capitalize">{formData.type}</div>
            </div>
            
            {formData.type === 'societe' && (
               <div className="p-4 bg-card rounded-xl shadow-sm border border-border">
                <div className="text-sm font-medium text-muted-foreground mb-1">Société</div>
                <div className="font-semibold">{formData.raison_sociale || "..."}</div>
                {formData.siret && <div className="text-sm text-muted-foreground font-mono mt-1">{formData.siret}</div>}
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite : Tom */}
        <div className="md:col-span-3">
           <TomOnboarding onDataUpdate={handleTomUpdate} onComplete={handleTomComplete} />
        </div>
        
      </div>
    </div>
  );
}
