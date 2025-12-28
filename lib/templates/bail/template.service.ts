/**
 * Service de génération de templates de bail
 * Gère le remplacement des variables et la génération du HTML final
 */

import { BAIL_NU_TEMPLATE } from './bail-nu.template';
import { BAIL_MEUBLE_TEMPLATE } from './bail-meuble.template';
import { BAIL_COLOCATION_TEMPLATE } from './bail-colocation.template';
import { BAIL_PARKING_TEMPLATE } from './bail-parking.template';
import type { BailComplet, TypeBail, TemplateVariables } from './types';
import type { ParkingLease, ParkingCategory } from './bail-parking.types';
import { getParkingCategoryLabel, getVehicleTypeLabel, getAccessMethodLabel, getSecurityFeatureLabel } from './bail-parking.types';

// Types de bail étendus pour inclure parking
type ExtendedTypeBail = TypeBail | 'parking';

// Mapping des templates par type
const TEMPLATES: Record<ExtendedTypeBail, string> = {
  nu: BAIL_NU_TEMPLATE,
  meuble: BAIL_MEUBLE_TEMPLATE,
  colocation: BAIL_COLOCATION_TEMPLATE,
  saisonnier: BAIL_NU_TEMPLATE, // Utilise le template nu pour l'instant
  mobilite: BAIL_MEUBLE_TEMPLATE, // Utilise le template meublé pour l'instant
  parking: BAIL_PARKING_TEMPLATE, // Nouveau template parking
};

export class LeaseTemplateService {
  /**
   * Génère le HTML du bail à partir des données
   */
  static generateHTML(typeBail: TypeBail, data: Partial<BailComplet>): string {
    const template = TEMPLATES[typeBail];
    if (!template) {
      throw new Error(`Template non trouvé pour le type de bail: ${typeBail}`);
    }

    // Convertir les données en variables template
    const variables = this.dataToVariables(typeBail, data);

    // Remplacer les variables dans le template
    return this.replaceVariables(template, variables);
  }

