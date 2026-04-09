/**
 * React Query hooks pour les annonces (property_listings)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  PropertyListingWithProperty,
  CreateListingInput,
  UpdateListingInput,
} from '@/lib/types/candidatures';

const LISTINGS_KEY = ['listings'];

interface ListingsResponse {
  listings: (PropertyListingWithProperty & { applications_count: number })[];
}

interface ListingResponse {
  listing: PropertyListingWithProperty;
}

/**
 * Récupérer toutes les annonces du propriétaire
 */
export function useListings() {
  return useQuery({
    queryKey: LISTINGS_KEY,
    queryFn: async () => {
      const res = await apiClient.get<ListingsResponse>('/v1/listings');
      return res.listings;
    },
  });
}

/**
 * Récupérer une annonce par ID
 */
export function useListing(id: string | undefined) {
  return useQuery({
    queryKey: [...LISTINGS_KEY, id],
    queryFn: async () => {
      const res = await apiClient.get<ListingResponse>(`/v1/listings/${id}`);
      return res.listing;
    },
    enabled: !!id,
  });
}

/**
 * Créer une annonce
 */
export function useCreateListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateListingInput) => {
      const res = await apiClient.post<ListingResponse>('/v1/listings', input);
      return res.listing;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LISTINGS_KEY });
    },
  });
}

/**
 * Mettre à jour une annonce
 */
export function useUpdateListing(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateListingInput) => {
      const res = await apiClient.patch<ListingResponse>(`/v1/listings/${id}`, input);
      return res.listing;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LISTINGS_KEY });
    },
  });
}

/**
 * Publier / dépublier une annonce
 */
export function useTogglePublishListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<{ listing: PropertyListingWithProperty; published: boolean }>(
        `/v1/listings/${id}/publish`
      );
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LISTINGS_KEY });
    },
  });
}
