"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutationWithToast } from "@/lib/hooks/use-mutation-with-toast";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Building2,
  MapPin,
  FolderOpen,
  Edit,
  X,
  Check,
  Loader2,
  Camera,
  Trash2,
  Plus,
  FileText,
  ImageIcon,
  Euro,
  Shield,
  Video,
  Key,
  Phone,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatCurrency } from "@/lib/helpers/format";
import { useToast } from "@/components/ui/use-toast";
import type { PropertyDetails } from "../../_data/fetchPropertyDetails";
import { PropertyMetersSection } from "@/components/owner/properties/PropertyMetersSection";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { EntityNotes } from "@/components/ui/entity-notes";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useSubscription } from "@/components/subscription";
import Image from "next/image";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Navigation, CheckCircle2 } from "lucide-react";
import dynamic from "next/dynamic";
import type { OwnerProperty, PropertyPhoto, LeaseInfo, TenantInfo, EdlInfo } from "@/lib/types/owner-property";
import type { Ticket } from "@/lib/types";
import { PropertyCharacteristicsBadges } from "./components/PropertyCharacteristicsBadges";
import { PropertyEditForm } from "./components/PropertyEditForm";
import { TicketListUnified } from "@/features/tickets/components/ticket-list-unified";
import { ticketsService } from "@/features/tickets/services/tickets.service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PropertyAnnouncementTab } from "@/features/properties/components/v3/property-announcement-tab";
import { PropertyRoomsPhotosTab } from "@/features/properties/components/v3/property-rooms-photos-tab";

// Import dynamique de la carte pour éviter les erreurs SSR
const PropertyMap = dynamic(
  () => import("@/components/maps/property-map").then((mod) => mod.PropertyMap),
  { 
    ssr: false,
    loading: () => (
      <div className="h-[200px] bg-muted/50 rounded-xl flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <MapPin className="h-6 w-6 animate-pulse" />
          <span className="text-sm">Chargement de la carte...</span>
        </div>
      </div>
    )
  }
);

interface PropertyDetailsClientProps {
  details: PropertyDetails;
  propertyId: string;
  /**
   * Item #13 : contexte parent pour breadcrumb "Mes biens > Immeuble > Lot"
   * et badge cliquable. Null si la property n'est pas un lot d'immeuble.
   */
  parentBuilding?: { id: string; adresse_complete: string | null } | null;
}

// Mapping type de bien → label CTA bail adapté + route
function getLeaseCtaForPropertyType(propertyType: string | undefined, propertyId: string): { label: string; href: string; description: string } {
  switch (propertyType) {
    case "parking":
    case "box":
      return {
        label: "Créer un contrat de parking",
        href: `/owner/leases/parking/new?propertyId=${propertyId}`,
        description: "Contrat de location de stationnement adapté à votre emplacement.",
      };
    case "local_commercial":
    case "fonds_de_commerce":
      return {
        label: "Créer un bail commercial",
        href: `/owner/leases/new?propertyId=${propertyId}`,
        description: "Bail commercial 3/6/9 ou dérogatoire pour votre local.",
      };
    case "bureaux":
      return {
        label: "Créer un bail professionnel",
        href: `/owner/leases/new?propertyId=${propertyId}`,
        description: "Bail professionnel ou commercial pour vos bureaux.",
      };
    case "entrepot":
      return {
        label: "Créer un bail commercial",
        href: `/owner/leases/new?propertyId=${propertyId}`,
        description: "Bail commercial ou professionnel pour votre entrepôt.",
      };
    case "immeuble":
      return {
        label: "Créer un bail pour un lot",
        href: `/owner/leases/new?propertyId=${propertyId}`,
        description: "Créez un bail pour l'un des lots de votre immeuble.",
      };
    case "terrain_agricole":
    case "exploitation_agricole":
      return {
        label: "Créer un bail rural",
        href: `/owner/leases/new?propertyId=${propertyId}`,
        description: "Bail rural adapté à votre exploitation (Art. L.411-1 Code Rural).",
      };
    default:
      return {
        label: "Créer un bail",
        href: `/owner/leases/new?propertyId=${propertyId}`,
        description: "Bail d'habitation adapté à votre bien.",
      };
  }
}

