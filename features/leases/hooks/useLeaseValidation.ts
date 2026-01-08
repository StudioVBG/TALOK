"use client";

import { useMemo, useCallback } from "react";
import type { BailComplet } from "@/lib/templates/bail/types";

/**
 * ✅ SOTA 2026 - Hook de validation de bail
 * 
 * Centralise toutes les règles de validation pour les baux
 * conformément à la législation française (Loi ALUR, ELAN, Climat & Résilience)
 * 
 * @returns {LeaseValidationResult} Résultat de validation avec erreurs critiques et avertissements
 */

export interface LeaseValidationResult {
  /** Erreurs critiques qui bloquent la création/envoi du bail */
  critical: ValidationError[];
  /** Avertissements qui n'empêchent pas la création mais méritent attention */
  warnings: ValidationError[];
  /** Le bail est-il valide pour envoi ? (aucune erreur critique) */
  isValid: boolean;
  /** Le bail est-il parfait ? (aucune erreur ni avertissement) */
  isPerfect: boolean;
  /** Score de complétude (0-100) */
  completionScore: number;
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  severity: "critical" | "warning" | "info";
  legalReference?: string;
}

// === CONSTANTES LÉGALES ===
const SURFACE_MINIMUM_M2 = 9; // Loi Carrez - surface minimum habitable
const BAIL_MOBILITE_DUREE_MAX_MOIS = 10;
const BAIL_SAISONNIER_DUREE_MAX_JOURS = 90;

// Classes DPE interdites à la location (évolution 2025-2034)
const DPE_INTERDIT_2025 = ["G"];
const DPE_INTERDIT_2028 = ["G", "F"];
const DPE_INTERDIT_2034 = ["G", "F", "E"];

// Dépôt de garantie maximum selon type de bail (en mois de loyer)
const DEPOT_MAX_PAR_TYPE: Record<string, number> = {
  nu: 1,
  meuble: 2,
  colocation: 2,
  saisonnier: 2,
  mobilite: 0, // Interdit
  etudiant: 1,
};

