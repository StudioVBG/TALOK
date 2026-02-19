import { numberToWords } from "@/lib/helpers/format";
import type { BailComplet } from "@/lib/templates/bail/types";
import type { LeaseDetails } from "@/app/owner/_data/fetchLeaseDetails";
import { getMaxDepotLegal } from "@/lib/validations/lease-financial";
import { isTenantRole, isOwnerRole, isGuarantorRole, SIGNER_ROLES } from "@/lib/constants/roles";
import type { OwnerIdentity } from "@/lib/entities/resolveOwnerIdentity";

interface OwnerProfile {
  id: string;
  prenom: string;
  nom: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  type?: string;
  // Champs société
  raison_sociale?: string;
  forme_juridique?: string;
  siret?: string;
  representant_nom?: string;
  representant_qualite?: string;
}

/**
 * Adaptateur : convertit un OwnerIdentity en OwnerProfile legacy pour compatibilité.
 */
export function ownerIdentityToProfile(identity: OwnerIdentity): OwnerProfile {
  const isCompany = identity.entityType === "company";
  return {
    id: identity.entityId || "",
    prenom: identity.firstName,
    nom: identity.lastName,
    email: identity.email,
    telephone: identity.phone || undefined,
    adresse: identity.address.street
      ? `${identity.address.street}, ${identity.address.postalCode} ${identity.address.city}`.trim()
      : undefined,
    type: isCompany ? "societe" : "particulier",
    raison_sociale: identity.companyName || undefined,
    forme_juridique: identity.legalForm || undefined,
    siret: identity.siret || undefined,
    representant_nom: identity.representative
      ? `${identity.representative.firstName} ${identity.representative.lastName}`.trim()
      : undefined,
    representant_qualite: identity.representative?.role || undefined,
  };
}

