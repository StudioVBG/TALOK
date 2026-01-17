/**
 * RecapStep - Composant de récapitulatif & soumission V3 avec preview professionnel
 * 
 * Sources :
 * - Modèle V3 section 2.7 : Étape 6 - Récapitulatif & soumission
 * - Composant existant : features/properties/components/executive-summary.tsx
 * - Design SOTA 2025 : Preview professionnel avec animations fluides, bouton soumission
 * 
 * Ce composant affiche un récapitulatif synthétique par bloc avec bouton "Soumettre pour validation"
 */

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExecutiveSummary, type SummaryRoom } from "@/features/properties/components/executive-summary";
import { CheckCircle2, AlertCircle, Loader2, Send } from "lucide-react";
import type { PropertyTypeV3, RoomV3, PhotoV3 } from "@/lib/types/property-v3";
import type { Room, Photo } from "@/lib/types";
import { containerVariants } from "@/lib/design-system/animations";
import { WizardStepLayout } from "@/lib/design-system/wizard-layout";

interface RecapStepProps {
  propertyId?: string;
  type_bien: PropertyTypeV3;
  data: Record<string, any>;
  rooms?: (Room | RoomV3)[];
  photos?: (Photo | PhotoV3)[];
  parkingDetails?: any;
  onSubmit: () => Promise<void>;
  onEdit?: (stepId: string) => void;
  isSubmitting?: boolean;
  errors?: string[];
  stepNumber?: number;
  totalSteps?: number;
  mode?: "fast" | "full" | "unified";
  onModeChange?: (mode: "fast" | "full" | "unified") => void;
  onBack?: () => void;
  microCopy?: string;
}

// Animation pour les sections de récapitulatif
const sectionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3 },
  },
};