  /**
   * Convertit les données du bail en variables template
   */
  static dataToVariables(typeBail: TypeBail, data: Partial<BailComplet>): Record<string, string> {
    const variables: Record<string, string> = {};
    const now = new Date();

    // Variables système
    variables['REFERENCE_BAIL'] = data.reference || `BAIL-${Date.now()}`;
    variables['DATE_GENERATION'] = this.formatDate(now);
    variables['DATE_SIGNATURE'] = data.date_signature ? this.formatDate(new Date(data.date_signature)) : '';
    variables['LIEU_SIGNATURE'] = data.lieu_signature || '';
    variables['NB_EXEMPLAIRES'] = String((data.locataires?.length || 1) + 1);

    // Valeurs par défaut pour révision du loyer (IRL)
    variables['REVISION_AUTORISEE'] = 'true';
    variables['TRIMESTRE_REFERENCE'] = this.getCurrentTrimestre();
    variables['INDICE_REFERENCE'] = 'IRL';

    // Bailleur
    if (data.bailleur) {
      const b = data.bailleur;
      variables['BAILLEUR_NOM_COMPLET'] = `${b.prenom} ${b.nom}`;
      variables['BAILLEUR_ADRESSE'] = `${b.adresse}, ${b.code_postal} ${b.ville}`;
      variables['BAILLEUR_QUALITE'] = b.type === 'societe' ? 'Société' : 'Personne physique';
      variables['BAILLEUR_TYPE'] = b.type;
      if (b.siret) variables['BAILLEUR_SIRET'] = b.siret;
      if (b.est_mandataire && b.mandataire_nom) {
        variables['MANDATAIRE_NOM'] = b.mandataire_nom;
        variables['MANDATAIRE_ADRESSE'] = b.mandataire_adresse || '';
      }
    }

    // Locataire(s)
    if (data.locataires && data.locataires.length > 0) {
      const l = data.locataires[0];
      variables['LOCATAIRE_NOM_COMPLET'] = `${l.prenom} ${l.nom}`;
      variables['LOCATAIRE_DATE_NAISSANCE'] = l.date_naissance ? this.formatDate(new Date(l.date_naissance)) : '';
      variables['LOCATAIRE_LIEU_NAISSANCE'] = l.lieu_naissance || '';

      if (data.locataires.length > 1) {
        const l2 = data.locataires[1];
        variables['LOCATAIRE_2_NOM'] = `${l2.prenom} ${l2.nom}`;
        variables['LOCATAIRE_2_DATE_NAISSANCE'] = l2.date_naissance ? this.formatDate(new Date(l2.date_naissance)) : '';
        variables['LOCATAIRE_2_LIEU_NAISSANCE'] = l2.lieu_naissance || '';
      }
    }

    // Logement
    if (data.logement) {
      const log = data.logement;
      variables['LOGEMENT_ADRESSE'] = log.adresse_complete;
      variables['LOGEMENT_CODE_POSTAL'] = log.code_postal;
      variables['LOGEMENT_VILLE'] = log.ville;
      variables['LOGEMENT_TYPE'] = this.formatLogementType(log.type);
      variables['LOGEMENT_REGIME'] = this.formatRegime(log.regime);
      variables['LOGEMENT_PERIODE_CONSTRUCTION'] = this.formatPeriodeConstruction(log.epoque_construction);
      variables['LOGEMENT_SURFACE'] = String(log.surface_habitable);
      variables['LOGEMENT_NB_PIECES'] = String(log.nb_pieces_principales);
      if (log.etage !== undefined) {
        variables['LOGEMENT_ETAGE'] = String(log.etage);
        variables['LOGEMENT_NB_ETAGES'] = String(log.nb_etages_immeuble || '');
      }
      variables['LOGEMENT_EQUIPEMENTS'] = log.equipements_privatifs?.join(', ') || 'Aucun équipement spécifique';
      variables['LOGEMENT_PARTIES_COMMUNES'] = log.parties_communes?.join(', ') || '';
      variables['LOGEMENT_ANNEXES'] = log.annexes?.map(a => `${a.type}${a.surface ? ` (${a.surface} m²)` : ''}`).join(', ') || '';
      const chauffageType = log.chauffage_type === 'individuel' ? 'Individuel' : 'Collectif';
      const chauffageEnergie = log.chauffage_energie ? this.formatEnergie(log.chauffage_energie) : null;
      variables['CHAUFFAGE_TYPE'] = chauffageType;
      variables['CHAUFFAGE_ENERGIE'] = chauffageEnergie || '';
      // Variable combinée pour affichage : "Collectif - Gaz" ou juste "Collectif" si pas d'énergie
      variables['CHAUFFAGE_DISPLAY'] = chauffageEnergie ? `${chauffageType} - ${chauffageEnergie}` : chauffageType;
      
      const eauChaudeType = log.eau_chaude_type === 'individuel' ? 'Individuelle' : 'Collective';
      const eauChaudeEnergie = log.eau_chaude_energie ? this.formatEnergie(log.eau_chaude_energie) : null;
      variables['EAU_CHAUDE_TYPE'] = eauChaudeType;
      variables['EAU_CHAUDE_ENERGIE'] = eauChaudeEnergie || '';
      // Variable combinée pour affichage
      variables['EAU_CHAUDE_DISPLAY'] = eauChaudeEnergie ? `${eauChaudeType} - ${eauChaudeEnergie}` : eauChaudeType;
      
      // Pour colocation
      if (log.nb_chambres) {
        variables['LOGEMENT_NB_CHAMBRES'] = String(log.nb_chambres);
      }
    }

    // Conditions du bail
    if (data.conditions) {
      const c = data.conditions;
      variables['BAIL_DATE_DEBUT'] = this.formatDate(new Date(c.date_debut));
      variables['BAIL_DUREE'] = this.formatDuree(c.duree_mois);
      variables['BAIL_DATE_FIN'] = c.date_fin ? this.formatDate(new Date(c.date_fin)) : '';
      variables['TACITE_RECONDUCTION'] = c.tacite_reconduction ? 'true' : '';

      // Financier
      variables['LOYER_HC'] = this.formatMontant(c.loyer_hc);
      variables['LOYER_LETTRES'] = c.loyer_en_lettres || this.numberToWords(c.loyer_hc);
      variables['CHARGES_MONTANT'] = this.formatMontant(c.charges_montant);
      variables['CHARGES_TYPE_LABEL'] = c.charges_type === 'forfait' ? 'Forfait de charges' : 'Provision sur charges (régularisation annuelle)';
      if (c.complement_loyer) {
        variables['COMPLEMENT_LOYER'] = this.formatMontant(c.complement_loyer);
      }
      const total = c.loyer_hc + c.charges_montant + (c.complement_loyer || 0);
      variables['LOYER_TOTAL'] = this.formatMontant(total);
      // ✅ FIX: Ajouter le total en lettres pour cohérence PDF
      variables['LOYER_TOTAL_LETTRES'] = (c as any).loyer_total_en_lettres || this.numberToWords(total);

      variables['MODE_PAIEMENT'] = this.formatModePaiement(c.mode_paiement);
      variables['PERIODICITE_PAIEMENT'] = c.periodicite_paiement === 'mensuelle' ? 'Mensuelle' : 'Trimestrielle';
      variables['JOUR_PAIEMENT'] = String(c.jour_paiement);
      variables['TERME_PAIEMENT'] = c.paiement_avance ? 'd\'avance (terme à échoir)' : 'à terme échu';

      variables['DEPOT_GARANTIE'] = this.formatMontant(c.depot_garantie);
      variables['DEPOT_LETTRES'] = c.depot_garantie_en_lettres || this.numberToWords(c.depot_garantie);

      // Révision du loyer - ne désactiver que si explicitement false
      if (c.revision_autorisee === false) {
        variables['REVISION_AUTORISEE'] = '';
      }
      if (c.trimestre_reference) {
        variables['TRIMESTRE_REFERENCE'] = c.trimestre_reference;
      }
    }

    // Encadrement des loyers
    if (data.encadrement && data.encadrement.commune_encadrement) {
      variables['ZONE_ENCADREMENT'] = 'true';
      variables['LOYER_REFERENCE'] = this.formatMontant(data.encadrement.loyer_reference || 0);
      variables['LOYER_REFERENCE_MAJORE'] = this.formatMontant(data.encadrement.loyer_reference_majore || 0);
      if (data.encadrement.complement_loyer) {
        variables['COMPLEMENT_LOYER'] = this.formatMontant(data.encadrement.complement_loyer);
        variables['COMPLEMENT_JUSTIFICATION'] = data.encadrement.justification_complement || '';
      }
      variables['DECRET_ENCADREMENT'] = data.encadrement.decret_reference || '';
    }

    // Diagnostics
    if (data.diagnostics) {
      const d = data.diagnostics;
      // DPE - Vérifier que les valeurs existent avant d'appeler toLowerCase()
      if (d.dpe) {
        const classeEnergie = d.dpe.classe_energie || '';
        const classeGes = d.dpe.classe_ges || '';
        
        variables['DPE_CLASSE'] = classeEnergie;
        variables['DPE_CLASSE_LOWER'] = classeEnergie ? classeEnergie.toLowerCase() : '';
        variables['DPE_GES'] = classeGes;
        variables['DPE_GES_LOWER'] = classeGes ? classeGes.toLowerCase() : '';
        variables['DPE_CONSOMMATION'] = d.dpe.consommation_energie ? String(d.dpe.consommation_energie) : '';
        variables['DPE_COUT_MIN'] = d.dpe.estimation_cout_min ? String(d.dpe.estimation_cout_min) : '';
        variables['DPE_COUT_MAX'] = d.dpe.estimation_cout_max ? String(d.dpe.estimation_cout_max) : '';
      }

      // CREP
      if (d.crep) {
        variables['CREP_DATE'] = this.formatDate(new Date(d.crep.date_realisation));
        variables['CREP_RESULTAT'] = d.crep.presence_plomb ? 'Présence de plomb' : 'Absence de plomb';
      }

      // Électricité
      if (d.electricite) {
        variables['ELECTRICITE_DATE'] = this.formatDate(new Date(d.electricite.date_realisation));
        variables['ELECTRICITE_RESULTAT'] = d.electricite.anomalies_detectees 
          ? `${d.electricite.nb_anomalies} anomalie(s)` 
          : 'Conforme';
      }

      // Gaz
      if (d.gaz) {
        variables['GAZ_DATE'] = this.formatDate(new Date(d.gaz.date_realisation));
        variables['GAZ_RESULTAT'] = d.gaz.anomalies_detectees 
          ? `Anomalie ${d.gaz.type_anomalie}` 
          : 'Conforme';
      }

      // ERP
      if (d.erp) {
        variables['ERP_DATE'] = this.formatDate(new Date(d.erp.date_realisation));
      }

      // Bruit
      if (d.bruit) {
        variables['BRUIT_DATE'] = this.formatDate(new Date(d.bruit.date_realisation));
        variables['BRUIT_ZONE'] = d.bruit.zone_exposition;
      }
    }

    // Garant
    if (data.garants && data.garants.length > 0) {
      const g = data.garants[0];
      variables['GARANT_NOM'] = `${g.prenom} ${g.nom}`;
      variables['GARANT_ADRESSE'] = `${g.adresse}, ${g.code_postal} ${g.ville}`;
      variables['GARANT_TYPE'] = this.formatGarantType(g.type_garantie);
      variables['GARANT_TYPE_ENGAGEMENT'] = 'solidaire'; // ou 'simple'
    }

    // Signatures électroniques
    if ((data as any).signatures) {
      const sigs = (data as any).signatures;
      
      // Signature bailleur
      if (sigs.bailleur?.signed && sigs.bailleur?.image) {
        variables['BAILLEUR_SIGNATURE_IMAGE'] = sigs.bailleur.image;
        variables['BAILLEUR_SIGNE'] = 'true';
        variables['BAILLEUR_DATE_SIGNATURE'] = sigs.bailleur.signed_at 
          ? this.formatDate(new Date(sigs.bailleur.signed_at)) 
          : '';
      }
      
      // Signature locataire
      if (sigs.locataire?.signed && sigs.locataire?.image) {
        variables['LOCATAIRE_SIGNATURE_IMAGE'] = sigs.locataire.image;
        variables['LOCATAIRE_SIGNE'] = 'true';
        variables['LOCATAIRE_DATE_SIGNATURE'] = sigs.locataire.signed_at 
          ? this.formatDate(new Date(sigs.locataire.signed_at)) 
          : '';
      }
      
      // Signature garant
      if (sigs.garant?.signed && sigs.garant?.image) {
        variables['GARANT_SIGNATURE_IMAGE'] = sigs.garant.image;
        variables['GARANT_SIGNE'] = 'true';
        variables['GARANT_DATE_SIGNATURE'] = sigs.garant.signed_at 
          ? this.formatDate(new Date(sigs.garant.signed_at)) 
          : '';
      }
    }

    // Clauses particulières
    if (data.clauses) {
      variables['ACTIVITE_PRO_AUTORISEE'] = data.clauses.activite_professionnelle_autorisee ? 'true' : '';
      variables['ACTIVITE_PRO_CONDITIONS'] = data.clauses.type_activite_autorisee || '';
      variables['SOUS_LOCATION_AUTORISEE'] = data.clauses.sous_location_autorisee ? 'true' : '';
    }

    // Copropriété
    if (data.logement?.regime === 'copropriete') {
      variables['COPROPRIETE'] = 'true';
    }

    // Spécifique meublé - Inventaire
    if (typeBail === 'meuble' && data.inventaire) {
      variables['INV_LITERIE'] = data.inventaire.literie_couette_couverture ? 'true' : '';
      variables['INV_VOLETS'] = data.inventaire.volets_rideaux_chambres ? 'true' : '';
      variables['INV_PLAQUES'] = data.inventaire.plaques_cuisson ? 'true' : '';
      variables['INV_FOUR'] = data.inventaire.four_ou_micro_ondes ? 'true' : '';
      variables['INV_FRIGO'] = data.inventaire.refrigerateur_congelateur ? 'true' : '';
      variables['INV_VAISSELLE'] = data.inventaire.vaisselle_ustensiles ? 'true' : '';
      variables['INV_TABLE'] = data.inventaire.table_sieges ? 'true' : '';
      variables['INV_RANGEMENTS'] = data.inventaire.rangements ? 'true' : '';
      variables['INV_LUMINAIRES'] = data.inventaire.luminaires ? 'true' : '';
      variables['INV_ENTRETIEN'] = data.inventaire.materiel_entretien ? 'true' : '';
    }

    // Spécifique colocation
    if (typeBail === 'colocation' && data.colocation) {
      variables['BAIL_UNIQUE'] = data.colocation.type_bail === 'unique' ? 'true' : '';
      variables['CLAUSE_SOLIDARITE'] = data.colocation.clause_solidarite ? 'true' : '';
      variables['DUREE_SOLIDARITE_MOIS'] = String(data.colocation.duree_solidarite_apres_depart || 6);
    }

    return variables;
  }

