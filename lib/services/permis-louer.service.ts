/**
 * Service de vérification du permis de louer
 *
 * Le permis de louer est une autorisation/déclaration préalable
 * mise en place par certaines communes pour lutter contre les logements indignes.
 *
 * Types:
 * - Déclaration: Simple notification à la mairie
 * - Autorisation: Inspection du logement requise, validité 2 ans
 */

import { createClient } from "@/lib/supabase/client";
import type { PermisLouerZone, PropertyPermisCompliance } from "@/lib/types/multi-company";

export interface PermisLouerCheckResult {
  required: boolean;
  type: "declaration" | "autorisation" | null;
  zone: PermisLouerZone | null;
  message: string;
  documentsRequired?: string[];
}

export interface PermisLouerComplianceStatus {
  status: "compliant" | "pending" | "expired" | "required" | "not_required";
  message: string;
  daysUntilExpiry?: number;
  compliance?: PropertyPermisCompliance;
}

/**
 * Vérifie si un code postal nécessite un permis de louer
 */
export async function checkPermisLouerRequired(
  codePostal: string
): Promise<PermisLouerCheckResult> {
  const supabase = createClient();

  const { data: zones, error } = await supabase
    .from("permis_louer_zones")
    .select("*")
    .eq("code_postal", codePostal)
    .eq("is_active", true)
    .or(`date_fin_vigueur.is.null,date_fin_vigueur.gt.${new Date().toISOString().split("T")[0]}`);

  if (error) {
    console.error("Erreur vérification permis de louer:", error);
    return {
      required: false,
      type: null,
      zone: null,
      message: "Erreur lors de la vérification",
    };
  }

  if (!zones || zones.length === 0) {
    return {
      required: false,
      type: null,
      zone: null,
      message: "Ce code postal n'est pas soumis au permis de louer",
    };
  }

  const zone = zones[0] as PermisLouerZone;

  const documentsRequired = [
    "Diagnostic de Performance Énergétique (DPE)",
    "État des Risques et Pollutions (ERP)",
    "Diagnostic électricité (si > 15 ans)",
    "Diagnostic gaz (si > 15 ans)",
    "Projet de bail",
    "Plan du logement",
    "Justificatif de propriété",
  ];

  if (zone.type_obligation === "autorisation") {
    documentsRequired.push("Photos de chaque pièce");
    documentsRequired.push("Attestation d'assurance PNO");
  }

  return {
    required: true,
    type: zone.type_obligation as "declaration" | "autorisation",
    zone,
    message:
      zone.type_obligation === "autorisation"
        ? `Ce logement nécessite une autorisation préalable de mise en location (${zone.commune})`
        : `Ce logement nécessite une déclaration de mise en location (${zone.commune})`,
    documentsRequired,
  };
}

/**
 * Vérifie le statut de conformité d'un bien
 */
export async function checkPropertyPermisCompliance(
  propertyId: string
): Promise<PermisLouerComplianceStatus> {
  const supabase = createClient();

  // Récupérer le bien pour avoir le code postal
  const { data: property, error: propError } = await supabase
    .from("properties")
    .select("id, code_postal, adresse_complete")
    .eq("id", propertyId)
    .single();

  if (propError || !property) {
    return {
      status: "not_required",
      message: "Bien non trouvé",
    };
  }

  // Vérifier si le code postal nécessite un permis
  const requirement = await checkPermisLouerRequired(property.code_postal);

  if (!requirement.required) {
    return {
      status: "not_required",
      message: "Ce bien n'est pas situé dans une zone soumise au permis de louer",
    };
  }

  // Récupérer la conformité existante
  const { data: compliance, error: compError } = await supabase
    .from("property_permis_compliance")
    .select("*")
    .eq("property_id", propertyId)
    .single();

  if (compError || !compliance) {
    return {
      status: "required",
      message: `${requirement.message}. Aucune demande en cours.`,
    };
  }

  const now = new Date();

  switch (compliance.statut) {
    case "approuve":
      if (compliance.date_expiration) {
        const expiry = new Date(compliance.date_expiration);
        const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntil <= 0) {
          return {
            status: "expired",
            message: "Votre autorisation de mise en location a expiré",
            daysUntilExpiry: daysUntil,
            compliance: compliance as PropertyPermisCompliance,
          };
        }

        if (daysUntil <= 90) {
          return {
            status: "pending",
            message: `Votre autorisation expire dans ${daysUntil} jours. Pensez à la renouveler.`,
            daysUntilExpiry: daysUntil,
            compliance: compliance as PropertyPermisCompliance,
          };
        }

        return {
          status: "compliant",
          message: `Autorisation valide jusqu'au ${expiry.toLocaleDateString("fr-FR")}`,
          daysUntilExpiry: daysUntil,
          compliance: compliance as PropertyPermisCompliance,
        };
      }

      return {
        status: "compliant",
        message: "Déclaration effectuée",
        compliance: compliance as PropertyPermisCompliance,
      };

    case "en_cours":
      return {
        status: "pending",
        message: "Demande en cours de traitement",
        compliance: compliance as PropertyPermisCompliance,
      };

    case "refuse":
      return {
        status: "required",
        message: `Demande refusée: ${compliance.motif_refus || "Motif non précisé"}`,
        compliance: compliance as PropertyPermisCompliance,
      };

    case "expire":
    case "a_renouveler":
      return {
        status: "expired",
        message: "Votre autorisation a expiré et doit être renouvelée",
        compliance: compliance as PropertyPermisCompliance,
      };

    default:
      return {
        status: "required",
        message: requirement.message,
        compliance: compliance as PropertyPermisCompliance,
      };
  }
}

