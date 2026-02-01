/**
 * Service de contacts juridiques géolocalisés
 * Retourne les contacts utiles (préfecture, ADIL, commissariat, tribunal)
 * en fonction du département du logement
 */

import type { LocalizedContact, DepartmentContacts } from "@/lib/types/legal-protocols";
export type { DepartmentContacts } from "@/lib/types/legal-protocols";

// Base de données des préfectures (tous les départements français + DROM)
const PREFECTURES: Record<string, Omit<LocalizedContact, "role">> = {
  "01": {
    name: "Préfecture de l'Ain",
    address: "45 avenue d'Alsace-Lorraine, 01012 Bourg-en-Bresse Cedex",
    phone: "04 74 32 30 00",
    url: "https://www.ain.gouv.fr",
    notes: "Service des évacuations forcées"
  },
  "02": {
    name: "Préfecture de l'Aisne",
    address: "2 rue Paul Doumer, 02010 Laon Cedex",
    phone: "03 23 21 82 82",
    url: "https://www.aisne.gouv.fr",
    notes: "Service logement"
  },
  "03": {
    name: "Préfecture de l'Allier",
    address: "2 rue Michel de l'Hospital, 03016 Moulins Cedex",
    phone: "04 70 48 30 00",
    url: "https://www.allier.gouv.fr",
    notes: "Service logement"
  },
  "06": {
    name: "Préfecture des Alpes-Maritimes",
    address: "147 Boulevard du Mercantour, 06286 Nice Cedex 3",
    phone: "04 93 72 20 00",
    url: "https://www.alpes-maritimes.gouv.fr",
    notes: "Service logement"
  },
  "13": {
    name: "Préfecture des Bouches-du-Rhône",
    address: "Boulevard Paul Peytral, 13006 Marseille",
    phone: "04 84 35 40 00",
    url: "https://www.bouches-du-rhone.gouv.fr",
    notes: "Service des évacuations forcées"
  },
  "31": {
    name: "Préfecture de la Haute-Garonne",
    address: "1 Place Saint-Étienne, 31038 Toulouse Cedex 9",
    phone: "05 34 45 34 45",
    url: "https://www.haute-garonne.gouv.fr",
    notes: "Service des évacuations"
  },
  "33": {
    name: "Préfecture de la Gironde",
    address: "Esplanade Charles de Gaulle, 33077 Bordeaux Cedex",
    phone: "05 56 90 60 60",
    url: "https://www.gironde.gouv.fr",
    notes: "Service logement et expulsions"
  },
  "34": {
    name: "Préfecture de l'Hérault",
    address: "34 Place des Martyrs de la Résistance, 34062 Montpellier Cedex 2",
    phone: "04 67 61 61 61",
    url: "https://www.herault.gouv.fr",
    notes: "Service logement"
  },
  "35": {
    name: "Préfecture d'Ille-et-Vilaine",
    address: "3 avenue de la Préfecture, 35026 Rennes Cedex 9",
    phone: "02 99 02 10 35",
    url: "https://www.ille-et-vilaine.gouv.fr",
    notes: "Service logement"
  },
  "38": {
    name: "Préfecture de l'Isère",
    address: "12 Place de Verdun, 38041 Grenoble Cedex 9",
    phone: "04 76 60 34 00",
    url: "https://www.isere.gouv.fr",
    notes: "Service logement"
  },
  "44": {
    name: "Préfecture de la Loire-Atlantique",
    address: "6 quai Ceineray, 44035 Nantes Cedex 1",
    phone: "02 40 41 20 20",
    url: "https://www.loire-atlantique.gouv.fr",
    notes: "Pour les demandes d'évacuation"
  },
  "59": {
    name: "Préfecture du Nord",
    address: "12 rue Jean Sans Peur, 59039 Lille Cedex",
    phone: "03 20 30 59 59",
    url: "https://www.nord.gouv.fr",
    notes: "Pour les demandes anti-squat"
  },
  "67": {
    name: "Préfecture du Bas-Rhin",
    address: "5 Place de la République, 67073 Strasbourg Cedex",
    phone: "03 88 21 67 68",
    url: "https://www.bas-rhin.gouv.fr",
    notes: "Service logement"
  },
  "69": {
    name: "Préfecture du Rhône",
    address: "106 rue Pierre Corneille, 69003 Lyon",
    phone: "04 72 61 60 60",
    url: "https://www.rhone.gouv.fr",
    notes: "Pour les demandes d'évacuation art. 38 DALO"
  },
  "75": {
    name: "Préfecture de Police de Paris",
    address: "9 Boulevard du Palais, 75004 Paris",
    phone: "01 53 71 53 71",
    url: "https://www.prefecturedepolice.interieur.gouv.fr",
    notes: "Pour les signalements de squat à Paris"
  },
  "77": {
    name: "Préfecture de Seine-et-Marne",
    address: "12 rue des Saints-Pères, 77010 Melun Cedex",
    phone: "01 64 71 77 77",
    url: "https://www.seine-et-marne.gouv.fr",
    notes: "Service logement"
  },
  "78": {
    name: "Préfecture des Yvelines",
    address: "1 rue Jean Houdon, 78010 Versailles Cedex",
    phone: "01 39 49 78 00",
    url: "https://www.yvelines.gouv.fr",
    notes: "Service logement"
  },
  "91": {
    name: "Préfecture de l'Essonne",
    address: "Boulevard de France, 91010 Évry Cedex",
    phone: "01 69 91 91 91",
    url: "https://www.essonne.gouv.fr",
    notes: "Service logement"
  },
  "92": {
    name: "Préfecture des Hauts-de-Seine",
    address: "167-177 avenue Joliot-Curie, 92013 Nanterre Cedex",
    phone: "01 40 97 20 00",
    url: "https://www.hauts-de-seine.gouv.fr",
    notes: "Service logement"
  },
  "93": {
    name: "Préfecture de la Seine-Saint-Denis",
    address: "1 esplanade Jean Moulin, 93007 Bobigny Cedex",
    phone: "01 41 60 60 60",
    url: "https://www.seine-saint-denis.gouv.fr",
    notes: "Service logement"
  },
  "94": {
    name: "Préfecture du Val-de-Marne",
    address: "21-29 avenue du Général de Gaulle, 94038 Créteil Cedex",
    phone: "01 49 56 60 00",
    url: "https://www.val-de-marne.gouv.fr",
    notes: "Service logement"
  },
  "95": {
    name: "Préfecture du Val-d'Oise",
    address: "5 avenue Bernard Hirsch, 95010 Cergy-Pontoise Cedex",
    phone: "01 34 25 25 25",
    url: "https://www.val-doise.gouv.fr",
    notes: "Service logement"
  },
  // DROM
  "971": {
    name: "Préfecture de la Guadeloupe",
    address: "Rue Lardenoy, 97100 Basse-Terre",
    phone: "05 90 99 39 00",
    url: "https://www.guadeloupe.gouv.fr",
    notes: "Service logement Guadeloupe"
  },
  "972": {
    name: "Préfecture de la Martinique",
    address: "Rue Victor Sévère, 97262 Fort-de-France",
    phone: "05 96 39 36 00",
    url: "https://www.martinique.gouv.fr",
    notes: "Service logement Martinique"
  },
  "973": {
    name: "Préfecture de la Guyane",
    address: "Rue Fiedmond, 97307 Cayenne Cedex",
    phone: "05 94 39 45 00",
    url: "https://www.guyane.gouv.fr",
    notes: "Service logement Guyane"
  },
  "974": {
    name: "Préfecture de La Réunion",
    address: "Place du Barachois, 97405 Saint-Denis Cedex",
    phone: "02 62 40 77 77",
    url: "https://www.reunion.gouv.fr",
    notes: "Service logement Réunion"
  },
  "976": {
    name: "Préfecture de Mayotte",
    address: "Rue de l'Hôpital, 97600 Mamoudzou",
    phone: "02 69 63 50 00",
    url: "https://www.mayotte.gouv.fr",
    notes: "Service logement Mayotte"
  },
  // Corse
  "2A": {
    name: "Préfecture de la Corse-du-Sud",
    address: "Palais Lantivy, Cours Napoléon, 20188 Ajaccio Cedex 1",
    phone: "04 95 11 12 13",
    url: "https://www.corse-du-sud.gouv.fr",
    notes: "Service logement"
  },
  "2B": {
    name: "Préfecture de la Haute-Corse",
    address: "Rond-Point du Maréchal Leclerc, 20401 Bastia Cedex",
    phone: "04 95 34 50 00",
    url: "https://www.haute-corse.gouv.fr",
    notes: "Service logement"
  },
};

