import { numberToWords } from "@/lib/helpers/format";
import type { BailComplet } from "@/lib/templates/bail/types";
import type { LeaseDetails } from "@/app/owner/_data/fetchLeaseDetails";

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

export function mapLeaseToTemplate(
  details: LeaseDetails,
  ownerProfile?: OwnerProfile
): Partial<BailComplet> {
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

  // Trouver les signataires - ✅ FIX: Plus résilient sur les rôles
  const mainTenant = sortedSigners.find((s: any) => {
    const role = s.role?.toLowerCase() || "";
    return role.includes("locataire") || role.includes("tenant") || role === "principal";
  });
  const ownerSigner = sortedSigners.find((s: any) => {
    const role = s.role?.toLowerCase() || "";
    return role.includes("proprietaire") || role.includes("owner") || role === "bailleur";
  });
  const guarantor = sortedSigners.find((s: any) => {
    const role = s.role?.toLowerCase() || "";
    return role.includes("garant") || role.includes("caution");
  });

  // S'assurer que surface > 0, sinon undefined pour afficher les pointillés
  // On utilise any car property peut ne pas avoir toutes les propriétés typées dans LeaseDetails
  const propAny = property as any;
  const surface = propAny.surface_habitable_m2 || propAny.surface;
  const surfaceValid = surface && surface > 0 ? surface : undefined;

  // ✅ SYNCHRONISATION : Les données financières viennent du BIEN (source unique)
  const getMaxDepotLegal = (typeBail: string, loyerHC: number): number => {
    switch (typeBail) {
      case "nu":
      case "etudiant":
        return loyerHC * 1;
      case "meuble":
      case "colocation":
        return loyerHC * 2;
      case "mobilite":
        return 0;
      case "saisonnier":
        return loyerHC * 2;
      default:
        return loyerHC;
    }
  };

  // ✅ LIRE depuis le BAIL en priorité (données saisies par l'utilisateur), puis fallback sur BIEN
  const loyer = lease.loyer ?? propAny?.loyer_hc ?? propAny?.loyer_base ?? 0;
  const charges = lease.charges_forfaitaires ?? propAny?.charges_mensuelles ?? 0;
  
  // ✅ CORRECTION SOTA 2026: Utiliser le dépôt saisi, sinon calculer le max légal
  const depotSaisi = (lease as any).depot_de_garantie;
  const depotGarantie = (depotSaisi && depotSaisi > 0) 
    ? depotSaisi 
    : getMaxDepotLegal(lease.type_bail, loyer);

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
  const dureeMois = getDureeMois(lease.type_bail, ownerProfile?.type);
  
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
    date_signature: lease.created_at, // Ou signed_at si dispo
    lieu_signature: property.ville || "...",
    
    bailleur: {
      nom: ownerProfile?.nom || "[NOM PROPRIÉTAIRE]",
      prenom: ownerProfile?.prenom || "",
      adresse: ownerProfile?.adresse || "[ADRESSE PROPRIÉTAIRE]",
      code_postal: "",
      ville: "",
      email: ownerProfile?.email || "",
      telephone: ownerProfile?.telephone || "",
      type: ownerProfile?.type === "societe" ? "societe" : "particulier",
      // Champs société
      raison_sociale: ownerProfile?.raison_sociale || "",
      forme_juridique: ownerProfile?.forme_juridique || "SCI",
      siret: ownerProfile?.siret || "",
      representant_nom: ownerProfile?.representant_nom || (ownerProfile?.type === "societe" ? `${ownerProfile?.prenom || ""} ${ownerProfile?.nom || ""}`.trim() : ""),
      representant_qualite: ownerProfile?.representant_qualite || (ownerProfile?.type === "societe" ? "Gérant" : ""),
      est_mandataire: false,
    },

    locataires: mainTenant ? [{
      // ✅ FIX: Priorité aux données du profil, puis invited_name, puis extraction depuis l'email
      nom: mainTenant.profile?.nom || 
           (mainTenant.invited_name ? mainTenant.invited_name.split(' ').slice(1).join(' ') || mainTenant.invited_name : "") ||
           (mainTenant.invited_email && !mainTenant.invited_email.includes('@a-definir') ? mainTenant.invited_email.split('@')[0] : "[NOM LOCATAIRE]"),
      prenom: mainTenant.profile?.prenom || 
              (mainTenant.invited_name ? mainTenant.invited_name.split(' ')[0] : ""),
      email: mainTenant.profile?.email || mainTenant.invited_email || "",
      telephone: mainTenant.profile?.telephone || "",
      date_naissance: mainTenant.profile?.date_naissance || "",
      lieu_naissance: mainTenant.profile?.lieu_naissance || "",
      nationalite: mainTenant.profile?.nationalite || "Française",
      adresse: mainTenant.profile?.adresse || "",
    }] : [],

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
        return ann;
      })(),
    },

    conditions: {
      type_bail: lease.type_bail || "nu",
      usage: "habitation_principale",
      date_debut: lease.date_debut,
      // ✅ FIX: Utiliser la date de fin CALCULÉE (cohérente avec duree_mois)
      date_fin: dateFinCalculee,
      // ✅ FIX: Utiliser la durée calculée (bailleur société = 6 ans)
      duree_mois: dureeMois,
      // ✅ Utiliser les valeurs synchronisées (property pour draft, lease pour actif)
      loyer_hc: loyer,
      loyer_en_lettres: numberToWords(loyer),
      charges_montant: charges,
      // ✅ FIX: Ajouter le total loyer + charges en lettres
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
      // ✅ FIX: Terme à échoir si paiement en début de mois
      paiement_avance: paiementAvance,
    },
    
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
      } : undefined,
      // Gaz - si installation gaz présente
      gaz: propAny.gaz_date ? {
        date_realisation: propAny.gaz_date,
        anomalies_detectees: propAny.gaz_anomalies || false,
        type_anomalie: propAny.gaz_type_anomalie || "",
      } : undefined,
      // ERP (risques)
      erp: propAny.erp_date ? {
        date_realisation: propAny.erp_date,
      } : undefined,
      // Bruit (aéroport)
      bruit: propAny.bruit_date ? {
        date_realisation: propAny.bruit_date,
        zone_exposition: propAny.bruit_zone || "",
      } : undefined,
    },
    
    // Signatures électroniques
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
  };
}
