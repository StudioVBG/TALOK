"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutationWithToast } from "@/lib/hooks/use-mutation-with-toast";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatCurrency } from "@/lib/helpers/format";
import { useToast } from "@/components/ui/use-toast";
import type { PropertyDetails } from "../../_data/fetchPropertyDetails";
import { PropertyMetersSection } from "@/components/owner/properties/PropertyMetersSection";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { EntityNotes } from "@/components/ui/entity-notes";
import Image from "next/image";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Navigation, CheckCircle2 } from "lucide-react";
import dynamic from "next/dynamic";
import type { OwnerProperty, PropertyPhoto, LeaseInfo, TenantInfo, EdlInfo } from "@/lib/types/owner-property";
import { PropertyCharacteristicsBadges } from "./components/PropertyCharacteristicsBadges";
import { PropertyEditForm } from "./components/PropertyEditForm";

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
}

export function PropertyDetailsClient({ details, propertyId }: PropertyDetailsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [property, setProperty] = useState(details.property);
  const [photos, setPhotos] = useState(details.photos || []);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // ========== MODE ÉDITION GLOBAL ==========
  const [isEditing, setIsEditing] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [pendingPhotoUrls, setPendingPhotoUrls] = useState<string[]>([]);
  const [photosToDelete, setPhotosToDelete] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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
    errorMessage: "Impossible de supprimer le bien.",
    invalidateQueries: ["property-details", propertyId],
    onSuccess: () => {
      router.push("/owner/properties");
    },
  });

  const handleDelete = () => {
    if (propertyId) {
      deleteProperty.mutate(propertyId);
    }
  };

  // ========== GESTION DU MODE ÉDITION ==========
  const handleStartEditing = () => {
    const p = property as any;
    setEditedValues({
      // Adresse
      adresse_complete: p.adresse_complete || "",
      code_postal: p.code_postal || "",
      ville: p.ville || "",
      // Surface & Pièces
      surface: p.surface || 0,
      nb_pieces: p.nb_pieces || 0,
      nb_chambres: p.nb_chambres || 0,
      etage: p.etage ?? "",
      ascenseur: p.ascenseur || false,
      // Habitation
      meuble: p.meuble || false,
      dpe_classe_energie: p.dpe_classe_energie || "",
      dpe_classe_climat: p.dpe_classe_climat || "",
      chauffage_type: p.chauffage_type || "",
      chauffage_energie: p.chauffage_energie || "",
      eau_chaude_type: p.eau_chaude_type || "",
      clim_presence: p.clim_presence || "aucune",
      clim_type: p.clim_type || "",
      // Extérieurs
      has_balcon: p.has_balcon || false,
      has_terrasse: p.has_terrasse || false,
      has_jardin: p.has_jardin || false,
      has_cave: p.has_cave || false,
      // Parking
      parking_type: p.parking_type || "",
      parking_numero: p.parking_numero || "",
      parking_niveau: p.parking_niveau || "",
      parking_gabarit: p.parking_gabarit || "",
      parking_acces: p.parking_acces || [],
      parking_portail_securise: p.parking_portail_securise || false,
      parking_video_surveillance: p.parking_video_surveillance || false,
      parking_gardien: p.parking_gardien || false,
      // Local Pro
      local_type: p.local_type || "",
      local_surface_totale: p.local_surface_totale || p.surface || 0,
      local_has_vitrine: p.local_has_vitrine || false,
      local_access_pmr: p.local_access_pmr || false,
      local_clim: p.local_clim || false,
      local_fibre: p.local_fibre || false,
      local_alarme: p.local_alarme || false,
      local_rideau_metal: p.local_rideau_metal || false,
      local_acces_camion: p.local_acces_camion || false,
      local_parking_clients: p.local_parking_clients || false,
      // Financier
      loyer_hc: p.loyer_hc || 0,
      charges_mensuelles: p.charges_mensuelles ?? 0,
      depot_garantie: p.depot_garantie || 0,
      // Visite virtuelle (Matterport, Nodalview, etc.)
      visite_virtuelle_url: p.visite_virtuelle_url || "",
    });
    setPendingPhotos([]);
    setPendingPhotoUrls([]);
    setPhotosToDelete([]);
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
  };

  // ========== SAUVEGARDE GLOBALE ==========
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      // Construire le payload avec tous les champs modifiés
      const propertyType = property.type || "";
      const isParking = ["parking", "box"].includes(propertyType);
      const isPro = ["local_commercial", "bureaux", "entrepot", "fonds_de_commerce"].includes(propertyType);
      const isHabitation = ["appartement", "maison", "studio", "colocation", "saisonnier"].includes(propertyType);

      // Payload de base (commun à tous les types)
      // Ne inclure que les champs qui ont été modifiés (présents dans editedValues)
      const payload: Record<string, any> = {};
      
      if (editedValues.adresse_complete !== undefined) {
        payload.adresse_complete = editedValues.adresse_complete;
      }
      if (editedValues.code_postal !== undefined) {
        payload.code_postal = editedValues.code_postal;
      }
      if (editedValues.ville !== undefined) {
        payload.ville = editedValues.ville;
      }
      if (editedValues.loyer_hc !== undefined) {
        payload.loyer_hc = parseFloat(editedValues.loyer_hc) || 0;
      }
      if (editedValues.charges_mensuelles !== undefined) {
        payload.charges_mensuelles = parseFloat(editedValues.charges_mensuelles) || 0;
      }
      if (editedValues.depot_garantie !== undefined) {
        payload.depot_garantie = parseFloat(editedValues.depot_garantie) || 0;
      }
      // TODO: Réactiver après application de la migration 20251207231451_add_visite_virtuelle_url.sql
      // if (editedValues.visite_virtuelle_url !== undefined) {
      //   payload.visite_virtuelle_url = editedValues.visite_virtuelle_url || null;
      // }

      // Champs spécifiques HABITATION
      if (isHabitation) {
        Object.assign(payload, {
          surface: parseFloat(editedValues.surface) || 0,
          nb_pieces: parseInt(editedValues.nb_pieces, 10) || 0,
          nb_chambres: parseInt(editedValues.nb_chambres, 10) || 0,
          etage: editedValues.etage !== "" ? parseInt(editedValues.etage, 10) : null,
          ascenseur: editedValues.ascenseur || false,
          meuble: editedValues.meuble || false,
          dpe_classe_energie: editedValues.dpe_classe_energie || null,
          dpe_classe_climat: editedValues.dpe_classe_climat || null,
          chauffage_type: editedValues.chauffage_type || null,
          chauffage_energie: editedValues.chauffage_energie || null,
          eau_chaude_type: editedValues.eau_chaude_type || null,
          clim_presence: editedValues.clim_presence || null,
          clim_type: editedValues.clim_type || null,
          has_balcon: editedValues.has_balcon || false,
          has_terrasse: editedValues.has_terrasse || false,
          has_jardin: editedValues.has_jardin || false,
          has_cave: editedValues.has_cave || false,
        });
      }

      // Champs spécifiques PARKING
      if (isParking) {
        Object.assign(payload, {
          surface: parseFloat(editedValues.surface) || null,
          parking_type: editedValues.parking_type || null,
          parking_numero: editedValues.parking_numero || null,
          parking_niveau: editedValues.parking_niveau || null,
          parking_gabarit: editedValues.parking_gabarit || null,
          parking_acces: editedValues.parking_acces || [],
          parking_portail_securise: editedValues.parking_portail_securise || false,
          parking_video_surveillance: editedValues.parking_video_surveillance || false,
          parking_gardien: editedValues.parking_gardien || false,
        });
      }

      // Champs spécifiques LOCAL PRO
      if (isPro) {
        Object.assign(payload, {
          surface: parseFloat(editedValues.surface) || parseFloat(editedValues.local_surface_totale) || 0,
          local_surface_totale: parseFloat(editedValues.local_surface_totale) || parseFloat(editedValues.surface) || 0,
          etage: editedValues.etage !== "" ? parseInt(editedValues.etage, 10) : null,
          local_type: editedValues.local_type || null,
          local_has_vitrine: editedValues.local_has_vitrine || false,
          local_access_pmr: editedValues.local_access_pmr || false,
          local_clim: editedValues.local_clim || false,
          local_fibre: editedValues.local_fibre || false,
          local_alarme: editedValues.local_alarme || false,
          local_rideau_metal: editedValues.local_rideau_metal || false,
          local_acces_camion: editedValues.local_acces_camion || false,
          local_parking_clients: editedValues.local_parking_clients || false,
        });
      }

      // Filtrer les valeurs undefined et null pour éviter les problèmes de validation
      const cleanPayload = Object.fromEntries(
        Object.entries(payload).filter(([_, value]) => {
          // Garder les valeurs null explicites, mais exclure undefined
          return value !== undefined;
        })
      );

      console.log('[PropertyDetailsClient] Payload nettoyé:', cleanPayload);

      const response = await apiClient.patch<{ property: typeof property }>(
        `/properties/${propertyId}`,
        cleanPayload
      );
      setProperty(response.property);

      // 2. Supprimer les photos marquées
      for (const photoId of photosToDelete) {
        try {
          await apiClient.delete(`/photos/${photoId}`);
        } catch (e) {
          console.error("Erreur suppression photo", photoId, e);
        }
      }

      // 3. Uploader les nouvelles photos
      if (pendingPhotos.length > 0) {
        const formData = new FormData();
        formData.append("propertyId", propertyId);
        formData.append("type", "autre");
        formData.append("collection", "property_media");
        pendingPhotos.forEach((file) => {
          formData.append("files", file);
        });

        await fetch("/api/documents/upload-batch", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
      }

      // 4. Recharger les photos
      try {
        const photosResponse = await apiClient.get<{ photos: any[] }>(`/properties/${propertyId}/photos`);
        setPhotos(photosResponse.photos || []);
      } catch (e) {
        console.log("Pas de photos à recharger");
      }

      // 5. Cleanup et quitter le mode édition
      pendingPhotoUrls.forEach((url) => URL.revokeObjectURL(url));
      setIsEditing(false);
      setEditedValues({});
      setPendingPhotos([]);
      setPendingPhotoUrls([]);
      setPhotosToDelete([]);

      toast({
        title: "Modifications enregistrées",
        description: "Toutes les modifications ont été sauvegardées avec succès.",
      });
    } catch (error: unknown) {
      console.error("Erreur sauvegarde globale:", error);
      
      // Extraire le message d'erreur détaillé
      let errorMessage = error instanceof Error ? error.message : "Erreur lors de la sauvegarde";
      let errorDetails = "";
      
      if (error.response?.error) {
        errorMessage = error.response.error;
        if (error.response.details) {
          // Si c'est une erreur de validation Zod
          if (Array.isArray(error.response.details)) {
            errorDetails = error.response.details
              .map((d: any) => `${d.path || d.field || "champ"}: ${d.message || d}`)
              .join(", ");
          } else if (typeof error.response.details === "object") {
            // Si c'est une erreur Supabase
            errorDetails = error.response.details.message || error.response.details.hint || "";
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

  // ========== GESTION DES PHOTOS ==========
  const handleAddPhotos = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files);
    const newUrls = newFiles.map((file) => URL.createObjectURL(file));
    setPendingPhotos((prev) => [...prev, ...newFiles]);
    setPendingPhotoUrls((prev) => [...prev, ...newUrls]);
  };

  const handleRemovePendingPhoto = (index: number) => {
    URL.revokeObjectURL(pendingPhotoUrls[index]);
    setPendingPhotos((prev) => prev.filter((_, i) => i !== index));
    setPendingPhotoUrls((prev) => prev.filter((_, i) => i !== index));
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
      return editedValues[field] ?? "";
    }
    return (property as any)[field] ?? "";
  };

  // Photos visibles = existantes non supprimées + pending
  const visibleExistingPhotos = photos.filter((p: any) => !photosToDelete.includes(p.id));
  const allDisplayPhotos = [
    ...visibleExistingPhotos,
    ...pendingPhotoUrls.map((url, idx) => ({ id: `pending-${idx}`, url, isPending: true, pendingIndex: idx })),
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Bouton retour */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <Button asChild variant="ghost" className="pl-0 hover:pl-2 transition-all text-slate-500 hover:text-slate-900 w-fit">
          <Link href="/owner/properties">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la liste
          </Link>
        </Button>

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
          <div className="h-[300px] md:h-[400px] rounded-2xl overflow-hidden bg-slate-50 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500 gap-4">
            <div className="p-4 bg-white rounded-full shadow-sm">
              <ImageIcon className="w-10 h-10 text-slate-400" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-slate-700">Aucune photo</h3>
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
              className="col-span-1 md:col-span-3 relative rounded-2xl overflow-hidden bg-slate-100 group cursor-pointer"
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
                  
                  {/* Badge pending */}
                  {(mainPhoto as any).isPending && (
                    <Badge className="absolute top-4 left-4 bg-amber-500">En attente d'upload</Badge>
                  )}

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
                          className="bg-white"
                          onClick={() => handleUnmarkPhotoForDeletion(mainPhoto.id)}
                        >
                          Annuler
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Info sur la photo principale */}
                  <div className="absolute bottom-0 left-0 p-6 text-white">
                    <Badge className="mb-2 bg-white/20 backdrop-blur">{property.type}</Badge>
                    <h1 className="text-2xl md:text-3xl font-bold drop-shadow-lg">
                      {isEditing ? editedValues.adresse_complete : property.adresse_complete}
                    </h1>
                    <p className="text-white/80">
                      {isEditing ? `${editedValues.code_postal} ${editedValues.ville}` : `${property.code_postal} ${property.ville}`}
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
                  
                  {photo.isPending && (
                    <Badge className="absolute top-2 left-2 bg-amber-500 text-xs">En attente</Badge>
                  )}

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
                          className="h-7 w-7 bg-white"
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
                  className="flex-1 bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all min-h-[100px]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-8 h-8 text-slate-400 mb-2" />
                  <span className="text-sm text-slate-500 font-medium">Ajouter</span>
                </motion.div>
              )}

              {/* Info loyer si pas en mode édition */}
              {!isEditing && allDisplayPhotos.length <= 2 && (
                <div className="flex-1 bg-white border rounded-xl p-4 flex flex-col justify-center items-center">
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
                <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
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
                        <Button asChild variant="default" size="sm" className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700">
                          <Link href={`/owner/inspections/${edlDraft.id}`}>
                            <FileText className="h-4 w-4 mr-2" />
                            Continuer l'état des lieux
                          </Link>
                        </Button>
                      ) : (
                        <Button asChild variant="default" size="sm" className="mt-2 w-full bg-blue-600 hover:bg-blue-700">
                          <Link href={`/owner/inspections/new?propertyId=${propertyId}&leaseId=${existingLease.id}`}>
                            <Plus className="h-4 w-4 mr-2" />
                            Créer l'EDL d'entrée
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                  {isLeasePartiallySigned && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">
                        Signature en cours - En attente des autres parties
                      </p>
                      <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                        <Link href={`/owner/leases/${existingLease.id}?tab=preview`}>
                          Voir les signatures
                        </Link>
                      </Button>
                    </div>
                  )}
                  {isLeasePending && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">
                        En attente de signature des parties
                      </p>
                      <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                        <Link href={`/owner/leases/${existingLease.id}?tab=preview`}>
                          Aperçu du bail
                        </Link>
                      </Button>
                    </div>
                  )}
                  {existingLease.statut === "draft" && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground">
                        Bail en cours de création
                      </p>
                      <Button asChild variant="outline" size="sm" className="mt-2 w-full">
                        <Link href={`/owner/leases/${existingLease.id}`}>
                          Continuer la création
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <Badge variant="outline">Vacant</Badge>
                  <p className="text-sm text-muted-foreground">Aucun locataire actuellement.</p>
                  <Button asChild className="w-full" variant="default">
                    <Link href={`/owner/leases/new?propertyId=${propertyId}`}>Créer un bail</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ========== VISITE VIRTUELLE (si renseignée) ========== */}
          {property.visite_virtuelle_url && !isEditing && (
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
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
              <Button asChild variant="outline" className="w-full justify-start border-blue-200 text-blue-700 hover:bg-blue-50">
                <Link href={`/owner/properties/${propertyId}/diagnostics`}>
                  <Shield className="mr-2 h-4 w-4" />
                  Diagnostics (DDT)
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href={`/owner/documents?property_id=${propertyId}`}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Gérer les documents
                </Link>
              </Button>
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
            className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg md:hidden z-50"
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
        description={`Cette action est irréversible. Le bien "${property?.adresse_complete}" sera supprimé.`}
        onConfirm={handleDelete}
        variant="destructive"
        loading={deleteProperty.isPending}
        confirmText="Supprimer définitivement"
        cancelText="Annuler"
      />

      {/* ========== GALERIE PHOTOS POPUP ========== */}
      <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
        <DialogContent hideClose className="max-w-6xl w-[95vw] h-[90vh] p-0 bg-black/95 border-none text-white overflow-hidden flex flex-col">
          {/* Header avec compteur et bouton fermer */}
          <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between">
            <span className="text-white/80 text-sm bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full">
              {selectedPhotoIndex + 1} / {allDisplayPhotos.length}
            </span>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full">
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
