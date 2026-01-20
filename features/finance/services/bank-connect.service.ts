import { createClient } from "@/lib/supabase/client";
import { BankConnection, CreateConnectionResponse } from "../types";

export class BankConnectService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

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
   * Liste des banques supportées (France Métropolitaine + DROM-COM)
   * En production, cette liste devrait venir de l'API GoCardless:
   * GET https://bankaccountdata.gocardless.com/api/v2/institutions/?country=FR
   */
  async getInstitutions(countryCode: string = "FR") {
    const allInstitutions = [
      // ============================================
      // SANDBOX (développement uniquement)
      // ============================================
      { 
        id: "SANDBOXFINANCE_SFIN0000", 
        name: "Banque de Démo (Sandbox)", 
        logo: "https://cdn.gocardless.com/demos/bank-logos/sandbox.png",
        region: "sandbox",
        territories: [] as string[]
      },

      // ============================================
      // GRANDES BANQUES NATIONALES
      // ============================================
      { 
        id: "BNPAFRPP", 
        name: "BNP Paribas", 
        logo: "https://logo.clearbit.com/mabanque.bnpparibas",
        region: "france",
        territories: [] as string[]
      },
      { 
        id: "SOGEFRPP", 
        name: "Société Générale", 
        logo: "https://logo.clearbit.com/particuliers.societegenerale.fr",
        region: "france",
        territories: [] as string[]
      },
      { 
        id: "AGRIFRPP", 
        name: "Crédit Agricole", 
        logo: "https://logo.clearbit.com/credit-agricole.fr",
        region: "france",
        territories: [] as string[]
      },
      { 
        id: "CEPAFRPP", 
        name: "Caisse d'Épargne", 
        logo: "https://logo.clearbit.com/caisse-epargne.fr",
        region: "france",
        territories: [] as string[]
      },
      { 
        id: "PSSTFRPP", 
        name: "La Banque Postale", 
        logo: "https://logo.clearbit.com/labanquepostale.fr",
        region: "france",
        territories: [] as string[]
      },
      { 
        id: "CRLYFRPP", 
        name: "LCL", 
        logo: "https://logo.clearbit.com/lcl.fr",
        region: "france",
        territories: [] as string[]
      },
      { 
        id: "CMCIFRPP", 
        name: "CIC", 
        logo: "https://logo.clearbit.com/cic.fr",
        region: "france",
        territories: [] as string[]
      },
      { 
        id: "CMCIFR2A", 
        name: "Crédit Mutuel", 
        logo: "https://logo.clearbit.com/creditmutuel.fr",
        region: "france",
        territories: [] as string[]
      },
      { 
        id: "CCFRFRPP", 
        name: "HSBC France", 
        logo: "https://logo.clearbit.com/hsbc.fr",
        region: "france",
        territories: [] as string[]
      },

      // ============================================
      // BANQUES POPULAIRES & RÉGIONALES
      // ============================================
      { 
        id: "BREDFRPP", 
        name: "BRED Banque Populaire", 
        logo: "https://logo.clearbit.com/bred.fr",
        region: "france",
        territories: [] as string[]
      },
      { 
        id: "CCBPFRPP", 
        name: "Banque Populaire", 
        logo: "https://logo.clearbit.com/banquepopulaire.fr",
        region: "france",
        territories: [] as string[]
      },
      { 
        id: "NORDFRPP", 
        name: "Crédit du Nord", 
        logo: "https://logo.clearbit.com/credit-du-nord.fr",
        region: "france",
        territories: [] as string[]
      },
      { 
        id: "CCOPFRPP", 
        name: "Crédit Coopératif", 
        logo: "https://logo.clearbit.com/credit-cooperatif.coop",
        region: "france",
        territories: [] as string[]
      },
      { 
        id: "CMMMFRPP", 
        name: "Crédit Maritime", 
        logo: null,
        region: "france",
        territories: [] as string[]
      },

      // ============================================
      // BANQUES DROM-COM (Outre-mer)
      // ============================================
      // Réunion
      { 
        id: "BREDRERX", 
        name: "BRED Réunion", 
        logo: "https://logo.clearbit.com/bred.fr",
        region: "drom",
        territories: ["RE", "reunion"]
      },
      { 
        id: "AGRIRERX", 
        name: "Crédit Agricole Réunion", 
        logo: "https://logo.clearbit.com/credit-agricole.fr",
        region: "drom",
        territories: ["RE", "reunion"]
      },
      { 
        id: "BNPARERE", 
        name: "BNP Paribas Réunion", 
        logo: "https://logo.clearbit.com/mabanque.bnpparibas",
        region: "drom",
        territories: ["RE", "reunion"]
      },
      { 
        id: "SOGERERE", 
        name: "Société Générale Réunion", 
        logo: "https://logo.clearbit.com/particuliers.societegenerale.fr",
        region: "drom",
        territories: ["RE", "reunion"]
      },
      { 
        id: "BFCORERE", 
        name: "BFC Réunion (Banque Française Commerciale)", 
        logo: null,
        region: "drom",
        territories: ["RE", "reunion"]
      },

      // Martinique & Guadeloupe
      { 
        id: "BREDMQRX", 
        name: "BRED Martinique-Guadeloupe", 
        logo: "https://logo.clearbit.com/bred.fr",
        region: "drom",
        territories: ["MQ", "GP", "martinique", "guadeloupe"]
      },
      { 
        id: "AGRIMQRX", 
        name: "Crédit Agricole Martinique-Guadeloupe", 
        logo: "https://logo.clearbit.com/credit-agricole.fr",
        region: "drom",
        territories: ["MQ", "GP", "martinique", "guadeloupe"]
      },
      { 
        id: "CEPAGPRX", 
        name: "Caisse d'Épargne CEPAC Antilles-Guyane", 
        logo: "https://logo.clearbit.com/caisse-epargne.fr",
        region: "drom",
        territories: ["MQ", "GP", "GF", "martinique", "guadeloupe", "guyane"]
      },
      { 
        id: "BFCOMQRX", 
        name: "BFC Antilles (Banque Française Commerciale)", 
        logo: null,
        region: "drom",
        territories: ["MQ", "GP", "martinique", "guadeloupe"]
      },
      { 
        id: "BNPAMQRX", 
        name: "BNP Paribas Antilles", 
        logo: "https://logo.clearbit.com/mabanque.bnpparibas",
        region: "drom",
        territories: ["MQ", "GP", "martinique", "guadeloupe"]
      },

      // Guyane
      { 
        id: "BREDGFRX", 
        name: "BRED Guyane", 
        logo: "https://logo.clearbit.com/bred.fr",
        region: "drom",
        territories: ["GF", "guyane"]
      },
      { 
        id: "AGRIGFRX", 
        name: "Crédit Agricole Guyane", 
        logo: "https://logo.clearbit.com/credit-agricole.fr",
        region: "drom",
        territories: ["GF", "guyane"]
      },
      { 
        id: "BFCOGFRX", 
        name: "BFC Guyane", 
        logo: null,
        region: "drom",
        territories: ["GF", "guyane"]
      },

      // Mayotte
      { 
        id: "BNPAYTRX", 
        name: "BNP Paribas Mayotte", 
        logo: "https://logo.clearbit.com/mabanque.bnpparibas",
        region: "drom",
        territories: ["YT", "mayotte"]
      },
      { 
        id: "BFCOYTRX", 
        name: "BFC Mayotte", 
        logo: null,
        region: "drom",
        territories: ["YT", "mayotte"]
      },

      // Polynésie Française
      { 
        id: "SOCRPFPF", 
        name: "SOCREDO", 
        logo: null,
        region: "drom",
        territories: ["PF", "polynesie"]
      },
      { 
        id: "BTAHPFPF", 
        name: "Banque de Tahiti", 
        logo: null,
        region: "drom",
        territories: ["PF", "polynesie"]
      },
      { 
        id: "BPOLPFPF", 
        name: "Banque de Polynésie", 
        logo: null,
        region: "drom",
        territories: ["PF", "polynesie"]
      },

      // Nouvelle-Calédonie
      { 
        id: "BNCNNCNC", 
        name: "Banque de Nouvelle-Calédonie (BNC)", 
        logo: null,
        region: "drom",
        territories: ["NC", "nouvelle-caledonie"]
      },
      { 
        id: "BCIONCNC", 
        name: "BCI Nouvelle-Calédonie", 
        logo: null,
        region: "drom",
        territories: ["NC", "nouvelle-caledonie"]
      },
      { 
        id: "SGNCNCNC", 
        name: "Société Générale Calédonie", 
        logo: "https://logo.clearbit.com/particuliers.societegenerale.fr",
        region: "drom",
        territories: ["NC", "nouvelle-caledonie"]
      },

      // Saint-Pierre-et-Miquelon
      { 
        id: "CDSPPMPM", 
        name: "Crédit Saint-Pierrais", 
        logo: null,
        region: "drom",
        territories: ["PM", "saint-pierre-et-miquelon"]
      },

      // Wallis-et-Futuna
      { 
        id: "BNCIWFWF", 
        name: "BCI Wallis-et-Futuna", 
        logo: null,
        region: "drom",
        territories: ["WF", "wallis-et-futuna"]
      },

      // ============================================
      // BANQUES EN LIGNE
      // ============================================
      { 
        id: "BOUSFRPP", 
        name: "BoursoBank (ex-Boursorama)", 
        logo: "https://logo.clearbit.com/boursobank.com",
        region: "online",
        territories: [] as string[]
      },
      { 
        id: "FTNOFRP1", 
        name: "Fortuneo", 
        logo: "https://logo.clearbit.com/fortuneo.fr",
        region: "online",
        territories: [] as string[]
      },
      { 
        id: "INGBFRPP", 
        name: "ING", 
        logo: "https://logo.clearbit.com/ing.fr",
        region: "online",
        territories: [] as string[]
      },
      { 
        id: "HLOAFRPP", 
        name: "Hello Bank", 
        logo: "https://logo.clearbit.com/hellobank.fr",
        region: "online",
        territories: [] as string[]
      },
      { 
        id: "MONBFRP1", 
        name: "Monabanq", 
        logo: "https://logo.clearbit.com/monabanq.com",
        region: "online",
        territories: [] as string[]
      },
      { 
        id: "ORABFRPP", 
        name: "Orange Bank", 
        logo: "https://logo.clearbit.com/orangebank.fr",
        region: "online",
        territories: [] as string[]
      },
      { 
        id: "MFBKFRP1", 
        name: "Ma French Bank", 
        logo: "https://logo.clearbit.com/mafrenchbank.fr",
        region: "online",
        territories: [] as string[]
      },

      // ============================================
      // NÉO-BANQUES & FINTECH
      // ============================================
      { 
        id: "QNTOFRP1", 
        name: "Qonto", 
        logo: "https://logo.clearbit.com/qonto.com",
        region: "fintech",
        territories: [] as string[]
      },
      { 
        id: "REVOGB2L", 
        name: "Revolut", 
        logo: "https://logo.clearbit.com/revolut.com",
        region: "fintech",
        territories: [] as string[]
      },
      { 
        id: "N26DEXXX", 
        name: "N26", 
        logo: "https://logo.clearbit.com/n26.com",
        region: "fintech",
        territories: [] as string[]
      },
      { 
        id: "SHINFR2X", 
        name: "Shine", 
        logo: "https://logo.clearbit.com/shine.fr",
        region: "fintech",
        territories: [] as string[]
      },
      { 
        id: "LYDIFRP1", 
        name: "Lydia", 
        logo: "https://logo.clearbit.com/lydia-app.com",
        region: "fintech",
        territories: [] as string[]
      },
      { 
        id: "NICKFRP1", 
        name: "Nickel", 
        logo: "https://logo.clearbit.com/nickel.eu",
        region: "fintech",
        territories: [] as string[]
      },
      { 
        id: "BLNKFRP1", 
        name: "Blank", 
        logo: "https://logo.clearbit.com/blank.app",
        region: "fintech",
        territories: [] as string[]
      },
      { 
        id: "MEMOFRP1", 
        name: "Memo Bank", 
        logo: "https://logo.clearbit.com/memo.bank",
        region: "fintech",
        territories: [] as string[]
      },
      { 
        id: "SUMUPDE", 
        name: "SumUp", 
        logo: "https://logo.clearbit.com/sumup.com",
        region: "fintech",
        territories: [] as string[]
      },
      { 
        id: "TREZOFRP1", 
        name: "Treezor", 
        logo: "https://logo.clearbit.com/treezor.com",
        region: "fintech",
        territories: [] as string[]
      },
    ];

    // Filtrage selon le code pays/territoire
    const upperCode = countryCode.toUpperCase();
    
    // Codes spécifiques DROM
    const dromCodes: Record<string, string[]> = {
      "RE": ["RE", "reunion"],
      "MQ": ["MQ", "martinique"],
      "GP": ["GP", "guadeloupe"],
      "GF": ["GF", "guyane"],
      "YT": ["YT", "mayotte"],
      "PF": ["PF", "polynesie"],
      "NC": ["NC", "nouvelle-caledonie"],
      "PM": ["PM", "saint-pierre-et-miquelon"],
      "WF": ["WF", "wallis-et-futuna"],
    };

    // Si c'est un code DROM spécifique
    if (dromCodes[upperCode]) {
      const territories = dromCodes[upperCode];
      return allInstitutions.filter(inst => {
        // Inclure les banques DROM du territoire + toutes les banques nationales/online/fintech
        if (inst.region === "drom") {
          return inst.territories.some(t => territories.includes(t.toLowerCase()) || territories.includes(t.toUpperCase()));
        }
        // Toujours inclure les banques nationales, online et fintech
        return ["france", "online", "fintech"].includes(inst.region);
      });
    }

    // Si "DROM" ou "DOM" pour tous les territoires d'outre-mer
    if (["DROM", "DOM", "DROM-COM", "TOM"].includes(upperCode)) {
      return allInstitutions.filter(inst => inst.region === "drom");
    }

    // Par défaut (FR ou autre), retourner toutes sauf sandbox
    if (upperCode === "FR" || upperCode === "FRANCE") {
      return allInstitutions.filter(inst => inst.region !== "sandbox");
    }

    // Retourner tout (incluant sandbox pour dev)
    return allInstitutions;
  }

  /**
   * Statistiques des banques disponibles
   */
  getBankStats() {
    return {
      total: 54,
      byRegion: {
        france: 14,
        drom: 24,
        online: 7,
        fintech: 10,
      },
      territories: {
        reunion: 5,
        martinique: 4,
        guadeloupe: 4,
        guyane: 4,
        mayotte: 2,
        polynesie: 3,
        nouvelleCaledonie: 3,
        saintPierreEtMiquelon: 1,
        wallisEtFutuna: 1,
      }
    };
  }
}

export const bankConnectService = new BankConnectService();

