"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Loader2, Edit, MapPin, Home, Ruler, Building2, Image as ImageIcon } from "lucide-react";
import StepFrame from "../_components/StepFrame";
import WizardFooter from "../_components/WizardFooter";
import { useNewProperty } from "../_store/useNewProperty";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";
import { PropertyAPI, UnitAPI } from "@/lib/api";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  APARTMENT: "Appartement",
  HOUSE: "Maison",
  STUDIO: "Studio",
  COLOCATION: "Colocation",
  PARKING: "Place de parking",
  BOX: "Box fermé",
  RETAIL: "Local commercial / Boutique",
  OFFICE: "Bureaux / Tertiaire",
  WAREHOUSE: "Entrepôt / Atelier / Logistique",
  MIXED: "Fonds de commerce / Mixte",
};

const DPE_LABELS: Record<string, string> = {
  A: "A (Très performant)",
  B: "B (Performant)",
  C: "C (Assez performant)",
  D: "D (Peu performant)",
  E: "E (Peu performant)",
  F: "F (Très peu performant)",
  G: "G (Extrêmement peu performant)",
};

type CreationStep = 
  | "idle"
  | "creating_draft"
  | "updating_details"
  | "saving_rooms"
  | "uploading_photos"
  | "saving_features"
  | "publishing"
  | "activating"
  | "completed";

