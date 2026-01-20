import { createClient } from "@/lib/supabase/client";

export interface BankAccount {
  id: string;
  institution_name: string;
  account_name: string;
  iban: string;
  balance: number;
  currency: string;
}

class OpenBankingService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  /**
   * Initialize a connection session (Bridge/Plaid)
   */
  async createConnectSession(): Promise<string> {
    // In SOTA 2026, would call Bridge/Plaid API
    return "https://connect.bridgeapi.io/session/mock_session_123";
  }

  /**
   * Sync accounts after connection
   */
  async syncAccounts(): Promise<BankAccount[]> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");

    // Simulation for SOTA 2026
    const mockAccounts: BankAccount[] = [
      {
        id: "acc_1",
        institution_name: "Boursorama",
        account_name: "Compte Courant",
        iban: "FR76 3000 1234 5678 9012 3456 789",
        balance: 2450.50,
        currency: "EUR"
      }
    ];

    // Mark as connected in DB
    await this.supabase
      .from("tenant_profiles")
      .update({ open_banking_connected: true })
      .eq("profile_id", (await this.getProfileId(user.id)));

    return mockAccounts;
  }

  /**
   * Initiate an instant payment (PIS - Payment Initiation Service)
   */
  async initiateInstantPayment(amount: number, recipientIban: string, reference: string): Promise<boolean> {
    // In SOTA 2026, calls the DSP2 API
    console.log(`Initiating instant payment of ${amount}€ to ${recipientIban} (${reference})`);
    return true;
  }

  private async getProfileId(userId: string): Promise<string> {
    const { data } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .single();
    return data?.id || "";
  }
}

export const openBankingService = new OpenBankingService();