// Base de données des ADIL (Agences Départementales d'Information sur le Logement)
const ADILS: Record<string, Omit<LocalizedContact, "role">> = {
  "01": {
    name: "ADIL de l'Ain",
    address: "34 rue Général Delestraint, 01000 Bourg-en-Bresse",
    phone: "04 74 21 82 44",
    url: "https://www.adil01.org",
    opening_hours: "Lun-Ven 9h-12h et 14h-17h",
    notes: "Conseil juridique gratuit sur le logement"
  },
  "06": {
    name: "ADIL des Alpes-Maritimes",
    address: "22 boulevard Dubouchage, 06000 Nice",
    phone: "04 93 98 78 78",
    url: "https://www.adil06.org",
    opening_hours: "Lun-Ven 9h-12h et 14h-17h",
    notes: "Permanences dans tout le département"
  },
  "13": {
    name: "ADIL des Bouches-du-Rhône",
    address: "7 Cours Jean Ballard, 13001 Marseille",
    phone: "04 96 11 12 00",
    url: "https://www.adil13.org",
    opening_hours: "Lun-Ven 9h-12h et 14h-17h",
    notes: "Permanences juridiques gratuites"
  },
  "31": {
    name: "ADIL de la Haute-Garonne",
    address: "4 rue Clémence Isaure, 31000 Toulouse",
    phone: "05 61 22 46 22",
    url: "https://www.adil31.org",
    opening_hours: "Lun-Ven 9h-12h et 14h-17h",
    notes: "Permanences dans plusieurs communes"
  },
  "33": {
    name: "ADIL de la Gironde",
    address: "105 avenue Émile Counord, 33300 Bordeaux",
    phone: "05 56 00 73 00",
    url: "https://www.adil33.org",
    opening_hours: "Lun-Ven 9h-12h et 14h-17h",
    notes: "Conseil gratuit propriétaires et locataires"
  },
  "34": {
    name: "ADIL de l'Hérault",
    address: "17 rue de la Méditerranée, 34000 Montpellier",
    phone: "04 67 55 55 55",
    url: "https://www.adil34.org",
    opening_hours: "Lun-Ven 9h-12h et 14h-17h",
    notes: "Conseil gratuit"
  },
  "35": {
    name: "ADIL d'Ille-et-Vilaine",
    address: "22 rue Poullain Duparc, 35000 Rennes",
    phone: "02 99 78 27 27",
    url: "https://www.adil35.org",
    opening_hours: "Lun-Ven 9h-12h et 14h-17h",
    notes: "Permanences gratuites"
  },
  "38": {
    name: "ADIL de l'Isère",
    address: "2 boulevard Maréchal Joffre, 38000 Grenoble",
    phone: "04 76 53 37 30",
    url: "https://www.adil38.org",
    opening_hours: "Lun-Ven 9h-12h et 14h-17h",
    notes: "Conseil gratuit"
  },
  "44": {
    name: "ADIL de Loire-Atlantique",
    address: "5 rue de l'Hôtel de Ville, 44000 Nantes",
    phone: "02 40 89 30 15",
    url: "https://www.adil44.fr",
    opening_hours: "Lun-Ven 9h-12h et 14h-17h",
    notes: "Conseil gratuit logement"
  },
  "59": {
    name: "ADIL du Nord",
    address: "10 place de la République, 59800 Lille",
    phone: "03 59 61 15 15",
    url: "https://www.adil59.org",
    opening_hours: "Lun-Ven 9h-12h et 14h-17h",
    notes: "Permanences dans tout le département"
  },
  "67": {
    name: "ADIL du Bas-Rhin",
    address: "8 rue Adolphe Seyboth, 67000 Strasbourg",
    phone: "03 88 21 07 06",
    url: "https://www.adil67.org",
    opening_hours: "Lun-Ven 9h-12h et 14h-17h",
    notes: "Conseil gratuit"
  },
  "69": {
    name: "ADIL du Rhône et de la Métropole de Lyon",
    address: "9 rue Vaubecour, 69002 Lyon",
    phone: "04 78 52 84 84",
    url: "https://www.adil69.org",
    opening_hours: "Lun-Ven 9h-12h et 13h30-17h",
    notes: "RDV téléphone ou sur place"
  },
  "75": {
    name: "ADIL de Paris",
    address: "46 bis Boulevard Edgar Quinet, 75014 Paris",
    phone: "01 42 79 50 34",
    email: "adil75@adil75.org",
    url: "https://www.adil75.org",
    opening_hours: "Lun-Ven 9h30-17h30",
    notes: "Conseil juridique gratuit sur le logement"
  },
  "77": {
    name: "ADIL de Seine-et-Marne",
    address: "1 rue Victor Hugo, 77000 Melun",
    phone: "01 64 37 81 52",
    url: "https://www.adil77.org",
    opening_hours: "Lun-Ven 9h-12h et 14h-17h",
    notes: "Conseil gratuit"
  },
  "78": {
    name: "ADIL des Yvelines",
    address: "3 impasse des Gendarmes, 78000 Versailles",
    phone: "01 30 97 27 27",
    url: "https://www.adil78.org",
    opening_hours: "Lun-Ven 9h-12h et 14h-17h",
    notes: "Conseil gratuit"
  },
  "91": {
    name: "ADIL de l'Essonne",
    address: "1 rue Monttessuy, 91000 Évry",
    phone: "01 60 77 14 64",
    url: "https://www.adil91.org",
    opening_hours: "Lun-Ven 9h-12h et 14h-17h",
    notes: "Conseil gratuit"
  },
  "92": {
    name: "ADIL des Hauts-de-Seine",
    address: "27-29 rue Kléber, 92300 Levallois-Perret",
    phone: "01 47 37 50 50",
    url: "https://www.adil92.org",
    opening_hours: "Lun-Ven 9h-12h et 14h-17h",
    notes: "Conseil gratuit"
  },
  "93": {
    name: "ADIL de Seine-Saint-Denis",
    address: "1 avenue Youri Gagarine, 93140 Bondy",
    phone: "01 48 02 20 20",
    url: "https://www.adil93.org",
    opening_hours: "Lun-Ven 9h-12h et 14h-17h",
    notes: "Conseil gratuit"
  },
  "94": {
    name: "ADIL du Val-de-Marne",
    address: "79-81 rue du Général de Gaulle, 94000 Créteil",
    phone: "01 42 07 37 27",
    url: "https://www.adil94.org",
    opening_hours: "Lun-Ven 9h-12h et 14h-17h",
    notes: "Conseil gratuit"
  },
  "95": {
    name: "ADIL du Val-d'Oise",
    address: "47 avenue des Genottes, 95800 Cergy",
    phone: "01 34 25 03 03",
    url: "https://www.adil95.org",
    opening_hours: "Lun-Ven 9h-12h et 14h-17h",
    notes: "Conseil gratuit"
  },
  // DROM
  "971": {
    name: "ADIL de la Guadeloupe",
    address: "Immeuble Calbassier, 97122 Baie-Mahault",
    phone: "05 90 89 43 63",
    url: "https://www.adil971.org",
    notes: "Conseil gratuit logement Guadeloupe"
  },
  "972": {
    name: "ADIL de la Martinique",
    address: "Centre d'affaires Agora, 97200 Fort-de-France",
    phone: "05 96 71 22 21",
    url: "https://www.adil972.org",
    notes: "Conseil gratuit logement Martinique"
  },
  "974": {
    name: "ADIL de La Réunion",
    address: "23 rue Juliette Dodu, 97400 Saint-Denis",
    phone: "02 62 41 14 24",
    url: "https://www.adil974.com",
    notes: "Conseil gratuit logement Réunion"
  },
};

