"use client";

import { useQuery } from "@tanstack/react-query";
import { rewardsService, type RewardTransaction } from "@/lib/services/rewards.service";

interface RewardsSummary {
  total_points: number;
  history: RewardTransaction[];
}

async function fetchTenantRewards(): Promise<RewardsSummary> {
  return rewardsService.getTenantRewardsSummary();
}

export function useTenantRewards() {
  return useQuery({
    queryKey: ["tenant", "rewards"],
    queryFn: fetchTenantRewards,
  });
}
