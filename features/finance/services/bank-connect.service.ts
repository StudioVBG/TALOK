import { createClient } from "@/lib/supabase/client";
import { BankConnection, CreateConnectionResponse } from "../types";

export class BankConnectService {
  private supabase = createClient();

  /**
   * Initier une connexion bancaire
   * NOTE (MVP): Actuellement MOCKÉ. 
   * En production, cela doit appeler une Edge Function qui contacte l'API GoCardless/Powens.
   */
  async initiateConnection(institutionId: string): Promise<CreateConnectionResponse> {
    // TODO: Implémenter l'appel réel à l'Edge Function 'bank-initiate'
    // const { data, error } = await this.supabase.functions.invoke('bank-initiate', {
    //   body: { institutionId }
    // });
    
    console.warn("[BankConnectService] Using MOCK implementation for initiateConnection");

    // Simulation pour le développement UI
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          link: "https://bank-account-data.gocardless.com/sandbox/...", 
          requisition_id: "req_" + Math.random().toString(36).substr(2, 9)
        });
      }, 1000);
    });
  }

  /**
   * Récupérer les connexions existantes
   */
  async getConnections(): Promise<BankConnection[]> {
    const { data, error } = await this.supabase
      .from("bank_connections")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as BankConnection[];
  }

  /**
   * Supprimer une connexion
   */
  async deleteConnection(id: string): Promise<void> {
    const { error } = await this.supabase
      .from("bank_connections")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }

  /**
   * Liste des banques supportées (Mock ou API)
   */
  async getInstitutions(countryCode: string = "FR") {
    // Idéalement, cette liste vient aussi de l'Edge Function pour être à jour
    // Pour le MVP SOTA, on met les principales banques françaises
    return [
      { id: "SANDBOXFINANCE_SFIN0000", name: "Banque de Démo (Sandbox)", logo: "https://cdn.gocardless.com/demos/bank-logos/sandbox.png" },
      { id: "BPCE_BPCEFRPP", name: "Caisse d'Epargne", logo: "https://logo.clearbit.com/caisse-epargne.fr" },
      { id: "BNP_PARIBAS", name: "BNP Paribas", logo: "https://logo.clearbit.com/mabanque.bnpparibas" },
      { id: "SOCIETE_GENERALE", name: "Société Générale", logo: "https://logo.clearbit.com/particuliers.societegenerale.fr" },
      { id: "CREDIT_AGRICOLE", name: "Crédit Agricole", logo: "https://logo.clearbit.com/credit-agricole.fr" },
      { id: "BOURSORAMA", name: "BoursoBank", logo: "https://logo.clearbit.com/boursobank.com" },
      { id: "REVOLUT", name: "Revolut", logo: "https://logo.clearbit.com/revolut.com" },
      { id: "QONTO", name: "Qonto", logo: "https://logo.clearbit.com/qonto.com" },
    ];
  }
}

export const bankConnectService = new BankConnectService();

