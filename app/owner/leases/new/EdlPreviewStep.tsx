"use client";

/**
 * Wrapper pour l'aperçu EDL dans le wizard de création de bail.
 *
 * Utilise le composant EDLPreview existant avec un HTML pré-généré
 * côté client (aucun appel API supplémentaire). Les données du wizard
 * sont mappées vers le format EDLComplet via mapBailWizardToEdlPreview.
 *
 * @see {@link mapBailWizardToEdlPreview} pour la logique de mapping
 * @see {@link EDLPreview} pour le composant d'aperçu réutilisé
 */

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, AlertCircle, FileText } from "lucide-react";
import {
  mapBailWizardToEdlPreview,
  generateDefaultRooms,
  type BailWizardEdlInput,
} from "@/lib/mappers/bail-wizard-to-edl-preview";
import { generateEDLViergeHTML } from "@/lib/templates/edl";

/** Lazy load EDLPreview pour ne pas alourdir le bundle du wizard */
const EDLPreview = dynamic(
  () =>
    import("@/features/edl/components/edl-preview").then((mod) => ({
      default: mod.EDLPreview,
    })),
  {
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/50 animate-pulse" />
          <p className="text-sm text-muted-foreground">
            Chargement de l&apos;aperçu EDL...
          </p>
        </div>
      </div>
    ),
    ssr: false,
  }
);

interface EdlPreviewStepProps {
  /** Données du wizard de bail à mapper vers le format EDL */
  data: BailWizardEdlInput;
}

/**
 * Composant wrapper qui intègre l'aperçu EDL dans le wizard de bail.
 *
 * - Mappe les données du wizard vers `Partial<EDLComplet>`
 * - Génère le HTML côté client via `generateEDLViergeHTML` (aucun appel API)
 * - Affiche un badge "Aperçu préliminaire" pour distinguer de l'EDL final
 * - Gère l'état vide (pas de propriété sélectionnée)
 * - Mémorise le mapping et la génération HTML pour éviter les re-renders inutiles
 */
export function EdlPreviewStep({ data }: EdlPreviewStepProps) {
  /** Données EDL mappées depuis le wizard */
  const edlData = useMemo(
    () => mapBailWizardToEdlPreview(data),
    [data]
  );

  /** Pièces par défaut basées sur le bien sélectionné */
  const rooms = useMemo(
    () => generateDefaultRooms(data.property?.nb_pieces, data.property?.type),
    [data.property?.nb_pieces, data.property?.type]
  );

  /** HTML pré-généré côté client (pas d'appel API) */
  const generatedHtml = useMemo(() => {
    if (!data.property) return "";
    try {
      return generateEDLViergeHTML(edlData, rooms);
    } catch (error) {
      console.error("[EdlPreviewStep] Erreur génération HTML:", error);
      return "";
    }
  }, [edlData, rooms, data.property]);

  // État vide : pas de propriété sélectionnée
  if (!data.property) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-sm font-medium text-muted-foreground mb-1">
          Aucun bien sélectionné
        </p>
        <p className="text-xs text-muted-foreground">
          Sélectionnez un bien immobilier pour voir l&apos;aperçu
          de l&apos;état des lieux d&apos;entrée.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Badge et description */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <Badge
          variant="outline"
          className="bg-blue-50 text-blue-700 border-blue-200"
        >
          <ClipboardCheck className="h-3 w-3 mr-1" />
          Aperçu préliminaire
        </Badge>
        <span className="text-xs text-muted-foreground">
          Ce document sera complété lors de l&apos;état des lieux d&apos;entrée
        </span>
      </div>

      {/* Composant EDLPreview réutilisé avec HTML pré-généré */}
      <div className="flex-1 min-h-0">
        <EDLPreview
          edlData={edlData}
          isVierge
          rooms={rooms}
          previewHtml={generatedHtml}
        />
      </div>
    </div>
  );
}
