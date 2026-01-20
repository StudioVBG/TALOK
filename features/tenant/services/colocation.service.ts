import { createClient } from "@/lib/supabase/client";

export interface HouseRuleVersion {
  id: string;
  lease_id: string;
  version: number;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
}

export interface RuleAcceptance {
  id: string;
  rule_version_id: string;
  roommate_id: string;
  accepted_at: string;
  ip_inet?: string | null;
  user_agent?: string | null;
}

export interface ChoreSchedule {
  id: string;
  lease_id: string;
  chore_name: string;
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  current_assignee_id?: string | null;
  rotation_order?: number[] | null;
  last_rotated_at?: string | null;
  created_at: string;
  updated_at: string;
}

export class ColocationService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  /**
   * Récupérer le règlement de colocation actuel
   */
  async getCurrentHouseRules(leaseId: string): Promise<HouseRuleVersion | null> {
    const { data, error } = await this.supabase
      .from("house_rule_versions")
      .select("*")
      .eq("lease_id", leaseId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }
    return data;
  }

  /**
   * Vérifier si l'utilisateur a accepté le règlement
   */
  async hasAcceptedRules(
    leaseId: string,
    ruleVersionId: string
  ): Promise<boolean> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) return false;

    const { data: roommate } = await this.supabase
      .from("roommates")
      .select("id")
      .eq("lease_id", leaseId)
      .eq("user_id", user.id)
      .is("left_on", null)
      .single();

    if (!roommate) return false;

    const { data: acceptance } = await this.supabase
      .from("rule_acceptances")
      .select("id")
      .eq("rule_version_id", ruleVersionId)
      .eq("roommate_id", roommate.id)
      .single();

    return !!acceptance;
  }

  /**
   * Accepter le règlement
   */
  async acceptRules(ruleVersionId: string): Promise<RuleAcceptance> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");

    // Récupérer le roommate_id
    const { data: rule } = await this.supabase
      .from("house_rule_versions")
      .select("lease_id")
      .eq("id", ruleVersionId)
      .single();

    if (!rule) throw new Error("Règlement non trouvé");

    const { data: roommate } = await this.supabase
      .from("roommates")
      .select("id")
      .eq("lease_id", rule.lease_id)
      .eq("user_id", user.id)
      .is("left_on", null)
      .single();

    if (!roommate) throw new Error("Vous n'êtes pas colocataire");

    const { data: acceptance, error } = await this.supabase
      .from("rule_acceptances")
      .insert({
        rule_version_id: ruleVersionId,
        roommate_id: roommate.id,
        accepted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return acceptance;
  }

  /**
   * Récupérer les tâches ménagères
   */
  async getChores(leaseId: string): Promise<ChoreSchedule[]> {
    const { data, error } = await this.supabase
      .from("chore_schedule")
      .select("*")
      .eq("lease_id", leaseId)
      .order("chore_name", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Faire tourner les tâches
   */
  async rotateChores(leaseId: string): Promise<void> {
    const chores = await this.getChores(leaseId);

    for (const chore of chores) {
      if (!chore.rotation_order || chore.rotation_order.length === 0) {
        continue;
      }

      // Trouver l'index actuel
      const currentIndex = chore.rotation_order.findIndex(
        (id) => id.toString() === chore.current_assignee_id
      );

      // Passer au suivant
      const nextIndex = (currentIndex + 1) % chore.rotation_order.length;
      const nextAssigneeId = chore.rotation_order[nextIndex];

      await this.supabase
        .from("chore_schedule")
        .update({
          current_assignee_id: nextAssigneeId.toString(),
          last_rotated_at: new Date().toISOString(),
        })
        .eq("id", chore.id);
    }
  }
}

export const colocationService = new ColocationService();

