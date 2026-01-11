/**
 * Service d'intégration comptable
 * Enregistre les écritures comptables lors des opérations métier
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  JOURNAUX,
  generateCompteProprietaire,
  generateCompteLocataire,
  getTauxTVA
} from "../constants/plan-comptable";

export interface AccountingEntryInput {
  journal_code: string;
  entry_date: string;
  compte_num: string;
  compte_lib: string;
  piece_ref: string;
  libelle: string;
  debit: number;
  credit: number;
  entity_type?: string;
  entity_id?: string;
}

export interface HonorairesResult {
  loyer_hc: number;
  taux_ht: number;
  montant_ht: number;
  tva_taux: number;
  tva_montant: number;
  total_ttc: number;
  net_proprietaire: number;
}

export class AccountingIntegrationService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Calcule les honoraires de gestion
   */
  calculateHonoraires(
    loyerHC: number,
    tauxHT: number = 0.07,
    codePostal: string = "75000"
  ): HonorairesResult {
    const tauxTVA = getTauxTVA(codePostal);
    const montantHT = loyerHC * tauxHT;
    const tvaMontant = montantHT * tauxTVA;
    const totalTTC = montantHT + tvaMontant;
    const netProprietaire = loyerHC - totalTTC;

    return {
      loyer_hc: Math.round(loyerHC * 100) / 100,
      taux_ht: tauxHT,
      montant_ht: Math.round(montantHT * 100) / 100,
      tva_taux: tauxTVA,
      tva_montant: Math.round(tvaMontant * 100) / 100,
      total_ttc: Math.round(totalTTC * 100) / 100,
      net_proprietaire: Math.round(netProprietaire * 100) / 100,
    };
  }

  /**
   * Enregistre une écriture comptable
   */
  async recordEntry(entry: AccountingEntryInput): Promise<{ id: string } | null> {
    const { data, error } = await this.supabase
      .from("accounting_entries")
      .insert({
        journal_code: entry.journal_code,
        entry_date: entry.entry_date,
        compte_num: entry.compte_num,
        compte_lib: entry.compte_lib,
        piece_ref: entry.piece_ref,
        libelle: entry.libelle,
        debit: entry.debit,
        credit: entry.credit,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[AccountingIntegration] Erreur enregistrement écriture:", error);
      return null;
    }

    return data;
  }

  /**
   * Enregistre les écritures lors d'un paiement de loyer
   *
   * Flux comptable:
   * 1. Encaissement locataire (BM - Banque Mandant)
   *    - Débit 512100 Banque Mandant
   *    - Crédit 467200-xxx Compte Locataire
   *
   * 2. Facturation honoraires (VE - Ventes)
   *    - Débit 467100-xxx Compte Propriétaire
   *    - Crédit 706100 Honoraires gestion
   *    - Crédit 445710 TVA collectée
   *
   * 3. Mise à disposition propriétaire (OD)
   *    - Débit 467200-xxx Compte Locataire (part loyer)
   *    - Crédit 467100-xxx Compte Propriétaire
   */
  async recordRentPayment(params: {
    invoiceId: string;
    leaseId: string;
    ownerId: string;
    tenantId: string;
    periode: string;
    montantLoyer: number;
    montantCharges: number;
    montantTotal: number;
    paymentDate: string;
    propertyCodePostal?: string;
  }): Promise<{ success: boolean; entries: string[] }> {
    const entries: string[] = [];
    const pieceRef = `PAY-${params.invoiceId.substring(0, 8)}`;
    const codePostal = params.propertyCodePostal || "75000";

    try {
      // 1. Calculer les honoraires
      const honoraires = this.calculateHonoraires(params.montantLoyer, 0.07, codePostal);

      // 2. Encaissement locataire - Débit Banque Mandant
      const entry1 = await this.recordEntry({
        journal_code: JOURNAUX.BANQUE_MANDANT,
        entry_date: params.paymentDate,
        compte_num: "512100",
        compte_lib: "Banque compte mandant",
        piece_ref: pieceRef,
        libelle: `Encaissement loyer ${params.periode} - Locataire`,
        debit: params.montantTotal,
        credit: 0,
        entity_type: "invoice",
        entity_id: params.invoiceId,
      });
      if (entry1) entries.push(entry1.id);

      // 3. Encaissement locataire - Crédit Compte Locataire
      const compteLocataire = generateCompteLocataire(params.tenantId);
      const entry2 = await this.recordEntry({
        journal_code: JOURNAUX.BANQUE_MANDANT,
        entry_date: params.paymentDate,
        compte_num: compteLocataire,
        compte_lib: `Compte locataire ${params.tenantId.substring(0, 8)}`,
        piece_ref: pieceRef,
        libelle: `Encaissement loyer ${params.periode}`,
        debit: 0,
        credit: params.montantTotal,
        entity_type: "invoice",
        entity_id: params.invoiceId,
      });
      if (entry2) entries.push(entry2.id);

      // 4. Facturation honoraires - Débit Compte Propriétaire
      const compteProprietaire = generateCompteProprietaire(params.ownerId);
      const entry3 = await this.recordEntry({
        journal_code: JOURNAUX.VENTES,
        entry_date: params.paymentDate,
        compte_num: compteProprietaire,
        compte_lib: `Compte propriétaire ${params.ownerId.substring(0, 8)}`,
        piece_ref: `FA-${params.invoiceId.substring(0, 8)}`,
        libelle: `Honoraires gestion ${params.periode}`,
        debit: honoraires.total_ttc,
        credit: 0,
        entity_type: "invoice",
        entity_id: params.invoiceId,
      });
      if (entry3) entries.push(entry3.id);

      // 5. Facturation honoraires - Crédit Produits
      const entry4 = await this.recordEntry({
        journal_code: JOURNAUX.VENTES,
        entry_date: params.paymentDate,
        compte_num: "706100",
        compte_lib: "Honoraires de gestion locative",
        piece_ref: `FA-${params.invoiceId.substring(0, 8)}`,
        libelle: `Honoraires gestion ${params.periode}`,
        debit: 0,
        credit: honoraires.montant_ht,
        entity_type: "invoice",
        entity_id: params.invoiceId,
      });
      if (entry4) entries.push(entry4.id);

      // 6. Facturation honoraires - Crédit TVA
      const entry5 = await this.recordEntry({
        journal_code: JOURNAUX.VENTES,
        entry_date: params.paymentDate,
        compte_num: "445710",
        compte_lib: "TVA collectée 20%",
        piece_ref: `FA-${params.invoiceId.substring(0, 8)}`,
        libelle: `TVA honoraires ${params.periode}`,
        debit: 0,
        credit: honoraires.tva_montant,
        entity_type: "invoice",
        entity_id: params.invoiceId,
      });
      if (entry5) entries.push(entry5.id);

      // 7. Mise à disposition - Débit Compte Locataire (transfert au proprio)
      const entry6 = await this.recordEntry({
        journal_code: JOURNAUX.OD,
        entry_date: params.paymentDate,
        compte_num: compteLocataire,
        compte_lib: `Compte locataire ${params.tenantId.substring(0, 8)}`,
        piece_ref: `TRANS-${params.invoiceId.substring(0, 8)}`,
        libelle: `Transfert loyer ${params.periode} vers propriétaire`,
        debit: params.montantTotal,
        credit: 0,
        entity_type: "invoice",
        entity_id: params.invoiceId,
      });
      if (entry6) entries.push(entry6.id);

      // 8. Mise à disposition - Crédit Compte Propriétaire
      const entry7 = await this.recordEntry({
        journal_code: JOURNAUX.OD,
        entry_date: params.paymentDate,
        compte_num: compteProprietaire,
        compte_lib: `Compte propriétaire ${params.ownerId.substring(0, 8)}`,
        piece_ref: `TRANS-${params.invoiceId.substring(0, 8)}`,
        libelle: `Crédit loyer ${params.periode} (net honoraires)`,
        debit: 0,
        credit: params.montantTotal,
        entity_type: "invoice",
        entity_id: params.invoiceId,
      });
      if (entry7) entries.push(entry7.id);

      // 9. Mettre à jour les soldes mandants
      await this.updateMandantBalance(params.ownerId, "owner", params.montantTotal - honoraires.total_ttc);
      await this.updateMandantBalance(params.tenantId, "tenant", -params.montantTotal);

      return { success: true, entries };
    } catch (error) {
      console.error("[AccountingIntegration] Erreur enregistrement paiement:", error);
      return { success: false, entries };
    }
  }

  /**
   * Met à jour le solde d'un compte mandant
   */
  async updateMandantBalance(
    profileId: string,
    accountType: "owner" | "tenant",
    amount: number
  ): Promise<boolean> {
    const accountNum = accountType === "owner"
      ? generateCompteProprietaire(profileId)
      : generateCompteLocataire(profileId);

    // Vérifier si le compte existe
    const { data: existing } = await this.supabase
      .from("mandant_accounts")
      .select("id, balance")
      .eq("profile_id", profileId)
      .eq("account_type", accountType)
      .single();

    if (existing) {
      // Mettre à jour
      const { error } = await this.supabase
        .from("mandant_accounts")
        .update({
          balance: existing.balance + amount,
          updated_at: new Date().toISOString()
        })
        .eq("id", existing.id);

      if (error) {
        console.error("[AccountingIntegration] Erreur màj solde:", error);
        return false;
      }
    } else {
      // Créer
      const { error } = await this.supabase
        .from("mandant_accounts")
        .insert({
          profile_id: profileId,
          account_type: accountType,
          account_num: accountNum,
          balance: amount,
        });

      if (error) {
        console.error("[AccountingIntegration] Erreur création compte:", error);
        return false;
      }
    }

    return true;
  }

  /**
   * Enregistre les écritures lors d'un reversement propriétaire
   */
  async recordOwnerPayout(params: {
    ownerId: string;
    amount: number;
    payoutDate: string;
    reference: string;
  }): Promise<{ success: boolean; entries: string[] }> {
    const entries: string[] = [];
    const compteProprietaire = generateCompteProprietaire(params.ownerId);

    try {
      // Débit Compte Propriétaire
      const entry1 = await this.recordEntry({
        journal_code: JOURNAUX.BANQUE_MANDANT,
        entry_date: params.payoutDate,
        compte_num: compteProprietaire,
        compte_lib: `Compte propriétaire ${params.ownerId.substring(0, 8)}`,
        piece_ref: params.reference,
        libelle: `Reversement propriétaire`,
        debit: params.amount,
        credit: 0,
        entity_type: "payout",
        entity_id: params.reference,
      });
      if (entry1) entries.push(entry1.id);

      // Crédit Banque Mandant
      const entry2 = await this.recordEntry({
        journal_code: JOURNAUX.BANQUE_MANDANT,
        entry_date: params.payoutDate,
        compte_num: "512100",
        compte_lib: "Banque compte mandant",
        piece_ref: params.reference,
        libelle: `Reversement propriétaire`,
        debit: 0,
        credit: params.amount,
        entity_type: "payout",
        entity_id: params.reference,
      });
      if (entry2) entries.push(entry2.id);

      // Mettre à jour le solde mandant
      await this.updateMandantBalance(params.ownerId, "owner", -params.amount);

      return { success: true, entries };
    } catch (error) {
      console.error("[AccountingIntegration] Erreur reversement:", error);
      return { success: false, entries };
    }
  }

  /**
   * Enregistre une opération sur dépôt de garantie
   */
  async recordDepositOperation(params: {
    tenantId: string;
    leaseId: string;
    operationType: "encaissement" | "restitution" | "retenue";
    amount: number;
    date: string;
    description?: string;
  }): Promise<{ success: boolean; entries: string[] }> {
    const entries: string[] = [];
    const pieceRef = `DEP-${params.leaseId.substring(0, 8)}`;

    try {
      if (params.operationType === "encaissement") {
        // Encaissement dépôt de garantie
        // Débit Banque Mandant
        const entry1 = await this.recordEntry({
          journal_code: JOURNAUX.BANQUE_MANDANT,
          entry_date: params.date,
          compte_num: "512100",
          compte_lib: "Banque compte mandant",
          piece_ref: pieceRef,
          libelle: `Dépôt de garantie - Encaissement`,
          debit: params.amount,
          credit: 0,
          entity_type: "lease",
          entity_id: params.leaseId,
        });
        if (entry1) entries.push(entry1.id);

        // Crédit Compte Dépôts
        const entry2 = await this.recordEntry({
          journal_code: JOURNAUX.BANQUE_MANDANT,
          entry_date: params.date,
          compte_num: "165000",
          compte_lib: "Dépôts de garantie reçus",
          piece_ref: pieceRef,
          libelle: `Dépôt de garantie - ${params.tenantId.substring(0, 8)}`,
          debit: 0,
          credit: params.amount,
          entity_type: "lease",
          entity_id: params.leaseId,
        });
        if (entry2) entries.push(entry2.id);

        // Enregistrer dans deposit_operations
        await this.supabase.from("deposit_operations").insert({
          lease_id: params.leaseId,
          tenant_id: params.tenantId,
          operation_type: "encaissement",
          amount: params.amount,
          operation_date: params.date,
          description: params.description || "Dépôt de garantie initial",
        });

      } else if (params.operationType === "restitution") {
        // Restitution dépôt de garantie
        // Débit Compte Dépôts
        const entry1 = await this.recordEntry({
          journal_code: JOURNAUX.BANQUE_MANDANT,
          entry_date: params.date,
          compte_num: "165000",
          compte_lib: "Dépôts de garantie reçus",
          piece_ref: pieceRef,
          libelle: `Restitution dépôt - ${params.tenantId.substring(0, 8)}`,
          debit: params.amount,
          credit: 0,
          entity_type: "lease",
          entity_id: params.leaseId,
        });
        if (entry1) entries.push(entry1.id);

        // Crédit Banque Mandant
        const entry2 = await this.recordEntry({
          journal_code: JOURNAUX.BANQUE_MANDANT,
          entry_date: params.date,
          compte_num: "512100",
          compte_lib: "Banque compte mandant",
          piece_ref: pieceRef,
          libelle: `Restitution dépôt de garantie`,
          debit: 0,
          credit: params.amount,
          entity_type: "lease",
          entity_id: params.leaseId,
        });
        if (entry2) entries.push(entry2.id);

        await this.supabase.from("deposit_operations").insert({
          lease_id: params.leaseId,
          tenant_id: params.tenantId,
          operation_type: "restitution",
          amount: params.amount,
          operation_date: params.date,
          description: params.description || "Restitution dépôt de garantie",
        });
      }

      return { success: true, entries };
    } catch (error) {
      console.error("[AccountingIntegration] Erreur dépôt garantie:", error);
      return { success: false, entries };
    }
  }

  /**
   * Récupère le solde d'un compte mandant
   */
  async getMandantBalance(profileId: string, accountType: "owner" | "tenant"): Promise<number> {
    const { data } = await this.supabase
      .from("mandant_accounts")
      .select("balance")
      .eq("profile_id", profileId)
      .eq("account_type", accountType)
      .single();

    return data?.balance || 0;
  }

  /**
   * Récupère toutes les écritures pour une entité
   */
  async getEntriesForEntity(entityType: string, entityId: string) {
    const { data, error } = await this.supabase
      .from("accounting_entries")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("entry_date", { ascending: true });

    if (error) {
      console.error("[AccountingIntegration] Erreur récupération écritures:", error);
      return [];
    }

    return data || [];
  }

  /**
   * Crée une écriture d'extourne pour annuler une écriture
   */
  async reverseEntry(params: {
    entryId: string;
    motif: string;
    date?: string;
  }): Promise<{ success: boolean; reversal_id?: string }> {
    const reversalDate = params.date || new Date().toISOString().split("T")[0];

    // Récupérer l'écriture originale
    const { data: original, error: fetchError } = await this.supabase
      .from("accounting_entries")
      .select("*")
      .eq("id", params.entryId)
      .single();

    if (fetchError || !original) {
      console.error("[AccountingIntegration] Écriture non trouvée:", params.entryId);
      return { success: false };
    }

    // Créer l'écriture d'extourne (inverse les débits/crédits)
    const reversal = await this.recordEntry({
      journal_code: JOURNAUX.OD, // Opérations Diverses pour les extournes
      entry_date: reversalDate,
      compte_num: original.compte_num,
      compte_lib: original.compte_lib,
      piece_ref: `EXT-${original.piece_ref}`,
      libelle: `Extourne: ${params.motif} (réf: ${original.piece_ref})`,
      debit: original.credit, // Inverse
      credit: original.debit, // Inverse
      entity_type: "reversal",
      entity_id: original.id,
    });

    if (!reversal) {
      return { success: false };
    }

    // Mettre à jour l'écriture originale pour indiquer qu'elle a été extournée
    await this.supabase
      .from("accounting_entries")
      .update({
        reversed: true,
        reversal_id: reversal.id,
        reversed_at: reversalDate,
      })
      .eq("id", params.entryId);

    return { success: true, reversal_id: reversal.id };
  }

  /**
   * Annule un ensemble d'écritures liées à une entité
   */
  async reverseEntriesForEntity(params: {
    entityType: string;
    entityId: string;
    motif: string;
  }): Promise<{ success: boolean; reversals: string[] }> {
    const entries = await this.getEntriesForEntity(params.entityType, params.entityId);
    const reversals: string[] = [];

    for (const entry of entries) {
      if (!entry.reversed) {
        const result = await this.reverseEntry({
          entryId: entry.id,
          motif: params.motif,
        });
        if (result.reversal_id) {
          reversals.push(result.reversal_id);
        }
      }
    }

    return { success: true, reversals };
  }

  /**
   * Enregistre les écritures pour un paiement de travaux
   */
  async recordWorkOrderPayment(params: {
    workOrderId: string;
    ownerId: string;
    providerId: string;
    amount: number;
    paymentDate: string;
    description: string;
  }): Promise<{ success: boolean; entries: string[] }> {
    const entries: string[] = [];
    const pieceRef = `WO-${params.workOrderId.substring(0, 8)}`;
    const compteProprietaire = generateCompteProprietaire(params.ownerId);

    try {
      // 1. Débit compte propriétaire (charge pour le propriétaire)
      const entry1 = await this.recordEntry({
        journal_code: JOURNAUX.ACHATS,
        entry_date: params.paymentDate,
        compte_num: compteProprietaire,
        compte_lib: `Compte propriétaire ${params.ownerId.substring(0, 8)}`,
        piece_ref: pieceRef,
        libelle: `Travaux: ${params.description}`,
        debit: params.amount,
        credit: 0,
        entity_type: "work_order",
        entity_id: params.workOrderId,
      });
      if (entry1) entries.push(entry1.id);

      // 2. Crédit fournisseur (dette envers le prestataire)
      const entry2 = await this.recordEntry({
        journal_code: JOURNAUX.ACHATS,
        entry_date: params.paymentDate,
        compte_num: "401000",
        compte_lib: `Fournisseur ${params.providerId.substring(0, 8)}`,
        piece_ref: pieceRef,
        libelle: `Travaux: ${params.description}`,
        debit: 0,
        credit: params.amount,
        entity_type: "work_order",
        entity_id: params.workOrderId,
      });
      if (entry2) entries.push(entry2.id);

      // 3. Paiement fournisseur - Débit fournisseur
      const entry3 = await this.recordEntry({
        journal_code: JOURNAUX.BANQUE_MANDANT,
        entry_date: params.paymentDate,
        compte_num: "401000",
        compte_lib: `Fournisseur ${params.providerId.substring(0, 8)}`,
        piece_ref: `PAY-${pieceRef}`,
        libelle: `Règlement travaux`,
        debit: params.amount,
        credit: 0,
        entity_type: "work_order",
        entity_id: params.workOrderId,
      });
      if (entry3) entries.push(entry3.id);

      // 4. Paiement fournisseur - Crédit Banque
      const entry4 = await this.recordEntry({
        journal_code: JOURNAUX.BANQUE_MANDANT,
        entry_date: params.paymentDate,
        compte_num: "512100",
        compte_lib: "Banque compte mandant",
        piece_ref: `PAY-${pieceRef}`,
        libelle: `Règlement travaux`,
        debit: 0,
        credit: params.amount,
        entity_type: "work_order",
        entity_id: params.workOrderId,
      });
      if (entry4) entries.push(entry4.id);

      // Mettre à jour le solde mandant propriétaire
      await this.updateMandantBalance(params.ownerId, "owner", -params.amount);

      return { success: true, entries };
    } catch (error) {
      console.error("[AccountingIntegration] Erreur paiement travaux:", error);
      return { success: false, entries };
    }
  }
}
