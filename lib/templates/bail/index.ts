/**
 * Index des templates de bail
 * Exporte tous les templates et utilitaires associés
 */

// Types
export * from './types';
export * from './bail-parking.types';

// Templates - Habitation
export { BAIL_NU_TEMPLATE, BAIL_NU_VARIABLES } from './bail-nu.template';
export { BAIL_MEUBLE_TEMPLATE, BAIL_MEUBLE_VARIABLES } from './bail-meuble.template';
export { BAIL_COLOCATION_TEMPLATE, BAIL_COLOCATION_VARIABLES } from './bail-colocation.template';
export { BAIL_PARKING_TEMPLATE } from './bail-parking.template';
export { BAIL_SAISONNIER_TEMPLATE, BAIL_SAISONNIER_VARIABLES } from './bail-saisonnier.template';
export { BAIL_MOBILITE_TEMPLATE, BAIL_MOBILITE_VARIABLES, MOTIFS_MOBILITE } from './bail-mobilite.template';

// Templates - Commercial et Professionnel
export { BAIL_COMMERCIAL_3_6_9_TEMPLATE, BAIL_COMMERCIAL_3_6_9_VARIABLES } from './bail-commercial-3-6-9.template';
export { BAIL_PROFESSIONNEL_TEMPLATE, BAIL_PROFESSIONNEL_VARIABLES } from './bail-professionnel.template';
export { BAIL_COMMERCIAL_DEROGATOIRE_TEMPLATE, BAIL_COMMERCIAL_DEROGATOIRE_VARIABLES } from './bail-commercial-derogatoire.template';
export { BAIL_MIXTE_TEMPLATE, BAIL_MIXTE_VARIABLES } from './bail-mixte.template';

// Configuration des templates par type
export const TEMPLATES_CONFIG = {
  nu: {
    id: 'bail-nu-v1',
    name: 'Bail de location vide',
    type_bail: 'nu' as const,
    duree_min: 36, // mois
    depot_max_mois: 1,
    preavis_locataire: 3, // mois (1 en zone tendue)
    preavis_bailleur: 6,
    loi_applicable: 'Loi n°89-462 du 6 juillet 1989, Décret n°2015-587',
  },
  meuble: {
    id: 'bail-meuble-v1',
    name: 'Bail de location meublée',
    type_bail: 'meuble' as const,
    duree_min: 12, // mois (9 pour étudiants)
    depot_max_mois: 2,
    preavis_locataire: 1,
    preavis_bailleur: 3,
    loi_applicable: 'Loi ALUR, Décret n°2015-981',
  },
  colocation: {
    id: 'bail-colocation-v1',
    name: 'Bail de colocation',
    type_bail: 'colocation' as const,
    duree_min: 12, // ou 36 si vide
    depot_max_mois: 2, // ou 1 si vide
    solidarite_max_mois: 6,
    loi_applicable: 'Article 8-1 Loi n°89-462',
  },
  saisonnier: {
    id: 'bail-saisonnier-v1',
    name: 'Bail de location saisonnière',
    type_bail: 'saisonnier' as const,
    duree_max_jours: 90,
    depot_max_mois: 0, // pas de limite légale
    preavis_locataire: 0, // selon contrat
    preavis_bailleur: 0, // selon contrat
    loi_applicable: 'Article 1-1 Loi n°89-462, Code civil',
  },
  mobilite: {
    id: 'bail-mobilite-v1',
    name: 'Bail mobilité',
    type_bail: 'mobilite' as const,
    duree_min: 1, // mois
    duree_max: 10, // mois
    depot_max_mois: 0, // INTERDIT
    depot_interdit: true,
    preavis_locataire: 1,
    preavis_bailleur: 0, // pas de résiliation anticipée possible
    renouvelable: false,
    loi_applicable: 'Loi ELAN n°2018-1021, Articles 25-12 à 25-18',
  },
  parking: {
    id: 'bail-parking-v1',
    name: 'Contrat de location de parking',
    type_bail: 'contrat_parking' as const,
    duree_min: 0, // Durée libre (code civil)
    depot_max_mois: 0, // Pas de limite légale
    preavis_locataire: 1,
    preavis_bailleur: 1,
    loi_applicable: 'Code civil (articles 1709 et suivants)',
  },
  etudiant: {
    id: 'bail-etudiant-v1',
    name: 'Bail étudiant',
    type_bail: 'etudiant' as const,
    duree_fixe: 9, // mois (non renouvelable tacitement)
    depot_max_mois: 1,
    preavis_locataire: 1,
    preavis_bailleur: 3,
    renouvelable: false,
    loi_applicable: 'Loi n°89-462, Article 25-7',
  },
  commercial_3_6_9: {
    id: 'bail-commercial-3-6-9-v1',
    name: 'Bail commercial 3/6/9',
    type_bail: 'commercial_3_6_9' as const,
    duree_min: 108, // 9 ans minimum
    depot_max_mois: 0, // Pas de limite légale (généralement 3 à 6 mois)
    preavis_locataire: 6, // Résiliation triennale
    preavis_bailleur: 6,
    droit_renouvellement: true,
    propriete_commerciale: true,
    loi_applicable: 'Code de commerce, Articles L.145-1 et suivants',
  },
  professionnel: {
    id: 'bail-professionnel-v1',
    name: 'Bail professionnel',
    type_bail: 'professionnel' as const,
    duree_min: 72, // 6 ans minimum
    depot_max_mois: 0, // Pas de limite légale
    preavis_locataire: 6,
    preavis_bailleur: 6,
    droit_renouvellement: false,
    loi_applicable: 'Loi n°86-1290, Article 57A',
  },
  commercial_derogatoire: {
    id: 'bail-commercial-derogatoire-v1',
    name: 'Bail commercial dérogatoire',
    type_bail: 'commercial_derogatoire' as const,
    duree_max: 36, // 3 ans maximum
    depot_max_mois: 0, // Pas de limite légale
    preavis_locataire: 0, // Selon contrat
    preavis_bailleur: 0, // Selon contrat
    droit_renouvellement: false,
    propriete_commerciale: false,
    loi_applicable: 'Code de commerce, Article L.145-5',
  },
  location_gerance: {
    id: 'bail-location-gerance-v1',
    name: 'Location-gérance',
    type_bail: 'location_gerance' as const,
    duree_min: 0, // Durée libre
    depot_max_mois: 0,
    preavis_locataire: 3,
    preavis_bailleur: 3,
    loi_applicable: 'Code de commerce, Articles L.144-1 et suivants',
  },
  bail_mixte: {
    id: 'bail-mixte-v1',
    name: 'Bail mixte (habitation + professionnel)',
    type_bail: 'bail_mixte' as const,
    duree_min: 36, // 3 ans si bailleur personne physique, 6 ans sinon
    depot_max_mois: 1, // Comme bail nu
    preavis_locataire: 3,
    preavis_bailleur: 6,
    loi_applicable: 'Loi n°89-462, Article 2',
  },
  bail_rural: {
    id: 'bail-rural-v1',
    name: 'Bail rural',
    type_bail: 'bail_rural' as const,
    duree_min: 108, // 9 ans minimum
    depot_max_mois: 0, // Non prévu par le statut du fermage
    preavis_locataire: 18, // 18 mois avant fin de période
    preavis_bailleur: 18,
    droit_preemption: true,
    loi_applicable: 'Code rural, Articles L.411-1 et suivants',
  },
};

// Utilitaires
export { LeaseTemplateService, LeaseTemplateService as TemplateService } from './template.service';

