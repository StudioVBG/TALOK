/**
 * FEC Export Service
 * Extracted from accounting.service.ts
 *
 * Handles the generation and export of FEC (Fichier des Écritures Comptables)
 * format required by French tax authorities.
 */

import { createClient } from "@/lib/supabase/client";
import { EcritureFEC } from "../types";
import { formatDateFEC } from "../constants/plan-comptable";
import { calculateHonoraires } from "./calculations";
import { getDateReversement } from "./helpers";

export class FECExportService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  /**
   * Génère l'export FEC pour une année
   */
  async generateExportFEC(annee: number): Promise<EcritureFEC[]> {
    const ecritures: EcritureFEC[] = [];
    let ecritureNum = 1;

    // Récupérer toutes les factures de l'année
    const { data: invoices } = await this.supabase
      .from("invoices")
      .select(`
        id,
        periode,
        montant_loyer,
        montant_charges,
        montant_total,
        statut,
        date_paiement,
        lease:leases!inner(
          loyer,
          property:properties!inner(
            owner_id,
            owner:profiles!properties_owner_id_fkey(prenom, nom)
          )
        )
      `)
      .eq("statut", "payee")
      .gte("periode", `${annee}-01`)
      .lte("periode", `${annee}-12`);

    for (const invoice of invoices || []) {
      const leaseData = invoice.lease as any;
      const owner = leaseData?.property?.owner;
      const ownerName = owner ? `${owner.prenom || ""} ${owner.nom || ""}`.trim() : "N/A";
      const ownerId = leaseData?.property?.owner_id || "";

      const datePaiement = invoice.date_paiement || `${invoice.periode}-05`;
      const dateReversement = getDateReversement(datePaiement);

      // Écriture 1: Facturation honoraires (Ventes)
      const honoraires = calculateHonoraires(leaseData?.loyer || invoice.montant_loyer || 0);

      // Débit client
      ecritures.push({
        JournalCode: "VE",
        JournalLib: "Ventes",
        EcritureNum: `VE-${annee}-${String(ecritureNum).padStart(6, "0")}`,
        EcritureDate: formatDateFEC(datePaiement),
        CompteNum: `411${ownerId.substring(0, 5).toUpperCase()}`,
        CompteLib: `Client ${ownerName}`,
        PieceRef: `FA-${invoice.id.substring(0, 8)}`,
        PieceDate: formatDateFEC(datePaiement),
        EcritureLib: `Honoraires gestion ${invoice.periode}`,
        Debit: honoraires.total_ttc,
        Credit: 0,
        Montantdevise: 0,
        Idevise: "EUR",
      });

      // Crédit produits
      ecritures.push({
        JournalCode: "VE",
        JournalLib: "Ventes",
        EcritureNum: `VE-${annee}-${String(ecritureNum).padStart(6, "0")}`,
        EcritureDate: formatDateFEC(datePaiement),
        CompteNum: "706100",
        CompteLib: "Honoraires de gestion locative",
        PieceRef: `FA-${invoice.id.substring(0, 8)}`,
        PieceDate: formatDateFEC(datePaiement),
        EcritureLib: `Honoraires gestion ${invoice.periode}`,
        Debit: 0,
        Credit: honoraires.montant_ht,
        Montantdevise: 0,
        Idevise: "EUR",
      });

      // Crédit TVA collectée
      ecritures.push({
        JournalCode: "VE",
        JournalLib: "Ventes",
        EcritureNum: `VE-${annee}-${String(ecritureNum).padStart(6, "0")}`,
        EcritureDate: formatDateFEC(datePaiement),
        CompteNum: "445710",
        CompteLib: "TVA collectée",
        PieceRef: `FA-${invoice.id.substring(0, 8)}`,
        PieceDate: formatDateFEC(datePaiement),
        EcritureLib: `TVA sur honoraires ${invoice.periode}`,
        Debit: 0,
        Credit: honoraires.tva_montant,
        Montantdevise: 0,
        Idevise: "EUR",
      });

      ecritureNum++;

      // Écriture 2: Encaissement (Banque)
      ecritures.push({
        JournalCode: "BQ",
        JournalLib: "Banque Agence",
        EcritureNum: `BQ-${annee}-${String(ecritureNum).padStart(6, "0")}`,
        EcritureDate: formatDateFEC(dateReversement),
        CompteNum: "512000",
        CompteLib: "Banque compte courant",
        PieceRef: `ENC-${invoice.id.substring(0, 8)}`,
        PieceDate: formatDateFEC(dateReversement),
        EcritureLib: `Encaissement honoraires ${invoice.periode}`,
        Debit: honoraires.total_ttc,
        Credit: 0,
        Montantdevise: 0,
        Idevise: "EUR",
      });

      ecritures.push({
        JournalCode: "BQ",
        JournalLib: "Banque Agence",
        EcritureNum: `BQ-${annee}-${String(ecritureNum).padStart(6, "0")}`,
        EcritureDate: formatDateFEC(dateReversement),
        CompteNum: `411${ownerId.substring(0, 5).toUpperCase()}`,
        CompteLib: `Client ${ownerName}`,
        PieceRef: `ENC-${invoice.id.substring(0, 8)}`,
        PieceDate: formatDateFEC(dateReversement),
        EcritureLib: `Encaissement honoraires ${invoice.periode}`,
        Debit: 0,
        Credit: honoraires.total_ttc,
        Montantdevise: 0,
        Idevise: "EUR",
      });

      ecritureNum++;
    }

    return ecritures;
  }

  /**
   * Convertit les écritures FEC en CSV
   */
  exportFECToCSV(ecritures: EcritureFEC[]): string {
    const headers = [
      "JournalCode",
      "JournalLib",
      "EcritureNum",
      "EcritureDate",
      "CompteNum",
      "CompteLib",
      "CompAuxNum",
      "CompAuxLib",
      "PieceRef",
      "PieceDate",
      "EcritureLib",
      "Debit",
      "Credit",
      "EcritureLet",
      "DateLet",
      "ValidDate",
      "Montantdevise",
      "Idevise",
    ];

    const lines = ecritures.map((e) =>
      [
        e.JournalCode,
        e.JournalLib,
        e.EcritureNum,
        e.EcritureDate,
        e.CompteNum,
        e.CompteLib,
        e.CompAuxNum || "",
        e.CompAuxLib || "",
        e.PieceRef,
        e.PieceDate,
        e.EcritureLib,
        e.Debit.toFixed(2).replace(".", ","),
        e.Credit.toFixed(2).replace(".", ","),
        e.EcritureLet || "",
        e.DateLet || "",
        e.ValidDate || "",
        e.Montantdevise.toFixed(2).replace(".", ","),
        e.Idevise,
      ].join(";")
    );

    return [headers.join(";"), ...lines].join("\n");
  }
}

// Export singleton
export const fecExportService = new FECExportService();
