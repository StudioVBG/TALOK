/**
 * Helpers purs partagés entre la route /api/scrape et ses tests unitaires.
 *
 * Ne pas mettre ici les fonctions qui dépendent de cheerio ($), de fetch ou
 * de Supabase : elles restent dans route.ts. Ici uniquement de la logique
 * déterministe (validation SSRF, parsing texte, lookups CP/Ville, sanitizers
 * numériques) — testable sans réseau ni DOM.
 */

// ============================================
// PROTECTION SSRF - SEC-002
// ============================================

export const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  // Metadata endpoints cloud
  "169.254.169.254", // AWS/GCP/Azure metadata
  "metadata.google.internal",
  "metadata.google",
  "metadata",
];

export const BLOCKED_IP_RANGES = [
  /^10\./,                          // Private 10.x.x.x
  /^172\.(1[6-9]|2[0-9]|3[01])\./,  // Private 172.16-31.x.x
  /^192\.168\./,                    // Private 192.168.x.x
  /^127\./,                         // Loopback
  /^169\.254\./,                    // Link-local
  /^0\./,                           // Reserved
  /^fc00:/i,                        // IPv6 private
  /^fe80:/i,                        // IPv6 link-local
];

export const ALLOWED_PROTOCOLS = ["http:", "https:"];

export const ALLOWED_DOMAINS = [
  // Sites d'annonces immobilières
  "leboncoin.fr",
  "www.leboncoin.fr",
  "seloger.com",
  "www.seloger.com",
  "bellesdemeures.com",
  "www.bellesdemeures.com",
  "pap.fr",
  "www.pap.fr",
  "logic-immo.com",
  "www.logic-immo.com",
  "bienici.com",
  "www.bienici.com",
  // Agences immobilières
  "orpi.com",
  "www.orpi.com",
  "century21.fr",
  "www.century21.fr",
  "laforet.com",
  "www.laforet.com",
  "guy-hoquet.com",
  "www.guy-hoquet.com",
  "stephane-plaza.com",
  "www.stephane-plaza.com",
  // Agrégateurs
  "figaro.fr",
  "immobilier.lefigaro.fr",
  "explorimmo.com",
  "www.explorimmo.com",
];

/**
 * Valide qu'une URL est autorisée (anti-SSRF).
 */