export function RecapStep({
  propertyId,
  type_bien,
  data,
  rooms = [],
  photos = [],
  parkingDetails,
  onSubmit,
  onEdit,
  isSubmitting = false,
  errors = [],
  stepNumber = 1,
  totalSteps = 8,
  mode = "full",
  onModeChange,
  onBack,
  microCopy,
}: RecapStepProps) {
  const [validationErrors, setValidationErrors] = useState<string[]>(errors);

  // Conversion rooms vers SummaryRoom
  const summaryRooms: SummaryRoom[] = rooms.map((room) => ({
    id: room.id,
    name: room.label_affiche,
    surface: room.surface_m2,
    heating: room.chauffage_present,
    cooling: room.clim_presente,
    photosReady: photos.some((p) => p.room_id === room.id),
  }));

  const handleSubmit = async () => {
    setValidationErrors([]);
    try {
      await onSubmit();
    } catch (error: unknown) {
      setValidationErrors([error instanceof Error ? error.message : "Erreur lors de la soumission"]);
    }
  };

  return (
    <WizardStepLayout
      title="Récapitulatif"
      description="Vérifiez l'ensemble avant validation"
      stepNumber={stepNumber}
      totalSteps={totalSteps}
      mode={mode}
      onModeChange={onModeChange}
      progressValue={(stepNumber / totalSteps) * 100}
      onBack={onBack}
      onNext={handleSubmit}
      canGoNext={!isSubmitting}
      nextLabel={isSubmitting ? "Soumission..." : "Soumettre pour validation"}
      microCopy={microCopy || "Tout est prêt ! Soumettez votre logement 🎉"}
      showModeSwitch={false}
    >
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
        {/* Erreurs de validation */}
      <AnimatePresence>
        {validationErrors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-lg border border-destructive/50 bg-destructive/10 p-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1 space-y-1">
                <h3 className="font-semibold text-destructive">Erreurs de validation</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-destructive/90">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview ExecutiveSummary avec animations */}
      <motion.div
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        className="rounded-3xl bg-gradient-to-br from-slate-900 via-primary/10 to-slate-900 p-6"
      >
        <ExecutiveSummary
          data={data}
          rooms={summaryRooms}
          parkingDetails={parkingDetails}
          actionSlot={
            onEdit ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit("pieces-photos")}
                className="border-white/40 bg-transparent text-white hover:bg-white/15"
              >
                Modifier pièces & photos
              </Button>
            ) : undefined
          }
        />
      </motion.div>

      {/* Sections de récapitulatif détaillé */}
      <motion.div
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        className="grid gap-6 md:grid-cols-2"
      >
        {/* Bloc 1 : Type & Adresse */}
        <motion.div variants={itemVariants}>
          <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Type & Adresse</h3>
                {onEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit("type-usage")}
                  >
                    Modifier
                  </Button>
                )}
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="w-24 text-muted-foreground">Type</dt>
                  <dd className="font-medium">{data.type_bien}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 text-muted-foreground">Adresse</dt>
                  <dd className="font-medium">
                    {data.adresse_complete}, {data.code_postal} {data.ville}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bloc 2 : Conditions de location */}
        <motion.div variants={itemVariants}>
          <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Conditions de location</h3>
                {onEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit("conditions")}
                  >
                    Modifier
                  </Button>
                )}
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <dt className="w-32 text-muted-foreground">Loyer HC</dt>
                  <dd className="font-medium">{data.loyer_hc || 0} € / mois</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-32 text-muted-foreground">Charges</dt>
                  <dd className="font-medium">{data.charges_mensuelles || 0} € / mois</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-32 text-muted-foreground">Dépôt</dt>
                  <dd className="font-medium">{data.depot_garantie || 0} €</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-32 text-muted-foreground">Type bail</dt>
                  <dd className="font-medium">{data.type_bail || "À définir"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bloc 3 : Infos essentielles & confort */}
        <motion.div variants={itemVariants}>
          <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Informations essentielles</h3>
                {onEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit("equipments-info")}
                  >
                    Modifier
                  </Button>
                )}
              </div>
              <dl className="space-y-2 text-sm">
                {data.surface_habitable_m2 && (
                  <div className="flex gap-2">
                    <dt className="w-32 text-muted-foreground">Surface</dt>
                    <dd className="font-medium">{data.surface_habitable_m2} m²</dd>
                  </div>
                )}
                {data.nb_pieces && (
                  <div className="flex gap-2">
                    <dt className="w-32 text-muted-foreground">Pièces</dt>
                    <dd className="font-medium">{data.nb_pieces}</dd>
                  </div>
                )}
                {data.nb_chambres && (
                  <div className="flex gap-2">
                    <dt className="w-32 text-muted-foreground">Chambres</dt>
                    <dd className="font-medium">{data.nb_chambres}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bloc 4 : Pièces & photos */}
        <motion.div variants={itemVariants}>
          <Card className="border-border/50 bg-background/80 backdrop-blur-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Pièces & photos</h3>
                {onEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit("pieces-photos")}
                  >
                    Modifier
                  </Button>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`h-4 w-4 ${
                      rooms.length > 0 ? "text-green-500" : "text-muted-foreground"
                    }`}
                  />
                  <span>
                    {rooms.length > 0
                      ? `${rooms.length} pièce(s) déclarée(s)`
                      : "Aucune pièce déclarée"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`h-4 w-4 ${
                      photos.length > 0 ? "text-green-500" : "text-muted-foreground"
                    }`}
                  />
                  <span>
                    {photos.length > 0
                      ? `${photos.length} photo(s) ajoutée(s)`
                      : "Aucune photo ajoutée"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Message d'aide */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="rounded-lg border border-border/50 bg-muted/30 p-4"
      >
        <p className="text-sm text-muted-foreground">
          💡 <strong>Rappel :</strong> Après validation, le logement sera visible dans votre
          tableau de bord. Vous pourrez ensuite créer des baux, gérer les locataires et suivre les
          paiements.
        </p>
      </motion.div>
      </motion.div>
    </WizardStepLayout>
  );
}