// Tribunaux judiciaires principaux
const TRIBUNAUX: Record<string, Omit<LocalizedContact, "role">> = {
  "13": {
    name: "Tribunal Judiciaire de Marseille",
    address: "6 rue Joseph Autran, 13006 Marseille",
    phone: "04 91 15 50 50",
    url: "https://www.tribunal-judiciaire-marseille.justice.fr",
    notes: "Juge des Contentieux de la Protection"
  },
  "31": {
    name: "Tribunal Judiciaire de Toulouse",
    address: "2 allée Jules Guesde, 31068 Toulouse Cedex 7",
    phone: "05 34 31 79 79",
    url: "https://www.tribunal-judiciaire-toulouse.justice.fr",
    notes: "Référé expulsion"
  },
  "33": {
    name: "Tribunal Judiciaire de Bordeaux",
    address: "30 rue des Frères Bonie, 33000 Bordeaux",
    phone: "05 56 00 10 10",
    url: "https://www.tribunal-judiciaire-bordeaux.justice.fr",
    notes: "JCP pour référé expulsion"
  },
  "59": {
    name: "Tribunal Judiciaire de Lille",
    address: "8 avenue du Peuple Belge, 59800 Lille",
    phone: "03 20 84 59 59",
    url: "https://www.tribunal-judiciaire-lille.justice.fr",
    notes: "Référé expulsion"
  },
  "69": {
    name: "Tribunal Judiciaire de Lyon",
    address: "67 rue Servient, 69003 Lyon",
    phone: "04 72 60 70 70",
    url: "https://www.tribunal-judiciaire-lyon.justice.fr",
    notes: "Référé expulsion"
  },
  "75": {
    name: "Tribunal Judiciaire de Paris",
    address: "Parvis du Tribunal de Paris, 75017 Paris",
    phone: "01 44 32 51 51",
    url: "https://www.tribunal-de-paris.justice.fr",
    notes: "JCP pour les référés expulsion"
  },
  "92": {
    name: "Tribunal Judiciaire de Nanterre",
    address: "179-191 avenue Joliot-Curie, 92020 Nanterre Cedex",
    phone: "01 40 97 10 10",
    url: "https://www.tribunal-judiciaire-nanterre.justice.fr",
    notes: "Référé expulsion"
  },
  "93": {
    name: "Tribunal Judiciaire de Bobigny",
    address: "173 avenue Paul Vaillant-Couturier, 93000 Bobigny",
    phone: "01 48 96 20 20",
    url: "https://www.tribunal-judiciaire-bobigny.justice.fr",
    notes: "Référé expulsion"
  },
  "94": {
    name: "Tribunal Judiciaire de Créteil",
    address: "Rue Pasteur Vallery-Radot, 94011 Créteil Cedex",
    phone: "01 49 81 16 00",
    url: "https://www.tribunal-judiciaire-creteil.justice.fr",
    notes: "Référé expulsion"
  },
};