export function mapLeaseToTemplate(
  details: LeaseDetails,
  ownerProfile?: OwnerProfile | OwnerIdentity
): Partial<BailComplet> {
  // ✅ SOTA 2026: Auto-adapt OwnerIdentity to legacy OwnerProfile
  const resolvedProfile: OwnerProfile | undefined = ownerProfile
    ? "displayName" in ownerProfile
      ? ownerIdentityToProfile(ownerProfile as OwnerIdentity)
      : (ownerProfile as OwnerProfile)
    : undefined;
  const { lease, property, signers } = details;

  // Trier les signataires pour mettre ceux qui ont signé en premier (le plus "réel")
  const sortedSigners = (signers || []).sort((a: any, b: any) => {
    if (a.signature_status === 'signed' && b.signature_status !== 'signed') return -1;
    if (a.signature_status !== 'signed' && b.signature_status === 'signed') return 1;
    // Priorité à ceux qui ont un profil lié
    if (a.profile_id && !b.profile_id) return -1;
    if (!a.profile_id && b.profile_id) return 1;
    return 0;
  });

  // ✅ SSOT 2026: Utilisation des helpers de rôles standardisés
  const mainTenant = sortedSigners.find((s: any) => isTenantRole(s.role));
  const ownerSigner = sortedSigners.find((s: any) => isOwnerRole(s.role));
  const guarantor = sortedSigners.find((s: any) => isGuarantorRole(s.role));

  // S'assurer que surface > 0, sinon undefined pour afficher les pointillés
  // On utilise any car property peut ne pas avoir toutes les propriétés typées dans LeaseDetails
  const propAny = property as any;
  const surface = propAny.surface_habitable_m2 || propAny.surface;
  const surfaceValid = surface && surface > 0 ? surface : undefined;

  // ✅ SSOT 2026: LIRE depuis le BAIL en priorité (données saisies par l'utilisateur)
  const loyer = lease.loyer ?? propAny?.loyer_hc ?? propAny?.loyer_base ?? 0;
  const charges = lease.charges_forfaitaires ?? propAny?.charges_mensuelles ?? 0;
  
  // ✅ CALCUL AUTOMATIQUE: Toujours calculer le dépôt basé sur le loyer
  // Cela garantit la cohérence même pour les baux existants avec des données incorrectes
  const maxDepotLegal = getMaxDepotLegal(lease.type_bail, loyer);
  const depotSaisi = (lease as any).depot_de_garantie;
  
  // Si le dépôt saisi dépasse le max légal, utiliser le max légal
  const depotGarantie = (depotSaisi && depotSaisi > 0 && depotSaisi <= maxDepotLegal)
    ? depotSaisi 
    : maxDepotLegal;

  // Calcul de la durée par défaut selon le type de bail
  // ✅ FIX: Prend en compte le type de bailleur (société = 6 ans pour bail nu)
  const getDureeMois = (type: string, bailleurType?: string): number => {
    switch (type) {
      case "meuble":
        return 12;
      case "nu":
        // 6 ans (72 mois) si bailleur personne morale, 3 ans sinon
        return bailleurType === "societe" ? 72 : 36;
      case "mobilite":
        return 10; // Max légal, souvent ajusté selon dates
      case "saisonnier":
        // Calculer la différence en mois si dates dispos
        if (lease.date_debut && lease.date_fin) {
            const start = new Date(lease.date_debut);
            const end = new Date(lease.date_fin);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            return Math.ceil(diffDays / 30);
        }
        return 1;
      default:
        return bailleurType === "societe" ? 72 : 36;
    }
  };

  // Déterminer le jour de paiement (par défaut 5)
  const jourPaiement = (lease as any).jour_paiement || 5;
  
  // ✅ FIX: Terme à échoir si jour ≤ 10 (paiement en début de période)
  const paiementAvance = jourPaiement <= 10;

  // ✅ FIX: Calculer la durée et la date de fin COHÉRENTES
  const dureeMois = getDureeMois(lease.type_bail, resolvedProfile?.type);
  
  // Recalculer date_fin à partir de date_debut + duree_mois
  // Justification : Évite l'incohérence entre "Six ans" et date_fin réelle
  const calculateDateFin = (dateDebut: string, mois: number): string => {
    if (!dateDebut) return "";
    const start = new Date(dateDebut);
    const end = new Date(start);
    end.setMonth(end.getMonth() + mois);
    return end.toISOString().split("T")[0];
  };
  
  const dateFinCalculee = lease.date_debut 
    ? calculateDateFin(lease.date_debut, dureeMois)
    : lease.date_fin || "";

  return {
    reference: lease.id ? lease.id.slice(0, 8).toUpperCase() : "DRAFT",
    date_signature: (lease as any).created_at, // Ou signed_at si dispo
    lieu_signature: property.ville || "...",
    
    bailleur: {
      nom: resolvedProfile?.nom || "[NOM PROPRIÉTAIRE]",
      prenom: resolvedProfile?.prenom || "",
      adresse: resolvedProfile?.adresse || "[ADRESSE PROPRIÉTAIRE]",
      code_postal: "",
      ville: "",
      email: resolvedProfile?.email || "",
      telephone: resolvedProfile?.telephone || "",
      type: resolvedProfile?.type === "societe" ? "societe" : "particulier",
      // Champs société
      raison_sociale: resolvedProfile?.raison_sociale || "",
      forme_juridique: resolvedProfile?.forme_juridique || "SCI",
      siret: resolvedProfile?.siret || "",
      representant_nom: resolvedProfile?.representant_nom || (resolvedProfile?.type === "societe" ? `${resolvedProfile?.prenom || ""} ${resolvedProfile?.nom || ""}`.trim() : ""),
      representant_qualite: resolvedProfile?.representant_qualite || (resolvedProfile?.type === "societe" ? "Gérant" : ""),
      est_mandataire: false,
    } as any,

    locataires: mainTenant ? [(() => {
      // FIX: Chaîne de fallback robuste — ne JAMAIS retourner un placeholder avec crochets
      // qui serait converti en "[En attente de locataire]" par le template service
      const profileNom = mainTenant.profile?.nom;
      const profilePrenom = mainTenant.profile?.prenom;
      const invitedParts = mainTenant.invited_name?.trim().split(' ') || [];
      const invitedPrenom = invitedParts[0] || '';
      const invitedNom = invitedParts.slice(1).join(' ') || invitedParts[0] || '';
      const emailName = mainTenant.invited_email?.split('@')[0]?.replace(/[._-]/g, ' ') || '';

      return {
        nom: profileNom || invitedNom || emailName || 'Locataire',
        prenom: profilePrenom || invitedPrenom || '',
        email: mainTenant.profile?.email || mainTenant.invited_email || "",
        telephone: mainTenant.profile?.telephone || "",
        date_naissance: mainTenant.profile?.date_naissance || "",
        lieu_naissance: mainTenant.profile?.lieu_naissance || "",
        nationalite: mainTenant.profile?.nationalite || "Française",
        adresse: mainTenant.profile?.adresse || "",
      };
    })()] as any[] : [],

    logement: {
      adresse_complete: property.adresse_complete || (property as any).adresse || "",
      code_postal: property.code_postal || "",
      ville: property.ville || "",
      type: property.type as any || "appartement",
      surface_habitable: surfaceValid || 0,
      nb_pieces_principales: (property as any).nb_pieces || 1,
      etage: (property as any).etage,
      // Mapper les champs étendus (si présents en DB via select *)
      epoque_construction: propAny.annee_construction ? String(propAny.annee_construction) as any : undefined,
      chauffage_type: propAny.chauffage_type || undefined,
      chauffage_energie: propAny.chauffage_energie || undefined,
      eau_chaude_type: propAny.eau_chaude_type || undefined,
      eau_chaude_energie: propAny.eau_chaude_energie || undefined,
      regime: propAny.regime || "mono_propriete",
      
      // ✅ NOUVEAU : Mapper les équipements privatifs (Climatisation, etc.)
      equipements_privatifs: (() => {
        const eq = [];
        if (propAny.clim_presence && propAny.clim_presence !== 'aucune') {
          eq.push(`Climatisation (${propAny.clim_type || 'fixe'})`);
        }
        if (propAny.cuisine_equipee) eq.push("Cuisine équipée");
        if (propAny.interphone) eq.push("Interphone");
        if (propAny.digicode) eq.push("Digicode");
        if (propAny.fibre_optique) eq.push("Fibre optique");
        return eq;
      })(),

      // ✅ NOUVEAU : Mapper les annexes (Balcon, Terrasse, Cave, Jardin)
      annexes: (() => {
        const ann = [];
        if (propAny.has_balcon) ann.push({ type: 'Balcon' });
        if (propAny.has_terrasse) ann.push({ type: 'Terrasse' });
        if (propAny.has_cave) ann.push({ type: 'Cave' });
        if (propAny.has_jardin) ann.push({ type: 'Jardin' });
        if (propAny.has_parking) ann.push({ type: 'Parking' });
        return ann as any[];
      })(),
    },

    conditions: {
      type_bail: (lease.type_bail || "nu") as any,
      usage: "habitation_principale",
      date_debut: lease.date_debut,
      // FIX: Utiliser la date de fin CALCULEE (coherente avec duree_mois)
      date_fin: dateFinCalculee,
      // FIX: Utiliser la duree calculee (bailleur societe = 6 ans)
      duree_mois: dureeMois,
      // Utiliser les valeurs synchronisees (property pour draft, lease pour actif)
      loyer_hc: loyer,
      loyer_en_lettres: numberToWords(loyer),
      charges_montant: charges,
      // FIX: Ajouter le total loyer + charges en lettres
      loyer_total: loyer + charges,
      loyer_total_en_lettres: numberToWords(loyer + charges),
      depot_garantie: depotGarantie,
      depot_garantie_en_lettres: numberToWords(depotGarantie),
      mode_paiement: "virement",
      periodicite_paiement: "mensuelle",
      jour_paiement: jourPaiement,
      tacite_reconduction: ["nu", "meuble"].includes(lease.type_bail),
      charges_type: "provisions", // Default
      revision_autorisee: true,
      indice_reference: "IRL",
      // FIX: Terme a echoir si paiement en debut de mois
      paiement_avance: paiementAvance,
    } as any,
    
    diagnostics: {
      dpe: {
        // ✅ FIX: Mapper tous les champs DPE depuis properties
        date_realisation: propAny.dpe_date || "",
        date_validite: propAny.dpe_date_validite || "",
        classe_energie: propAny.dpe_classe_energie || propAny.energie || undefined,
        classe_ges: propAny.dpe_classe_climat || propAny.ges || undefined,
        consommation_energie: propAny.dpe_consommation || propAny.consommation_energie || 0,
        emissions_ges: propAny.dpe_emissions_ges || propAny.emissions_ges || 0,
        // Estimations coûts annuels
        estimation_cout_min: propAny.dpe_cout_min || propAny.estimation_cout_min || 0,
        estimation_cout_max: propAny.dpe_cout_max || propAny.estimation_cout_max || 0,
      },
      // CREP (plomb) - si immeuble avant 1949
      crep: propAny.crep_date ? {
        date_realisation: propAny.crep_date,
        presence_plomb: propAny.crep_plomb || false,
      } : undefined,
      // Électricité - si installation > 15 ans
      electricite: propAny.elec_date ? {
        date_realisation: propAny.elec_date,
        anomalies_detectees: propAny.elec_anomalies || false,
        nb_anomalies: propAny.elec_nb_anomalies || 0,
      } as any : undefined,
      // Gaz - si installation gaz présente
      gaz: propAny.gaz_date ? {
        date_realisation: propAny.gaz_date,
        anomalies_detectees: propAny.gaz_anomalies || false,
        type_anomalie: propAny.gaz_type_anomalie || "",
      } as any : undefined,
      // ERP (risques)
      erp: propAny.erp_date ? {
        date_realisation: propAny.erp_date,
      } as any : undefined,
      // Bruit (aéroport)
      bruit: propAny.bruit_date ? {
        date_realisation: propAny.bruit_date,
        zone_exposition: propAny.bruit_zone || "",
      } : undefined,
    },
    
    // Signatures electroniques
    signatures: {
      bailleur: {
        signed: ownerSigner?.signature_status === "signed",
        signed_at: ownerSigner?.signed_at || null,
        image: ownerSigner?.signature_image || null,
      },
      locataire: {
        signed: mainTenant?.signature_status === "signed",
        signed_at: mainTenant?.signed_at || null,
        image: mainTenant?.signature_image || null,
      },
      garant: guarantor ? {
        signed: guarantor?.signature_status === "signed",
        signed_at: guarantor?.signed_at || null,
        image: guarantor?.signature_image || null,
      } : null,
    },
    
    // ✅ SOTA 2026: Transmettre les signers bruts pour le template service
    // Nécessaire pour que les images de signature s'affichent dans le PDF
    signers: sortedSigners,
  } as any;
}