export function isUrlAllowed(url: string): { allowed: boolean; reason?: string } {
  try {
    const urlObj = new URL(url);

    if (!ALLOWED_PROTOCOLS.includes(urlObj.protocol)) {
      return { allowed: false, reason: `Protocole non autorisé: ${urlObj.protocol}` };
    }

    const hostname = urlObj.hostname.toLowerCase();

    if (BLOCKED_HOSTS.includes(hostname)) {
      return { allowed: false, reason: "Host bloqué" };
    }

    for (const range of BLOCKED_IP_RANGES) {
      if (range.test(hostname)) {
        return { allowed: false, reason: "IP privée bloquée" };
      }
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some(
      (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
    );

    if (!isAllowedDomain) {
      return {
        allowed: false,
        reason: `Domaine non autorisé: ${hostname}. Seuls les sites d'annonces immobilières sont autorisés.`,
      };
    }

    return { allowed: true };
  } catch {
    return { allowed: false, reason: "Format d'URL invalide" };
  }
}

// ============================================
// TYPES
// ============================================

export interface ExtractionQuality {
  source: string;
  score: number;
  details: string[];
}

export interface ExtractedData {
  titre: string;
  description: string;
  loyer_hc: number | null;
  loyer_cc: number | null;
  charges: number | null;
  surface: number | null;
  nb_pieces: number | null;
  nb_chambres: number | null;
  type: string;
  code_postal: string | null;
  ville: string | null;
  adresse: string | null;
  adresse_complete: string | null;
  meuble: boolean | null;
  dpe_classe_energie: string | null;
  dpe_ges: string | null;
  dpe_valeur: number | null;
  chauffage_type: string | null;
  chauffage_mode: string | null;
  etage: number | null;
  nb_etages: number | null;
  ascenseur: boolean | null;
  balcon: boolean;
  terrasse: boolean;
  parking_inclus: boolean;
  cave: boolean;
  climatisation: boolean;
  jardin: boolean;
  piscine: boolean;
  annee_construction: number | null;
  photos: string[];
  cover_url: string | null;
  visite_virtuelle_url: string | null;
  source_url: string;
  source_site: string;
  extraction_quality: ExtractionQuality;
}

// ============================================
// MAPPINGS CODES POSTAUX <-> VILLES
// ============================================

export const CP_TO_CITY: Record<string, string> = {
  // Martinique
  "97200": "Fort-de-France", "97220": "La Trinité", "97221": "Le Carbet",
  "97222": "Case-Pilote", "97223": "Le Diamant", "97224": "Ducos",
  "97225": "Le Marigot", "97226": "Le Morne-Rouge", "97227": "Sainte-Anne",
  "97228": "Sainte-Luce", "97229": "Les Trois-Îlets", "97230": "Sainte-Marie",
  "97231": "Le Robert", "97232": "Le Lamentin", "97233": "Schoelcher",
  "97240": "Le François", "97250": "Fonds-Saint-Denis", "97260": "Le Morne-Rouge",
  "97270": "Saint-Esprit", "97280": "Le Vauclin", "97290": "Le Marin",
  // Guadeloupe
  "97100": "Basse-Terre", "97110": "Pointe-à-Pitre", "97122": "Baie-Mahault",
  "97139": "Les Abymes", "97160": "Le Moule", "97170": "Petit-Bourg",
  "97180": "Sainte-Anne", "97190": "Le Gosier",
  "97111": "Morne-à-l'Eau", "97113": "Gourbeyre", "97114": "Trois-Rivières",
  "97115": "Sainte-Rose", "97116": "Pointe-Noire", "97117": "Port-Louis",
  "97118": "Saint-François", "97120": "Saint-Claude", "97123": "Baillif",
  "97125": "Bouillante", "97126": "Deshaies", "97128": "Goyave",
  "97129": "Lamentin", "97130": "Capesterre-Belle-Eau", "97131": "Petit-Canal",
  "97140": "Capesterre-de-Marie-Galante", "97150": "Saint-Martin",
  // Réunion
  "97400": "Saint-Denis", "97410": "Saint-Pierre", "97420": "Le Port",
  "97430": "Le Tampon", "97440": "Saint-André", "97460": "Saint-Paul",
  "97411": "Bois-de-Nèfles Saint-Paul", "97412": "Bras-Panon", "97413": "Cilaos",
  "97414": "Entre-Deux", "97415": "Saint-Paul", "97416": "La Chaloupe Saint-Leu",
  "97417": "La Montagne Saint-Denis", "97418": "Plaine des Cafres",
  "97419": "La Possession", "97421": "La Rivière Saint-Louis",
  "97422": "La Saline", "97423": "Le Guillaume Saint-Paul",
  "97424": "Le Piton Saint-Leu", "97425": "Les Avirons",
  "97426": "Trois-Bassins", "97427": "L'Étang-Salé", "97429": "Petite-Île",
  "97431": "Plaine des Palmistes", "97432": "Ravine des Cabris",
  "97433": "Salazie", "97434": "Saint-Gilles-les-Bains",
  "97435": "Saint-Gilles-les-Hauts", "97436": "Saint-Leu",
  "97437": "Sainte-Anne", "97438": "Sainte-Marie",
  "97439": "Sainte-Rose", "97441": "Sainte-Suzanne",
  "97442": "Saint-Philippe", "97450": "Saint-Louis",
  "97470": "Saint-Benoît", "97480": "Saint-Joseph", "97490": "Sainte-Clotilde",
  // Guyane
  "97300": "Cayenne", "97310": "Kourou", "97320": "Saint-Laurent-du-Maroni",
  "97311": "Roura", "97312": "Saint-Élie", "97313": "Saül",
  "97314": "Régina", "97315": "Sinnamary", "97316": "Iracoubo",
  "97317": "Mana", "97318": "Saint-Georges-de-l'Oyapock",
  "97319": "Awala-Yalimapo", "97330": "Camopi", "97340": "Grand-Santi",
  "97350": "Maripasoula", "97351": "Matoury", "97352": "Macouria",
  "97353": "Montsinéry-Tonnegrande", "97354": "Rémire-Montjoly",
  "97355": "Apatou", "97356": "Papaichton", "97360": "Mana",
  "97370": "Maripasoula", "97380": "Tonate",
  // Mayotte
  "97600": "Mamoudzou", "97605": "Pamandzi", "97610": "Dzaoudzi",
  "97615": "Petite-Terre", "97620": "Mtsamboro", "97625": "Bandraboua",
  "97630": "Acoua", "97640": "Sada", "97650": "Bandrele",
  "97660": "Bouéni", "97670": "Chirongui", "97680": "Tsingoni",
  "97690": "Koungou",
  // Saint-Pierre-et-Miquelon
  "97500": "Saint-Pierre",
  // Métropole — Paris arrondissements complets
  "75001": "Paris", "75002": "Paris", "75003": "Paris", "75004": "Paris",
  "75005": "Paris", "75006": "Paris", "75007": "Paris", "75008": "Paris",
  "75009": "Paris", "75010": "Paris", "75011": "Paris", "75012": "Paris",
  "75013": "Paris", "75014": "Paris", "75015": "Paris", "75016": "Paris",
  "75017": "Paris", "75018": "Paris", "75019": "Paris", "75020": "Paris",
  "75116": "Paris",
  // Lyon arrondissements complets
  "69001": "Lyon", "69002": "Lyon", "69003": "Lyon", "69004": "Lyon",
  "69005": "Lyon", "69006": "Lyon", "69007": "Lyon", "69008": "Lyon",
  "69009": "Lyon",
  // Marseille arrondissements complets
  "13001": "Marseille", "13002": "Marseille", "13003": "Marseille",
  "13004": "Marseille", "13005": "Marseille", "13006": "Marseille",
  "13007": "Marseille", "13008": "Marseille", "13009": "Marseille",
  "13010": "Marseille", "13011": "Marseille", "13012": "Marseille",
  "13013": "Marseille", "13014": "Marseille", "13015": "Marseille",
  "13016": "Marseille",
  // Top 30 villes France
  "31000": "Toulouse", "33000": "Bordeaux", "44000": "Nantes",
  "59000": "Lille", "67000": "Strasbourg", "34000": "Montpellier",
  "35000": "Rennes", "06000": "Nice", "76000": "Rouen",
  "21000": "Dijon", "38000": "Grenoble", "37000": "Tours",
  "63000": "Clermont-Ferrand", "49000": "Angers", "29200": "Brest",
  "42000": "Saint-Étienne", "30000": "Nîmes", "57000": "Metz",
  "83000": "Toulon", "76600": "Le Havre", "87000": "Limoges",
  "68100": "Mulhouse", "51100": "Reims", "66000": "Perpignan",
  "64000": "Pau", "14000": "Caen", "72000": "Le Mans",
  "45000": "Orléans", "25000": "Besançon", "84000": "Avignon",
  "41000": "Blois", "80000": "Amiens", "86000": "Poitiers",
  "74000": "Annecy", "73000": "Chambéry", "85000": "La Roche-sur-Yon",
  "46000": "Cahors", "47000": "Agen", "11000": "Carcassonne",
  "12000": "Rodez", "65000": "Tarbes", "40000": "Mont-de-Marsan",
  // Banlieue parisienne (top communes)
  "92100": "Boulogne-Billancourt", "92200": "Neuilly-sur-Seine",
  "92300": "Levallois-Perret", "92400": "Courbevoie", "92500": "Rueil-Malmaison",
  "92600": "Asnières-sur-Seine", "92700": "Colombes", "92800": "Puteaux",
  "93100": "Montreuil", "93200": "Saint-Denis", "93300": "Aubervilliers",
  "94100": "Saint-Maur-des-Fossés", "94200": "Ivry-sur-Seine",
  "94300": "Vincennes", "94400": "Vitry-sur-Seine",
  "95100": "Argenteuil", "95200": "Sarcelles",
  "78000": "Versailles", "78100": "Saint-Germain-en-Laye",
  "77100": "Meaux", "77200": "Torcy", "77300": "Fontainebleau",
  "91100": "Corbeil-Essonnes", "91200": "Athis-Mons",
};

export const CITY_TO_CP: Record<string, string> = {
  // Martinique
  "fort-de-france": "97200", "la trinite": "97220", "la trinité": "97220",
  "le carbet": "97221", "case-pilote": "97222", "le diamant": "97223",
  "ducos": "97224", "le marigot": "97225", "sainte-anne": "97227",
  "sainte-luce": "97228", "les trois-ilets": "97229", "sainte-marie": "97230",
  "le robert": "97231", "le lamentin": "97232", "lamentin": "97232",
  "schoelcher": "97233", "le francois": "97240", "le françois": "97240",
  "saint-esprit": "97270", "le vauclin": "97280", "le marin": "97290",
  // Guadeloupe
  "basse-terre": "97100", "pointe-a-pitre": "97110", "baie-mahault": "97122",
  "les abymes": "97139", "le moule": "97160", "le gosier": "97190",
  "morne-a-l'eau": "97111", "gourbeyre": "97113", "trois-rivieres": "97114",
  "sainte-rose": "97115", "pointe-noire": "97116", "port-louis": "97117",
  "saint-francois": "97118", "saint-claude": "97120", "baillif": "97123",
  "bouillante": "97125", "deshaies": "97126", "goyave": "97128",
  "capesterre-belle-eau": "97130", "petit-canal": "97131",
  "saint-martin": "97150",
  // Réunion
  "saint-denis": "97400", "saint-pierre": "97410", "le port": "97420",
  "le tampon": "97430", "saint-andre": "97440", "saint-paul": "97460",
  "saint-louis": "97450", "saint-benoit": "97470", "saint-joseph": "97480",
  "saint-leu": "97436", "sainte-suzanne": "97441", "salazie": "97433",
  "cilaos": "97413", "entre-deux": "97414", "petite-ile": "97429",
  "l'etang-sale": "97427", "les avirons": "97425", "trois-bassins": "97426",
  "saint-philippe": "97442", "la possession": "97419",
  "bras-panon": "97412", "plaine des palmistes": "97431",
  // Guyane
  "cayenne": "97300", "kourou": "97310", "saint-laurent-du-maroni": "97320",
  "matoury": "97351", "macouria": "97352", "remire-montjoly": "97354",
  "apatou": "97355", "maripasoula": "97350", "mana": "97317",
  "sinnamary": "97315", "iracoubo": "97316",
  // Mayotte
  "mamoudzou": "97600", "pamandzi": "97605", "dzaoudzi": "97610",
  "koungou": "97690", "tsingoni": "97680", "sada": "97640",
  "bandrele": "97650", "boueni": "97660", "chirongui": "97670",
  // Saint-Pierre-et-Miquelon
  "miquelon": "97500",
  // Métropole top 40
  "paris": "75000", "lyon": "69000", "marseille": "13000",
  "toulouse": "31000", "bordeaux": "33000", "nantes": "44000",
  "lille": "59000", "strasbourg": "67000", "montpellier": "34000",
  "rennes": "35000", "nice": "06000", "rouen": "76000",
  "dijon": "21000", "grenoble": "38000", "tours": "37000",
  "clermont-ferrand": "63000", "angers": "49000", "brest": "29200",
  "saint-etienne": "42000", "nimes": "30000", "metz": "57000",
  "toulon": "83000", "le havre": "76600", "limoges": "87000",
  "mulhouse": "68100", "reims": "51100", "perpignan": "66000",
  "pau": "64000", "caen": "14000", "le mans": "72000",
  "orleans": "45000", "besancon": "25000", "avignon": "84000",
  "blois": "41000", "amiens": "80000", "poitiers": "86000",
  "annecy": "74000", "chambery": "73000",
  // Banlieue parisienne top
  "boulogne-billancourt": "92100", "neuilly-sur-seine": "92200",
  "levallois-perret": "92300", "courbevoie": "92400",
  "rueil-malmaison": "92500", "asnieres-sur-seine": "92600",
  "colombes": "92700", "puteaux": "92800",
  "montreuil": "93100", "aubervilliers": "93300",
  "saint-maur-des-fosses": "94100", "ivry-sur-seine": "94200",
  "vincennes": "94300", "vitry-sur-seine": "94400",
  "argenteuil": "95100", "sarcelles": "95200",
  "versailles": "78000", "saint-germain-en-laye": "78100",
  "meaux": "77100", "fontainebleau": "77300",
};

// ============================================
// UTILITAIRES
// ============================================

export function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export function findCityFromCP(cp: string): string | null {
  return CP_TO_CITY[cp] || null;
}

export function findCPFromCity(city: string): string | null {
  return CITY_TO_CP[normalizeText(city)] || null;
}

export function detectSourceSite(url: string): string {
  const domain = new URL(url).hostname.toLowerCase();
  if (domain.includes('leboncoin')) return 'leboncoin';
  if (domain.includes('seloger')) return 'seloger';
  if (domain.includes('pap.fr')) return 'pap';
  if (domain.includes('logic-immo')) return 'logic-immo';
  if (domain.includes('bien-ici')) return 'bienici';
  if (domain.includes('orpi')) return 'orpi';
  if (domain.includes('century21')) return 'century21';
  if (domain.includes('laforet')) return 'laforet';
  if (domain.includes('figaro')) return 'figaro';
  return 'generic';
}

export function isValidPhotoUrl(url: string, site: string = 'generic'): boolean {
  if (!url || url.length < 15) return false;
  if (!url.startsWith('http')) return false;

  const excludePatterns = [
    /logo/i, /icon/i, /avatar/i, /favicon/i, /sprite/i, /button/i,
    /badge/i, /banner/i, /tracking/i, /pixel/i, /analytics/i,
    /placeholder/i, /blank/i, /1x1/i, /spacer/i, /transparent/i,
    /\.svg$/i, /\.gif$/i, /loading/i, /spinner/i, /emoji/i,
    /profile/i, /user-avatar/i, /seal/i, /picto/i, /marker/i,
  ];

  if (site === 'leboncoin') {
    excludePatterns.push(/static\.lbc/i, /assets\.lbc/i, /ldlc/i);
  }

  for (const pattern of excludePatterns) {
    if (pattern.test(url)) return false;
  }

  return /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url) ||
         /images?\./i.test(url) ||
         /cdn\./i.test(url) ||
         /photos?\./i.test(url);
}

export function cleanPrice(value: unknown): number | null {
  if (!value) return null;
  const num = parseInt(String(value).replace(/[^\d]/g, ''), 10);
  return (num >= 50 && num <= 50000) ? num : null;
}

export function cleanSurface(value: unknown): number | null {
  if (!value) return null;
  const num = parseInt(String(value).replace(/[^\d]/g, ''), 10);
  return (num >= 5 && num <= 2000) ? num : null;
}

export function cleanRooms(value: unknown): number | null {
  if (!value) return null;
  const num = parseInt(String(value), 10);
  return (num >= 1 && num <= 20) ? num : null;
}

export function cleanDPE(value: unknown): string | null {
  if (!value) return null;
  const letter = String(value).toUpperCase().match(/[A-G]/);
  return letter ? letter[0] : null;
}
