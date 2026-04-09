"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { insuranceService } from "@/features/insurance/services/insurance.service";
import type { InsurancePolicyInsert, InsurancePolicyUpdate } from "@/lib/insurance/types";

export function useInsurancePolicies(filters?: {
  property_id?: string;
  lease_id?: string;
  type?: string;
}) {
  return useQuery({
    queryKey: ["insurance", filters],
    queryFn: () => insuranceService.list(filters),
    staleTime: 30_000,
    placeholderData: [],
  });
}

export function useInsurancePolicy(id: string | null) {
  return useQuery({
    queryKey: ["insurance", id],
    queryFn: () => insuranceService.getById(id!),
    enabled: !!id,
  });
}

export function useCreateInsurance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InsurancePolicyInsert) => insuranceService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insurance"] });
    },
  });
}

export function useUpdateInsurance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: InsurancePolicyUpdate }) =>
      insuranceService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insurance"] });
    },
  });
}

export function useDeleteInsurance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => insuranceService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["insurance"] });
    },
  });
}