export function useLeaseValidation(bailData: Partial<BailComplet> | null) {
  
  const validate = useCallback((): LeaseValidationResult => {
    const critical: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    
    if (!bailData) {
      return {
        critical: [{ code: "NO_DATA", message: "Aucune donnée de bail", severity: "critical" }],
        warnings: [],
        isValid: false,
        isPerfect: false,
        completionScore: 0,
      };
    }

    // === VALIDATION BAILLEUR ===
    const isSociete = bailData.bailleur?.type === "societe";
    
    if (isSociete) {
      if (!bailData.bailleur?.nom && !bailData.bailleur?.raison_sociale) {
        critical.push({
          code: "BAILLEUR_RAISON_SOCIALE_MISSING",
          message: "Raison sociale de la société manquante",
          field: "bailleur.raison_sociale",
          severity: "critical",
        });
      }
      if (!bailData.bailleur?.siret) {
        warnings.push({
          code: "BAILLEUR_SIRET_MISSING",
          message: "SIRET de la société non renseigné",
          field: "bailleur.siret",
          severity: "warning",
        });
      }
      if (!bailData.bailleur?.representant_nom) {
        warnings.push({
          code: "BAILLEUR_REPRESENTANT_MISSING",
          message: "Représentant légal non identifié",
          field: "bailleur.representant_nom",
          severity: "warning",
        });
      }
    } else {
      if (!bailData.bailleur?.nom) {
        critical.push({
          code: "BAILLEUR_NOM_MISSING",
          message: "Nom du bailleur manquant",
          field: "bailleur.nom",
          severity: "critical",
        });
      }
      if (!bailData.bailleur?.prenom) {
        critical.push({
          code: "BAILLEUR_PRENOM_MISSING",
          message: "Prénom du bailleur manquant",
          field: "bailleur.prenom",
          severity: "critical",
        });
      }
    }
    
    if (!bailData.bailleur?.adresse) {
      critical.push({
        code: "BAILLEUR_ADRESSE_MISSING",
        message: "Adresse du bailleur manquante",
        field: "bailleur.adresse",
        severity: "critical",
        legalReference: "Art. 3 Loi ALUR",
      });
    }

    // === VALIDATION LOCATAIRES ===
    if (!bailData.locataires || bailData.locataires.length === 0) {
      critical.push({
        code: "LOCATAIRE_MISSING",
        message: "Aucun locataire défini",
        field: "locataires",
        severity: "critical",
      });
    } else {
      const mainTenant = bailData.locataires[0];
      const isPlaceholder = mainTenant.nom?.includes("[") || mainTenant.nom?.includes("@");
      
      if (!isPlaceholder) {
        if (!mainTenant.nom || mainTenant.nom === "[NOM LOCATAIRE]") {
          warnings.push({
            code: "LOCATAIRE_NOM_INCOMPLET",
            message: "Nom du locataire principal non renseigné",
            field: "locataires[0].nom",
            severity: "warning",
          });
        }
        if (!mainTenant.email) {
          warnings.push({
            code: "LOCATAIRE_EMAIL_MISSING",
            message: "Email du locataire non renseigné",
            field: "locataires[0].email",
            severity: "warning",
          });
        }
      }
    }

    // === VALIDATION LOGEMENT ===
    if (!bailData.logement?.adresse_complete) {
      critical.push({
        code: "LOGEMENT_ADRESSE_MISSING",
        message: "Adresse du logement manquante",
        field: "logement.adresse_complete",
        severity: "critical",
        legalReference: "Art. 3 Loi ALUR",
      });
    }
    
    const surface = bailData.logement?.surface_habitable || 0;
    if (surface <= 0) {
      critical.push({
        code: "LOGEMENT_SURFACE_MISSING",
        message: "Surface habitable non renseignée",
        field: "logement.surface_habitable",
        severity: "critical",
        legalReference: "Art. 3 Loi ALUR",
      });
    } else if (surface < SURFACE_MINIMUM_M2) {
      critical.push({
        code: "LOGEMENT_SURFACE_INSUFFISANTE",
        message: `Surface habitable insuffisante (${surface}m² < ${SURFACE_MINIMUM_M2}m² légal)`,
        field: "logement.surface_habitable",
        severity: "critical",
        legalReference: "Art. 4 Décret n°2002-120",
      });
    }
    
    if (!bailData.logement?.nb_pieces_principales || bailData.logement.nb_pieces_principales < 1) {
      warnings.push({
        code: "LOGEMENT_PIECES_MISSING",
        message: "Nombre de pièces principales non renseigné",
        field: "logement.nb_pieces_principales",
        severity: "warning",
      });
    }

    // === VALIDATION CONDITIONS FINANCIÈRES ===
    const typeBail = bailData.conditions?.type_bail || "nu";
    const loyerHC = bailData.conditions?.loyer_hc || 0;
    const depot = bailData.conditions?.depot_garantie || 0;
    
    if (loyerHC <= 0) {
      critical.push({
        code: "LOYER_MISSING",
        message: "Montant du loyer non renseigné",
        field: "conditions.loyer_hc",
        severity: "critical",
      });
    }
    
    if (bailData.conditions?.charges_montant === undefined) {
      warnings.push({
        code: "CHARGES_MISSING",
        message: "Montant des charges non renseigné (sera à 0€)",
        field: "conditions.charges_montant",
        severity: "warning",
      });
    }
    
    // Vérification dépôt de garantie légal
    const maxDepotMois = DEPOT_MAX_PAR_TYPE[typeBail] ?? 1;
    const maxDepotLegal = loyerHC * maxDepotMois;
    
    if (typeBail === "mobilite" && depot > 0) {
      critical.push({
        code: "DEPOT_MOBILITE_INTERDIT",
        message: "Bail mobilité : dépôt de garantie interdit",
        field: "conditions.depot_garantie",
        severity: "critical",
        legalReference: "Art. 25-13 Loi ELAN",
      });
    } else if (depot > maxDepotLegal && maxDepotLegal > 0) {
      critical.push({
        code: "DEPOT_EXCESSIF",
        message: `Dépôt de garantie (${depot}€) supérieur au maximum légal (${maxDepotLegal}€ = ${maxDepotMois} mois)`,
        field: "conditions.depot_garantie",
        severity: "critical",
        legalReference: "Art. 22 Loi n°89-462",
      });
    }

    // === VALIDATION DATES ===
    if (!bailData.conditions?.date_debut) {
      critical.push({
        code: "DATE_DEBUT_MISSING",
        message: "Date de début du bail non renseignée",
        field: "conditions.date_debut",
        severity: "critical",
      });
    } else {
      const dateDebut = new Date(bailData.conditions.date_debut);
      const aujourdhui = new Date();
      aujourdhui.setHours(0, 0, 0, 0);
      
      // Avertissement si date très ancienne
      if (typeBail !== "saisonnier") {
        const debutMoins6Mois = new Date(aujourdhui);
        debutMoins6Mois.setMonth(debutMoins6Mois.getMonth() - 6);
        if (dateDebut < debutMoins6Mois) {
          warnings.push({
            code: "DATE_DEBUT_ANCIENNE",
            message: "Date de début très ancienne (> 6 mois)",
            field: "conditions.date_debut",
            severity: "warning",
          });
        }
      }
    }
    
    // Durée pour baux à durée déterminée
    if (typeBail === "saisonnier" || typeBail === "mobilite") {
      if (!bailData.conditions?.date_fin) {
        critical.push({
          code: "DATE_FIN_OBLIGATOIRE",
          message: `Date de fin obligatoire pour un bail ${typeBail === "saisonnier" ? "saisonnier" : "mobilité"}`,
          field: "conditions.date_fin",
          severity: "critical",
        });
      } else if (bailData.conditions.date_debut) {
        const debut = new Date(bailData.conditions.date_debut);
        const fin = new Date(bailData.conditions.date_fin);
        const diffMs = fin.getTime() - debut.getTime();
        const diffJours = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const diffMois = Math.ceil(diffJours / 30);
        
        if (typeBail === "mobilite" && diffMois > BAIL_MOBILITE_DUREE_MAX_MOIS) {
          critical.push({
            code: "MOBILITE_DUREE_EXCESSIVE",
            message: `Bail mobilité : durée max ${BAIL_MOBILITE_DUREE_MAX_MOIS} mois (actuellement ${diffMois} mois)`,
            field: "conditions.duree_mois",
            severity: "critical",
            legalReference: "Art. 25-12 Loi ELAN",
          });
        }
        if (typeBail === "saisonnier" && diffJours > BAIL_SAISONNIER_DUREE_MAX_JOURS) {
          warnings.push({
            code: "SAISONNIER_DUREE_ELEVEE",
            message: `Location saisonnière > ${BAIL_SAISONNIER_DUREE_MAX_JOURS} jours : risque de requalification en bail meublé`,
            field: "conditions.duree_mois",
            severity: "warning",
          });
        }
      }
    }

    // === VALIDATION DPE (OBLIGATOIRE) ===
    const classeEnergie = bailData.diagnostics?.dpe?.classe_energie;
    
    if (!classeEnergie) {
      critical.push({
        code: "DPE_MISSING",
        message: "DPE non renseigné (obligatoire depuis 2011, renforcé 2023)",
        field: "diagnostics.dpe.classe_energie",
        severity: "critical",
        legalReference: "Art. 3-3 Loi Climat & Résilience",
      });
    } else {
      // Vérifier les interdictions de location selon l'année
      const anneeActuelle = new Date().getFullYear();
      
      if (anneeActuelle >= 2025 && DPE_INTERDIT_2025.includes(classeEnergie)) {
        critical.push({
          code: "DPE_G_INTERDIT",
          message: `⛔ Logement classé ${classeEnergie} : location interdite depuis 2025`,
          field: "diagnostics.dpe.classe_energie",
          severity: "critical",
          legalReference: "Loi Climat & Résilience",
        });
      } else if (anneeActuelle >= 2028 && DPE_INTERDIT_2028.includes(classeEnergie)) {
        critical.push({
          code: "DPE_F_INTERDIT",
          message: `⛔ Logement classé ${classeEnergie} : location interdite depuis 2028`,
          field: "diagnostics.dpe.classe_energie",
          severity: "critical",
          legalReference: "Loi Climat & Résilience",
        });
      } else if (classeEnergie === "F") {
        warnings.push({
          code: "DPE_F_FUTUR",
          message: "⚠️ Logement classé F : location interdite à partir de 2028",
          field: "diagnostics.dpe.classe_energie",
          severity: "warning",
          legalReference: "Loi Climat & Résilience",
        });
      } else if (classeEnergie === "E") {
        warnings.push({
          code: "DPE_E_FUTUR",
          message: "ℹ️ Logement classé E : location interdite à partir de 2034",
          field: "diagnostics.dpe.classe_energie",
          severity: "warning",
          legalReference: "Loi Climat & Résilience",
        });
      }
    }

    // === CALCUL SCORE DE COMPLÉTUDE ===
    const totalFields = 15;
    let completedFields = 0;
    
    if (bailData.bailleur?.nom || bailData.bailleur?.raison_sociale) completedFields++;
    if (bailData.bailleur?.adresse) completedFields++;
    if (bailData.bailleur?.email) completedFields++;
    if (bailData.locataires && bailData.locataires.length > 0) completedFields++;
    if (bailData.locataires?.[0]?.nom) completedFields++;
    if (bailData.logement?.adresse_complete) completedFields++;
    if (surface > 0) completedFields++;
    if (bailData.logement?.nb_pieces_principales) completedFields++;
    if (loyerHC > 0) completedFields++;
    if (bailData.conditions?.charges_montant !== undefined) completedFields++;
    if (bailData.conditions?.depot_garantie !== undefined) completedFields++;
    if (bailData.conditions?.date_debut) completedFields++;
    if (classeEnergie) completedFields++;
    if (bailData.diagnostics?.dpe?.date_realisation) completedFields++;
    if (bailData.diagnostics?.dpe?.consommation_energie) completedFields++;
    
    const completionScore = Math.round((completedFields / totalFields) * 100);

    return {
      critical,
      warnings,
      isValid: critical.length === 0,
      isPerfect: critical.length === 0 && warnings.length === 0,
      completionScore,
    };
  }, [bailData]);

  const result = useMemo(() => validate(), [validate]);

  return {
    ...result,
    /** Revalider les données */
    revalidate: validate,
  };
}

export default useLeaseValidation;

