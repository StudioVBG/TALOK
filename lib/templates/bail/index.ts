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
};

// Utilitaires
export { LeaseTemplateService } from './template.service';

