/**
 * React Query hooks pour les candidatures (applications)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Application, CreateApplicationInput } from '@/lib/types/candidatures';

const APPLICATIONS_KEY = ['applications'];

interface ApplicationsResponse {
  applications: Application[];
}

interface ApplicationResponse {
  application: Application;
}

/**
 * Récupérer les candidatures pour une annonce
 */
export function useApplicationsForListing(listingId: string | undefined, statusFilter?: string) {
  return useQuery({
    queryKey: [...APPLICATIONS_KEY, 'listing', listingId, statusFilter],
    queryFn: async () => {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await apiClient.get<ApplicationsResponse>(
        `/v1/listings/${listingId}/applications${params}`
      );
      return res.applications;
    },
    enabled: !!listingId,
  });
}

/**
 * Récupérer une candidature par ID
 */
export function useApplication(id: string | undefined) {
  return useQuery({
    queryKey: [...APPLICATIONS_KEY, id],
    queryFn: async () => {
      const res = await apiClient.get<ApplicationResponse>(`/v1/applications/${id}`);
      return res.application;
    },
    enabled: !!id,
  });
}

/**
 * Déposer une candidature (public)
 */
export function useCreateApplication() {
  return useMutation({
    mutationFn: async (input: CreateApplicationInput) => {
      const res = await apiClient.post<ApplicationResponse>('/v1/applications', input);
      return res.application;
    },
  });
}

/**
 * Accepter une candidature
 */
export function useAcceptApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<{ application: Application; lease_id: string | null }>(
        `/v1/applications/${id}/accept`
      );
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPLICATIONS_KEY });
    },
  });
}

/**
 * Refuser une candidature
 */
export function useRejectApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await apiClient.post<ApplicationResponse>(
        `/v1/applications/${id}/reject`,
        { rejection_reason: reason }
      );
      return res.application;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPLICATIONS_KEY });
    },
  });
}

/**
 * Lancer le scoring IA
 */
export function useScoreApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<{ application: Application; scoring: any }>(
        `/v1/applications/${id}/score`
      );
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPLICATIONS_KEY });
    },
  });
}

/**
 * Comparer des candidatures
 */
export function useCompareApplications() {
  return useMutation({
    mutationFn: async (applicationIds: string[]) => {
      const res = await apiClient.post<{
        applications: Application[];
        ranking: Array<{
          application_id: string;
          applicant_name: string;
          total_score: number;
          rank: number;
        }>;
      }>('/v1/applications/compare', { application_ids: applicationIds });
      return res;
    },
  });
}

/**
 * Récupérer une annonce publique par token
 */
export function usePublicListing(token: string | undefined) {
  return useQuery({
    queryKey: ['public-listing', token],
    queryFn: async () => {
      const res = await apiClient.get<{ listing: any }>(`/v1/public/listings/${token}`);
      return res.listing;
    },
    enabled: !!token,
  });
}