export function PropertyDetailsClient({ details, propertyId, parentBuilding }: PropertyDetailsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { refresh: refreshSubscription } = useSubscription();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [property, setProperty] = useState(details.property);
  const [photos, setPhotos] = useState(details.photos || []);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // ========== DÉTECTION NOUVELLE CRÉATION ==========
  const isNewlyCreated = searchParams.get("new") === "true";
  const [showNewPropertyBanner, setShowNewPropertyBanner] = useState(isNewlyCreated);

  // Supprimer le param ?new=true de l'URL sans recharger
  useEffect(() => {
    if (isNewlyCreated) {
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [isNewlyCreated]);

  // CTA bail adapté au type de bien
  const leaseCta = useMemo(
    () => getLeaseCtaForPropertyType(property.type, propertyId),
    [property.type, propertyId]
  );

  // ========== MODE ÉDITION GLOBAL ==========
  const [isEditing, setIsEditing] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [pendingPhotoUrls, setPendingPhotoUrls] = useState<string[]>([]);
  const [photosToDelete, setPhotosToDelete] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  // Statut visuel par index dans pendingPhotos : 'pending' (à enregistrer),
  // 'uploading' (upload en cours), 'failed' (échec). Permet d'afficher un
  // badge clair par photo et de retenir les fichiers en échec après save.
  const [uploadStatuses, setUploadStatuses] = useState<Record<number, "pending" | "uploading" | "failed">>({});
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // ========== INLINE EDIT: Accès & Sécurité ==========
  const [isEditingAccess, setIsEditingAccess] = useState(false);
  const [accessDigicode, setAccessDigicode] = useState(property.digicode || "");
  const [accessInterphone, setAccessInterphone] = useState(property.interphone || "");
  const [isSavingAccess, setIsSavingAccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    ticketsService.getTicketsByProperty(propertyId).then((data) => {
      if (!cancelled) setTickets(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [propertyId]);

  const { leases = [] } = details;
  // Chercher un bail existant (tous les statuts sauf terminated/archived)
  const existingLease = leases.find((l: any) => 
    ["active", "pending_signature", "draft", "fully_signed", "partially_signed", "sent"].includes(l.statut)
  );
  const isLeaseActive = existingLease?.statut === "active";
  const isLeasePending = existingLease?.statut === "pending_signature";
  const isLeaseSigned = existingLease?.statut === "fully_signed";
  const isLeasePartiallySigned = existingLease?.statut === "partially_signed";
  
  // Vérifier si un EDL d'entrée est signé pour ce bail
  const entryEdl = existingLease?.edls?.find((e: any) => e.type === 'entree');
  const edlIsSigned = entryEdl?.status === 'signed';
  const edlDraft = entryEdl && ["draft", "scheduled", "in_progress", "completed"].includes(entryEdl.status) ? entryEdl : null;

  // ========== MUTATIONS ==========
  const activateLease = useMutationWithToast({
    mutationFn: async (leaseId: string) => {
      // ✅ SOTA 2026: Utiliser la route d'activation dédiée (avec EDL et facturation)
      await apiClient.post(`/leases/${leaseId}/activate`, {});
    },
    successMessage: "Bail activé avec succès ! La facture initiale a été générée.",
    invalidateQueries: ["property-details", propertyId],
    onSuccess: () => {
      router.refresh();
    }
  });

  const handleManualActivation = () => {
    if (existingLease?.id) {
      activateLease.mutate(existingLease.id);
    }
  };

  const deleteProperty = useMutationWithToast({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/properties/${id}`);
    },
    successMessage: "Bien supprimé avec succès",
    errorMessage: (error: Error) => {
      const msg = (error as Error & { response?: { error?: string; details?: string } })?.response;
      if (msg?.details?.includes("bail actif") || msg?.details?.includes("active")) {
        return "Impossible de supprimer : ce bien a un bail en cours. Résiliez-le d'abord.";
      }
      if (msg?.details?.includes("bail") || msg?.details?.includes("lease")) {
        return "Impossible de supprimer : ce bien a un bail en attente de signature.";
      }
      return msg?.error || msg?.details || "Impossible de supprimer le bien.";
    },
    invalidateQueries: ["property-details", propertyId],
    onSuccess: () => {
      refreshSubscription();
      router.push("/owner/properties");
    },
  });

  const handleDelete = () => {
    if (propertyId) {
      deleteProperty.mutate(propertyId);
    }
  };

  // ========== GESTION DU MODE ÉDITION ==========
  // Note : on N'INITIALISE PAS editedValues avec les valeurs de la property.
  // getValue() tombe sur la valeur de property si la clé n'est pas dans editedValues.
  // Conséquence : seuls les champs réellement modifiés par l'utilisateur sont
  // envoyés au PATCH (évite d'écraser des champs non touchés).
  const handleStartEditing = () => {
    setEditedValues({});
    setPendingPhotos([]);
    setPendingPhotoUrls([]);
    setPhotosToDelete([]);
    setUploadStatuses({});
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    // Cleanup URL objects
    pendingPhotoUrls.forEach((url) => URL.revokeObjectURL(url));
    setIsEditing(false);
    setEditedValues({});
    setPendingPhotos([]);
    setPendingPhotoUrls([]);
    setPhotosToDelete([]);
    setUploadStatuses({});
  };

  // ========== SAUVEGARDE GLOBALE ==========
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      // Construire le payload — diff vs property initial pour n'envoyer QUE les
      // champs réellement modifiés (évite d'écraser le loyer à 0, le DPE à null,
      // un switch à false, etc., quand l'utilisateur n'y a pas touché).
      const propertyType = property.type || "";
      const isParking = ["parking", "box"].includes(propertyType);
      const isPro = ["local_commercial", "bureaux", "entrepot", "fonds_de_commerce"].includes(propertyType);
      const isHabitation = ["appartement", "maison", "studio", "colocation", "saisonnier"].includes(propertyType);

      const initial = property as Record<string, unknown>;
      const payload: Record<string, unknown> = {};

      const toNumberOrNull = (v: unknown): number | null => {
        if (v === "" || v === null || v === undefined) return null;
        const n = typeof v === "number" ? v : parseFloat(String(v));
        return Number.isFinite(n) ? n : null;
      };
      const toIntOrNull = (v: unknown): number | null => {
        if (v === "" || v === null || v === undefined) return null;
        const n = typeof v === "number" ? v : parseInt(String(v).trim(), 10);
        return Number.isFinite(n) ? n : null;
      };
      const sameValue = (a: unknown, b: unknown) => {
        // null/undefined/'' considérés comme équivalents (évite faux diff)
        const norm = (x: unknown) => (x === undefined || x === "" ? null : x);
        return norm(a) === norm(b);
      };
      const setIfChanged = (key: string, value: unknown) => {
        if (sameValue(initial[key], value)) return;
        payload[key] = value;
      };

      // Champs texte communs
      const textFields = ["adresse_complete", "complement_adresse", "code_postal", "ville", "visite_virtuelle_url"];
      for (const f of textFields) {
        if (editedValues[f] === undefined) continue;
        setIfChanged(f, editedValues[f] === "" ? null : editedValues[f]);
      }

      // Financier (si présents dans le formulaire)
      if (editedValues.loyer_hc !== undefined) setIfChanged("loyer_hc", toNumberOrNull(editedValues.loyer_hc));
      if (editedValues.charges_mensuelles !== undefined) setIfChanged("charges_mensuelles", toNumberOrNull(editedValues.charges_mensuelles));
      if (editedValues.depot_garantie !== undefined) setIfChanged("depot_garantie", toNumberOrNull(editedValues.depot_garantie));

      // Encadrement des loyers (loi ALUR/ELAN) — applicable surtout en habitation
      // mais on accepte les champs pour tous les types puisque la DB les supporte.
      if (editedValues.zone_encadrement !== undefined) {
        setIfChanged(
          "zone_encadrement",
          editedValues.zone_encadrement === "" ? null : editedValues.zone_encadrement
        );
      }
      if (editedValues.loyer_reference_majore !== undefined) {
        setIfChanged("loyer_reference_majore", toNumberOrNull(editedValues.loyer_reference_majore));
      }
      if (editedValues.complement_loyer !== undefined) {
        setIfChanged("complement_loyer", toNumberOrNull(editedValues.complement_loyer));
      }
      if (editedValues.complement_justification !== undefined) {
        setIfChanged(
          "complement_justification",
          editedValues.complement_justification === "" ? null : editedValues.complement_justification
        );
      }

      // Accès & Sécurité — "" → null pour autoriser la suppression
      if (editedValues.digicode !== undefined) {
        setIfChanged("digicode", editedValues.digicode === "" ? null : editedValues.digicode);
      }
      if (editedValues.interphone !== undefined) {
        setIfChanged("interphone", editedValues.interphone === "" ? null : editedValues.interphone);
      }

      // Champs spécifiques HABITATION
      if (isHabitation) {
        if (editedValues.surface !== undefined) setIfChanged("surface", toNumberOrNull(editedValues.surface));
        if (editedValues.surface_carrez !== undefined) {
          setIfChanged("surface_carrez", toNumberOrNull(editedValues.surface_carrez));
        }
        if (editedValues.nb_pieces !== undefined) setIfChanged("nb_pieces", toIntOrNull(editedValues.nb_pieces));
        if (editedValues.nb_chambres !== undefined) setIfChanged("nb_chambres", toIntOrNull(editedValues.nb_chambres));
        if (editedValues.etage !== undefined) setIfChanged("etage", toIntOrNull(editedValues.etage));

        const habBools = ["ascenseur", "meuble", "has_balcon", "has_terrasse", "has_jardin", "has_cave"];
        for (const f of habBools) {
          if (editedValues[f] !== undefined) setIfChanged(f, Boolean(editedValues[f]));
        }
        const habEnums = ["dpe_classe_energie", "dpe_classe_climat", "chauffage_type", "chauffage_energie", "eau_chaude_type", "clim_presence", "clim_type"];
        for (const f of habEnums) {
          if (editedValues[f] !== undefined) {
            setIfChanged(f, editedValues[f] === "" ? null : editedValues[f]);
          }
        }
        // Indicateurs DPE chiffrés — exigés à la soumission (cf. submit/route.ts:235-243)
        if (editedValues.dpe_consommation !== undefined) {
          setIfChanged("dpe_consommation", toNumberOrNull(editedValues.dpe_consommation));
        }
        if (editedValues.dpe_emissions !== undefined) {
          setIfChanged("dpe_emissions", toNumberOrNull(editedValues.dpe_emissions));
        }
        if (editedValues.dpe_date_realisation !== undefined) {
          setIfChanged(
            "dpe_date_realisation",
            editedValues.dpe_date_realisation === "" ? null : editedValues.dpe_date_realisation
          );
        }
      }

      // Champs spécifiques PARKING
      if (isParking) {
        if (editedValues.surface !== undefined) setIfChanged("surface", toNumberOrNull(editedValues.surface));
        const parkingTexts = ["parking_type", "parking_numero", "parking_niveau", "parking_gabarit"];
        for (const f of parkingTexts) {
          if (editedValues[f] !== undefined) {
            setIfChanged(f, editedValues[f] === "" ? null : editedValues[f]);
          }
        }
        const parkingBools = ["parking_portail_securise", "parking_video_surveillance", "parking_gardien"];
        for (const f of parkingBools) {
          if (editedValues[f] !== undefined) setIfChanged(f, Boolean(editedValues[f]));
        }
        // parking_acces : tableau d'enums — n'envoyer que si l'utilisateur l'a explicitement modifié
        if (editedValues.parking_acces !== undefined && Array.isArray(editedValues.parking_acces)) {
          setIfChanged("parking_acces", editedValues.parking_acces);
        }
      }

      // Champs spécifiques LOCAL PRO
      if (isPro) {
        if (editedValues.surface !== undefined) setIfChanged("surface", toNumberOrNull(editedValues.surface));
        if (editedValues.local_surface_totale !== undefined) setIfChanged("local_surface_totale", toNumberOrNull(editedValues.local_surface_totale));
        if (editedValues.etage !== undefined) setIfChanged("etage", toIntOrNull(editedValues.etage));
        if (editedValues.local_type !== undefined) setIfChanged("local_type", editedValues.local_type === "" ? null : editedValues.local_type);

        const proBools = ["local_has_vitrine", "local_access_pmr", "local_clim", "local_fibre", "local_alarme", "local_rideau_metal", "local_acces_camion", "local_parking_clients"];
        for (const f of proBools) {
          if (editedValues[f] !== undefined) setIfChanged(f, Boolean(editedValues[f]));
        }
      }

      // Ne PATCHer que s'il y a au moins un champ modifié (évite UPDATE inutile
      // et évite que le serveur recalcule l'updated_at à vide).
      if (Object.keys(payload).length > 0) {
        const response = await apiClient.patch<{ property: typeof property }>(
          `/properties/${propertyId}`,
          payload
        );
        setProperty(response.property);
      }

      // 2. Supprimer les photos marquées
      for (const photoId of photosToDelete) {
        try {
          await apiClient.delete(`/photos/${photoId}`);
        } catch (e) {
          console.error("Erreur suppression photo", photoId, e);
        }
      }

      // 3. Uploader les nouvelles photos via le flow signed URL → table `photos`
      //    (même chemin que PhotosStep, garantit que les images apparaissent
      //    après reload et qu'elles servent de cover dans la liste "Mes biens")
      const uploadFailures: string[] = [];
      if (pendingPhotos.length > 0) {
        // Tag par défaut selon le type de bien (aligné avec photos_tag_check)
        const defaultTag = isParking
          ? "emplacement"
          : isPro
            ? "interieur"
            : "vue_generale";

        // Tracker quels indices ont échoué pour pouvoir les conserver
        // dans pendingPhotos après le save (l'utilisateur peut retry).
        const failedIndices: number[] = [];

        for (let i = 0; i < pendingPhotos.length; i++) {
          const file = pendingPhotos[i];
          // Marquer cette photo comme "uploading" → badge bleu animé
          setUploadStatuses((prev) => ({ ...prev, [i]: "uploading" }));

          try {
            const { upload_url } = await apiClient.post<{ upload_url: string; photo: any }>(
              `/properties/${propertyId}/photos/upload-url`,
              {
                file_name: file.name,
                mime_type: file.type,
                tag: defaultTag,
              }
            );
            const uploadResponse = await fetch(upload_url, {
              method: "PUT",
              headers: { "Content-Type": file.type },
              body: file,
            });
            if (!uploadResponse.ok) {
              uploadFailures.push(file.name);
              failedIndices.push(i);
              setUploadStatuses((prev) => ({ ...prev, [i]: "failed" }));
            }
          } catch (uploadErr) {
            console.error("[PropertyDetails] Erreur upload photo", file.name, uploadErr);
            uploadFailures.push(file.name);
            failedIndices.push(i);
            setUploadStatuses((prev) => ({ ...prev, [i]: "failed" }));
          }
        }

        // 4. Recharger les photos depuis la source de vérité
        try {
          const photosResponse = await apiClient.get<{ photos: any[] }>(`/properties/${propertyId}/photos`);
          setPhotos(photosResponse.photos || []);
        } catch {
          // Photos non rechargées - non critique
        }

        // 5. Nettoyer SEULEMENT les fichiers uploadés avec succès. Les fichiers
        //    en échec restent dans pendingPhotos avec leur badge "failed" et
        //    l'utilisateur peut retry ou les supprimer.
        const failedSet = new Set(failedIndices);
        const keptFiles: File[] = [];
        const keptUrls: string[] = [];
        const newStatuses: Record<number, "pending" | "uploading" | "failed"> = {};
        pendingPhotos.forEach((f, i) => {
          if (failedSet.has(i)) {
            keptFiles.push(f);
            keptUrls.push(pendingPhotoUrls[i]);
            newStatuses[keptFiles.length - 1] = "failed";
          } else {
            URL.revokeObjectURL(pendingPhotoUrls[i]);
          }
        });
        setPendingPhotos(keptFiles);
        setPendingPhotoUrls(keptUrls);
        setUploadStatuses(newStatuses);

        if (uploadFailures.length > 0) {
          // ⚠️ Garder le mode édition pour permettre le retry sur les échecs
          toast({
            title: `${uploadFailures.length} photo${uploadFailures.length > 1 ? "s en échec" : " en échec"}`,
            description: `Photos uploadées : ${pendingPhotos.length - uploadFailures.length}/${pendingPhotos.length}. Réessayez ou supprimez les photos en rouge.`,
            variant: "destructive",
            duration: 8000,
          });
        } else {
          // ✅ Tous les uploads ont réussi → on quitte le mode édition
          setIsEditing(false);
          setEditedValues({});
          setPhotosToDelete([]);
          toast({
            title: "Modifications enregistrées",
            description: pendingPhotos.length > 0
              ? `${pendingPhotos.length} photo${pendingPhotos.length > 1 ? "s ajoutée" + (pendingPhotos.length > 1 ? "s" : "") : " ajoutée"} avec succès.`
              : "Toutes les modifications ont été sauvegardées.",
          });
        }
      } else {
        // Aucune photo à uploader → quitter le mode édition normalement
        setIsEditing(false);
        setEditedValues({});
        setPhotosToDelete([]);
        toast({
          title: "Modifications enregistrées",
          description: "Toutes les modifications ont été sauvegardées avec succès.",
        });
      }

      // Forcer la révalidation côté serveur (anti-ISR cache)
      router.refresh();
    } catch (error: unknown) {
      console.error("Erreur sauvegarde globale:", error);
      
      // Extraire le message d'erreur détaillé
      let errorMessage = error instanceof Error ? (error as Error).message : "Erreur lors de la sauvegarde";
      let errorDetails = "";
      
      if ((error as any).response?.error) {
        errorMessage = (error as any).response.error;
        if ((error as any).response.details) {
          // Si c'est une erreur de validation Zod
          if (Array.isArray((error as any).response.details)) {
            errorDetails = (error as any).response.details
              .map((d: any) => `${d.path || d.field || "champ"}: ${d.message || d}`)
              .join(", ");
          } else if (typeof (error as any).response.details === "object") {
            // Si c'est une erreur Supabase
            errorDetails = (error as any).response.details.message || (error as any).response.details.hint || "";
          }
        }
      }
      
      toast({
        title: "Erreur",
        description: errorDetails ? `${errorMessage}\n${errorDetails}` : errorMessage,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ========== SAUVEGARDE INLINE: Accès & Sécurité ==========
  const handleSaveAccess = async () => {
    setIsSavingAccess(true);
    try {
      // "" → null pour permettre l'effacement explicite des codes d'accès
      const accessPayload: Record<string, string | null> = {};
      if (accessDigicode !== (property.digicode || "")) {
        accessPayload.digicode = accessDigicode === "" ? null : accessDigicode;
      }
      if (accessInterphone !== (property.interphone || "")) {
        accessPayload.interphone = accessInterphone === "" ? null : accessInterphone;
      }
      if (Object.keys(accessPayload).length === 0) {
        setIsEditingAccess(false);
        return;
      }
      const response = await apiClient.patch<{ property: typeof property }>(
        `/properties/${propertyId}`,
        accessPayload
      );
      setProperty(response.property);
      setIsEditingAccess(false);
      toast({
        title: "Codes d'accès mis à jour",
        description: "Les informations d'accès ont été sauvegardées.",
      });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de mettre à jour les codes d'accès",
        variant: "destructive",
      });
    } finally {
      setIsSavingAccess(false);
    }
  };

  // ========== GESTION DES PHOTOS ==========
  const handleAddPhotos = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files);
    const newUrls = newFiles.map((file) => URL.createObjectURL(file));
    setPendingPhotos((prev) => {
      const startIndex = prev.length;
      // Initialiser le statut "pending" pour chaque nouvelle photo
      setUploadStatuses((statuses) => {
        const next = { ...statuses };
        newFiles.forEach((_, i) => {
          next[startIndex + i] = "pending";
        });
        return next;
      });
      return [...prev, ...newFiles];
    });
    setPendingPhotoUrls((prev) => [...prev, ...newUrls]);
  };

  const handleRemovePendingPhoto = (index: number) => {
    URL.revokeObjectURL(pendingPhotoUrls[index]);
    setPendingPhotos((prev) => prev.filter((_, i) => i !== index));
    setPendingPhotoUrls((prev) => prev.filter((_, i) => i !== index));
    // Recalculer les indices des statuts (les indices > index décalent de -1)
    setUploadStatuses((statuses) => {
      const next: Record<number, "pending" | "uploading" | "failed"> = {};
      Object.entries(statuses).forEach(([k, v]) => {
        const i = parseInt(k, 10);
        if (i < index) next[i] = v;
        else if (i > index) next[i - 1] = v;
      });
      return next;
    });
  };

  const handleMarkPhotoForDeletion = (photoId: string) => {
    setPhotosToDelete((prev) => [...prev, photoId]);
  };

  const handleUnmarkPhotoForDeletion = (photoId: string) => {
    setPhotosToDelete((prev) => prev.filter((id) => id !== photoId));
  };

  const handleFieldChange = (field: string, value: unknown) => {
    setEditedValues((prev) => ({ ...prev, [field]: value }));
  };

  const getValue = (field: string) => {
    if (isEditing) {
      // Si l'utilisateur a modifié ce champ, on retourne la valeur édité (même
      // si c'est une chaîne vide intentionnelle). Sinon on retombe sur la
      // valeur actuelle de la property pour pré-remplir l'input.
      if (Object.prototype.hasOwnProperty.call(editedValues, field)) {
        return editedValues[field] ?? "";
      }
      return (property as any)[field] ?? "";
    }
    return (property as any)[field] ?? "";
  };

  // Photos visibles = existantes non supprimées + pending
  const visibleExistingPhotos = photos.filter((p: any) => !photosToDelete.includes(p.id));
  const allDisplayPhotos = [
    ...visibleExistingPhotos,
    ...pendingPhotoUrls.map((url, idx) => ({
      id: `pending-${idx}`,
      url,
      isPending: true,
      pendingIndex: idx,
      uploadStatus: uploadStatuses[idx] ?? "pending",
    })),
  ];
  const mainPhoto = allDisplayPhotos[0];

  // ========== GALERIE POPUP ==========
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  const openGallery = (index: number) => {
    setSelectedPhotoIndex(index);
    setIsGalleryOpen(true);
  };

  const navigateGallery = (direction: "prev" | "next") => {
    if (direction === "prev") {
      setSelectedPhotoIndex((prev) => (prev > 0 ? prev - 1 : allDisplayPhotos.length - 1));
    } else {
      setSelectedPhotoIndex((prev) => (prev < allDisplayPhotos.length - 1 ? prev + 1 : 0));
    }
  };

  // Gestion du clavier pour la navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isGalleryOpen) return;
    if (e.key === "ArrowLeft") navigateGallery("prev");
    if (e.key === "ArrowRight") navigateGallery("next");
    if (e.key === "Escape") setIsGalleryOpen(false);
  }, [isGalleryOpen, allDisplayPhotos.length]);

  // Attacher le listener clavier pour la navigation galerie
  useEffect(() => {
    if (!isGalleryOpen) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGalleryOpen, handleKeyDown]);

  // Item #13 : breadcrumb et badge contextualisés pour un lot d'immeuble.
  const breadcrumbItems = parentBuilding
    ? [
        { label: "Mes biens", href: "/owner/properties?tab=immeubles" },
        {
          label: `Immeuble ${parentBuilding.adresse_complete ?? ""}`.trim(),
          href: `/owner/buildings/${parentBuilding.id}`,
        },
        { label: property.adresse_complete || "Lot" },
      ]
    : [
        { label: "Mes biens", href: "/owner/properties" },
        { label: property.adresse_complete || "Détails du bien" },
      ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Breadcrumb (contextualisé pour les lots d'immeuble — item #13) */}
      <Breadcrumb
        items={breadcrumbItems}
        homeHref="/owner/dashboard"
        className="mb-4"
      />

      {/* Badge parent cliquable — visible uniquement pour les lots d'immeuble */}
      {parentBuilding && (
        <Link
          href={`/owner/buildings/${parentBuilding.id}`}
          className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#2563EB] text-sm transition-colors"
        >
          <Building2 className="h-3.5 w-3.5" />
          <span>
            Lot dans l'immeuble
            {parentBuilding.adresse_complete
              ? ` · ${parentBuilding.adresse_complete}`
              : ""}
          </span>
          <ArrowLeft className="h-3.5 w-3.5 rotate-180 opacity-60" />
        </Link>
      )}

      {/* Bouton retour */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <Link href="/owner/properties" className={cn(buttonVariants({ variant: "ghost" }), "pl-0 hover:pl-2 transition-all text-muted-foreground hover:text-foreground w-fit")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à la liste
        </Link>

        {/* Boutons d'action */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Bouton Favori */}
          <FavoriteButton
            id={propertyId}
            type="property"
            label={property.adresse_complete || property.nom || "Bien"}
            description={property.ville}
            href={`/owner/properties/${propertyId}`}
            variant="outline"
          />
          
          {/* Bouton Modifier / Annuler */}
          {!isEditing ? (
            <Button onClick={handleStartEditing} variant="default" className="gap-2">
              <Edit className="h-4 w-4" />
              Modifier le bien
            </Button>
          ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancelEditing} disabled={isSaving}>
              <X className="mr-2 h-4 w-4" />
              Annuler
            </Button>
            <Button onClick={handleSaveAll} disabled={isSaving} className="bg-green-600 hover:bg-green-700">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Enregistrer tout
                </>
              )}
            </Button>
          </div>
          )}
        </div>
      </div>

      {/* ========== BANDEAU POST-CRÉATION : CTA vers création de bail ========== */}
      <AnimatePresence>
        {showNewPropertyBanner && !existingLease && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mb-6"
          >
            <Card className="border-green-200 dark:border-green-800 bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 dark:from-green-950/40 dark:via-emerald-950/40 dark:to-teal-950/40 shadow-lg">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-green-900 dark:text-green-100">
                        Bien enregistré avec succès !
                      </h3>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                        {leaseCta.description}{" "}
                        <span className="font-medium">Prochaine étape : créer le contrat de location.</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-green-700 hover:text-green-900 hover:bg-green-100"
                      onClick={() => setShowNewPropertyBanner(false)}
                    >
                      Plus tard
                    </Button>
                    <Link href={leaseCta.href} className={cn(buttonVariants({ variant: "default" }), "bg-green-600 hover:bg-green-700 text-white shadow-md gap-2")}>
                      <FileText className="h-4 w-4" />
                      {leaseCta.label}
                    </Link>
                  </div>
                </div>
                {/* Mini-stepper visuel */}
                <div className="mt-4 flex items-center gap-2 text-xs text-green-600">
                  <span className="flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Bien créé
                  </span>
                  <span className="w-8 h-0.5 bg-green-300 rounded" />
                  <span className="flex items-center gap-1 font-semibold text-green-800 bg-green-100 px-2 py-0.5 rounded-full">
                    Bail
                  </span>
                  <span className="w-8 h-0.5 bg-green-200 rounded" />
                  <span className="text-green-400">État des lieux</span>
                  <span className="w-8 h-0.5 bg-green-200 rounded" />
                  <span className="text-green-400">Activation</span>
                  <span className="w-8 h-0.5 bg-green-200 rounded" />
                  <span className="text-green-400">1er loyer</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========== HERO / PHOTOS SECTION ========== */}
      <div className="relative w-full mb-8">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleAddPhotos(e.target.files)}
        />

        {allDisplayPhotos.length === 0 ? (
          // Aucune photo
          <div className="h-[300px] md:h-[400px] rounded-2xl overflow-hidden bg-muted border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground gap-4">
            <div className="p-4 bg-card rounded-full shadow-sm">
              <ImageIcon className="w-10 h-10 text-muted-foreground" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground">Aucune photo</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {isEditing ? "Ajoutez des photos pour mettre en valeur votre bien" : "Cliquez sur 'Modifier le bien' pour ajouter des photos"}
              </p>
              {isEditing && (
                <Button onClick={() => fileInputRef.current?.click()} variant="default" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Ajouter des photos
                </Button>
              )}
            </div>
          </div>
        ) : (
          // Affichage des photos
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[300px] md:h-[450px]">
            {/* Photo principale */}
            <div 
              className="col-span-1 md:col-span-3 relative rounded-2xl overflow-hidden bg-muted group cursor-pointer"
              onClick={() => !isEditing && openGallery(0)}
            >
              {mainPhoto && (
                <>
                  <Image
                    src={mainPhoto.url}
                    alt="Photo principale"
                    fill
                    sizes="(max-width: 768px) 100vw, 75vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  
                  {/* Badge statut upload (pending/uploading/failed) */}
                  {(mainPhoto as any).isPending && (() => {
                    const status = (mainPhoto as any).uploadStatus as "pending" | "uploading" | "failed";
                    if (status === "uploading") {
                      return (
                        <Badge className="absolute top-4 left-4 bg-blue-500 gap-1.5">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Upload en cours…
                        </Badge>
                      );
                    }
                    if (status === "failed") {
                      return (
                        <Badge className="absolute top-4 left-4 bg-red-500 gap-1.5">
                          <AlertTriangle className="h-3 w-3" />
                          Échec — réessayez
                        </Badge>
                      );
                    }
                    return (
                      <Badge className="absolute top-4 left-4 bg-amber-500">À enregistrer</Badge>
                    );
                  })()}

                  {/* Bouton supprimer en mode édition */}
                  {isEditing && (
                    <div className="absolute top-4 right-4">
                      {(mainPhoto as any).isPending ? (
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleRemovePendingPhoto((mainPhoto as any).pendingIndex)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      ) : !photosToDelete.includes(mainPhoto.id) ? (
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleMarkPhotoForDeletion(mainPhoto.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="bg-card"
                          onClick={() => handleUnmarkPhotoForDeletion(mainPhoto.id)}
                        >
                          Annuler
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Info sur la photo principale */}
                  <div className="absolute bottom-0 left-0 p-6 text-white">
                    <Badge className="mb-2 bg-card/20 backdrop-blur">{property.type}</Badge>
                    <h1 className="text-2xl md:text-3xl font-bold drop-shadow-lg">
                      {String(getValue("adresse_complete") || property.adresse_complete || "")}
                    </h1>
                    <p className="text-white/80">
                      {`${getValue("code_postal") || property.code_postal || ""} ${getValue("ville") || property.ville || ""}`.trim()}
                    </p>
                  </div>

                  {/* Bouton "Voir les photos" - visible seulement sur mobile quand il y a plusieurs photos */}
                  {!isEditing && allDisplayPhotos.length > 1 && (
                    <div className="absolute bottom-4 right-4 md:hidden">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="bg-black/60 backdrop-blur-sm text-white border-none hover:bg-black/80 gap-2"
                        onClick={(e) => { e.stopPropagation(); openGallery(0); }}
                      >
                        <ImageIcon className="w-4 h-4" />
                        {allDisplayPhotos.length} photos
                      </Button>
                    </div>
                  )}
                </>
              )}

              {/* Overlay "À supprimer" */}
              {mainPhoto && photosToDelete.includes(mainPhoto.id) && (
                <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
                  <Badge variant="destructive" className="text-lg px-4 py-2">À supprimer</Badge>
                </div>
              )}
            </div>

            {/* Colonne de droite - miniatures + bouton ajouter */}
            <div className="hidden md:flex flex-col gap-4">
              {allDisplayPhotos.slice(1, 3).map((photo: any, idx) => (
                <div 
                  key={photo.id} 
                  className={`flex-1 relative rounded-xl overflow-hidden group cursor-pointer ${
                    photosToDelete.includes(photo.id) ? "opacity-50" : ""
                  }`}
                  onClick={() => !isEditing && openGallery(idx + 1)}
                >
                  <Image
                    src={photo.url}
                    alt={`Photo ${idx + 2}`}
                    fill
                    sizes="25vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  
                  {photo.isPending && (() => {
                    const status = photo.uploadStatus as "pending" | "uploading" | "failed";
                    if (status === "uploading") {
                      return (
                        <Badge className="absolute top-2 left-2 bg-blue-500 text-xs gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Upload…
                        </Badge>
                      );
                    }
                    if (status === "failed") {
                      return (
                        <Badge className="absolute top-2 left-2 bg-red-500 text-xs gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Échec
                        </Badge>
                      );
                    }
                    return (
                      <Badge className="absolute top-2 left-2 bg-amber-500 text-xs">À enregistrer</Badge>
                    );
                  })()}

                  {isEditing && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {photo.isPending ? (
                        <Button 
                          size="icon" 
                          variant="destructive"
                          className="h-7 w-7"
                          onClick={() => handleRemovePendingPhoto(photo.pendingIndex)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      ) : !photosToDelete.includes(photo.id) ? (
                        <Button 
                          size="icon" 
                          variant="destructive"
                          className="h-7 w-7"
                          onClick={() => handleMarkPhotoForDeletion(photo.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button 
                          size="icon" 
                          variant="outline"
                          className="h-7 w-7 bg-card"
                          onClick={() => handleUnmarkPhotoForDeletion(photo.id)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Overlay +N - Cliquable pour voir toutes les photos */}
                  {idx === 1 && allDisplayPhotos.length > 3 && (
                    <div 
                      className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center hover:bg-black/70 transition-colors"
                      onClick={(e) => { e.stopPropagation(); openGallery(idx + 1); }}
                    >
                      <span className="text-white font-bold text-2xl">+{allDisplayPhotos.length - 3}</span>
                      <span className="text-white/80 text-sm mt-1">Voir toutes</span>
                    </div>
                  )}

                  {/* Overlay "À supprimer" */}
                  {photosToDelete.includes(photo.id) && (
                    <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
                      <Trash2 className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>
              ))}

              {/* Bouton ajouter photos (en mode édition) */}
              {isEditing && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex-1 bg-muted border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-muted/80 hover:border-blue-400 transition-all min-h-[100px]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground font-medium">Ajouter</span>
                </motion.div>
              )}

              {/* Info loyer si pas en mode édition */}
              {!isEditing && allDisplayPhotos.length <= 2 && (
                <div className="flex-1 bg-card border rounded-xl p-4 flex flex-col justify-center items-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Loyer</p>
                  <p className="text-2xl font-bold">{formatCurrency(property.loyer_hc || 0)}</p>
                  <span className="text-xs text-muted-foreground">/mois HC</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bouton ajouter photos mobile (en mode édition) */}
        {isEditing && allDisplayPhotos.length > 0 && (
          <div className="md:hidden mt-4">
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              variant="outline" 
              className="w-full gap-2"
            >
              <Camera className="w-4 h-4" />
              Ajouter des photos
            </Button>
          </div>
        )}
      </div>

      {/* ========== CONTENU PRINCIPAL ========== */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Colonne Gauche */}
        <div className="md:col-span-2 space-y-6">
          {/* ========== CARACTÉRISTIQUES (adresse visible uniquement en mode édition) ========== */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-5 w-5 text-blue-600" />
                Caractéristiques
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Mode édition : afficher les champs d'adresse */}
              {isEditing && (
                <div className="mb-6 p-4 bg-muted rounded-lg border border-dashed border-border">
                  <p className="text-xs text-muted-foreground mb-3 font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Modifier l'adresse
                  </p>
                  <div className="grid gap-3">
                    <div>
                      <Label htmlFor="adresse_complete" className="text-xs">Adresse</Label>
                      <Input
                        id="adresse_complete"
                        value={getValue("adresse_complete")}
                        onChange={(e) => handleFieldChange("adresse_complete", e.target.value)}
                        className="mt-1 h-9"
                      />
                    </div>
                    <div>
                      <Label htmlFor="complement_adresse" className="text-xs">
                        Complément d'adresse <span className="text-muted-foreground">(optionnel)</span>
                      </Label>
                      <Input
                        id="complement_adresse"
                        value={getValue("complement_adresse")}
                        onChange={(e) => handleFieldChange("complement_adresse", e.target.value)}
                        placeholder="Bâtiment B, 3e étage, escalier C…"
                        className="mt-1 h-9"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="code_postal" className="text-xs">Code Postal</Label>
                        <Input
                          id="code_postal"
                          value={getValue("code_postal")}
                          onChange={(e) => handleFieldChange("code_postal", e.target.value)}
                          className="mt-1 h-9"
                        />
                      </div>
                      <div>
                        <Label htmlFor="ville" className="text-xs">Ville</Label>
                        <Input
                          id="ville"
                          value={getValue("ville")}
                          onChange={(e) => handleFieldChange("ville", e.target.value)}
                          className="mt-1 h-9"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Caractéristiques - toujours visibles */}
              {isEditing ? (
                <PropertyEditForm 
                  property={property} 
                  editedValues={editedValues} 
                  handleFieldChange={handleFieldChange} 
                  getValue={getValue}
                />
              ) : (
                <PropertyCharacteristicsBadges property={property} />
              )}
            </CardContent>
          </Card>

          {/* ========== ACCÈS & SÉCURITÉ (mode lecture avec inline edit) ========== */}
          {!isEditing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Key className="h-5 w-5 text-indigo-600" />
                    Accès & Sécurité
                  </CardTitle>
                  {(property.digicode || property.interphone) && !isEditingAccess && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAccessDigicode(property.digicode || "");
                        setAccessInterphone(property.interphone || "");
                        setIsEditingAccess(true);
                      }}
                      className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1.5"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Modifier
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditingAccess ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Code digicode</Label>
                        <Input
                          value={accessDigicode}
                          onChange={(e) => setAccessDigicode(e.target.value)}
                          placeholder="Ex: 1234A, A5678"
                          className="mt-1 h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Interphone</Label>
                        <Input
                          value={accessInterphone}
                          onChange={(e) => setAccessInterphone(e.target.value)}
                          placeholder="Ex: DUPONT, 042"
                          className="mt-1 h-9"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingAccess(false)}
                        disabled={isSavingAccess}
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Annuler
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveAccess}
                        disabled={isSavingAccess}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        {isSavingAccess ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5 mr-1" />
                        )}
                        Enregistrer
                      </Button>
                    </div>
                  </div>
                ) : property.digicode || property.interphone ? (
                  <div className="space-y-3">
                    {property.digicode && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/50">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-card flex items-center justify-center shadow-sm">
                            <Key className="h-4 w-4 text-indigo-600" />
                          </div>
                          <span className="text-sm font-medium text-muted-foreground">Digicode</span>
                        </div>
                        <span className="font-mono font-black tracking-widest text-indigo-600 dark:text-indigo-400">
                          {property.digicode}
                        </span>
                      </div>
                    )}
                    {property.interphone && (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-muted border border-border">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-card flex items-center justify-center shadow-sm">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <span className="text-sm font-medium text-muted-foreground">Interphone</span>
                        </div>
                        <span className="text-sm font-bold text-foreground">
                          {property.interphone}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                          Aucun code d'accès renseigné
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                          Ajoutez le digicode et l'interphone pour qu'ils soient automatiquement transmis à vos locataires.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3 border-amber-300 text-amber-800 hover:bg-amber-100"
                          onClick={() => {
                            setAccessDigicode("");
                            setAccessInterphone("");
                            setIsEditingAccess(true);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Ajouter les codes d'accès
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            </motion.div>
          )}

          {/* ========== CARTE DE LOCALISATION ========== */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Navigation className="h-5 w-5 text-emerald-600" />
                Localisation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PropertyMap
                latitude={(property as any).latitude}
                longitude={(property as any).longitude}
                address={`${property.adresse_complete}, ${property.code_postal} ${property.ville}`}
                height="220px"
                zoom={15}
                markerColor="primary"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Euro className="h-5 w-5 text-green-600" />
                Données Financières
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="loyer_hc">Loyer Hors Charges (€)</Label>
                  {isEditing ? (
                    <Input
                      id="loyer_hc"
                      type="number"
                      value={getValue("loyer_hc")}
                      onChange={(e) => handleFieldChange("loyer_hc", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium mt-1">{formatCurrency(property.loyer_hc ?? 0)}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="charges_mensuelles">Charges Mensuelles (€)</Label>
                  {isEditing ? (
                    <Input
                      id="charges_mensuelles"
                      type="number"
                      value={getValue("charges_mensuelles")}
                      onChange={(e) => handleFieldChange("charges_mensuelles", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium mt-1">{formatCurrency((property as any).charges_mensuelles ?? 0)}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Colonne Droite */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Occupation</CardTitle>
            </CardHeader>
            <CardContent>
              {existingLease ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge 
                      variant="default" 
                      className={
                        isLeaseActive ? "bg-green-600" : 
                        isLeaseSigned ? "bg-blue-600" : 
                        isLeasePartiallySigned ? "bg-indigo-500" :
                        isLeasePending ? "bg-amber-500" : 
                        "bg-slate-500"
                      }
                    >
                      {isLeaseActive ? "Loué" : 
                       isLeaseSigned ? "Signé (EDL requis)" :
                       isLeasePartiallySigned ? "Signature partielle" :
                       isLeasePending ? "Signature en cours" : 
                       "Brouillon"}
                    </Badge>
                    <Link 
                      href={`/owner/leases/${existingLease.id}`} 
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Voir le bail
                    </Link>
                  </div>
                  {isLeaseActive && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">Locataire(s)</p>
                      <p className="font-medium">
                        {(existingLease?.tenants?.filter((t: TenantInfo) => t.role === 'locataire_principal' || t.role === 'tenant').length ?? 0) > 0
                          ? existingLease?.tenants
                              ?.filter((t: TenantInfo) => t.role === 'locataire_principal' || t.role === 'tenant')
                              .map((t: TenantInfo) => t.profile ? `${t.profile.prenom} ${t.profile.nom}` : t.invited_name || "Locataire")
                              .join(", ")
                          : "En attente"}
                      </p>
                    </div>
                  )}
                  {isLeaseSigned && (
                    <div className="pt-2 border-t space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {edlIsSigned 
                          ? "✅ Bail entièrement signé et EDL terminé. Le bail est prêt à être activé."
                          : "✅ Bail entièrement signé. Un EDL d'entrée est requis pour activer le bail."}
                      </p>
                      
                      {edlIsSigned ? (
                        <Button 
                          onClick={handleManualActivation}
                          disabled={activateLease.isPending}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-100"
                        >
                          {activateLease.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                          )}
                          Activer le bail maintenant
                        </Button>
                      ) : edlDraft ? (
                        <Link href={`/owner/inspections/${edlDraft.id}`} className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-2 w-full bg-indigo-600 hover:bg-indigo-700")}>
                          <FileText className="h-4 w-4 mr-2" />
                          Continuer l'état des lieux
                        </Link>
                      ) : (
                        <Link href={`/owner/inspections/new?property_id=${propertyId}&lease_id=${existingLease.id}`} className={cn(buttonVariants({ variant: "default", size: "sm" }), "mt-2 w-full bg-blue-600 hover:bg-blue-700")}>
                          <Plus className="h-4 w-4 mr-2" />
                          Créer l'EDL d'entrée
                        </Link>
                      )}
                    </div>
                  )}
                  {isLeasePartiallySigned && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">
                        Signature en cours - En attente des autres parties
                      </p>
                      <Link href={`/owner/leases/${existingLease.id}?tab=preview`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 w-full")}>
                        Voir les signatures
                      </Link>
                    </div>
                  )}
                  {isLeasePending && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">
                        En attente de signature des parties
                      </p>
                      <Link href={`/owner/leases/${existingLease.id}?tab=preview`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 w-full")}>
                        Aperçu du bail
                      </Link>
                    </div>
                  )}
                  {existingLease.statut === "draft" && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">
                        Bail en cours de création
                      </p>
                      <Link href={`/owner/leases/${existingLease.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 w-full")}>
                        Continuer la création
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <Badge variant="outline">Vacant</Badge>
                  <p className="text-sm text-muted-foreground">Aucun locataire actuellement.</p>
                  <Link href={leaseCta.href} className={cn(buttonVariants({ variant: "default" }), "w-full")}>
                    <FileText className="h-4 w-4 mr-2" />
                    {leaseCta.label}
                  </Link>
                  <p className="text-xs text-muted-foreground">{leaseCta.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Maintenance & Tickets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Maintenance & Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <TicketListUnified tickets={tickets} variant="owner" />
            </CardContent>
          </Card>

          {/* Pièces & Photos / Annonce */}
          {!["parking", "box"].includes(property.type || "") && (
            <Card>
              <Tabs defaultValue="rooms" className="w-full">
                <CardHeader className="pb-2">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="rooms">Pièces & Photos</TabsTrigger>
                    <TabsTrigger value="announcement">Annonce</TabsTrigger>
                  </TabsList>
                </CardHeader>
                <CardContent>
                  <TabsContent value="rooms" className="mt-0">
                    <PropertyRoomsPhotosTab
                      propertyId={propertyId}
                      property={property as any}
                      isHabitation={!["local_commercial", "bureaux", "entrepot", "fonds_de_commerce"].includes(property.type || "")}
                      compact
                    />
                  </TabsContent>
                  <TabsContent value="announcement" className="mt-0">
                    <PropertyAnnouncementTab
                      property={property as any}
                      onPropertyUpdate={async (updates) => {
                        await apiClient.patch(`/properties/${propertyId}`, updates);
                        setProperty((prev): OwnerProperty => ({ ...prev, ...updates } as OwnerProperty));
                      }}
                    />
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          )}

          {/* ========== VISITE VIRTUELLE (si renseignée) ========== */}
          {property.visite_virtuelle_url && !isEditing && (
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Video className="h-5 w-5 text-blue-600" />
                  Visite virtuelle disponible
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Explorez ce bien en 360° grâce à la visite virtuelle.
                </p>
                <Button 
                  asChild 
                  className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <a 
                    href={property.visite_virtuelle_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <Video className="h-4 w-4" />
                    Lancer la visite virtuelle
                    <span className="ml-2 opacity-70">↗</span>
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Section Compteurs - Masquer pour parking/box (pas de compteurs d'énergie) */}
          {!["parking", "box"].includes(property.type || "") && (
            <PropertyMetersSection propertyId={propertyId} />
          )}

          {/* Section Notes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Notes privées</CardTitle>
            </CardHeader>
            <CardContent>
              <EntityNotes 
                entityType="property" 
                entityId={propertyId}
                maxDisplay={3}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href={`/owner/properties/${propertyId}/diagnostics`} className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30")}>
                <Shield className="mr-2 h-4 w-4" />
                Diagnostics (DDT)
              </Link>
              <Link href={`/owner/documents?property_id=${propertyId}`} className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start")}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Gérer les documents
              </Link>
              <Button 
                variant="outline" 
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer le bien
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Barre de sauvegarde sticky en mode édition (mobile) */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t shadow-lg md:hidden z-50"
          >
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleCancelEditing} disabled={isSaving} className="flex-1">
                Annuler
              </Button>
              <Button onClick={handleSaveAll} disabled={isSaving} className="flex-1 bg-green-600 hover:bg-green-700">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dialog de suppression */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Supprimer ce bien ?"
        description={`Le bien "${property?.adresse_complete}" sera archivé et retiré de la liste de vos biens. Ses documents et historique resteront consultables.`}
        onConfirm={handleDelete}
        variant="destructive"
        loading={deleteProperty.isPending}
        confirmText="Supprimer définitivement"
        cancelText="Annuler"
      />

      {/* ========== GALERIE PHOTOS POPUP ========== */}
      <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
        <DialogContent hideClose className="max-w-6xl w-[95vw] h-[90vh] p-0 bg-black/95 border-none text-white overflow-hidden flex flex-col" aria-describedby={undefined}>
          {/* Header avec compteur et bouton fermer */}
          <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between">
            <span className="text-white/80 text-sm bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full">
              {selectedPhotoIndex + 1} / {allDisplayPhotos.length}
            </span>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-card/20 rounded-full">
                <X className="h-6 w-6" />
              </Button>
            </DialogClose>
          </div>

          {/* Zone principale avec photo et navigation */}
          <div 
            className="flex-1 relative flex items-center justify-center bg-black"
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") navigateGallery("prev");
              if (e.key === "ArrowRight") navigateGallery("next");
            }}
            tabIndex={0}
          >
            {/* Bouton Précédent */}
            {allDisplayPhotos.length > 1 && (
              <button
                onClick={() => navigateGallery("prev")}
                className="absolute left-4 z-40 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-all hover:scale-110"
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
            )}

            {/* Photo actuelle */}
            {allDisplayPhotos[selectedPhotoIndex] && (
              <div className="relative w-full h-full max-h-[75vh]">
                <Image 
                  src={allDisplayPhotos[selectedPhotoIndex]?.url || ""} 
                  alt={`Photo ${selectedPhotoIndex + 1}`}
                  fill
                  sizes="95vw"
                  className="object-contain"
                  priority
                />
              </div>
            )}

            {/* Bouton Suivant */}
            {allDisplayPhotos.length > 1 && (
              <button
                onClick={() => navigateGallery("next")}
                className="absolute right-4 z-40 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-all hover:scale-110"
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            )}
          </div>

          {/* Thumbnails en bas */}
          <div className="h-24 bg-black/80 backdrop-blur-sm p-4 flex gap-2 overflow-x-auto items-center justify-center">
            {allDisplayPhotos.map((photo: any, idx) => (
              <button
                key={photo.id || idx}
                onClick={() => setSelectedPhotoIndex(idx)}
                className={`relative w-16 h-14 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                  idx === selectedPhotoIndex 
                    ? "border-white ring-2 ring-white/50 scale-110" 
                    : "border-transparent opacity-60 hover:opacity-100 hover:border-white/50"
                }`}
              >
                <Image 
                  src={photo.url} 
                  alt={`Miniature ${idx + 1}`} 
                  fill 
                  sizes="64px"
                  className="object-cover" 
                />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