  /**
   * Remplace les variables dans le template
   * Supporte les conditions {{#if VAR}}...{{/if}} et les boucles {{#each ARRAY}}...{{/each}}
   * 
   * ✅ FIX: Utilise une BOUCLE pour gérer les conditions imbriquées
   * Chaque passe traite un niveau d'imbrication
   */
  static replaceVariables(template: string, variables: Record<string, string>): string {
    let html = template;
    let previousHtml = '';
    let iterations = 0;
    const maxIterations = 10; // Sécurité contre les boucles infinies

    // ✅ FIX: Boucle jusqu'à ce qu'il n'y ait plus de changements
    // Cela permet de gérer les conditions imbriquées niveau par niveau
    while (html !== previousHtml && iterations < maxIterations) {
      previousHtml = html;
      iterations++;

      // Traiter les conditions {{#if VAR}}...{{else}}...{{/if}}
      // Pattern non-greedy pour capturer le bon niveau d'imbrication
      html = html.replace(/\{\{#if\s+(\w+)\}\}((?:(?!\{\{#if)[\s\S])*?)(?:\{\{else\}\}((?:(?!\{\{#if)[\s\S])*?))?\{\{\/if\}\}/g, 
        (match, varName, ifContent, elseContent = '') => {
          const value = variables[varName];
          if (value && value !== '' && value !== 'false') {
            return ifContent;
          }
          return elseContent;
        }
      );
    }

    // Traiter les boucles {{#each ARRAY}}...{{/each}}
    // Note: Pour les boucles, on attend que les données soient déjà formatées en HTML
    html = html.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
      (match, arrayName, itemTemplate) => {
        return variables[`${arrayName}_HTML`] || '';
      }
    );

    // Remplacer les variables simples {{VAR}}
    html = html.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return variables[varName] !== undefined ? variables[varName] : '';
    });

