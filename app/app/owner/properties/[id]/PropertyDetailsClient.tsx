"use client";
// @ts-nocheck

import { useState, useCallback, useRef } from "react";
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
  ImageIcon
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatCurrency } from "@/lib/helpers/format";
import { useToast } from "@/components/ui/use-toast";
import type { PropertyDetails } from "../../_data/fetchPropertyDetails";
import Image from "next/image";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  const activeLease = leases.find((l: any) => l.statut === "active");

  // Mutation pour la suppression du bien
  const deleteProperty = useMutationWithToast({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/properties/${id}`);
    },
    successMessage: "Bien supprimé avec succès",
    errorMessage: "Impossible de supprimer le bien.",
    invalidateQueries: ["properties"],
    onSuccess: () => {
      router.push("/app/owner/properties");
    },
  });

  const handleDelete = () => {
    if (propertyId) {
      deleteProperty.mutate(propertyId);
    }
  };

  // ========== GESTION DU MODE ÉDITION ==========
  const handleStartEditing = () => {
    setEditedValues({
      adresse_complete: property.adresse_complete || "",
      code_postal: property.code_postal || "",
      ville: property.ville || "",
      surface: property.surface || 0,
      nb_pieces: property.nb_pieces || 0,
      loyer_hc: property.loyer_hc || 0,
      charges_mensuelles: (property as any).charges_mensuelles ?? 0,
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
      // 1. Sauvegarder les infos du bien
      const payload = {
        adresse_complete: editedValues.adresse_complete,
        code_postal: editedValues.code_postal,
        ville: editedValues.ville,
        surface: parseFloat(editedValues.surface) || 0,
        nb_pieces: parseInt(editedValues.nb_pieces, 10) || 0,
        loyer_hc: parseFloat(editedValues.loyer_hc) || 0,
        charges_mensuelles: parseFloat(editedValues.charges_mensuelles) || 0,
      };

      const response = await apiClient.patch<{ property: typeof property }>(
        `/properties/${propertyId}`,
        payload
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
    } catch (error: any) {
      console.error("Erreur sauvegarde globale:", error);
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la sauvegarde",
        variant: "destructive",
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

  const handleFieldChange = (field: string, value: string | number) => {
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
      <div className="flex items-center justify-between mb-6">
        <Button asChild variant="ghost" className="pl-0 hover:pl-2 transition-all text-slate-500 hover:text-slate-900">
          <Link href="/app/owner/properties">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la liste
          </Link>
        </Button>

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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                Informations Générales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label htmlFor="adresse_complete">Adresse complète</Label>
                  {isEditing ? (
                    <Input
                      id="adresse_complete"
                      value={getValue("adresse_complete")}
                      onChange={(e) => handleFieldChange("adresse_complete", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium mt-1">{property.adresse_complete}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="code_postal">Code Postal</Label>
                  {isEditing ? (
                    <Input
                      id="code_postal"
                      value={getValue("code_postal")}
                      onChange={(e) => handleFieldChange("code_postal", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium mt-1">{property.code_postal}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="ville">Ville</Label>
                  {isEditing ? (
                    <Input
                      id="ville"
                      value={getValue("ville")}
                      onChange={(e) => handleFieldChange("ville", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium mt-1">{property.ville}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="surface">Surface (m²)</Label>
                  {isEditing ? (
                    <Input
                      id="surface"
                      type="number"
                      value={getValue("surface")}
                      onChange={(e) => handleFieldChange("surface", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium mt-1">{property.surface} m²</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="nb_pieces">Nombre de pièces</Label>
                  {isEditing ? (
                    <Input
                      id="nb_pieces"
                      type="number"
                      value={getValue("nb_pieces")}
                      onChange={(e) => handleFieldChange("nb_pieces", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium mt-1">{property.nb_pieces}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-green-600" />
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
              {activeLease ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="default" className="bg-green-600">Loué</Badge>
                    <Link href={`/app/owner/contracts/${activeLease.id}`} className="text-sm text-blue-600 hover:underline">
                      Voir le bail
                    </Link>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground">Locataire(s)</p>
                    <p className="font-medium">
                      {activeLease.tenants?.length > 0 
                        ? activeLease.tenants.map((t: any) => `${t.prenom} ${t.nom}`).join(", ")
                        : "Inconnu"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <Badge variant="outline">Vacant</Badge>
                  <p className="text-sm text-muted-foreground">Aucun locataire actuellement.</p>
                  <Button asChild className="w-full" variant="default">
                    <Link href={`/app/owner/contracts/new?propertyId=${propertyId}`}>Créer un bail</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href={`/app/owner/documents?property_id=${propertyId}`}>
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
