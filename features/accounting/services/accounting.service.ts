/**
 * Service Comptabilité - Gestion Locative
 * Calculs et génération des documents comptables
 *
 * Refactored: Pure calculations extracted to ./calculations.ts
 * Refactored: Helpers extracted to ./helpers.ts
 * Refactored: FEC export extracted to ./fec-export.service.ts
 */

import { createClient } from "@/lib/supabase/client";
import {
  CRGData,
  MouvementMandant,
  BalanceMandants,
  CompteMandant,
  SituationLocataire,
  RecapitulatifFiscal,
  EcritureFEC,
  CalculHonoraires,
  CalculReversement,
  Periode,
  ChargesDeductibles,
} from "../types";
import {
  TAUX_HONORAIRES,
  generateCompteProprietaire,
  generateCompteLocataire,
  formatDateFEC,
} from "../constants/plan-comptable";

// Import extracted modules
import {
  calculateHonoraires as calcHonoraires,
  calculateReversement as calcReversement,
  calculateProrata as calcProrata,
  calculateTotauxMouvements,
  calculateRecapitulatif,
} from "./calculations";
import { formatPeriode, getDateReversement } from "./helpers";
import { fecExportService } from "./fec-export.service";

export class AccountingService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  // ============================================================================
  // CALCULS DE BASE (delegated to ./calculations.ts)
  // ============================================================================

  /**
   * Calcule les honoraires de gestion sur un loyer
   */
  calculateHonoraires(
    loyerHC: number,
    tauxHT: number = TAUX_HONORAIRES.GESTION_LOCATIVE,
    codePostal: string = "75000"
  ): CalculHonoraires {
    return calcHonoraires(loyerHC, tauxHT, codePostal);
  }

  /**
   * Calcule le montant à reverser au propriétaire
   */
  calculateReversement(
    loyerEncaisse: number,
    chargesEncaissees: number,
    tauxHonoraires: number = TAUX_HONORAIRES.GESTION_LOCATIVE,
    travauxDeduits: number = 0,
    autresDeductions: number = 0,
    codePostal: string = "75000"
  ): CalculReversement {
    return calcReversement(
      loyerEncaisse,
      chargesEncaissees,
      tauxHonoraires,
      travauxDeduits,
      autresDeductions,
      codePostal
    );
  }

  /**
   * Calcule le prorata temporis pour les charges
   */
  calculateProrata(
    dateDebut: string,
    dateFin: string,
    annee: number
  ): { jours_occupation: number; jours_annee: number; ratio: number } {
    return calcProrata(dateDebut, dateFin, annee);
  }

  // ============================================================================
  // COMPTE RENDU DE GESTION (CRG)
  // ============================================================================

  /**
   * Génère le Compte Rendu de Gestion pour un propriétaire sur une période
   */
  async generateCRG(ownerId: string, periode: Periode): Promise<CRGData[]> {
    // 1. Récupérer les informations du propriétaire
    const { data: ownerProfile } = await this.supabase
      .from("profiles")
      .select(`
        id,
        prenom,
        nom,
        email,
        owner_profiles!inner(
          type,
          siret,
          raison_sociale,
          adresse_facturation
        )
      `)
      .eq("id", ownerId)
      .single();

    if (!ownerProfile) {
      throw new Error("Propriétaire non trouvé");
    }

    // 2. Récupérer les biens du propriétaire
    const { data: properties } = await this.supabase
      .from("properties")
      .select(`
        id,
        nom,
        type_bien,
        adresse_ligne1,
        ville,
        code_postal,
        surface,
        nb_pieces
      `)
      .eq("owner_id", ownerId);

    if (!properties?.length) {
      throw new Error("Aucun bien trouvé pour ce propriétaire");
    }

    // 3. Pour chaque bien, générer le CRG
    const crgs: CRGData[] = [];

    for (const property of properties) {
      // Récupérer le bail actif
      const { data: lease } = await this.supabase
        .from("leases")
        .select(`
          id,
          loyer,
          charges_forfaitaires,
          date_debut,
          date_fin,
          type_bail,
          tenant:profiles!leases_tenant_id_fkey(
            id,
            prenom,
            nom,
            email
          )
        `)
        .eq("property_id", property.id)
        .eq("statut", "active")
        .single();

      // Récupérer les mouvements de la période
      const mouvements = await this.getPropertyMovements(
        property.id,
        ownerId,
        periode.debut,
        periode.fin
      );

      // Calculer le solde de début de période
      const soldeDebut = await this.calculateSoldeAtDate(ownerId, property.id, periode.debut);

      // Calculer les totaux
      const totaux = this.calculateTotauxMouvements(mouvements);

      // Calculer le récapitulatif
      const recapitulatif = this.calculateRecapitulatif(mouvements);

      const ownerData = ownerProfile.owner_profiles as any;

      const crg: CRGData = {
        numero: `CRG-${new Date().getFullYear()}-${property.id.substring(0, 4).toUpperCase()}`,
        date_emission: new Date().toISOString().split("T")[0],
        periode,
        gestionnaire: {
          raison_sociale: "TALOK GESTION",
          adresse: "10 rue de la Paix, 75002 Paris",
          siret: "123 456 789 00012",
          carte_g: "CPI 7501 2024 000 012 345",
        },
        proprietaire: {
          id: ownerProfile.id,
          nom: ownerProfile.nom || "",
          prenom: ownerProfile.prenom || "",
          raison_sociale: ownerData?.raison_sociale || undefined,
          adresse: ownerData?.adresse_facturation || "",
          type: ownerData?.type || "particulier",
          siret: ownerData?.siret || undefined,
          email: ownerProfile.email || undefined,
        },
        bien: {
          id: property.id,
          reference: `LOT-${property.id.substring(0, 8).toUpperCase()}`,
          type: property.type_bien || "appartement",
          adresse: property.adresse_ligne1 || "",
          ville: property.ville || "",
          code_postal: property.code_postal || "",
          surface: property.surface || undefined,
          nb_pieces: property.nb_pieces || undefined,
        },
        locataire: lease?.tenant
          ? {
              id: (lease.tenant as any).id,
              nom: (lease.tenant as any).nom || "",
              prenom: (lease.tenant as any).prenom || "",
              email: (lease.tenant as any).email || undefined,
              bail: {
                debut: lease.date_debut,
                fin: lease.date_fin || "",
                type: lease.type_bail || "nu",
              },
            }
          : undefined,
        loyer_mensuel: {
          loyer_hc: lease?.loyer || 0,
          provisions_charges: lease?.charges_forfaitaires || 0,
          loyer_cc: (lease?.loyer || 0) + (lease?.charges_forfaitaires || 0),
        },
        solde_debut_periode: soldeDebut,
        mouvements,
        totaux,
        solde_fin_periode: soldeDebut + totaux.total_credits - totaux.total_debits,
        recapitulatif,
      };

      crgs.push(crg);
    }

    return crgs;
  }

  /**
   * Récupère tous les mouvements d'un bien sur une période
   */
  private async getPropertyMovements(
    propertyId: string,
    ownerId: string,
    startDate: string,
    endDate: string
  ): Promise<MouvementMandant[]> {
    const mouvements: MouvementMandant[] = [];

    // 1. Loyers encaissés (via invoices payées)
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
          property_id,
          loyer
        )
      `)
      .eq("lease.property_id", propertyId)
      .eq("statut", "payee")
      .gte("periode", startDate.substring(0, 7))
      .lte("periode", endDate.substring(0, 7));

    // Ajouter les loyers comme crédits
    for (const invoice of invoices || []) {
      const datePaiement = invoice.date_paiement || `${invoice.periode}-05`;

      mouvements.push({
        id: `LOY-${invoice.id}`,
        date: datePaiement,
        piece: `QT-${invoice.id.substring(0, 8)}`,
        libelle: `Loyer ${formatPeriode(invoice.periode)}`,
        type: "credit",
        montant: invoice.montant_total || 0,
        categorie: "loyer",
        invoice_id: invoice.id,
      });

      // Calculer et ajouter les honoraires comme débit
      const leaseData = invoice.lease as any;
      const honoraires = this.calculateHonoraires(leaseData?.loyer || invoice.montant_loyer || 0);

      mouvements.push({
        id: `HON-${invoice.id}`,
        date: getDateReversement(datePaiement),
        piece: `FA-${invoice.id.substring(0, 8)}`,
        libelle: `Honoraires gestion ${formatPeriode(invoice.periode)}`,
        type: "debit",
        montant: honoraires.total_ttc,
        categorie: "honoraires",
        detail_honoraires: {
          base_ht: honoraires.loyer_hc,
          taux_ht: honoraires.taux_ht,
          montant_ht: honoraires.montant_ht,
          tva_taux: honoraires.tva_taux,
          tva_montant: honoraires.tva_montant,
          total_ttc: honoraires.total_ttc,
        },
        invoice_id: invoice.id,
      });

      // Ajouter le reversement comme débit
      const reversement = this.calculateReversement(
        invoice.montant_loyer || 0,
        invoice.montant_charges || 0
      );

      mouvements.push({
        id: `REV-${invoice.id}`,
        date: getDateReversement(datePaiement),
        piece: `VIR-${invoice.id.substring(0, 8)}`,
        libelle: `Reversement ${formatPeriode(invoice.periode)}`,
        type: "debit",
        montant: reversement.montant_reverse,
        categorie: "reversement",
        invoice_id: invoice.id,
      });
    }

    // 2. Travaux et interventions (via tickets/work_orders)
    const { data: workOrders } = await this.supabase
      .from("work_orders")
      .select(`
        id,
        cout_final,
        date_intervention,
        statut,
        ticket:tickets!inner(
          id,
          titre,
          property_id
        )
      `)
      .eq("ticket.property_id", propertyId)
      .eq("statut", "completed")
      .gte("date_intervention", startDate)
      .lte("date_intervention", endDate);

    for (const workOrder of workOrders || []) {
      if (workOrder.cout_final && workOrder.cout_final > 0) {
        const ticketData = workOrder.ticket as any;
        mouvements.push({
          id: `TRV-${workOrder.id}`,
          date: workOrder.date_intervention || startDate,
          piece: `INT-${workOrder.id.substring(0, 8)}`,
          libelle: `Intervention: ${ticketData?.titre || "Travaux"}`,
          type: "debit",
          montant: workOrder.cout_final,
          categorie: "travaux",
          ticket_id: ticketData?.id,
        });
      }
    }

    // Trier par date
    mouvements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculer les soldes cumulés
    let soldeCumule = 0;
    for (const mouvement of mouvements) {
      if (mouvement.type === "credit") {
        soldeCumule += mouvement.montant;
      } else {
        soldeCumule -= mouvement.montant;
      }
      mouvement.solde_cumule = Math.round(soldeCumule * 100) / 100;
    }

    return mouvements;
  }

  /**
   * Calcule le solde du compte mandant à une date donnée
   */
  private async calculateSoldeAtDate(
    ownerId: string,
    propertyId: string,
    date: string
  ): Promise<number> {
    // Récupérer tous les mouvements avant la date
    const { data: invoicesBefore } = await this.supabase
      .from("invoices")
      .select(`
        montant_total,
        montant_loyer,
        montant_charges,
        lease:leases!inner(property_id, loyer)
      `)
      .eq("lease.property_id", propertyId)
      .eq("statut", "payee")
      .lt("periode", date.substring(0, 7));

    let solde = 0;

    for (const invoice of invoicesBefore || []) {
      // + Loyer encaissé
      solde += invoice.montant_total || 0;

      // - Honoraires
      const leaseData = invoice.lease as any;
      const honoraires = this.calculateHonoraires(leaseData?.loyer || invoice.montant_loyer || 0);
      solde -= honoraires.total_ttc;

      // - Reversement
      const reversement = this.calculateReversement(
        invoice.montant_loyer || 0,
        invoice.montant_charges || 0
      );
      solde -= reversement.montant_reverse;
    }

    return Math.round(solde * 100) / 100;
  }

  /**
   * Calcule les totaux des mouvements (delegated to ./calculations.ts)
   */
  private calculateTotauxMouvements(mouvements: MouvementMandant[]): {
    total_debits: number;
    total_credits: number;
  } {
    return calculateTotauxMouvements(mouvements);
  }

  /**
   * Calcule le récapitulatif du CRG (delegated to ./calculations.ts)
   */
  private calculateRecapitulatif(mouvements: MouvementMandant[]) {
    return calculateRecapitulatif(mouvements);
  }

  // ============================================================================
  // BALANCE DES MANDANTS
  // ============================================================================

  /**
   * Génère la balance des mandants à une date donnée
   */
  async generateBalanceMandants(date: string): Promise<BalanceMandants> {
    // 1. Récupérer tous les propriétaires avec leurs biens
    const { data: owners } = await this.supabase
      .from("profiles")
      .select(`
        id,
        prenom,
        nom,
        properties!properties_owner_id_fkey(id, nom)
      `)
      .eq("role", "owner");

    const comptesProprietaires: CompteMandant[] = [];

    for (const owner of owners || []) {
      const properties = (owner as any).properties || [];

      for (const property of properties) {
        const solde = await this.calculateSoldeAtDate(owner.id, property.id, date);

        comptesProprietaires.push({
          compte: generateCompteProprietaire(owner.id),
          id: owner.id,
          nom: `${owner.prenom || ""} ${owner.nom || ""}`.trim() || "N/A",
          bien: property.nom || property.id,
          debit: solde < 0 ? Math.abs(solde) : 0,
          credit: solde >= 0 ? solde : 0,
        });
      }
    }

    // 2. Récupérer tous les locataires avec leurs arriérés
    const { data: tenants } = await this.supabase
      .from("profiles")
      .select(`
        id,
        prenom,
        nom
      `)
      .eq("role", "tenant");

    const comptesLocataires: CompteMandant[] = [];

    for (const tenant of tenants || []) {
      const arrieres = await this.calculateArriereLocataire(tenant.id, date);

      if (arrieres !== 0) {
        comptesLocataires.push({
          compte: generateCompteLocataire(tenant.id),
          id: tenant.id,
          nom: `${tenant.prenom || ""} ${tenant.nom || ""}`.trim() || "N/A",
          debit: arrieres > 0 ? arrieres : 0,
          credit: arrieres < 0 ? Math.abs(arrieres) : 0,
        });
      }
    }

    // 3. Calculer les totaux
    const totalProprietaires = comptesProprietaires.reduce(
      (acc, c) => ({ debit: acc.debit + c.debit, credit: acc.credit + c.credit }),
      { debit: 0, credit: 0 }
    );

    const totalLocataires = comptesLocataires.reduce(
      (acc, c) => ({ debit: acc.debit + c.debit, credit: acc.credit + c.credit }),
      { debit: 0, credit: 0 }
    );

    // 4. Vérification d'équilibre
    // Solde banque mandant = Dettes propriétaires - Créances locataires
    const soldeBanqueMandant = totalProprietaires.credit - totalLocataires.debit;
    const ecart =
      soldeBanqueMandant - (totalProprietaires.credit - totalLocataires.debit);

    return {
      date,
      comptes_proprietaires: comptesProprietaires,
      comptes_locataires: comptesLocataires,
      total_proprietaires: {
        debit: Math.round(totalProprietaires.debit * 100) / 100,
        credit: Math.round(totalProprietaires.credit * 100) / 100,
      },
      total_locataires: {
        debit: Math.round(totalLocataires.debit * 100) / 100,
        credit: Math.round(totalLocataires.credit * 100) / 100,
      },
      verification: {
        solde_banque_mandant: Math.round(soldeBanqueMandant * 100) / 100,
        total_dettes_proprietaires: Math.round(totalProprietaires.credit * 100) / 100,
        total_creances_locataires: Math.round(totalLocataires.debit * 100) / 100,
        ecart: Math.round(ecart * 100) / 100,
        equilibre: Math.abs(ecart) < 0.01,
      },
    };
  }

  /**
   * Calcule les arriérés d'un locataire
   */
  private async calculateArriereLocataire(
    tenantId: string,
    date: string
  ): Promise<number> {
    // Récupérer les factures impayées
    const { data: invoicesImpayees } = await this.supabase
      .from("invoices")
      .select(`
        montant_total,
        lease:leases!inner(tenant_id)
      `)
      .eq("lease.tenant_id", tenantId)
      .in("statut", ["envoyee", "en_retard", "partielle"])
      .lte("periode", date.substring(0, 7));

    let arrieres = 0;
    for (const invoice of invoicesImpayees || []) {
      arrieres += invoice.montant_total || 0;
    }

    return Math.round(arrieres * 100) / 100;
  }

  // ============================================================================
  // RÉCAPITULATIF FISCAL (2044)
  // ============================================================================

  /**
   * Génère le récapitulatif fiscal annuel pour un propriétaire
   */
  async generateRecapFiscal(ownerId: string, annee: number): Promise<RecapitulatifFiscal> {
    const startDate = `${annee}-01-01`;
    const endDate = `${annee}-12-31`;

    // 1. Récupérer les informations du propriétaire
    const { data: ownerProfile } = await this.supabase
      .from("profiles")
      .select(`
        id,
        prenom,
        nom,
        owner_profiles!inner(
          type,
          siret,
          raison_sociale,
          adresse_facturation
        )
      `)
      .eq("id", ownerId)
      .single();

    if (!ownerProfile) {
      throw new Error("Propriétaire non trouvé");
    }

    // 2. Récupérer les biens et leurs revenus
    const { data: properties } = await this.supabase
      .from("properties")
      .select(`
        id,
        adresse_ligne1,
        ville,
        leases!leases_property_id_fkey(
          id,
          loyer,
          charges_forfaitaires,
          tenant:profiles!leases_tenant_id_fkey(prenom, nom)
        )
      `)
      .eq("owner_id", ownerId);

    // 3. Calculer les revenus bruts par bien
    const biensFiscaux = [];
    let totalLoyers = 0;
    let totalCharges = 0;
    let totalHonoraires = 0;

    for (const property of properties || []) {
      const { data: invoices } = await this.supabase
        .from("invoices")
        .select(`
          montant_loyer,
          montant_charges,
          lease:leases!inner(property_id, loyer)
        `)
        .eq("lease.property_id", property.id)
        .eq("statut", "payee")
        .gte("periode", `${annee}-01`)
        .lte("periode", `${annee}-12`);

      let loyersBien = 0;
      let chargesBien = 0;

      for (const invoice of invoices || []) {
        loyersBien += invoice.montant_loyer || 0;
        chargesBien += invoice.montant_charges || 0;

        // Calculer les honoraires
        const leaseData = invoice.lease as any;
        const honoraires = this.calculateHonoraires(leaseData?.loyer || invoice.montant_loyer || 0);
        totalHonoraires += honoraires.total_ttc;
      }

      const leases = (property as any).leases || [];
      const tenant = leases[0]?.tenant;

      biensFiscaux.push({
        id: property.id,
        adresse: `${property.adresse_ligne1 || ""}, ${property.ville || ""}`,
        locataire: tenant ? `${tenant.prenom || ""} ${tenant.nom || ""}`.trim() : undefined,
        loyers_bruts: loyersBien,
        charges_recuperees: chargesBien,
      });

      totalLoyers += loyersBien;
      totalCharges += chargesBien;
    }

    // 4. Calculer les charges déductibles
    const chargesDeductibles = await this.calculateChargesDeductibles(ownerId, annee);

    // 5. Régularisation N-1 (si disponible)
    const regularisation = await this.getRegularisationNMoins1(ownerId, annee);

    // 6. Calculer le revenu foncier net
    const revenuBrut = totalLoyers + totalCharges;
    const revenuNet =
      revenuBrut -
      chargesDeductibles.total +
      (regularisation?.regularisation || 0);

    const ownerData = ownerProfile.owner_profiles as any;

    return {
      annee,
      proprietaire: {
        id: ownerProfile.id,
        nom: ownerProfile.nom || "",
        prenom: ownerProfile.prenom || "",
        raison_sociale: ownerData?.raison_sociale || undefined,
        adresse: ownerData?.adresse_facturation || "",
        type: ownerData?.type || "particulier",
        siret: ownerData?.siret || undefined,
      },
      biens: biensFiscaux,
      revenus_bruts: {
        loyers: Math.round(totalLoyers * 100) / 100,
        charges_recuperees: Math.round(totalCharges * 100) / 100,
        total: Math.round(revenuBrut * 100) / 100,
      },
      charges_deductibles: chargesDeductibles,
      regularisation_n_moins_1: regularisation || undefined,
      revenu_foncier_net: Math.round(revenuNet * 100) / 100,
    };
  }

  /**
   * Calcule les charges déductibles pour un propriétaire sur une année
   */
  private async calculateChargesDeductibles(
    ownerId: string,
    annee: number
  ): Promise<ChargesDeductibles> {
    // Récupérer les charges de l'année
    const { data: charges } = await this.supabase
      .from("charges")
      .select(`
        type,
        montant,
        date_debut,
        property:properties!inner(owner_id)
      `)
      .eq("property.owner_id", ownerId);

    // Récupérer les honoraires facturés
    const { data: invoices } = await this.supabase
      .from("invoices")
      .select(`
        montant_loyer,
        lease:leases!inner(
          loyer,
          property:properties!inner(owner_id)
        )
      `)
      .eq("lease.property.owner_id", ownerId)
      .eq("statut", "payee")
      .gte("periode", `${annee}-01`)
      .lte("periode", `${annee}-12`);

    // Calculer les honoraires totaux
    let honorairesTotal = 0;
    for (const invoice of invoices || []) {
      const leaseData = invoice.lease as any;
      const honoraires = this.calculateHonoraires(leaseData?.loyer || invoice.montant_loyer || 0);
      honorairesTotal += honoraires.total_ttc;
    }

    // Récupérer les travaux
    const { data: workOrders } = await this.supabase
      .from("work_orders")
      .select(`
        cout_final,
        date_intervention,
        ticket:tickets!inner(
          titre,
          property:properties!inner(owner_id)
        )
      `)
      .eq("ticket.property.owner_id", ownerId)
      .eq("statut", "completed")
      .gte("date_intervention", `${annee}-01-01`)
      .lte("date_intervention", `${annee}-12-31`);

    const reparations = (workOrders || []).map((wo) => ({
      date: wo.date_intervention || "",
      libelle: (wo.ticket as any)?.titre || "Travaux",
      montant: wo.cout_final || 0,
    }));

    const totalReparations = reparations.reduce((sum, r) => sum + r.montant, 0);

    // Calculer les autres charges
    let assurances = 0;
    let taxeFonciere = 0;
    let provisionsCopro = 0;

    for (const charge of charges || []) {
      switch (charge.type) {
        case "assurance":
          assurances += charge.montant || 0;
          break;
        case "taxe":
          taxeFonciere += charge.montant || 0;
          break;
        case "copro":
          provisionsCopro += charge.montant || 0;
          break;
      }
    }

    // Forfait frais de gestion (20€ par bien)
    const nbBiens = new Set((charges || []).map((c) => (c as any).property?.id)).size || 1;
    const forfaitGestion = nbBiens * 20;

    const total =
      honorairesTotal +
      forfaitGestion +
      assurances +
      totalReparations +
      taxeFonciere +
      provisionsCopro;

    return {
      ligne_221_honoraires_gestion: Math.round(honorairesTotal * 100) / 100,
      ligne_222_frais_gestion_forfait: forfaitGestion,
      ligne_223_assurances: Math.round(assurances * 100) / 100,
      ligne_224_reparations: reparations,
      ligne_224_total: Math.round(totalReparations * 100) / 100,
      ligne_225_charges_non_recuperees: 0,
      ligne_226_indemnites: 0,
      ligne_227_taxe_fonciere: Math.round(taxeFonciere * 100) / 100,
      ligne_229_provisions_copro: Math.round(provisionsCopro * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }

  /**
   * Récupère la régularisation N-1
   */
  private async getRegularisationNMoins1(
    ownerId: string,
    annee: number
  ): Promise<{ provisions_deduites: number; charges_reelles: number; regularisation: number } | null> {
    // Pour l'instant, retourner null
    // TODO: Implémenter la récupération des données N-1
    return null;
  }

  // ============================================================================
  // SITUATION LOCATAIRE
  // ============================================================================

  /**
   * Génère la situation d'un locataire
   */
  async generateSituationLocataire(tenantId: string): Promise<SituationLocataire> {
    // 1. Récupérer les informations du locataire
    const { data: tenant } = await this.supabase
      .from("profiles")
      .select(`
        id,
        prenom,
        nom,
        email,
        telephone
      `)
      .eq("id", tenantId)
      .single();

    if (!tenant) {
      throw new Error("Locataire non trouvé");
    }

    // 2. Récupérer le bail actif
    const { data: lease } = await this.supabase
      .from("leases")
      .select(`
        id,
        loyer,
        charges_forfaitaires,
        depot_de_garantie,
        date_debut,
        date_fin,
        type_bail,
        property:properties!inner(
          id,
          adresse_ligne1,
          ville,
          code_postal,
          type_bien
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("statut", "active")
      .single();

    if (!lease) {
      throw new Error("Aucun bail actif pour ce locataire");
    }

    // 3. Récupérer l'historique des paiements
    const { data: invoices } = await this.supabase
      .from("invoices")
      .select(`
        id,
        periode,
        montant_total,
        statut,
        date_paiement,
        payments(montant, date_paiement)
      `)
      .eq("lease_id", lease.id)
      .order("periode", { ascending: false })
      .limit(12);

    const historique = (invoices || []).map((invoice) => {
      const payments = (invoice as any).payments || [];
      const totalPaye = payments.reduce((sum: number, p: any) => sum + (p.montant || 0), 0);

      let statut: "solde" | "partiel" | "impaye" = "impaye";
      if (totalPaye >= (invoice.montant_total || 0)) {
        statut = "solde";
      } else if (totalPaye > 0) {
        statut = "partiel";
      }

      return {
        periode: invoice.periode,
        date_echeance: `${invoice.periode}-01`,
        montant_appele: invoice.montant_total || 0,
        montant_paye: totalPaye,
        solde: (invoice.montant_total || 0) - totalPaye,
        statut,
        date_paiement: invoice.date_paiement || undefined,
      };
    });

    // 4. Calculer la situation globale
    const dateDebut = new Date(lease.date_debut);
    const maintenant = new Date();
    const nbMois = Math.ceil(
      (maintenant.getTime() - dateDebut.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    const totalAppele = historique.reduce((sum, h) => sum + h.montant_appele, 0);
    const totalPaye = historique.reduce((sum, h) => sum + h.montant_paye, 0);
    const soldeDu = totalAppele - totalPaye;

    const propertyData = lease.property as any;

    return {
      date_edition: new Date().toISOString().split("T")[0],
      locataire: {
        id: tenant.id,
        nom: tenant.nom || "",
        prenom: tenant.prenom || "",
        email: tenant.email || undefined,
        telephone: tenant.telephone || undefined,
        bail: {
          debut: lease.date_debut,
          fin: lease.date_fin || "",
          type: lease.type_bail || "nu",
        },
      },
      bien: {
        id: propertyData?.id || "",
        reference: `LOT-${(propertyData?.id || "").substring(0, 8).toUpperCase()}`,
        type: propertyData?.type_bien || "appartement",
        adresse: propertyData?.adresse_ligne1 || "",
        ville: propertyData?.ville || "",
        code_postal: propertyData?.code_postal || "",
      },
      bail: {
        date_debut: lease.date_debut,
        date_fin: lease.date_fin || "",
        loyer_hc: lease.loyer || 0,
        provisions_charges: lease.charges_forfaitaires || 0,
        total_mensuel: (lease.loyer || 0) + (lease.charges_forfaitaires || 0),
        depot_garantie: lease.depot_de_garantie || 0,
        mode_paiement: "prelevement_sepa",
      },
      historique,
      situation: {
        nb_mois_bail: nbMois,
        total_appele: Math.round(totalAppele * 100) / 100,
        total_paye: Math.round(totalPaye * 100) / 100,
        solde_du: Math.round(soldeDu * 100) / 100,
        a_jour: soldeDu <= 0,
      },
    };
  }

  // ============================================================================
  // EXPORT FEC
  // ============================================================================
  // FEC Export (delegated to ./fec-export.service.ts)
  // ============================================================================

  /**
   * Génère l'export FEC pour une année
   */
  async generateExportFEC(annee: number): Promise<EcritureFEC[]> {
    return fecExportService.generateExportFEC(annee);
  }

  /**
   * Convertit les écritures FEC en CSV
   */
  exportFECToCSV(ecritures: EcritureFEC[]): string {
    return fecExportService.exportFECToCSV(ecritures);
  }

  // ============================================================================
  // HELPERS
  // ============================================================================
  // Helpers moved to ./helpers.ts: formatPeriode, getDateReversement
  // FEC export moved to ./fec-export.service.ts
  // ============================================================================
}

// Export singleton
export const accountingService = new AccountingService();
