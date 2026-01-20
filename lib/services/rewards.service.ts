import { createClient } from "@/lib/supabase/client";

export interface RewardTransaction {
  id: string;
  points: number;
  action_type: string;
  description: string;
  created_at: string;
}

class RewardsService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  /**
   * Get total points and last transactions
   */
  async getTenantRewardsSummary(): Promise<{ total_points: number; history: RewardTransaction[] }> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return { total_points: 0, history: [] };

    const { data: profile } = await this.supabase
      .from("profiles")
      .select("id, tenant_profiles(total_points)")
      .eq("user_id", user.id)
      .single();

    if (!profile) return { total_points: 0, history: [] };

    const { data: history } = await this.supabase
      .from("tenant_rewards")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(10);

    return {
      total_points: (profile.tenant_profiles as any)?.total_points || 0,
      history: history || []
    };
  }

  /**
   * Award points for an action
   */
  async awardPoints(actionType: 'rent_paid_on_time' | 'energy_saving' | 'profile_completed', points: number, description: string): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) return;

    await this.supabase.from("tenant_rewards").insert({
      profile_id: profile.id,
      points,
      action_type: actionType,
      description
    });
  }
}

export const rewardsService = new RewardsService();

