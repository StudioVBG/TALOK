/**
 * Service de régularisation des charges locatives
 *
 * Calcule et génère la régularisation annuelle des charges
 * conformément à la loi ALUR et décret 87-713
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { CHARGES_RECUPERABLES } from "../constants/plan-comptable";
import { createAutoEntry } from "@/lib/accounting/engine";
import { getOrCreateCurrentExercise } from "@/lib/accounting/auto-exercise";
import {
  getEntityAccountingConfig,
  markEntryInformational,
  shouldMarkInformational,
} from "@/lib/accounting/entity-config";
import { resolveSystemActorForEntity } from "@/lib/accounting/system-actor";

export interface ChargeProvision {
  periode: string;
  montant: number;
}

export interface ChargeReelle {
  type: string;
  libelle: string;
  montant_total: number;
  quote_part: number;
  prorata?: number;
}

export interface RegularisationResult {
  lease_id: string;
  tenant_id: string;
  annee: number;
  periode_regularisation: {
    debut: string;
    fin: string;
  };
  provisions_percues: number;
  charges_reelles: ChargeReelle[];
  total_charges_reelles: number;
  solde: number; // Positif = trop perçu (à rembourser), Négatif = complément à facturer
  type_regularisation: "credit" | "debit";
  detail_provisions: ChargeProvision[];
  prorata_occupation: {
    jours_occupation: number;
    jours_annee: number;
    ratio: number;
  };
  date_calcul: string;
}

export interface CreateRegularisationInput {
  leaseId: string;
  annee: number;
  chargesReelles: ChargeReelle[];
}

export class ChargeRegularizationService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Calcule la régularisation des charges pour un bail
   */
  async calculateRegularisation(
    leaseId: string,
    annee: number
  ): Promise<RegularisationResult | null> {
    // 1. Récupérer les informations du bail
    const { data: lease } = await this.supabase
      .from("leases")
      .select(`
        id,
        tenant_id,
        date_debut,
        date_fin,
        charges_forfaitaires,
        type_charges,
        property:properties!inner(
          id,
          charges:charges(
            id,
            type,
            libelle,
            montant,
            date_debut,
            quote_part
          )
        )
      `)
      .eq("id", leaseId)
      .single();

    if (!lease) {
      throw new Error("Bail non trouvé");
    }

    // 2. Calculer le prorata d'occupation
    const prorata = this.calculateProrata(
      lease.date_debut,
      lease.date_fin || `${annee}-12-31`,
      annee
    );

    if (prorata.jours_occupation <= 0) {
      throw new Error("Le locataire n'a pas occupé le logement sur cette période");
    }

    // 3. Récupérer les provisions versées
    const { data: invoices } = await this.supabase
      .from("invoices")
      .select("periode, montant_charges")
      .eq("lease_id", leaseId)
      .eq("statut", "payee")
      .gte("periode", `${annee}-01`)
      .lte("periode", `${annee}-12`);

    const detailProvisions: ChargeProvision[] = (invoices || []).map((inv) => ({
      periode: inv.periode,
      montant: inv.montant_charges || 0,
    }));

    const provisionsPercues = detailProvisions.reduce(
      (sum, p) => sum + p.montant,
      0
    );

    // 4. Récupérer les charges réelles du bien
    const propertyData = lease.property as any;
    const charges = propertyData?.charges || [];

    // 5. Calculer la quote-part des charges réelles
    const chargesReelles: ChargeReelle[] = charges.map((charge: any) => {
      // Appliquer le prorata si la charge est annuelle
      const montantProrata = (charge.montant || 0) * prorata.ratio;
      const quotePart = charge.quote_part || 100;
      const montantQuotePart = montantProrata * (quotePart / 100);

      return {
        type: charge.type,
        libelle: charge.libelle || this.getChargeLibelle(charge.type),
        montant_total: charge.montant || 0,
        quote_part: quotePart,
        prorata: prorata.ratio,
        montant_du: Math.round(montantQuotePart * 100) / 100,
      };
    });

    const totalChargesReelles = chargesReelles.reduce(
      (sum, c: any) => sum + (c.montant_du || 0),
      0
    );

    // 6. Calculer le solde
    const solde = provisionsPercues - totalChargesReelles;

    return {
      lease_id: leaseId,
      tenant_id: lease.tenant_id,
      annee,
      periode_regularisation: {
        debut: `${annee}-01-01`,
        fin: `${annee}-12-31`,
      },
      provisions_percues: Math.round(provisionsPercues * 100) / 100,
      charges_reelles: chargesReelles,
      total_charges_reelles: Math.round(totalChargesReelles * 100) / 100,
      solde: Math.round(solde * 100) / 100,
      type_regularisation: solde >= 0 ? "credit" : "debit",
      detail_provisions: detailProvisions,
      prorata_occupation: prorata,
      date_calcul: new Date().toISOString(),
    };
  }

  /**
   * Crée et enregistre une régularisation
   */
  async createRegularisation(
    input: CreateRegularisationInput
  ): Promise<{ id: string; result: RegularisationResult }> {
    // Calculer la régularisation
    const result = await this.calculateRegularisation(input.leaseId, input.annee);

    if (!result) {
      throw new Error("Impossible de calculer la régularisation");
    }

    // Si des charges réelles sont fournies, les utiliser
    if (input.chargesReelles && input.chargesReelles.length > 0) {
      result.charges_reelles = input.chargesReelles;
      result.total_charges_reelles = input.chargesReelles.reduce(
        (sum, c) => sum + c.quote_part,
        0
      );
      result.solde = result.provisions_percues - result.total_charges_reelles;
      result.type_regularisation = result.solde >= 0 ? "credit" : "debit";
    }

    // Enregistrer la régularisation
    const { data, error } = await this.supabase
      .from("charge_regularisations")
      .insert({
        lease_id: result.lease_id,
        tenant_id: result.tenant_id,
        year: result.annee,
        period_start: result.periode_regularisation.debut,
        period_end: result.periode_regularisation.fin,
        provisions_received: result.provisions_percues,
        actual_charges: result.total_charges_reelles,
        balance: result.solde,
        status: "draft",
        details: {
          charges_reelles: result.charges_reelles,
          detail_provisions: result.detail_provisions,
          prorata: result.prorata_occupation,
        },
      })
      .select("id")
      .single();

    if (error) {
      console.error("[ChargeRegularization] Erreur création:", error);
      throw new Error("Erreur lors de l'enregistrement de la régularisation");
    }

    return {
      id: data.id,
      result,
    };
  }

  /**
   * Valide et applique une régularisation (crée la facture ou l'avoir)
   */
  async applyRegularisation(regularisationId: string): Promise<{
    success: boolean;
    invoice_id?: string;
    credit_note_id?: string;
  }> {
    // Récupérer la régularisation
    const { data: regul } = await this.supabase
      .from("charge_regularisations")
      .select("*")
      .eq("id", regularisationId)
      .single();

    if (!regul) {
      throw new Error("Régularisation non trouvée");
    }

    if (regul.status === "applied") {
      throw new Error("Cette régularisation a déjà été appliquée");
    }

    // Récupérer le bail pour les infos propriétaire + l'entité comptable.
    // legal_entity_id sur la property est requis pour pouvoir créer une
    // écriture comptable ; adresse_complete sert juste au libellé.
    const { data: lease } = await this.supabase
      .from("leases")
      .select(`
        id,
        tenant_id,
        property:properties!inner(id, owner_id, legal_entity_id, adresse_complete)
      `)
      .eq("id", regul.lease_id)
      .single();

    if (!lease) {
      throw new Error("Bail non trouvé");
    }

    const propertyData = lease.property as any;
    const propertyId = propertyData?.id as string | undefined;
    const propertyAddress = propertyData?.adresse_complete as string | undefined;
    const legalEntityId = propertyData?.legal_entity_id as string | null;

    if (regul.balance < 0) {
      // Le locataire doit un complément → Créer une facture de régularisation
      const { data: invoice, error } = await this.supabase
        .from("invoices")
        .insert({
          lease_id: regul.lease_id,
          owner_id: propertyData.owner_id,
          tenant_id: regul.tenant_id,
          periode: `${regul.year}-REG`,
          montant_loyer: 0,
          montant_charges: Math.abs(regul.balance),
          montant_total: Math.abs(regul.balance),
          statut: "sent",
          metadata: {
            type: "regularisation_charges",
            regularisation_id: regularisationId,
            year: regul.year,
          },
        })
        .select("id")
        .single();

      if (error) {
        throw new Error("Erreur création facture régularisation");
      }

      // Mettre à jour le statut de la régularisation
      await this.supabase
        .from("charge_regularisations")
        .update({
          status: "applied",
          applied_at: new Date().toISOString(),
          invoice_id: invoice.id,
        })
        .eq("id", regularisationId);

      // Écriture comptable de régul (non-bloquant). Idempotent via la
      // référence regul:<id>. Le builder gère le diff provisions/réelles
      // et balance automatiquement la ligne 411 (complément ou avoir).
      await this.bookRegularisationEntry({
        regularisationId,
        legalEntityId,
        regul,
        lease,
        propertyId,
        propertyAddress,
      });

      return {
        success: true,
        invoice_id: invoice.id,
      };
    } else if (regul.balance > 0) {
      // Trop perçu → Créer un avoir ou déduire du prochain loyer
      // Pour l'instant, on enregistre le crédit sur le compte locataire
      const { data: creditNote, error } = await this.supabase
        .from("invoices")
        .insert({
          lease_id: regul.lease_id,
          owner_id: propertyData.owner_id,
          tenant_id: regul.tenant_id,
          periode: `${regul.year}-AVR`,
          montant_loyer: 0,
          montant_charges: -regul.balance, // Montant négatif = avoir
          montant_total: -regul.balance,
          statut: "paid", // Automatiquement considéré comme réglé
          metadata: {
            type: "avoir_regularisation",
            regularisation_id: regularisationId,
            year: regul.year,
          },
        })
        .select("id")
        .single();

      if (error) {
        throw new Error("Erreur création avoir régularisation");
      }

      // Mettre à jour le statut
      await this.supabase
        .from("charge_regularisations")
        .update({
          status: "applied",
          applied_at: new Date().toISOString(),
          credit_note_id: creditNote.id,
        })
        .eq("id", regularisationId);

      // Écriture comptable de régul (cas trop-perçu).
      await this.bookRegularisationEntry({
        regularisationId,
        legalEntityId,
        regul,
        lease,
        propertyId,
        propertyAddress,
      });

      return {
        success: true,
        credit_note_id: creditNote.id,
      };
    }

    // Solde = 0, rien à faire côté facturation. On pose quand même
    // l'écriture comptable si provisions_received > 0 — elle solde
    // proprement le 419100 vers 708000 sans ligne 411 (diff = 0).
    await this.supabase
      .from("charge_regularisations")
      .update({
        status: "applied",
        applied_at: new Date().toISOString(),
      })
      .eq("id", regularisationId);

    await this.bookRegularisationEntry({
      regularisationId,
      legalEntityId,
      regul,
      lease,
      propertyId,
      propertyAddress,
    });

    return { success: true };
  }

  /**
   * Pose l'écriture comptable de régul charges via l'engine.
   * Non-bloquant : toute erreur est loggée mais ne fait pas échouer
   * l'application de la régul (qui a déjà créé son invoice/avoir et
   * marqué le statut).
   *
   * Idempotence : skip silencieux si une écriture existe déjà avec
   * reference="regul:<id>" et source="auto:charge_regularization".
   *
   * Skip explicite (avec log) si :
   *   - la property n'a pas de legal_entity_id (compta non rattachable)
   *   - la config compta de l'entité est désactivée
   *   - aucun exercice ouvert pour l'entité
   *   - les montants sont nuls des 2 côtés
   */
  private async bookRegularisationEntry(args: {
    regularisationId: string;
    legalEntityId: string | null;
    regul: any;
    lease: any;
    propertyId: string | undefined;
    propertyAddress: string | undefined;
  }): Promise<void> {
    const {
      regularisationId,
      legalEntityId,
      regul,
      lease,
      propertyId,
      propertyAddress,
    } = args;

    try {
      if (!legalEntityId) {
        console.warn(
          "[charge-regul.bookEntry] property.legal_entity_id null → skip auto-entry",
          { regularisationId },
        );
        return;
      }

      // Idempotence : un appel répété d'applyRegularisation ne doit pas
      // dupliquer l'écriture. La ref est dérivée de l'id de la régul.
      const reference = `regul:${regularisationId}`;
      const { data: existing } = await this.supabase
        .from("accounting_entries")
        .select("id")
        .eq("reference", reference)
        .eq("source", "auto:charge_regularization")
        .limit(1)
        .maybeSingle();

      if (existing && (existing as { id: string }).id) {
        return;
      }

      const config = await getEntityAccountingConfig(
        this.supabase,
        legalEntityId,
      );
      if (!config || !config.accountingEnabled) {
        return;
      }

      const exercise = await getOrCreateCurrentExercise(
        this.supabase,
        legalEntityId,
      );
      if (!exercise) {
        console.warn(
          "[charge-regul.bookEntry] no current exercise → skip",
          { legalEntityId },
        );
        return;
      }

      const provisionsCents = Math.round(
        Number(regul.provisions_received ?? regul.provisions_versees ?? 0) *
          100,
      );
      const actualCents = Math.round(
        Number(regul.actual_charges ?? regul.charges_reelles ?? 0) * 100,
      );

      if (provisionsCents <= 0 && actualCents <= 0) {
        return;
      }

      const actorUserId = await resolveSystemActorForEntity(
        this.supabase,
        legalEntityId,
      );
      if (!actorUserId) {
        console.warn("[charge-regul.bookEntry] no system actor", {
          legalEntityId,
        });
        return;
      }

      const tenantId = (regul.tenant_id ?? lease?.tenant_id) as
        | string
        | undefined;
      const leaseId = (lease?.id ?? regul.lease_id) as string | undefined;
      const periodLabel =
        regul.year != null ? `${regul.year}` : (regul.annee ?? "");
      const addrSuffix = propertyAddress ? ` - ${propertyAddress}` : "";
      const label = `Régularisation charges ${periodLabel}${addrSuffix}`.trim();

      const entry = await createAutoEntry(
        this.supabase,
        "charge_regularization",
        {
          entityId: legalEntityId,
          exerciseId: exercise.id,
          userId: actorUserId,
          // Le builder lit amountCents = provisions et
          // secondaryAmountCents = actual ; il calcule le diff et ajoute
          // la ligne 411 (complément ou avoir) automatiquement.
          amountCents: provisionsCents,
          secondaryAmountCents: actualCents,
          label,
          date: new Date().toISOString().split("T")[0],
          reference,
          propertyId,
          leaseId,
          thirdPartyType: tenantId ? "tenant" : undefined,
          thirdPartyId: tenantId,
        },
      );

      if (shouldMarkInformational(config)) {
        await markEntryInformational(this.supabase, entry.id);
      }
    } catch (err) {
      console.error("[charge-regul.bookEntry] failed (non-blocking):", err);
    }
  }

  /**
   * Récupère l'historique des régularisations pour un bail
   */
  async getRegularisationHistory(leaseId: string) {
    const { data, error } = await this.supabase
      .from("charge_regularisations")
      .select("*")
      .eq("lease_id", leaseId)
      .order("year", { ascending: false });

    if (error) {
      console.error("[ChargeRegularization] Erreur récupération:", error);
      return [];
    }

    return data || [];
  }

  /**
   * Récupère une régularisation par son ID
   */
  async getRegularisationById(regularisationId: string) {
    const { data, error } = await this.supabase
      .from("charge_regularisations")
      .select(`
        *,
        lease:leases!inner(
          id,
          date_debut,
          date_fin,
          loyer,
          charges_forfaitaires,
          tenant_id,
          property:properties!inner(
            id,
            nom,
            adresse_complete,
            ville,
            code_postal,
            owner_id
          )
        )
      `)
      .eq("id", regularisationId)
      .single();

    if (error) {
      console.error("[ChargeRegularization] Erreur récupération:", error);
      return null;
    }

    return data;
  }

  /**
   * Annule une régularisation (seulement si en brouillon)
   */
  async cancelRegularisation(regularisationId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    // Récupérer la régularisation
    const { data: regul } = await this.supabase
      .from("charge_regularisations")
      .select("id, status, year, lease_id")
      .eq("id", regularisationId)
      .single();

    if (!regul) {
      throw new Error("Régularisation non trouvée");
    }

    if (regul.status === "applied") {
      throw new Error("Impossible d'annuler une régularisation déjà appliquée");
    }

    if (regul.status === "cancelled") {
      throw new Error("Cette régularisation est déjà annulée");
    }

    // Mettre à jour le statut
    const { error } = await this.supabase
      .from("charge_regularisations")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", regularisationId);

    if (error) {
      console.error("[ChargeRegularization] Erreur annulation:", error);
      throw new Error("Erreur lors de l'annulation de la régularisation");
    }

    return {
      success: true,
      message: `Régularisation ${regul.year} annulée`,
    };
  }

  /**
   * Met à jour une régularisation en brouillon
   */
  async updateRegularisation(
    regularisationId: string,
    updates: {
      charges_reelles?: any[];
      notes?: string;
      nouvelle_provision?: number;
      date_effet_nouvelle_provision?: string;
    }
  ): Promise<{ success: boolean }> {
    const { data: regul } = await this.supabase
      .from("charge_regularisations")
      .select("id, status")
      .eq("id", regularisationId)
      .single();

    if (!regul) {
      throw new Error("Régularisation non trouvée");
    }

    if (regul.status !== "draft") {
      throw new Error("Seules les régularisations en brouillon peuvent être modifiées");
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.charges_reelles) {
      const totalCharges = updates.charges_reelles.reduce(
        (sum, c) => sum + (c.montant_du || c.quote_part || 0),
        0
      );
      updateData.details = { charges_reelles: updates.charges_reelles };
      updateData.actual_charges = totalCharges;
      updateData.charges_reelles = totalCharges;
    }

    if (updates.notes !== undefined) {
      updateData.notes = updates.notes;
    }

    if (updates.nouvelle_provision !== undefined) {
      updateData.nouvelle_provision = updates.nouvelle_provision;
    }

    if (updates.date_effet_nouvelle_provision !== undefined) {
      updateData.date_effet_nouvelle_provision = updates.date_effet_nouvelle_provision;
    }

    const { error } = await this.supabase
      .from("charge_regularisations")
      .update(updateData)
      .eq("id", regularisationId);

    if (error) {
      console.error("[ChargeRegularization] Erreur mise à jour:", error);
      throw new Error("Erreur lors de la mise à jour");
    }

    return { success: true };
  }

  /**
   * Calcule le prorata d'occupation
   */
  private calculateProrata(
    dateDebut: string,
    dateFin: string,
    annee: number
  ): { jours_occupation: number; jours_annee: number; ratio: number } {
    const debut = new Date(
      Math.max(
        new Date(dateDebut).getTime(),
        new Date(`${annee}-01-01`).getTime()
      )
    );
    const fin = new Date(
      Math.min(
        new Date(dateFin).getTime(),
        new Date(`${annee}-12-31`).getTime()
      )
    );

    const joursOccupation =
      Math.ceil((fin.getTime() - debut.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const joursAnnee = annee % 4 === 0 ? 366 : 365;

    return {
      jours_occupation: Math.max(0, joursOccupation),
      jours_annee: joursAnnee,
      ratio: Math.round((joursOccupation / joursAnnee) * 10000) / 10000,
    };
  }

  /**
   * Retourne le libellé d'un type de charge
   */
  private getChargeLibelle(type: string): string {
    const libelles: Record<string, string> = {
      eau: "Eau froide et chaude",
      chauffage: "Chauffage collectif",
      electricite: "Électricité des parties communes",
      ascenseur: "Ascenseur - Maintenance et électricité",
      entretien: "Entretien parties communes",
      gardiennage: "Gardiennage (40%)",
      ordures: "Taxe ordures ménagères",
      assurance: "Assurance immeuble",
      autres: "Autres charges récupérables",
    };

    return libelles[type] || type;
  }

  /**
   * Génère le document de régularisation (pour PDF)
   */
  async generateRegularisationDocument(
    regularisationId: string
  ): Promise<any> {
    const { data: regul } = await this.supabase
      .from("charge_regularisations")
      .select(`
        *,
        lease:leases!inner(
          id,
          date_debut,
          tenant:profiles!leases_tenant_id_fkey(prenom, nom),
          property:properties!inner(
            adresse_complete,
            ville,
            code_postal,
            owner:profiles!properties_owner_id_fkey(prenom, nom)
          )
        )
      `)
      .eq("id", regularisationId)
      .single();

    if (!regul) {
      throw new Error("Régularisation non trouvée");
    }

    const leaseData = regul.lease as any;
    const tenant = leaseData?.tenant;
    const property = leaseData?.property;
    const owner = property?.owner;

    return {
      numero: `REG-${regul.year}-${regul.id.substring(0, 8).toUpperCase()}`,
      date_emission: new Date().toISOString().split("T")[0],
      annee: regul.year,
      periode: {
        debut: regul.period_start,
        fin: regul.period_end,
      },
      proprietaire: {
        nom: `${owner?.prenom || ""} ${owner?.nom || ""}`.trim(),
      },
      locataire: {
        nom: `${tenant?.prenom || ""} ${tenant?.nom || ""}`.trim(),
      },
      bien: {
        adresse: property?.adresse_complete || "",
        ville: property?.ville || "",
        code_postal: property?.code_postal || "",
      },
      provisions_versees: regul.provisions_received,
      charges_reelles: regul.details?.charges_reelles || [],
      total_charges: regul.actual_charges,
      solde: regul.balance,
      type: regul.balance >= 0 ? "credit" : "debit",
      mention_legale:
        "Ce décompte est établi conformément à l'article 23 de la loi n°89-462 du 6 juillet 1989 et au décret n°87-713 du 26 août 1987.",
    };
  }
}
