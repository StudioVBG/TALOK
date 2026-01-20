import { createClient } from "@/lib/supabase/client";
import { chargeSchema } from "@/lib/validations";
import type { Charge, ChargeType, ChargePeriodicity } from "@/lib/types";

export interface CreateChargeData {
  property_id: string;
  type: ChargeType;
  montant: number;
  periodicite: ChargePeriodicity;
  refacturable_locataire: boolean;
}

export interface UpdateChargeData extends Partial<CreateChargeData> {}

export class ChargesService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  async getCharges() {
    const { data, error } = await this.supabase
      .from("charges")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as Charge[];
  }

  async getChargeById(id: string) {
    const { data, error } = await this.supabase
      .from("charges")
      .select("*")
      .eq("id", id as any)
      .single();

    if (error) throw error;
    return data as Charge;
  }

  async getChargesByProperty(propertyId: string) {
    const { data, error } = await this.supabase
      .from("charges")
      .select("*")
      .eq("property_id", propertyId as any)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as Charge[];
  }

  async createCharge(data: CreateChargeData) {
    const validatedData = chargeSchema.parse(data);

    const { data: charge, error } = await this.supabase
      .from("charges")
      .insert(validatedData as any)
      .select()
      .single();

    if (error) throw error;
    return charge as Charge;
  }

  async updateCharge(id: string, data: UpdateChargeData) {
    const { data: charge, error } = await (this.supabase
      .from("charges") as any)
      .update(data as any)
      .eq("id", id as any)
      .select()
      .single();

    if (error) throw error;
    return charge as Charge;
  }

  async deleteCharge(id: string) {
    const { error } = await this.supabase.from("charges").delete().eq("id", id);

    if (error) throw error;
  }
}

export const chargesService = new ChargesService();

