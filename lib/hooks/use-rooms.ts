/**
 * Hook React Query pour les rooms (pièces)
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { propertiesService } from "@/features/properties/services/properties.service";
import type { Room } from "@/lib/types";

/**
 * Hook pour récupérer les rooms d'une propriété
 */
export function useRooms(propertyId: string | null) {
  return useQuery({
    queryKey: ["rooms", propertyId],
    queryFn: async () => {
      if (!propertyId) throw new Error("Property ID requis");
      return await propertiesService.listRooms(propertyId);
    },
    enabled: !!propertyId,
  });
}

/**
 * Hook pour créer une room
 */
export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      propertyId,
      data,
    }: {
      propertyId: string;
      data: Parameters<typeof propertiesService.createRoom>[1];
    }) => {
      return await propertiesService.createRoom(propertyId, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rooms", variables.propertyId] });
      queryClient.invalidateQueries({ queryKey: ["property", variables.propertyId] });
    },
  });
}

/**
 * Hook pour mettre à jour une room
 */
export function useUpdateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      propertyId,
      roomId,
      data,
    }: {
      propertyId: string;
      roomId: string;
      data: Partial<Room>;
    }) => {
      return await propertiesService.updateRoom(propertyId, roomId, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rooms", variables.propertyId] });
      queryClient.invalidateQueries({ queryKey: ["property", variables.propertyId] });
    },
  });
}

/**
 * Hook pour supprimer une room
 */
export function useDeleteRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ propertyId, roomId }: { propertyId: string; roomId: string }) => {
      return await propertiesService.deleteRoom(propertyId, roomId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rooms", variables.propertyId] });
      queryClient.invalidateQueries({ queryKey: ["property", variables.propertyId] });
    },
  });
}