/**
 * Récupère toutes les zones de permis de louer
 */
export async function getAllPermisZones(): Promise<PermisLouerZone[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("permis_louer_zones")
    .select("*")
    .eq("is_active", true)
    .order("commune", { ascending: true });

  if (error) {
    console.error("Erreur récupération zones permis de louer:", error);
    return [];
  }

  return (data || []) as PermisLouerZone[];
}

/**
 * Recherche des zones par commune ou code postal
 */
export async function searchPermisZones(query: string): Promise<PermisLouerZone[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("permis_louer_zones")
    .select("*")
    .eq("is_active", true)
    .or(`commune.ilike.%${query}%,code_postal.ilike.%${query}%`)
    .limit(20);

  if (error) {
    console.error("Erreur recherche zones:", error);
    return [];
  }

  return (data || []) as PermisLouerZone[];
}

/**
 * Crée ou met à jour la conformité permis de louer d'un bien
 */
export async function updatePropertyPermisCompliance(
  propertyId: string,
  data: Partial<PropertyPermisCompliance>
): Promise<PropertyPermisCompliance | null> {
  const supabase = createClient();

  // Vérifier d'abord si une entrée existe
  const { data: existing } = await supabase
    .from("property_permis_compliance")
    .select("id")
    .eq("property_id", propertyId)
    .single();

  if (existing) {
    // Mise à jour
    const { data: updated, error } = await supabase
      .from("property_permis_compliance")
      .update(data)
      .eq("property_id", propertyId)
      .select()
      .single();

    if (error) {
      console.error("Erreur mise à jour conformité:", error);
      return null;
    }

    return updated as PropertyPermisCompliance;
  } else {
    // Création
    const { data: created, error } = await supabase
      .from("property_permis_compliance")
      .insert({ property_id: propertyId, ...data })
      .select()
      .single();

    if (error) {
      console.error("Erreur création conformité:", error);
      return null;
    }

    return created as PropertyPermisCompliance;
  }
}

/**
 * Génère la liste des documents manquants pour un bien
 */
export async function getMissingDocuments(propertyId: string): Promise<string[]> {
  const supabase = createClient();

  // Récupérer les documents existants
  const { data: documents } = await supabase
    .from("documents")
    .select("type")
    .eq("property_id", propertyId);

  const existingTypes = new Set((documents || []).map((d: any) => d.type));

  // Documents requis pour le permis de louer
  const requiredDocuments = [
    { type: "dpe", label: "Diagnostic de Performance Énergétique (DPE)" },
    { type: "erp", label: "État des Risques et Pollutions (ERP)" },
    { type: "diagnostic_electricite", label: "Diagnostic électricité" },
    { type: "diagnostic_gaz", label: "Diagnostic gaz" },
    { type: "bail", label: "Projet de bail" },
    { type: "plan_logement", label: "Plan du logement" },
    { type: "titre_propriete", label: "Justificatif de propriété" },
  ];

  return requiredDocuments
    .filter((doc) => !existingTypes.has(doc.type))
    .map((doc) => doc.label);
}