// Noms des départements
const DEPARTMENT_NAMES: Record<string, string> = {
  "01": "Ain",
  "02": "Aisne",
  "03": "Allier",
  "04": "Alpes-de-Haute-Provence",
  "05": "Hautes-Alpes",
  "06": "Alpes-Maritimes",
  "07": "Ardèche",
  "08": "Ardennes",
  "09": "Ariège",
  "10": "Aube",
  "11": "Aude",
  "12": "Aveyron",
  "13": "Bouches-du-Rhône",
  "14": "Calvados",
  "15": "Cantal",
  "16": "Charente",
  "17": "Charente-Maritime",
  "18": "Cher",
  "19": "Corrèze",
  "2A": "Corse-du-Sud",
  "2B": "Haute-Corse",
  "21": "Côte-d'Or",
  "22": "Côtes-d'Armor",
  "23": "Creuse",
  "24": "Dordogne",
  "25": "Doubs",
  "26": "Drôme",
  "27": "Eure",
  "28": "Eure-et-Loir",
  "29": "Finistère",
  "30": "Gard",
  "31": "Haute-Garonne",
  "32": "Gers",
  "33": "Gironde",
  "34": "Hérault",
  "35": "Ille-et-Vilaine",
  "36": "Indre",
  "37": "Indre-et-Loire",
  "38": "Isère",
  "39": "Jura",
  "40": "Landes",
  "41": "Loir-et-Cher",
  "42": "Loire",
  "43": "Haute-Loire",
  "44": "Loire-Atlantique",
  "45": "Loiret",
  "46": "Lot",
  "47": "Lot-et-Garonne",
  "48": "Lozère",
  "49": "Maine-et-Loire",
  "50": "Manche",
  "51": "Marne",
  "52": "Haute-Marne",
  "53": "Mayenne",
  "54": "Meurthe-et-Moselle",
  "55": "Meuse",
  "56": "Morbihan",
  "57": "Moselle",
  "58": "Nièvre",
  "59": "Nord",
  "60": "Oise",
  "61": "Orne",
  "62": "Pas-de-Calais",
  "63": "Puy-de-Dôme",
  "64": "Pyrénées-Atlantiques",
  "65": "Hautes-Pyrénées",
  "66": "Pyrénées-Orientales",
  "67": "Bas-Rhin",
  "68": "Haut-Rhin",
  "69": "Rhône",
  "70": "Haute-Saône",
  "71": "Saône-et-Loire",
  "72": "Sarthe",
  "73": "Savoie",
  "74": "Haute-Savoie",
  "75": "Paris",
  "76": "Seine-Maritime",
  "77": "Seine-et-Marne",
  "78": "Yvelines",
  "79": "Deux-Sèvres",
  "80": "Somme",
  "81": "Tarn",
  "82": "Tarn-et-Garonne",
  "83": "Var",
  "84": "Vaucluse",
  "85": "Vendée",
  "86": "Vienne",
  "87": "Haute-Vienne",
  "88": "Vosges",
  "89": "Yonne",
  "90": "Territoire de Belfort",
  "91": "Essonne",
  "92": "Hauts-de-Seine",
  "93": "Seine-Saint-Denis",
  "94": "Val-de-Marne",
  "95": "Val-d'Oise",
  "971": "Guadeloupe",
  "972": "Martinique",
  "973": "Guyane",
  "974": "La Réunion",
  "976": "Mayotte",
};