    // Remplacer les variables imbriquées {{this.prop}}
    html = html.replace(/\{\{this\.(\w+)\}\}/g, (match, propName) => {
      return ''; // Géré par les boucles
    });

    // ✅ FIX: Validation anti-fuite - Nettoyer les tokens restants
    // Supprimer tout {{...}} ou {{#...}} non traité
    html = html.replace(/\{\{[#/]?\w+\}\}/g, '');

    return html;
  }

  // ============================================
  // UTILITAIRES DE FORMATAGE
  // ============================================

  static formatDate(date: Date): string {
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  static formatMontant(montant: number): string {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(montant);
  }

  /**
   * Calcule le trimestre de référence IRL actuel
   * L'IRL est publié avec un décalage, donc on utilise le trimestre précédent
   */
  static getCurrentTrimestre(): string {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    const year = now.getFullYear();
    
    // Déterminer le trimestre précédent (celui publié)
    // T1 (jan-mar) -> on utilise T4 année précédente
    // T2 (avr-jun) -> on utilise T1 année en cours
    // T3 (jul-sep) -> on utilise T2 année en cours
    // T4 (oct-déc) -> on utilise T3 année en cours
    
    let trimestre: number;
    let annee: number;
    
    if (month < 3) { // T1 actuel -> T4 année précédente
      trimestre = 4;
      annee = year - 1;
    } else if (month < 6) { // T2 actuel -> T1
      trimestre = 1;
      annee = year;
    } else if (month < 9) { // T3 actuel -> T2
      trimestre = 2;
      annee = year;
    } else { // T4 actuel -> T3
      trimestre = 3;
      annee = year;
    }
    
    const trimestreLabel = trimestre === 1 ? '1er' : `${trimestre}ème`;
    return `${trimestreLabel} trimestre ${annee}`;
  }

  static formatDuree(mois: number): string {
    if (mois === 12) return 'Un an';
    if (mois === 9) return 'Neuf mois';
    if (mois === 36) return 'Trois ans';
    if (mois === 72) return 'Six ans';
    
    const annees = Math.floor(mois / 12);
    const moisRestants = mois % 12;
    
    if (annees > 0 && moisRestants === 0) {
      return `${annees} an${annees > 1 ? 's' : ''}`;
    }
    if (annees > 0) {
      return `${annees} an${annees > 1 ? 's' : ''} et ${moisRestants} mois`;
    }
    return `${mois} mois`;
  }

  static formatLogementType(type: string): string {
    const types: Record<string, string> = {
      appartement: 'Appartement',
      maison: 'Maison',
      studio: 'Studio',
      chambre: 'Chambre',
      loft: 'Loft',
    };
    return types[type] || type;
  }

  static formatRegime(regime?: string): string {
    const regimes: Record<string, string> = {
      mono_propriete: 'Mono-propriété',
      copropriete: 'Copropriété',
      indivision: 'Indivision',
    };
    return regime ? regimes[regime] || regime : 'Non déterminé';
  }

  static formatPeriodeConstruction(periode?: string): string {
    const periodes: Record<string, string> = {
      avant_1949: 'Avant 1949',
      '1949_1974': '1949 à 1974',
      '1975_1989': '1975 à 1989',
      '1990_2005': '1990 à 2005',
      apres_2005: 'Après 2005',
    };
    return periode ? periodes[periode] || periode : 'Non déterminée';
  }

  static formatEnergie(energie?: string): string {
    const energies: Record<string, string> = {
      gaz: 'Gaz',
      electricite: 'Électricité',
      fioul: 'Fioul',
      bois: 'Bois',
      pompe_chaleur: 'Pompe à chaleur',
      solaire: 'Solaire',
      autre: 'Autre',
    };
    return energie ? energies[energie] || energie : 'Non déterminé';
  }

  static formatModePaiement(mode: string): string {
    const modes: Record<string, string> = {
      virement: 'Virement bancaire',
      prelevement: 'Prélèvement automatique',
      cheque: 'Chèque',
      especes: 'Espèces',
    };
    return modes[mode] || mode;
  }

  static formatGarantType(type: string): string {
    const types: Record<string, string> = {
      personne_physique: 'Caution personne physique',
      personne_morale: 'Caution personne morale',
      visale: 'Garantie Visale',
      glj: 'Garantie loyers impayés (GLI)',
    };
    return types[type] || type;
  }

  /**
   * Convertit un nombre en lettres (simplifié)
   */
  static numberToWords(n: number): string {
    const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
      'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

    if (n < 20) return units[n];
    if (n < 100) {
      const t = Math.floor(n / 10);
      const u = n % 10;
      if (t === 7 || t === 9) {
        return tens[t] + (u === 1 && t === 7 ? '-et-' : '-') + units[10 + u];
      }
      return tens[t] + (u === 1 && t !== 8 ? '-et-' : (u ? '-' : '')) + units[u];
    }
    if (n < 1000) {
      const h = Math.floor(n / 100);
      const r = n % 100;
      return (h === 1 ? 'cent' : units[h] + ' cent') + (r ? ' ' + this.numberToWords(r) : (h > 1 ? 's' : ''));
    }
    if (n < 10000) {
      const m = Math.floor(n / 1000);
      const r = n % 1000;
      return (m === 1 ? 'mille' : units[m] + ' mille') + (r ? ' ' + this.numberToWords(r) : '');
    }

    // Pour les grands nombres, retourner le format numérique
    return `${this.formatMontant(n)} euros`;
  }

  // ============================================
  // GÉNÉRATION BAIL PARKING
  // ============================================

  /**
   * Génère le HTML du contrat de location de parking
   */
  static generateParkingLeaseHTML(data: Partial<ParkingLease>): string {
    const template = TEMPLATES.parking;
    const variables = this.parkingDataToVariables(data);
    return this.replaceVariables(template, variables);
  }

  /**
   * Convertit les données du bail parking en variables template
   */
  static parkingDataToVariables(data: Partial<ParkingLease>): Record<string, string> {
    const variables: Record<string, string> = {};
    const now = new Date();

    // Variables système
    variables['REFERENCE_BAIL'] = data.reference || `PARK-${Date.now()}`;
    variables['DATE_GENERATION'] = this.formatDate(now);
    variables['DATE_SIGNATURE'] = this.formatDate(now);
    variables['LIEU_SIGNATURE'] = data.owner?.city || '';

    // Type de parking
    const category = data.parking?.specifications?.category;
    variables['PARKING_CATEGORY_LABEL'] = category ? getParkingCategoryLabel(category) : 'Parking';
    variables['PARKING_DESCRIPTION'] = this.getParkingDescription(category);
    variables['PARKING_ICON'] = this.getParkingIcon(category);

    // Localisation du parking
    if (data.parking) {
      variables['PARKING_ADRESSE'] = data.parking.address || '';
      variables['PARKING_CODE_POSTAL'] = data.parking.postalCode || '';
      variables['PARKING_VILLE'] = data.parking.city || '';
      
      const location = data.parking.specifications?.location;
      if (location) {
        variables['PARKING_NUMERO'] = location.numero || '';
        variables['PARKING_NIVEAU'] = location.niveau || '';
        variables['PARKING_ZONE'] = location.zone || '';
      }

      const dims = data.parking.specifications?.dimensions;
      if (dims) {
        variables['PARKING_DIMENSIONS'] = 'true';
        variables['PARKING_LONGUEUR'] = String(dims.longueur_m || '');
        variables['PARKING_LARGEUR'] = String(dims.largeur_m || '');
        variables['PARKING_HAUTEUR'] = String(dims.hauteur_max_m || '');
      }

      // Caractéristiques
      const features = data.parking.specifications?.features;
      if (features) {
        variables['PARKING_COUVERT'] = features.couvert ? 'true' : '';
        variables['PARKING_FERME'] = features.ferme ? 'true' : '';
        variables['PARKING_ECLAIRE'] = features.eclaire ? 'true' : '';
        variables['PARKING_PRISE'] = features.prise_electrique ? 'true' : '';
        variables['PARKING_BORNE_VE'] = features.borne_recharge_ve ? 'true' : '';
      }

      // Sécurité
      const security = data.parking.specifications?.security;
      if (security) {
        variables['PARKING_VIDEO'] = security.includes('video_surveillance') ? 'true' : '';
        variables['PARKING_GARDIEN'] = security.includes('gardiennage_24h') || security.includes('gardiennage_jour') ? 'true' : '';
        variables['PARKING_BARRIERE'] = security.includes('barriere_automatique') ? 'true' : '';
      }

      // Accès
      const access = data.parking.specifications?.access;
      if (access && access.length > 0) {
        variables['ACCES_METHODES'] = access.map(a => getAccessMethodLabel(a)).join(', ');
      } else {
        variables['ACCES_METHODES'] = 'Accès libre';
      }

      const accessHours = data.parking.specifications?.accessHours;
      if (accessHours?.restricted) {
        variables['ACCES_RESTREINT'] = 'true';
        variables['ACCES_HORAIRES'] = accessHours.schedule || '7h-22h';
      }
    }

    // Type de véhicule
    const vehicleType = data.conditions?.usage?.allowedVehicles?.[0];
    variables['VEHICULE_TYPE_LABEL'] = vehicleType ? getVehicleTypeLabel(vehicleType) : 'Tout véhicule';

    // Véhicule du locataire
    if (data.tenant?.vehicleInfo) {
      variables['VEHICULE_IMMATRICULATION'] = data.tenant.vehicleInfo.licensePlate || '';
      variables['VEHICULE_MARQUE'] = data.tenant.vehicleInfo.brand || '';
      variables['VEHICULE_MODELE'] = data.tenant.vehicleInfo.model || '';
    }

    // Bailleur
    if (data.owner) {
      const o = data.owner;
      if (o.type === 'societe') {
        variables['BAILLEUR_SOCIETE'] = 'true';
        variables['BAILLEUR_RAISON_SOCIALE'] = o.companyName || '';
        variables['BAILLEUR_FORME_JURIDIQUE'] = o.legalForm || '';
        variables['BAILLEUR_SIRET'] = o.siret || '';
        variables['BAILLEUR_REPRESENTANT'] = o.representativeName || '';
        variables['BAILLEUR_NOM_COMPLET'] = o.companyName || '';
      } else {
        variables['BAILLEUR_NOM_COMPLET'] = `${o.civility || ''} ${o.firstName || ''} ${o.lastName || ''}`.trim();
      }
      variables['BAILLEUR_ADRESSE'] = o.address || '';
      variables['BAILLEUR_CODE_POSTAL'] = o.postalCode || '';
      variables['BAILLEUR_VILLE'] = o.city || '';
      variables['BAILLEUR_EMAIL'] = o.email || '';
      variables['BAILLEUR_TELEPHONE'] = o.phone || '';
    }

    // Locataire
    if (data.tenant) {
      const t = data.tenant;
      if (t.type === 'societe') {
        variables['LOCATAIRE_SOCIETE'] = 'true';
        variables['LOCATAIRE_RAISON_SOCIALE'] = t.companyName || '';
        variables['LOCATAIRE_FORME_JURIDIQUE'] = t.legalForm || '';
        variables['LOCATAIRE_SIRET'] = t.siret || '';
        variables['LOCATAIRE_NOM_COMPLET'] = t.companyName || '';
      } else {
        variables['LOCATAIRE_NOM_COMPLET'] = `${t.civility || ''} ${t.firstName || ''} ${t.lastName || ''}`.trim();
        variables['LOCATAIRE_DATE_NAISSANCE'] = t.birthDate ? this.formatDate(new Date(t.birthDate)) : '';
        variables['LOCATAIRE_LIEU_NAISSANCE'] = t.birthPlace || '';
        variables['LOCATAIRE_NATIONALITE'] = t.nationality || 'Française';
      }
      variables['LOCATAIRE_ADRESSE'] = t.currentAddress || '';
      variables['LOCATAIRE_CODE_POSTAL'] = t.postalCode || '';
      variables['LOCATAIRE_VILLE'] = t.city || '';
      variables['LOCATAIRE_EMAIL'] = t.email || '';
      variables['LOCATAIRE_TELEPHONE'] = t.phone || '';
    }

    // Conditions
    if (data.conditions) {
      const c = data.conditions;

      // Type de location
      if (c.locationType === 'accessoire_logement') {
        variables['ACCESSOIRE_LOGEMENT'] = 'true';
        variables['LOGEMENT_LIE_ADRESSE'] = c.linkedPropertyId || '';
      }

      // Durée
      if (c.duration) {
        variables['BAIL_DATE_DEBUT'] = c.duration.startDate ? this.formatDate(new Date(c.duration.startDate)) : '';
        if (c.duration.type === 'indeterminee') {
          variables['DUREE_INDETERMINEE'] = 'true';
          variables['BAIL_DUREE'] = 'Durée indéterminée';
        } else {
          variables['BAIL_DUREE'] = this.formatDuree(c.duration.months || 12);
          variables['BAIL_DUREE_MOIS'] = String(c.duration.months || 12);
          if (c.duration.endDate) {
            variables['BAIL_DATE_FIN'] = this.formatDate(new Date(c.duration.endDate));
          }
        }
      }

      // Préavis
      if (c.noticePeriod) {
        variables['PREAVIS_BAILLEUR'] = String(c.noticePeriod.landlordMonths || 1);
        variables['PREAVIS_LOCATAIRE'] = String(c.noticePeriod.tenantMonths || 1);
      }

      // Financier
      if (c.financial) {
        const f = c.financial;
        variables['LOYER_MENSUEL'] = this.formatMontant(f.rentMonthly || 0);
        
        if (f.rentIncludesVAT && f.vatRate) {
          variables['TVA_APPLICABLE'] = 'true';
          variables['TVA_TAUX'] = String(f.vatRate);
          variables['TVA_MONTANT'] = this.formatMontant((f.rentMonthly || 0) * (f.vatRate / 100));
        }

        variables['CHARGES_MONTANT'] = this.formatMontant(f.chargesMonthly || 0);
        variables['CHARGES_TYPE_LABEL'] = f.chargesType === 'forfait' 
          ? 'forfait' 
          : f.chargesType === 'provisions' 
          ? 'provisions avec régularisation annuelle' 
          : 'incluses';

        const total = (f.rentMonthly || 0) + (f.chargesMonthly || 0);
        variables['LOYER_TOTAL'] = this.formatMontant(total);
        variables['LOYER_LETTRES'] = this.numberToWords(Math.round(total));

        variables['DEPOT_GARANTIE'] = this.formatMontant(f.deposit || 0);
        variables['DEPOT_MOIS'] = String(f.depositMonths || 1);
      }

      // Paiement
      if (c.payment) {
        variables['MODE_PAIEMENT'] = this.formatModePaiement(c.payment.method);
        variables['JOUR_PAIEMENT'] = String(c.payment.dayOfMonth || 5);
      }

      // Révision
      if (c.rentRevision?.allowed) {
        variables['REVISION_AUTORISEE'] = 'true';
        variables['INDICE_REFERENCE'] = c.rentRevision.index || 'IRL';
      }

      // Assurance
      if (c.insurance?.tenantRequired) {
        variables['ASSURANCE_LOCATAIRE_OBLIGATOIRE'] = 'true';
        variables['ASSURANCE_OBLIGATOIRE'] = 'true';
      }

      // Usage
      if (c.usage) {
        if (c.usage.storageAllowed) {
          variables['STOCKAGE_AUTORISE'] = 'true';
        }
        if (!c.usage.sublettingAllowed) {
          variables['SOUS_LOCATION_INTERDITE'] = 'true';
        }
        if (!c.usage.commercialUseForbidden) {
          variables['USAGE_COMMERCIAL_AUTORISE'] = 'true';
        }
      }
    }

    // Clauses particulières
    if (data.specialClauses && data.specialClauses.length > 0) {
      variables['CLAUSES_PARTICULIERES'] = data.specialClauses.join('<br><br>');
    }

    return variables;
  }

  /**
   * Obtient la description du type de parking
   */
  static getParkingDescription(category?: ParkingCategory): string {
    const descriptions: Record<ParkingCategory, string> = {
      place_exterieure: 'Place de parking en plein air, non couverte',
      place_couverte: 'Place de parking sous abri ou toit',
      box_ferme: 'Box individuel fermé avec porte',
      garage_individuel: 'Garage privatif indépendant',
      souterrain: 'Place en parking souterrain',
      aerien: 'Place en parking silo ou étage',
      deux_roues: 'Emplacement pour deux-roues',
    };
    return category ? descriptions[category] : 'Emplacement de stationnement';
  }

  /**
   * Obtient l'icône du type de parking
   */
  static getParkingIcon(category?: ParkingCategory): string {
    const icons: Record<ParkingCategory, string> = {
      place_exterieure: '🅿️',
      place_couverte: '🏢',
      box_ferme: '🔐',
      garage_individuel: '🏠',
      souterrain: '⬇️',
      aerien: '🏗️',
      deux_roues: '🏍️',
    };
    return category ? icons[category] : '🅿️';
  }
}

