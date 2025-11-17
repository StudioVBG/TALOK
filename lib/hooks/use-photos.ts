/**
 * Hook React Query pour les photos
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { propertiesService } from "@/features/properties/services/properties.service";
import type { Photo } from "@/lib/types";

/**
 * Hook pour récupérer les photos d'une propriété
 */
export function usePhotos(propertyId: string | null) {
  return useQuery({
    queryKey: ["photos", propertyId],
    queryFn: async () => {
      if (!propertyId) throw new Error("Property ID requis");
      return await propertiesService.listPhotos(propertyId);
    },
    enabled: !!propertyId,
  });
}

/**
 * Hook pour mettre à jour une photo
 */
export function useUpdatePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ photoId, data }: { photoId: string; data: Partial<Photo> }) => {
      return await propertiesService.updatePhoto(photoId, data);
    },
    onSuccess: (updatedPhoto, variables) => {
      // Invalider toutes les queries photos pour rafraîchir les données
      queryClient.invalidateQueries({ queryKey: ["photos"] });
    },
  });
}

/**
 * Hook pour supprimer une photo
 */
export function useDeletePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (photoId: string) => {
      return await propertiesService.deletePhoto(photoId);
    },
    onSuccess: () => {
      // Invalider toutes les queries photos pour rafraîchir les données
      queryClient.invalidateQueries({ queryKey: ["photos"] });
    },
  });
}