// Régions par département
const REGIONS: Record<string, string> = {
  "01": "Auvergne-Rhône-Alpes",
  "03": "Auvergne-Rhône-Alpes",
  "07": "Auvergne-Rhône-Alpes",
  "15": "Auvergne-Rhône-Alpes",
  "26": "Auvergne-Rhône-Alpes",
  "38": "Auvergne-Rhône-Alpes",
  "42": "Auvergne-Rhône-Alpes",
  "43": "Auvergne-Rhône-Alpes",
  "63": "Auvergne-Rhône-Alpes",
  "69": "Auvergne-Rhône-Alpes",
  "73": "Auvergne-Rhône-Alpes",
  "74": "Auvergne-Rhône-Alpes",
  "21": "Bourgogne-Franche-Comté",
  "25": "Bourgogne-Franche-Comté",
  "39": "Bourgogne-Franche-Comté",
  "58": "Bourgogne-Franche-Comté",
  "70": "Bourgogne-Franche-Comté",
  "71": "Bourgogne-Franche-Comté",
  "89": "Bourgogne-Franche-Comté",
  "90": "Bourgogne-Franche-Comté",
  "22": "Bretagne",
  "29": "Bretagne",
  "35": "Bretagne",
  "56": "Bretagne",
  "18": "Centre-Val de Loire",
  "28": "Centre-Val de Loire",
  "36": "Centre-Val de Loire",
  "37": "Centre-Val de Loire",
  "41": "Centre-Val de Loire",
  "45": "Centre-Val de Loire",
  "2A": "Corse",
  "2B": "Corse",
  "08": "Grand Est",
  "10": "Grand Est",
  "51": "Grand Est",
  "52": "Grand Est",
  "54": "Grand Est",
  "55": "Grand Est",
  "57": "Grand Est",
  "67": "Grand Est",
  "68": "Grand Est",
  "88": "Grand Est",
  "02": "Hauts-de-France",
  "59": "Hauts-de-France",
  "60": "Hauts-de-France",
  "62": "Hauts-de-France",
  "80": "Hauts-de-France",
  "75": "Île-de-France",
  "77": "Île-de-France",
  "78": "Île-de-France",
  "91": "Île-de-France",
  "92": "Île-de-France",
  "93": "Île-de-France",
  "94": "Île-de-France",
  "95": "Île-de-France",
  "14": "Normandie",
  "27": "Normandie",
  "50": "Normandie",
  "61": "Normandie",
  "76": "Normandie",
  "16": "Nouvelle-Aquitaine",
  "17": "Nouvelle-Aquitaine",
  "19": "Nouvelle-Aquitaine",
  "23": "Nouvelle-Aquitaine",
  "24": "Nouvelle-Aquitaine",
  "33": "Nouvelle-Aquitaine",
  "40": "Nouvelle-Aquitaine",
  "47": "Nouvelle-Aquitaine",
  "64": "Nouvelle-Aquitaine",
  "79": "Nouvelle-Aquitaine",
  "86": "Nouvelle-Aquitaine",
  "87": "Nouvelle-Aquitaine",
  "09": "Occitanie",
  "11": "Occitanie",
  "12": "Occitanie",
  "30": "Occitanie",
  "31": "Occitanie",
  "32": "Occitanie",
  "34": "Occitanie",
  "46": "Occitanie",
  "48": "Occitanie",
  "65": "Occitanie",
  "66": "Occitanie",
  "81": "Occitanie",
  "82": "Occitanie",
  "44": "Pays de la Loire",
  "49": "Pays de la Loire",
  "53": "Pays de la Loire",
  "72": "Pays de la Loire",
  "85": "Pays de la Loire",
  "04": "Provence-Alpes-Côte d'Azur",
  "05": "Provence-Alpes-Côte d'Azur",
  "06": "Provence-Alpes-Côte d'Azur",
  "13": "Provence-Alpes-Côte d'Azur",
  "83": "Provence-Alpes-Côte d'Azur",
  "84": "Provence-Alpes-Côte d'Azur",
  "971": "Guadeloupe",
  "972": "Martinique",
  "973": "Guyane",
  "974": "La Réunion",
  "976": "Mayotte",
};