export default function SummaryStep() {
  const { draft, prev, reset } = useNewProperty();
  const { toast } = useToast();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [creationStep, setCreationStep] = useState<CreationStep>("idle");
  const [photoUploadProgress, setPhotoUploadProgress] = useState<Record<number, number>>({});

  const handleCreate = async () => {
    // ✅ PROTECTION: Éviter les appels multiples
    if (isCreating) {
      console.warn("[SummaryStep] Création déjà en cours, ignorer l'appel");
      return;
    }
    
    setIsCreating(true);
    setErrors([]);
    setCreationStep("creating_draft");
    setPhotoUploadProgress({});

    try {
      // Validation minimale
      if (!draft.kind) {
        throw new Error("Le type de bien est requis");
      }
      if (!draft.address?.adresse_complete || !draft.address?.code_postal || !draft.address?.ville) {
        throw new Error("L'adresse complète est requise");
      }

      // Mapping type_bien vers les valeurs attendues par l'API (selon propertyDraftSchema)
      const typeMapping: Record<string, string> = {
        APARTMENT: "appartement",
        HOUSE: "maison",
        STUDIO: "studio",
        COLOCATION: "colocation",
        PARKING: "parking",
        BOX: "box",
        RETAIL: "local_commercial",
        OFFICE: "bureaux",
        WAREHOUSE: "entrepot",
        MIXED: "fonds_de_commerce",
      };

      const type_bien = typeMapping[draft.kind];
      if (!type_bien) {
        throw new Error(`Type de bien invalide: ${draft.kind}`);
      }

      // 1. Créer le draft via l'API (canon simplifié)
      setCreationStep("creating_draft");
      const draftResponse = await PropertyAPI.createDraft({
        kind: draft.kind,
        address: {
          line1: draft.address?.adresse_complete || "",
          city: draft.address?.ville || "",
          postal_code: draft.address?.code_postal || "",
          country_code: "FR",
        },
        status: "DRAFT",
      });

      const propertyId = draftResponse.property_id;
      const unitId = draftResponse.unit_id;
      
      // ✅ VALIDATION: Vérifier que propertyId existe avant de continuer
      if (!propertyId) {
        console.error("[SummaryStep] property_id manquant dans la réponse:", draftResponse);
        throw new Error("Erreur lors de la création du bien : identifiant manquant");
      }
      
      // Stocker les IDs dans le store pour les étapes suivantes
      draft.property_id = propertyId;
      draft.unit_id = unitId;
      
      // ✅ VALIDATION: Double vérification avant utilisation
      if (!propertyId || propertyId === "undefined") {
        console.error("[SummaryStep] propertyId invalide:", propertyId);
        throw new Error("Erreur : identifiant du bien invalide");
      }

      // 2. Mettre à jour avec les données complètes
      const updatePayload: Record<string, unknown> = {
        adresse_complete: draft.address.adresse_complete,
        complement_adresse: draft.address.complement_adresse || null,
        code_postal: draft.address.code_postal,
        ville: draft.address.ville,
        departement: draft.address.departement || null,
      };

      if (draft.details) {
        if (draft.details.surface_m2) updatePayload.surface = draft.details.surface_m2;
        if (draft.details.rooms_count) updatePayload.nb_pieces = draft.details.rooms_count;
        if (draft.details.floor !== undefined) updatePayload.etage = draft.details.floor;
        if (draft.details.elevator !== undefined) updatePayload.ascenseur = draft.details.elevator;
        if (draft.details.dpe_classe_energie) updatePayload.dpe_classe_energie = draft.details.dpe_classe_energie;
        if (draft.details.dpe_classe_climat) updatePayload.dpe_classe_climat = draft.details.dpe_classe_climat;
        if (draft.details.dpe_consommation) updatePayload.dpe_consommation = draft.details.dpe_consommation;
        if (draft.details.dpe_emissions) updatePayload.dpe_emissions = draft.details.dpe_emissions;
        if (draft.details.permis_louer_requis !== undefined) updatePayload.permis_louer_requis = draft.details.permis_louer_requis;
        if (draft.details.permis_louer_numero) updatePayload.permis_louer_numero = draft.details.permis_louer_numero;
        if (draft.details.permis_louer_date) updatePayload.permis_louer_date = draft.details.permis_louer_date;
      }

      // 2. Mettre à jour avec les données complètes
      setCreationStep("updating_details");
      // ✅ VALIDATION: Vérifier une dernière fois avant l'appel API
      if (!propertyId || propertyId === "undefined") {
        throw new Error("Erreur : identifiant du bien invalide avant mise à jour");
      }
      await apiClient.patch(`/properties/${propertyId}`, updatePayload);

      // 3. Sauvegarder les rooms (si présentes, mode FULL uniquement)
      // ✅ OPTIMISATION: Parallélisation des sauvegardes de rooms
      if (draft.rooms && draft.rooms.length > 0) {
        setCreationStep("saving_rooms");
        try {
          await Promise.all(
            draft.rooms.map((room) =>
              apiClient.post(`/properties/${propertyId}/rooms`, {
                type_piece: room.room_type,
                label_affiche: room.name || room.room_type,
                ordre: room.sort_order,
              })
            )
          );
        } catch (roomError: any) {
          console.warn("[SummaryStep] Erreur lors de la sauvegarde des rooms:", roomError);
          // On continue même si les rooms échouent
        }
      }

      // 4. Upload des photos (si présentes)
      // ✅ OPTIMISATION: Parallélisation des URLs signées et uploads (avec limite de concurrence)
      // ✅ IMPORTANT: Cette étape est NON-BLOQUANTE - le bien est déjà créé et visible
      let photoUploadErrors = false;
      
      if (draft.photos && draft.photos.length > 0) {
        setCreationStep("uploading_photos");
        try {
          const photosWithFiles = draft.photos
            .map((photo, index) => ({ photo, index }))
            .filter(({ photo }) => photo.file);

          if (photosWithFiles.length > 0) {
            // ✅ Étape 1: Obtenir toutes les URLs signées en parallèle
            const uploadUrlPromises = photosWithFiles.map(({ photo, index }) => {
              setPhotoUploadProgress((prev) => ({ ...prev, [index]: 0 }));
              
              // ✅ CORRECTION: Ajouter un tag par défaut si manquant pour éviter l'erreur 400
              // Pour les photos sans pièce, utiliser "vue_generale" par défaut
              // Note: photo peut ne pas avoir de propriété tag, utiliser "vue_generale" par défaut
              const defaultTag = (photo as any).tag || "vue_generale";
              
              return apiClient
                .post<{ upload_url: string; uploadURL?: string; key?: string; photo?: any }>(
                  `/properties/${propertyId}/photos/upload-url`,
                  {
                    file_name: photo.file!.name,
                    mime_type: photo.file!.type as "image/jpeg" | "image/png" | "image/webp",
                    tag: defaultTag, // ✅ Tag par défaut au lieu de null
                    room_id: null,
                  }
                )
                .then((response) => {
                  // ✅ CORRECTION: L'API retourne upload_url (snake_case), pas uploadURL (camelCase)
                  const uploadURL = response.upload_url || response.uploadURL;
                  if (!uploadURL) {
                    console.error(`[SummaryStep] ⚠️ uploadURL manquant dans la réponse:`, response);
                    throw new Error("URL d'upload manquante dans la réponse");
                  }
                  return { response: { uploadURL, key: response.key || "" }, index, photo };
                })
                .catch((error) => {
                  // ✅ GESTION D'ERREUR: Logger mais ne pas bloquer la création
                  console.warn(`[SummaryStep] Erreur upload URL pour photo ${index + 1}:`, error);
                  // Retourner null pour cette photo, on continuera sans elle
                  return null;
                });
            });

            // ✅ FILTRER: Exclure les promesses qui ont échoué (null)
            const uploadUrlsResults = await Promise.allSettled(uploadUrlPromises);
            const uploadUrls = uploadUrlsResults
              .map((result, index) => {
                if (result.status === "fulfilled" && result.value !== null) {
                  return result.value;
                } else {
                  console.warn(`[SummaryStep] Photo ${index + 1} ignorée (erreur upload URL)`);
                  return null;
                }
              })
              .filter((item): item is { response: { uploadURL: string; key: string }; index: number; photo: any } => {
                if (item === null) return false;
                // ✅ VALIDATION: Vérifier que uploadURL est bien une URL valide (Supabase signed URL)
                if (!item.response.uploadURL || !item.response.uploadURL.startsWith('http')) {
                  console.error(`[SummaryStep] ⚠️ uploadURL invalide:`, item.response.uploadURL);
                  return false;
                }
                return true;
              });
            
            // ✅ Si aucune photo n'a pu obtenir d'URL, continuer quand même
            if (uploadUrls.length === 0) {
              console.warn("[SummaryStep] Aucune photo n'a pu obtenir d'URL d'upload, continuation sans photos");
              photoUploadErrors = true;
            } else {
              // Vérifier s'il y a eu des erreurs dans les résultats
              photoUploadErrors = uploadUrlsResults.some(r => r.status === "rejected");
            }

            // ✅ Étape 2: Uploader les photos en parallèle (limite de 3 uploads simultanés pour éviter la surcharge)
            // Seulement si on a des URLs valides
            if (uploadUrls.length > 0) {
              const MAX_CONCURRENT_UPLOADS = 3;
              const uploadPromises: Promise<void>[] = [];

              for (let i = 0; i < uploadUrls.length; i += MAX_CONCURRENT_UPLOADS) {
              const batch = uploadUrls.slice(i, i + MAX_CONCURRENT_UPLOADS);
              const batchPromises = batch.map(({ response, index, photo }) => {
                setPhotoUploadProgress((prev) => ({ ...prev, [index]: 30 }));

                return new Promise<void>((resolve, reject) => {
                  const xhr = new XMLHttpRequest();

                  xhr.upload.addEventListener("progress", (e) => {
                    if (e.lengthComputable) {
                      const percentComplete = 30 + Math.round((e.loaded / e.total) * 70);
                      setPhotoUploadProgress((prev) => ({ ...prev, [index]: percentComplete }));
                    }
                  });

                  xhr.addEventListener("load", () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                      setPhotoUploadProgress((prev) => ({ ...prev, [index]: 100 }));
                      resolve();
                    } else {
                      reject(new Error(`Échec de l'upload de la photo ${index + 1}`));
                    }
                  });

                  xhr.addEventListener("error", () => {
                    reject(new Error(`Échec de l'upload de la photo ${index + 1}`));
                  });

                  xhr.open("PUT", response.uploadURL);
                  xhr.setRequestHeader("Content-Type", photo.file!.type);
                  xhr.send(photo.file!);
                });
              });

                uploadPromises.push(...batchPromises);
                // Attendre que le batch actuel soit terminé avant de commencer le suivant
                await Promise.allSettled(batchPromises); // ✅ Utiliser allSettled pour ne pas bloquer sur une erreur
              }

              // Attendre que tous les uploads soient terminés (même en cas d'erreur)
              await Promise.allSettled(uploadPromises);

              // La photo est automatiquement créée dans la table photos par l'API upload-url
              // Si c'est la photo de couverture, on peut la marquer comme telle après
              if (photosWithFiles[0]?.photo.isCover) {
                // La première photo est automatiquement marquée comme is_main par l'API
              }
            }
          }
        } catch (photoError: any) {
          // ✅ GESTION D'ERREUR AMÉLIORÉE: Logger l'erreur mais continuer la création
          console.warn("[SummaryStep] Erreur lors de l'upload des photos:", photoError);
          console.warn("[SummaryStep] Le bien sera créé mais les photos devront être ajoutées ultérieurement");
          photoUploadErrors = true;
          // On continue même si les photos échouent - le bien doit être visible
        }
      } else {
        // Pas de photos à uploader, pas d'erreur
        photoUploadErrors = false;
      }

      // 5. Sauvegarder les features (si présentes, mode FULL uniquement)
      if (draft.features && draft.features.length > 0) {
        setCreationStep("saving_features");
        try {
          await apiClient.post(`/properties/${propertyId}/features/bulk`, {
            features: draft.features.map((feature) => ({
              feature,
              value: true,
            })),
          });
        } catch (featureError: any) {
          console.warn("[SummaryStep] Erreur lors de la sauvegarde des features:", featureError);
          // On continue même si les features échouent
        }
      }

      // 6 & 7. Sauvegarder les options de publication et activer le bien
      // ✅ OPTIMISATION: Regrouper les deux PATCH en un seul pour réduire les requêtes
      setCreationStep("publishing");
      const finalPayload: Record<string, unknown> = {};
      
      // Options de publication (mode FULL uniquement)
      if (draft.is_published !== undefined || draft.visibility || draft.available_from) {
        if (draft.is_published !== undefined) {
          // Note: L'API properties ne semble pas avoir de champ is_published direct
          // On peut utiliser l'état "published" à la place
          if (draft.is_published) {
            finalPayload.etat = "published";
          }
        }
        if (draft.available_from) {
          finalPayload.disponible_a_partir_de = draft.available_from;
        }
      }
      
      // ✅ IMPORTANT: Ne PAS activer automatiquement - garder le bien en "draft"
      // pour qu'il soit visible même si incomplet (photos manquantes, etc.)
      // Le bien reste en "draft" et sera visible dans la liste "Mes biens"
      // L'utilisateur pourra l'activer manuellement quand il le souhaite
      // if (!draft.is_published && !finalPayload.etat) {
      //   finalPayload.etat = "active"; // ❌ SUPPRIMÉ - ne pas activer automatiquement
      // }
      
      // ✅ VALIDATION: Vérifier que propertyId existe avant de continuer
      if (!propertyId) {
        console.error("[SummaryStep] propertyId manquant lors de la sauvegarde finale");
        throw new Error("Erreur : identifiant du bien manquant");
      }
      
      // Faire un seul PATCH si nécessaire
      if (Object.keys(finalPayload).length > 0) {
        setCreationStep("activating");
        try {
          await apiClient.patch(`/properties/${propertyId}`, finalPayload);
        } catch (finalError: any) {
          console.warn("[SummaryStep] Erreur lors de la sauvegarde finale:", finalError);
          // On continue même si cette étape échoue
        }
      }
      
      // Note: La génération de code_unique pour units est désactivée car la colonne n'existe pas
      // Si nécessaire, créer une migration pour ajouter cette colonne
      // if (unitId) {
      //   setCreationStep("activating");
      //   try {
      //     await UnitAPI.createCode(unitId);
      //   } catch (codeError: any) {
      //     console.warn("[SummaryStep] Erreur lors de la génération du code:", codeError);
      //   }
      // }
      
      // ✅ IMPORTANT: Ne PAS activer automatiquement - garder le bien en draft
      // pour qu'il soit visible même si incomplet (photos manquantes, etc.)
      // L'utilisateur pourra l'activer manuellement quand il le souhaite
      // Le bien reste en "draft" et sera visible dans la liste "Mes biens"
      /*
      if (!draft.is_published) {
        setCreationStep("activating");
        try {
          await PropertyAPI.activate(propertyId);
        } catch (activateError: any) {
          console.warn("[SummaryStep] Erreur lors de l'activation:", activateError);
          // On continue même si cette étape échoue - le bien reste en draft et visible
        }
      }
      */

      setCreationStep("completed");

      // ✅ SUCCÈS: Le bien est créé même si certaines étapes ont échouent (photos, etc.)
      // Tracker les erreurs non bloquantes pour adapter le message
      const hasErrors = photoUploadErrors;
      
      toast({
        title: "Bien créé avec succès",
        description: hasErrors 
          ? "Votre bien a été créé et est maintenant visible dans vos biens. Certaines photos peuvent nécessiter des ajustements et pourront être complétées ultérieurement."
          : "Votre bien a été créé et est maintenant visible dans vos biens.",
      });

      // Réinitialiser le store
      reset();

      // ✅ RAFFRAÎCHIR: Forcer le rafraîchissement du cache Next.js
      // IMPORTANT: router.refresh() seul ne suffit pas toujours avec unstable_cache
      // On doit aussi appeler revalidatePath côté serveur via une route API
      router.refresh();

      // Appeler une route API pour forcer la revalidation côté serveur
      try {
        await fetch("/api/revalidate?path=/app/owner/properties&tag=owner:properties", {
          method: "POST",
          credentials: "include",
        });
      } catch (revalidateError) {
        console.warn("[SummaryStep] Erreur lors de la revalidation:", revalidateError);
        // On continue quand même
      }

      // Attendre un court instant pour que le refresh soit pris en compte
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Rediriger vers la liste des propriétés pour voir le nouveau bien
      // Ajouter un timestamp pour forcer le rechargement
      router.push(`/app/owner/properties?refresh=${Date.now()}`);
    } catch (error: any) {
      console.error("[SummaryStep] Erreur lors de la création:", error);
      const errorMessage = error?.message || error?.error || "Une erreur est survenue lors de la création du bien";
      setErrors([errorMessage]);
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const canCreate = draft.kind && draft.address?.adresse_complete && draft.address?.code_postal && draft.address?.ville;

  return (
    <StepFrame k="SUMMARY">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Récapitulatif</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Vérifiez les informations avant de créer votre bien
          </p>
        </div>

        {/* Barre de progression de création */}
        {isCreating && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            className="rounded-lg border bg-muted/50 p-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {creationStep === "creating_draft" && "Création du bien..."}
                  {creationStep === "updating_details" && "Mise à jour des détails..."}
                  {creationStep === "saving_rooms" && "Sauvegarde des pièces..."}
                  {creationStep === "uploading_photos" && "Upload des photos..."}
                  {creationStep === "saving_features" && "Sauvegarde des caractéristiques..."}
                  {creationStep === "publishing" && "Publication..."}
                  {creationStep === "activating" && "Activation..."}
                  {creationStep === "completed" && "Terminé !"}
                </span>
                {creationStep !== "completed" && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <motion.div
                  className="h-2 rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{
                    width:
                      creationStep === "creating_draft" ? "15%" :
                      creationStep === "updating_details" ? "30%" :
                      creationStep === "saving_rooms" ? "45%" :
                      creationStep === "uploading_photos" ? "60%" :
                      creationStep === "saving_features" ? "75%" :
                      creationStep === "publishing" ? "85%" :
                      creationStep === "activating" ? "95%" :
                      creationStep === "completed" ? "100%" : "0%",
                  }}
                  transition={{ duration: reduced ? 0 : 0.3, ease: "easeOut" }}
                />
              </div>
              {/* Progression détaillée pour les photos */}
              {creationStep === "uploading_photos" && draft.photos && draft.photos.length > 0 && (
                <div className="space-y-2 mt-3">
                  {draft.photos.map((photo, index) => {
                    const progress = photoUploadProgress[index] || 0;
                    return (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground truncate flex-1 mr-2">
                            {photo.file?.name || `Photo ${index + 1}`}
                          </span>
                          <span className="text-muted-foreground">{progress}%</span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-muted">
                          <motion.div
                            className="h-1 rounded-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: reduced ? 0 : 0.2 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Erreurs */}
        {errors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            className="rounded-lg border border-destructive bg-destructive/10 p-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive mb-2">Erreurs</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}

        {/* Récapitulatif par section */}
        <div className="space-y-4">
          {/* Type de bien */}
          {draft.kind && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.2 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    Type de bien
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium">{TYPE_LABELS[draft.kind] || draft.kind}</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Adresse */}
          {draft.address && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.2, delay: reduced ? 0 : 0.1 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Adresse
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-sm font-medium">{draft.address.adresse_complete}</p>
                  {draft.address.complement_adresse && (
                    <p className="text-sm text-muted-foreground">{draft.address.complement_adresse}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {draft.address.code_postal} {draft.address.ville}
                    {draft.address.departement && ` (${draft.address.departement})`}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Détails */}
          {draft.details && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.2, delay: reduced ? 0 : 0.2 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Détails
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {draft.details.surface_m2 && (
                      <div className="flex items-center gap-2">
                        <Ruler className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          <span className="font-medium">Surface :</span> {draft.details.surface_m2} m²
                        </span>
                      </div>
                    )}
                    {draft.details.rooms_count && (
                      <div className="flex items-center gap-2">
                        <Home className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          <span className="font-medium">Pièces :</span> {draft.details.rooms_count}
                        </span>
                      </div>
                    )}
                    {draft.details.floor !== undefined && draft.details.floor !== null && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          <span className="font-medium">Étage :</span> {draft.details.floor}
                        </span>
                      </div>
                    )}
                    {draft.details.elevator && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Ascenseur</span>
                      </div>
                    )}
                    {draft.details.dpe_classe_energie && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          <span className="font-medium">DPE Énergie :</span> {DPE_LABELS[draft.details.dpe_classe_energie] || draft.details.dpe_classe_energie}
                        </span>
                      </div>
                    )}
                    {draft.details.dpe_classe_climat && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          <span className="font-medium">DPE Climat :</span> {DPE_LABELS[draft.details.dpe_classe_climat] || draft.details.dpe_classe_climat}
                        </span>
                      </div>
                    )}
                    {draft.details.permis_louer_requis && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm">
                          Permis de louer : {draft.details.permis_louer_numero || "Numéro non renseigné"}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Photos */}
          {draft.photos && draft.photos.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduced ? 0 : 0.2, delay: reduced ? 0 : 0.3 }}
            >
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Photos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    <span className="font-medium">{draft.photos.length}</span> photo{draft.photos.length > 1 ? "s" : ""} ajoutée{draft.photos.length > 1 ? "s" : ""}
                  </p>
                  {draft.photos.some((p) => p.isCover) && (
                    <p className="text-xs text-muted-foreground mt-1">Photo de couverture définie</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Message d'aide */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduced ? 0 : 0.2, delay: reduced ? 0 : 0.4 }}
            className="rounded-lg border bg-muted/50 p-4"
          >
            <p className="text-sm text-muted-foreground">
              Une fois créé, vous pourrez modifier toutes ces informations depuis la page de votre bien.
            </p>
          </motion.div>
        </div>
      </div>

      <WizardFooter
        primary={isCreating ? "Création en cours..." : "Créer le bien"}
        onPrimary={handleCreate}
        onBack={prev}
        disabled={!canCreate || isCreating}
        hint={isCreating ? "Veuillez patienter..." : "Vérifiez les informations avant de créer"}
      />
    </StepFrame>
  );
}
