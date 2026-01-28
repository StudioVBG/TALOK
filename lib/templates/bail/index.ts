/**
 * Index des templates de bail
 * Exporte tous les templates et utilitaires associés
 */

// Types
export * from './types';
export * from './bail-parking.types';

// Templates
export { BAIL_NU_TEMPLATE, BAIL_NU_VARIABLES } from './bail-nu.template';
export { BAIL_MEUBLE_TEMPLATE, BAIL_MEUBLE_VARIABLES } from './bail-meuble.template';
export { BAIL_COLOCATION_TEMPLATE, BAIL_COLOCATION_VARIABLES } from './bail-colocation.template';
export { BAIL_PARKING_TEMPLATE } from './bail-parking.template';
export { BAIL_SAISONNIER_TEMPLATE, BAIL_SAISONNIER_VARIABLES } from './bail-saisonnier.template';
export { BAIL_MOBILITE_TEMPLATE, BAIL_MOBILITE_VARIABLES, MOTIFS_MOBILITE } from './bail-mobilite.template';
export { BAIL_COMMERCIAL_TEMPLATE, BAIL_COMMERCIAL_VARIABLES } from './bail-commercial.template';
export { BAIL_DEROGATOIRE_TEMPLATE, BAIL_DEROGATOIRE_VARIABLES } from './bail-derogatoire.template';
export { BAIL_PROFESSIONNEL_TEMPLATE, BAIL_PROFESSIONNEL_VARIABLES } from './bail-professionnel.template';
export { BAIL_LOCATION_GERANCE_TEMPLATE, BAIL_LOCATION_GERANCE_VARIABLES } from './bail-location-gerance.template';

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
    type_bail: 'parking' as const,
    duree_min: 0, // Durée libre (code civil)
    depot_max_mois: 0, // Pas de limite légale
    preavis_locataire: 1,
    preavis_bailleur: 1,
    loi_applicable: 'Code civil (articles 1709 et suivants)',
  },
  commercial: {
    id: 'bail-commercial-v1',
    name: 'Bail commercial 3/6/9',
    type_bail: 'commercial' as const,
    duree_min: 108, // 9 ans minimum
    duree_max: 0, // Pas de limite
    depot_max_mois: 0, // Pas de limite légale (généralement 3-6 mois)
    preavis_locataire: 6, // Résiliation triennale
    preavis_bailleur: 6,
    resiliation_triennale: true,
    droit_renouvellement: true,
    indemnite_eviction: true,
    indexation: ['ILC', 'ILAT', 'ICC'],
    loi_applicable: 'Code de commerce (Articles L145-1 à L145-60)',
  },
  commercial_derogatoire: {
    id: 'bail-derogatoire-v1',
    name: 'Bail commercial dérogatoire',
    type_bail: 'commercial_derogatoire' as const,
    duree_min: 0,
    duree_max: 36, // 3 ans maximum (cumul)
    depot_max_mois: 0, // Pas de limite légale
    preavis_locataire: 0, // Selon contrat
    preavis_bailleur: 0, // Pas de congé nécessaire
    resiliation_triennale: false,
    droit_renouvellement: false,
    indemnite_eviction: false,
    tacite_reconduction: false,
    loi_applicable: 'Article L145-5 du Code de commerce',
  },
  professionnel: {
    id: 'bail-professionnel-v1',
    name: 'Bail professionnel',
    type_bail: 'professionnel' as const,
    duree_min: 72, // 6 ans minimum
    duree_max: 0, // Pas de limite
    depot_max_mois: 0, // Pas de limite légale (généralement 2 mois)
    preavis_locataire: 6,
    preavis_bailleur: 6,
    resiliation_anticipee: true, // À tout moment avec préavis
    droit_renouvellement: false, // Pas de propriété commerciale
    indemnite_eviction: false, // Pas d'indemnité d'éviction
    indexation: ['ILAT', 'ILC'],
    professions_liberales: true,
    ordre_professionnel: true, // Pour professions réglementées
    assurance_rcp_obligatoire: true,
    loi_applicable: 'Article 57 A de la loi n°86-1290 du 23 décembre 1986',
  },
  location_gerance: {
    id: 'bail-location-gerance-v1',
    name: 'Contrat de location-gérance',
    type_bail: 'location_gerance' as const,
    duree_min: 12, // Généralement 1 an minimum
    duree_max: 0, // Pas de limite légale
    depot_max_mois: 0, // Cautionnement libre (généralement 3-6 mois de redevance)
    preavis_locataire: 6, // 6 mois selon contrat
    preavis_bailleur: 6, // 6 mois selon contrat
    resiliation_anticipee: false, // Selon clauses contractuelles
    solidarite_fiscale: true, // Article L144-7: 6 mois après publication JAL
    publication_jal_obligatoire: true, // Article L144-6
    exploitation_personnelle_requise: true, // 2 ans minimum avant mise en gérance
    redevance_types: ['fixe', 'pourcentage_ca', 'mixte', 'progressive'],
    indexation: ['ILC', 'ILAT'],
    licences_transmissibles: true, // Selon type de fonds
    loi_applicable: 'Code de commerce Articles L144-1 à L144-13',
  },
};

// Utilitaires
export { LeaseTemplateService, LeaseTemplateService as TemplateService } from './template.service';