/**
 * Extrait le code département d'un code postal
 * Gère les DROM (3 chiffres) et métropole (2 chiffres)
 */
export function getDepartmentFromPostalCode(postalCode: string): string {
  if (!postalCode || postalCode.length < 2) return "00";
  
  // Corse
  if (postalCode.startsWith("20")) {
    const third = postalCode[2];
    return third === "0" || third === "1" ? "2A" : "2B";
  }
  
  // DROM (97x)
  if (postalCode.startsWith("97")) {
    return postalCode.substring(0, 3);
  }
  
  // Métropole
  return postalCode.substring(0, 2);
}

/**
 * Récupère tous les contacts utiles pour un département
 */
export function getContactsForDepartment(departmentCode: string): DepartmentContacts {
  const deptCode = departmentCode.toUpperCase();
  const deptName = DEPARTMENT_NAMES[deptCode] || `Département ${deptCode}`;
  const region = REGIONS[deptCode] || "France";
  
  // Préfecture (avec fallback générique)
  const prefectureData = PREFECTURES[deptCode] || {
    name: `Préfecture ${deptName ? "de " + deptName : ""}`,
    url: `https://www.${deptCode.toLowerCase()}.gouv.fr`,
    notes: "Rechercher sur le site officiel de votre préfecture"
  };
  
  // ADIL (peut être null si pas de données)
  const adilData = ADILS[deptCode];
  
  // Tribunal
  const tribunalData = TRIBUNAUX[deptCode] || {
    name: `Tribunal Judiciaire de ${deptName}`,
    url: "https://www.justice.fr/recherche/annuaires",
    notes: "Trouver votre tribunal sur justice.fr"
  };
  
  return {
    department_code: deptCode,
    department_name: deptName,
    region,
    
    prefecture: {
      role: "Préfecture",
      ...prefectureData,
      name: prefectureData.name || `Préfecture de ${deptName}`,
    },
    
    adil: adilData ? {
      role: "ADIL (Conseil juridique gratuit)",
      ...adilData,
      name: adilData.name || `ADIL de ${deptName}`,
    } : null,
    
    tribunal_judiciaire: {
      role: "Tribunal Judiciaire",
      ...tribunalData,
      name: tribunalData.name || `Tribunal Judiciaire de ${deptName}`,
    },
    
    commissariat_principal: {
      role: "Commissariat / Gendarmerie",
      name: `Commissariat de ${deptName}`,
      phone: "17",
      url: "https://www.service-public.fr/particuliers/vosdroits/R13959",
      notes: "Appeler le 17 ou trouver le commissariat le plus proche"
    },
    
    emergency_contacts: [
      {
        role: "Police / Gendarmerie (Urgence)",
        name: "Numéro d'urgence",
        phone: "17",
        notes: "En cas de flagrant délit ou menace immédiate"
      },
      {
        role: "Numéro européen",
        name: "Urgences",
        phone: "112",
        notes: "Fonctionne partout en Europe"
      },
      {
        role: "SAMU Social",
        name: "Hébergement d'urgence",
        phone: "115",
        notes: "Si vous êtes à la rue suite à une expulsion"
      },
      {
        role: "Plateforme anti-squat",
        name: "Ma Sécurité",
        url: "https://www.masecurite.interieur.gouv.fr",
        notes: "Signalement et conseils du Ministère de l'Intérieur"
      }
    ]
  };
}

/**
 * Vérifie si un département a une ADIL
 */
export function hasADIL(departmentCode: string): boolean {
  return departmentCode in ADILS;
}

/**
 * Retourne l'URL de l'ANIL pour trouver l'ADIL la plus proche
 */
export function getANILUrl(): string {
  return "https://www.anil.org/lanil-et-les-adil/votre-adil/";
}







