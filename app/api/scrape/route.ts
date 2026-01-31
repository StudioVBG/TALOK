import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { createClient } from "@/lib/supabase/server";
import { ApiError, handleApiError } from "@/lib/helpers/api-error";
import { applyRateLimit } from "@/lib/middleware/rate-limit";

// Force cette route à s'exécuter uniquement côté serveur
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15; // 15 secondes max

// ============================================
// PROTECTION SSRF - SEC-002
// ============================================

/**
 * Hosts bloqués pour prévenir les attaques SSRF
 */
const BLOCKED_HOSTS = [
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

/**
 * Ranges IP privées bloquées
 */
const BLOCKED_IP_RANGES = [
  /^10\./,                          // Private 10.x.x.x
  /^172\.(1[6-9]|2[0-9]|3[01])\./,  // Private 172.16-31.x.x
  /^192\.168\./,                    // Private 192.168.x.x
  /^127\./,                         // Loopback
  /^169\.254\./,                    // Link-local
  /^0\./,                           // Reserved
  /^fc00:/i,                        // IPv6 private
  /^fe80:/i,                        // IPv6 link-local
];

/**
 * Protocoles autorisés
 */
const ALLOWED_PROTOCOLS = ["http:", "https:"];

/**
 * Domaines autorisés (whitelist)
 */
const ALLOWED_DOMAINS = [
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
 * Valide qu'une URL est autorisée (anti-SSRF)
 */
function isUrlAllowed(url: string): { allowed: boolean; reason?: string } {
  try {
    const urlObj = new URL(url);

    // Vérifier le protocole
    if (!ALLOWED_PROTOCOLS.includes(urlObj.protocol)) {
      return { allowed: false, reason: `Protocole non autorisé: ${urlObj.protocol}` };
    }

    const hostname = urlObj.hostname.toLowerCase();

    // Vérifier les hosts bloqués
    if (BLOCKED_HOSTS.includes(hostname)) {
      return { allowed: false, reason: "Host bloqué" };
    }

    // Vérifier les ranges IP privées
    for (const range of BLOCKED_IP_RANGES) {
      if (range.test(hostname)) {
        return { allowed: false, reason: "IP privée bloquée" };
      }
    }

    // Vérifier la whitelist des domaines
    const isAllowedDomain = ALLOWED_DOMAINS.some(
      (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
    );

    if (!isAllowedDomain) {
      return {
        allowed: false,
        reason: `Domaine non autorisé: ${hostname}. Seuls les sites d'annonces immobilières sont autorisés.`
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

interface ExtractedData {
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

interface ExtractionQuality {
  source: string;
  score: number;
  details: string[];
}

// ============================================
// MAPPINGS CODES POSTAUX <-> VILLES
// ============================================

const CP_TO_CITY: Record<string, string> = {
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
  // Réunion
  "97400": "Saint-Denis", "97410": "Saint-Pierre", "97420": "Le Port",
  "97430": "Le Tampon", "97440": "Saint-André", "97460": "Saint-Paul",
  // Guyane
  "97300": "Cayenne", "97310": "Kourou", "97320": "Saint-Laurent-du-Maroni",
  // Métropole principales
  "75001": "Paris", "75002": "Paris", "75003": "Paris", "75004": "Paris",
  "69001": "Lyon", "69002": "Lyon", "69003": "Lyon",
  "13001": "Marseille", "13002": "Marseille",
  "31000": "Toulouse", "33000": "Bordeaux", "44000": "Nantes",
  "59000": "Lille", "67000": "Strasbourg", "34000": "Montpellier",
  "35000": "Rennes", "06000": "Nice",
};

const CITY_TO_CP: Record<string, string> = {
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
  // Réunion
  "saint-denis": "97400", "saint-pierre": "97410", "le port": "97420",
  "le tampon": "97430", "saint-andre": "97440", "saint-paul": "97460",
  // Métropole
  "paris": "75000", "lyon": "69000", "marseille": "13000",
  "toulouse": "31000", "bordeaux": "33000", "nantes": "44000",
  "lille": "59000", "strasbourg": "67000", "montpellier": "34000",
  "rennes": "35000", "nice": "06000",
};

// ============================================
// UTILITAIRES
// ============================================

function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function findCityFromCP(cp: string): string | null {
  return CP_TO_CITY[cp] || null;
}

function findCPFromCity(city: string): string | null {
  return CITY_TO_CP[normalizeText(city)] || null;
}

function detectSourceSite(url: string): string {
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

function isValidPhotoUrl(url: string, site: string = 'generic'): boolean {
  if (!url || url.length < 15) return false;
  if (!url.startsWith('http')) return false;
  
  // Exclusions globales
  const excludePatterns = [
    /logo/i, /icon/i, /avatar/i, /favicon/i, /sprite/i, /button/i,
    /badge/i, /banner/i, /tracking/i, /pixel/i, /analytics/i,
    /placeholder/i, /blank/i, /1x1/i, /spacer/i, /transparent/i,
    /\.svg$/i, /\.gif$/i, /loading/i, /spinner/i, /emoji/i,
    /profile/i, /user-avatar/i, /seal/i, /picto/i, /marker/i,
  ];
  
  // Exclusions par site
  if (site === 'leboncoin') {
    excludePatterns.push(/static\.lbc/i, /assets\.lbc/i, /ldlc/i);
  }
  
  for (const pattern of excludePatterns) {
    if (pattern.test(url)) return false;
  }
  
  // Doit être une vraie image
  return /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url) || 
         /images?\./i.test(url) || 
         /cdn\./i.test(url) ||
         /photos?\./i.test(url);
}

function cleanPrice(value: any): number | null {
  if (!value) return null;
  const num = parseInt(String(value).replace(/[^\d]/g, ''), 10);
  return (num >= 50 && num <= 50000) ? num : null;
}

function cleanSurface(value: any): number | null {
  if (!value) return null;
  const num = parseInt(String(value).replace(/[^\d]/g, ''), 10);
  return (num >= 5 && num <= 2000) ? num : null;
}

function cleanRooms(value: any): number | null {
  if (!value) return null;
  const num = parseInt(String(value), 10);
  return (num >= 1 && num <= 20) ? num : null;
}

function cleanDPE(value: any): string | null {
  if (!value) return null;
  const letter = String(value).toUpperCase().match(/[A-G]/);
  return letter ? letter[0] : null;
}

// ============================================
// EXTRACTEUR LEBONCOIN (spécialisé)
// ============================================

function extractLeBonCoin($: cheerio.CheerioAPI): Partial<ExtractedData> | null {
  const result: Partial<ExtractedData> = { source_site: 'leboncoin' };
  let score = 0;
  const details: string[] = [];
  
  // 1. Chercher __NEXT_DATA__ (source la plus fiable)
  const nextDataScript = $('#__NEXT_DATA__').html();
  if (nextDataScript) {
    try {
      const nextData = JSON.parse(nextDataScript);
      const pageProps = nextData?.props?.pageProps;
      
      // Trouver l'annonce
      const ad = pageProps?.ad || pageProps?.adview || pageProps?.listing;
      
      if (ad) {
        details.push('✅ __NEXT_DATA__ trouvé');
        score += 30;
        
        // Titre & Description
        result.titre = ad.subject || ad.title || "";
        result.description = ad.body || ad.description || "";
        
        // Prix
        if (ad.price) {
          const price = Array.isArray(ad.price) ? ad.price[0] : ad.price;
          result.loyer_hc = cleanPrice(price);
          if (result.loyer_hc) { score += 10; details.push('✅ Prix trouvé'); }
        }
        
        // Localisation
        if (ad.location) {
          result.code_postal = ad.location.zipcode || ad.location.postal_code || null;
          result.ville = ad.location.city || ad.location.city_label || null;
          if (result.ville) { score += 10; details.push('✅ Ville trouvée'); }
        }
        
        // Attributs
        const attrs: Record<string, any> = {};
        if (Array.isArray(ad.attributes)) {
          ad.attributes.forEach((a: any) => {
            if (a.key) {
              attrs[a.key] = a.value;
              if (a.value_label) attrs[`${a.key}_label`] = a.value_label;
            }
          });
        }
        
        // Surface
        result.surface = cleanSurface(attrs.square || attrs.surface || attrs.living_area);
        if (result.surface) { score += 10; details.push('✅ Surface trouvée'); }
        
        // Pièces
        result.nb_pieces = cleanRooms(attrs.rooms || attrs.nb_rooms);
        result.nb_chambres = cleanRooms(attrs.bedrooms || attrs.nb_bedrooms);
        if (result.nb_pieces) { score += 5; details.push('✅ Pièces trouvées'); }
        
        // DPE
        result.dpe_classe_energie = cleanDPE(attrs.energy_rate || attrs.dpe);
        result.dpe_ges = cleanDPE(attrs.ges);
        if (result.dpe_classe_energie) { score += 5; details.push('✅ DPE trouvé'); }
        
        // Meublé
        if (attrs.furnished !== undefined) {
          result.meuble = attrs.furnished === 1 || attrs.furnished === true || attrs.furnished === "1";
          details.push(`✅ Meublé: ${result.meuble}`);
        }
        
        // Chauffage
        const heatingType = attrs.heating_type || attrs.heating || attrs.energy_heating;
        if (heatingType) {
          const ht = String(heatingType).toLowerCase();
          if (ht.includes('gaz')) result.chauffage_type = 'gaz';
          else if (ht.includes('electr') || ht.includes('élec')) result.chauffage_type = 'electrique';
          else if (ht.includes('fioul')) result.chauffage_type = 'fioul';
          else if (ht.includes('bois') || ht.includes('granul')) result.chauffage_type = 'bois';
          else if (ht.includes('pompe') || ht.includes('pac')) result.chauffage_type = 'pac';
          if (result.chauffage_type) { score += 5; details.push('✅ Chauffage trouvé'); }
        }
        
        const heatingMode = attrs.heating_mode;
        if (heatingMode) {
          const hm = String(heatingMode).toLowerCase();
          if (hm.includes('collectif')) result.chauffage_mode = 'collectif';
          else if (hm.includes('individuel')) result.chauffage_mode = 'individuel';
        }
        
        // Étage
        result.etage = attrs.floor ? parseInt(attrs.floor, 10) : null;
        result.nb_etages = attrs.nb_floors ? parseInt(attrs.nb_floors, 10) : null;
        
        // Équipements
        result.ascenseur = attrs.elevator === 1 || attrs.elevator === true;
        result.balcon = attrs.balcony === 1;
        result.terrasse = attrs.terrace === 1;
        result.parking_inclus = attrs.parking === 1 || (attrs.nb_parking && parseInt(attrs.nb_parking) > 0);
        result.cave = attrs.cellar === 1;
        
        // Photos depuis __NEXT_DATA__
        if (ad.images && Array.isArray(ad.images)) {
          result.photos = [];
          ad.images.forEach((img: any) => {
            const url = img.urls?.large || img.urls?.default || img.url || 
                       (typeof img === 'string' ? img : null);
            if (url && isValidPhotoUrl(url, 'leboncoin')) {
              result.photos!.push(url);
            }
          });
          if (result.photos.length > 0) {
            score += 15;
            details.push(`✅ ${result.photos.length} photos trouvées`);
          }
        }
        
        // Visite virtuelle
        result.visite_virtuelle_url = ad.virtual_tour_url || ad.virtual_visit_url || null;
        if (result.visite_virtuelle_url) {
          details.push('✅ Visite virtuelle trouvée');
        }
      }
    } catch (e) {
      details.push('❌ Erreur parsing __NEXT_DATA__');
    }
  }
  
  // 2. Fallback: Sélecteurs HTML spécifiques LeBonCoin
  if (!result.titre) {
    result.titre = $('h1[data-qa-id="adview_title"]').text().trim() ||
                   $('[data-qa-id="adview_spotlight_description_container"] h1').text().trim() ||
                   $('h1').first().text().trim();
  }
  
  if (!result.loyer_hc) {
    const priceText = $('[data-qa-id="adview_price"]').text() ||
                      $('[data-test-id="price"]').text() ||
                      $('[class*="Price"]').first().text();
    result.loyer_hc = cleanPrice(priceText);
    if (result.loyer_hc) details.push('✅ Prix HTML');
  }
  
  if (!result.description) {
    result.description = $('[data-qa-id="adview_description_container"]').text().trim() ||
                         $('[data-qa-id="adview_description"]').text().trim();
  }
  
  // Photos HTML fallback
  if (!result.photos || result.photos.length === 0) {
    result.photos = [];
    $('[data-qa-id="adview_spotlight_container"] img, [data-qa-id="gallery"] img').each((_, el) => {
      const url = $(el).attr('data-src') || $(el).attr('src');
      if (url && isValidPhotoUrl(url, 'leboncoin') && !result.photos!.includes(url)) {
        result.photos!.push(url);
      }
    });
  }
  
  result.extraction_quality = {
    source: 'leboncoin',
    score: Math.min(100, score),
    details,
  };
  
  return result;
}

// ============================================
// EXTRACTEUR SELOGER (spécialisé)
// ============================================

function extractSeLoger($: cheerio.CheerioAPI): Partial<ExtractedData> | null {
  const result: Partial<ExtractedData> = { source_site: 'seloger' };
  const details: string[] = [];
  let score = 0;
  
  // SeLoger utilise souvent des data-attributes spécifiques
  result.titre = $('h1.Title__TitleContainer, h1[class*="Title"]').text().trim() ||
                 $('h1').first().text().trim();
  
  // Prix
  const priceEl = $('[class*="Price"], [data-test="price"]').first();
  if (priceEl.length) {
    result.loyer_hc = cleanPrice(priceEl.text());
    if (result.loyer_hc) { score += 10; details.push('✅ Prix'); }
  }
  
  // Caractéristiques
  $('[class*="Criterion"], [class*="Feature"], .criteria-item').each((_, el) => {
    const text = $(el).text().toLowerCase();
    
    if (text.includes('m²') || text.includes('m2')) {
      const match = text.match(/(\d+)/);
      if (match && !result.surface) {
        result.surface = cleanSurface(match[1]);
        if (result.surface) { score += 10; details.push('✅ Surface'); }
      }
    }
    
    if (text.includes('pièce')) {
      const match = text.match(/(\d+)/);
      if (match && !result.nb_pieces) {
        result.nb_pieces = cleanRooms(match[1]);
        if (result.nb_pieces) { score += 5; details.push('✅ Pièces'); }
      }
    }
    
    if (text.includes('chambre')) {
      const match = text.match(/(\d+)/);
      if (match && !result.nb_chambres) {
        result.nb_chambres = cleanRooms(match[1]);
      }
    }
  });
  
  // Localisation
  const locationText = $('[class*="Locality"], [class*="Address"]').text();
  const cpMatch = locationText.match(/\b(97\d{3}|0[1-9]\d{3}|[1-9]\d{4})\b/);
  if (cpMatch) {
    result.code_postal = cpMatch[1];
    result.ville = findCityFromCP(result.code_postal);
    score += 10;
    details.push('✅ Localisation');
  }
  
  // DPE
  const dpeMatch = $('[class*="dpe"], [class*="DPE"]').text().match(/[A-G]/i);
  if (dpeMatch) {
    result.dpe_classe_energie = dpeMatch[0].toUpperCase();
    score += 5;
    details.push('✅ DPE');
  }
  
  // Description
  result.description = $('[class*="Description"], [data-test="description"]').text().trim();
  
  // Photos
  result.photos = [];
  $('[class*="Gallery"] img, [class*="Carousel"] img, [class*="Slider"] img').each((_, el) => {
    const url = $(el).attr('data-src') || $(el).attr('src');
    if (url && isValidPhotoUrl(url, 'seloger') && !result.photos!.includes(url)) {
      result.photos!.push(url);
    }
  });
  if (result.photos.length > 0) {
    score += 15;
    details.push(`✅ ${result.photos.length} photos`);
  }
  
  result.extraction_quality = {
    source: 'seloger',
    score: Math.min(100, score),
    details,
  };
  
  return result;
}

// ============================================
// EXTRACTEUR PAP (spécialisé)
// ============================================

function extractPAP($: cheerio.CheerioAPI): Partial<ExtractedData> | null {
  const result: Partial<ExtractedData> = { source_site: 'pap' };
  const details: string[] = [];
  let score = 0;
  
  result.titre = $('h1.item-title, .annonce-titre h1').text().trim() ||
                 $('h1').first().text().trim();
  
  // Prix
  const priceText = $('.item-price, .annonce-prix').text();
  result.loyer_hc = cleanPrice(priceText);
  if (result.loyer_hc) { score += 10; details.push('✅ Prix'); }
  
  // Caractéristiques
  $('.item-tags li, .annonce-caracteristiques li').each((_, el) => {
    const text = $(el).text().toLowerCase();
    
    if (text.includes('m²') && !result.surface) {
      result.surface = cleanSurface(text);
      if (result.surface) { score += 10; details.push('✅ Surface'); }
    }
    
    if (text.includes('pièce') && !result.nb_pieces) {
      result.nb_pieces = cleanRooms(text);
      if (result.nb_pieces) { score += 5; details.push('✅ Pièces'); }
    }
    
    if (text.includes('chambre') && !result.nb_chambres) {
      result.nb_chambres = cleanRooms(text);
    }
    
    if (text.includes('meublé')) result.meuble = true;
    if (text.includes('ascenseur')) result.ascenseur = true;
    if (text.includes('parking') || text.includes('garage')) result.parking_inclus = true;
    if (text.includes('balcon')) result.balcon = true;
    if (text.includes('terrasse')) result.terrasse = true;
    if (text.includes('cave')) result.cave = true;
  });
  
  // Localisation
  const locationText = $('.item-geoloc, .annonce-localisation').text();
  const cpMatch = locationText.match(/\b(97\d{3}|0[1-9]\d{3}|[1-9]\d{4})\b/);
  if (cpMatch) {
    result.code_postal = cpMatch[1];
    result.ville = findCityFromCP(result.code_postal);
    score += 10;
    details.push('✅ Localisation');
  }
  
  // Description
  result.description = $('.item-description, .annonce-description').text().trim();
  
  // Photos
  result.photos = [];
  $('.owl-carousel img, .gallery img, .slider img').each((_, el) => {
    const url = $(el).attr('data-src') || $(el).attr('src');
    if (url && isValidPhotoUrl(url, 'pap') && !result.photos!.includes(url)) {
      result.photos!.push(url);
    }
  });
  if (result.photos.length > 0) {
    score += 15;
    details.push(`✅ ${result.photos.length} photos`);
  }
  
  result.extraction_quality = {
    source: 'pap',
    score: Math.min(100, score),
    details,
  };
  
  return result;
}

// ============================================
// EXTRACTEUR JSON-LD (Schema.org)
// ============================================

function extractJsonLd($: cheerio.CheerioAPI): Partial<ExtractedData> | null {
  let result: Partial<ExtractedData> | null = null;
  
  $('script[type="application/ld+json"]').each((_, el) => {
    if (result && result.loyer_hc) return; // Déjà trouvé du contenu riche
    
    try {
      const content = $(el).html();
      if (!content) return;
      
      let parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        parsed = parsed.find(p => 
          ['Product', 'Apartment', 'House', 'RealEstateListing', 'Residence', 'SingleFamilyResidence'].includes(p['@type'])
        );
      }
      
      if (!parsed || !parsed['@type']) return;
      
      result = result || {};
      
      result.titre = parsed.name || result.titre;
      result.description = parsed.description || result.description;
      
      // Surface
      if (parsed.floorSize) {
        const val = parsed.floorSize.value || parsed.floorSize;
        result.surface = cleanSurface(val);
      }
      
      // Pièces
      result.nb_pieces = cleanRooms(parsed.numberOfRooms);
      
      // Prix
      if (parsed.offers?.price) {
        result.loyer_hc = cleanPrice(parsed.offers.price);
      }
      
      // Adresse
      if (parsed.address) {
        result.ville = parsed.address.addressLocality || null;
        result.code_postal = parsed.address.postalCode || null;
        result.adresse = parsed.address.streetAddress || null;
      }
      
      // Photos
      if (parsed.image) {
        result.photos = result.photos || [];
        const images = Array.isArray(parsed.image) ? parsed.image : [parsed.image];
        images.forEach((img: any) => {
          const url = typeof img === 'string' ? img : img?.url;
          if (url && isValidPhotoUrl(url) && !result!.photos!.includes(url)) {
            result!.photos!.push(url);
          }
        });
      }
      
    } catch (e) {
      // Ignore JSON invalide
    }
  });
  
  if (result) {
    result.extraction_quality = {
      source: 'json-ld',
      score: 50,
      details: ['✅ JSON-LD Schema.org trouvé'],
    };
  }
  
  return result;
}

// ============================================
// EXTRACTEUR MÉTA (OpenGraph)
// ============================================

function extractMeta($: cheerio.CheerioAPI): Partial<ExtractedData> {
  const result: Partial<ExtractedData> = {};
  
  result.titre = $('meta[property="og:title"]').attr("content") || 
                 $("title").text().trim() || "";
  
  result.description = $('meta[property="og:description"]').attr("content") || 
                       $('meta[name="description"]').attr("content") || "";
  
  // Photo de couverture
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (ogImage && isValidPhotoUrl(ogImage)) {
    result.photos = [ogImage];
    result.cover_url = ogImage;
  }
  
  return result;
}

// ============================================
// EXTRACTEUR TEXTE (fallback)
// ============================================

function extractFromText(text: string): Partial<ExtractedData> {
  const result: Partial<ExtractedData> = {};
  const lowerText = text.toLowerCase();
  
  // Prix
  const pricePatterns = [
    /loyer[:\s]+(\d[\d\s]*)\s*€/i,
    /(\d[\d\s]*)\s*€\s*(?:\/\s*mois|par\s*mois|mensuel|cc|hc)/i,
    /prix[:\s]+(\d[\d\s]*)\s*€/i,
  ];
  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.loyer_hc = cleanPrice(match[1]);
      if (result.loyer_hc) break;
    }
  }
  
  // Surface
  const surfacePatterns = [
    /surface[:\s]+(\d+)\s*m[²2]/i,
    /(\d+)\s*m[²2]\s*(?:habitable|habitables|de surface)/i,
    /superficie[:\s]+(\d+)/i,
  ];
  for (const pattern of surfacePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.surface = cleanSurface(match[1]);
      if (result.surface) break;
    }
  }
  
  // Pièces
  const piecesPatterns = [
    /(\d+)\s*pièces?(?:\s|$|,|\.)/i,
    /\bt(\d)\b/i,
    /\bf(\d)\b/i,
  ];
  for (const pattern of piecesPatterns) {
    const match = lowerText.match(pattern);
    if (match) {
      result.nb_pieces = cleanRooms(match[1]);
      if (result.nb_pieces) break;
    }
  }
  
  // Chambres
  const chambreMatch = text.match(/(\d+)\s*chambres?/i);
  if (chambreMatch) {
    result.nb_chambres = cleanRooms(chambreMatch[1]);
  }
  
  // Type
  if (lowerText.includes('maison') || lowerText.includes('villa')) result.type = 'maison';
  else if (lowerText.includes('studio')) result.type = 'studio';
  else if (lowerText.includes('parking') || lowerText.includes('garage') || lowerText.includes('box')) result.type = 'parking';
  else if (lowerText.includes('local commercial') || lowerText.includes('boutique')) result.type = 'local_commercial';
  else if (lowerText.includes('bureau')) result.type = 'bureaux';
  else if (lowerText.includes('entrepot') || lowerText.includes('entrepôt')) result.type = 'entrepot';
  else if (lowerText.includes('colocation')) result.type = 'colocation';
  else if (/\bt[1-6]\b/.test(lowerText)) result.type = 'appartement';
  else result.type = 'appartement';
  
  // Meublé
  if (/\bmeublé[es]?\b|\bfurnished\b/i.test(lowerText)) result.meuble = true;
  else if (/\bnon[- ]meublé[es]?\b|\bvide\b/i.test(lowerText)) result.meuble = false;
  
  // DPE
  const dpeMatch = lowerText.match(/(?:dpe|classe énergie|energie)[:\s]*([a-g])\b/i);
  if (dpeMatch) result.dpe_classe_energie = dpeMatch[1].toUpperCase();
  
  const gesMatch = lowerText.match(/(?:ges|émissions?|climat)[:\s]*([a-g])\b/i);
  if (gesMatch) result.dpe_ges = gesMatch[1].toUpperCase();
  
  // Chauffage
  if (/chauffage.*gaz|gaz.*chauffage|gaz de ville/i.test(lowerText)) result.chauffage_type = 'gaz';
  else if (/chauffage.*électrique|électrique.*chauffage|radiateurs?\s+électriques?/i.test(lowerText)) result.chauffage_type = 'electrique';
  else if (/pompe à chaleur|pac\b/i.test(lowerText)) result.chauffage_type = 'pac';
  else if (/chauffage.*fioul|fioul/i.test(lowerText)) result.chauffage_type = 'fioul';
  else if (/chauffage.*bois|poêle/i.test(lowerText)) result.chauffage_type = 'bois';
  
  if (/chauffage\s+collectif|collectif/i.test(lowerText)) result.chauffage_mode = 'collectif';
  else if (/chauffage\s+individuel|individuel/i.test(lowerText)) result.chauffage_mode = 'individuel';
  
  // Étage
  const etageMatch = lowerText.match(/(\d+)(?:er?|[èe]me)?\s*étage|\bétage\s*:?\s*(\d+)/i);
  if (etageMatch) {
    result.etage = parseInt(etageMatch[1] || etageMatch[2], 10);
  } else if (/rdc|rez[- ]de[- ]chaussée/i.test(lowerText)) {
    result.etage = 0;
  }
  
  // Équipements
  result.ascenseur = lowerText.includes('ascenseur') ? !lowerText.includes('sans ascenseur') : null;
  result.balcon = /\bbalcon\b/.test(lowerText);
  result.terrasse = /\bterrasse\b/.test(lowerText);
  result.parking_inclus = /parking\s*(?:inclus|compris)|place\s*de\s*parking|\bgarage\b/i.test(lowerText);
  result.cave = /\bcave\b/.test(lowerText);
  result.climatisation = /\bclim(?:atisation)?\b|air\s*conditionné/i.test(lowerText);
  result.jardin = /\bjardin\b/.test(lowerText);
  result.piscine = /\bpiscine\b/.test(lowerText);
  
  // Code postal
  const cpMatch = lowerText.match(/\b(97[1-6]\d{2}|98\d{3}|0[1-9]\d{3}|[1-8]\d{4}|9[0-5]\d{3})\b/);
  if (cpMatch) {
    result.code_postal = cpMatch[1];
    result.ville = findCityFromCP(cpMatch[1]);
  }
  
  return result;
}

// ============================================
// EXTRACTION VISITE VIRTUELLE
// ============================================

function extractVirtualTour($: cheerio.CheerioAPI, text: string): string | null {
  const patterns = [
    /https?:\/\/(?:my\.)?matterport\.com\/show\/\?m=[a-zA-Z0-9]+/i,
    /https?:\/\/(?:app\.)?nodalview\.com\/(?:tour|embed|v)\/[a-zA-Z0-9-]+/i,
    /https?:\/\/(?:www\.)?previsite\.fr\/visite\/[a-zA-Z0-9-]+/i,
    /https?:\/\/[a-z0-9.-]*klapty\.com\/[a-zA-Z0-9/-]+/i,
  ];
  
  // Chercher dans les iframes
  let found: string | null = null;
  $('iframe[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src) {
      for (const pattern of patterns) {
        if (pattern.test(src)) {
          found = src;
          return false;
        }
      }
    }
  });
  
  if (found) return found;
  
  // Chercher dans les liens
  $('a[href]').each((_, el) => {
    if (found) return false;
    const href = $(el).attr('href');
    if (href) {
      for (const pattern of patterns) {
        if (pattern.test(href)) {
          found = href;
          return false;
        }
      }
    }
  });
  
  if (found) return found;
  
  // Chercher dans le texte brut
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  
  return null;
}

// ============================================
// EXTRACTION PHOTOS HTML
// ============================================

function extractPhotosFromHtml($: cheerio.CheerioAPI, site: string, existingPhotos: string[]): string[] {
  const photos = [...existingPhotos];
  const maxPhotos = 25;
  
  // Sélecteurs génériques pour les galeries
  const selectors = [
    '.gallery img, .carousel img, .slider img, .swiper-slide img',
    '[data-gallery] img, [data-carousel] img, [data-slider] img',
    '.photo img, .image img, .picture img',
    'figure img, article img',
    'img[data-src], img[data-lazy-src]',
  ];
  
  selectors.forEach(selector => {
    $(selector).each((_, el) => {
      if (photos.length >= maxPhotos) return false;
      
      const url = $(el).attr("data-src") || 
                  $(el).attr("data-lazy-src") || 
                  $(el).attr("data-original") ||
                  $(el).attr("src");
      
      if (url && isValidPhotoUrl(url, site) && !photos.includes(url)) {
        photos.push(url);
      }
    });
  });
  
  return photos.slice(0, maxPhotos);
}

// ============================================
// FUSION DES DONNÉES
// ============================================

function mergeData(sources: Partial<ExtractedData>[]): ExtractedData {
  const result: ExtractedData = {
    titre: "",
    description: "",
    loyer_hc: null,
    loyer_cc: null,
    charges: null,
    surface: null,
    nb_pieces: null,
    nb_chambres: null,
    type: "appartement",
    code_postal: null,
    ville: null,
    adresse: null,
    adresse_complete: null,
    meuble: null,
    dpe_classe_energie: null,
    dpe_ges: null,
    dpe_valeur: null,
    chauffage_type: null,
    chauffage_mode: null,
    etage: null,
    nb_etages: null,
    ascenseur: null,
    balcon: false,
    terrasse: false,
    parking_inclus: false,
    cave: false,
    climatisation: false,
    jardin: false,
    piscine: false,
    annee_construction: null,
    photos: [],
    cover_url: null,
    visite_virtuelle_url: null,
    source_url: "",
    source_site: "generic",
    extraction_quality: { source: 'unknown', score: 0, details: [] },
  };
  
  // Fusionner les sources par priorité (première non-null gagne)
  for (const src of sources) {
    if (!src) continue;
    
    if (!result.titre && src.titre) result.titre = src.titre;
    if (!result.description && src.description) result.description = src.description;
    if (result.loyer_hc === null && src.loyer_hc != null) result.loyer_hc = src.loyer_hc;
    if (result.surface === null && src.surface != null) result.surface = src.surface;
    if (result.nb_pieces === null && src.nb_pieces != null) result.nb_pieces = src.nb_pieces;
    if (result.nb_chambres === null && src.nb_chambres != null) result.nb_chambres = src.nb_chambres;
    if (src.type && src.type !== 'appartement') result.type = src.type;
    if (!result.code_postal && src.code_postal) result.code_postal = src.code_postal;
    if (!result.ville && src.ville) result.ville = src.ville;
    if (!result.adresse && src.adresse) result.adresse = src.adresse;
    if (result.meuble === null && src.meuble != null) result.meuble = src.meuble;
    if (!result.dpe_classe_energie && src.dpe_classe_energie) result.dpe_classe_energie = src.dpe_classe_energie;
    if (!result.dpe_ges && src.dpe_ges) result.dpe_ges = src.dpe_ges;
    if (!result.chauffage_type && src.chauffage_type) result.chauffage_type = src.chauffage_type;
    if (!result.chauffage_mode && src.chauffage_mode) result.chauffage_mode = src.chauffage_mode;
    if (result.etage === null && src.etage != null) result.etage = src.etage;
    if (result.ascenseur === null && src.ascenseur != null) result.ascenseur = src.ascenseur;
    if (!result.balcon && src.balcon) result.balcon = true;
    if (!result.terrasse && src.terrasse) result.terrasse = true;
    if (!result.parking_inclus && src.parking_inclus) result.parking_inclus = true;
    if (!result.cave && src.cave) result.cave = true;
    if (!result.climatisation && src.climatisation) result.climatisation = true;
    if (!result.jardin && src.jardin) result.jardin = true;
    if (!result.piscine && src.piscine) result.piscine = true;
    if (!result.visite_virtuelle_url && src.visite_virtuelle_url) result.visite_virtuelle_url = src.visite_virtuelle_url;
    if (src.source_site && src.source_site !== 'generic') result.source_site = src.source_site;
    
    // Photos: accumuler
    if (src.photos && src.photos.length > 0) {
      src.photos.forEach(p => {
        if (!result.photos.includes(p)) result.photos.push(p);
      });
    }
    
    // Qualité
    if (src.extraction_quality && src.extraction_quality.score > result.extraction_quality.score) {
      result.extraction_quality = src.extraction_quality;
    }
  }
  
  return result;
}

// ============================================
// ENDPOINT PRINCIPAL
// ============================================

export async function POST(request: Request) {
  try {
    // =========================================
    // SEC-002: Protections de sécurité
    // =========================================

    // 1. Rate limiting (10 req/min)
    const rateLimitResponse = await applyRateLimit(request, "scrape");
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // 2. Authentification requise
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new ApiError(401, "Authentification requise pour utiliser le scraper");
    }

    // 3. Vérifier le rôle (owner ou admin uniquement)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!profile || !["owner", "admin"].includes(profile.role)) {
      throw new ApiError(403, "Accès non autorisé. Seuls les propriétaires et admins peuvent utiliser cette fonctionnalité.");
    }

    // 4. Parser la requête
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL manquante" }, { status: 400 });
    }

    // 5. Validation anti-SSRF
    const validation = isUrlAllowed(url);
    if (!validation.allowed) {
      console.warn(`[Scrape] URL rejetée: ${url} - Raison: ${validation.reason}`);
      return NextResponse.json(
        { error: "URL non autorisée", reason: validation.reason },
        { status: 400 }
      );
    }

    console.log(`\n[Scrape] 🔍 Analyse par ${user.email}: ${url}`);
    const startTime = Date.now();

    // Détecter le site source
    const site = detectSourceSite(url);
    console.log(`[Scrape] 📍 Site détecté: ${site}`);

    // 6. Fetch avec timeout (10 secondes)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`Impossible d'accéder à l'URL: ${response.status} ${response.statusText}`);
    }

    // 7. Vérifier la taille de la réponse (max 5MB)
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
      throw new Error("La page est trop volumineuse (max 5MB)");
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Texte brut pour analyse
    const bodyText = $("body").text().replace(/\s+/g, " ").slice(0, 60000);

    // 2. Extraction selon le site
    const sources: Partial<ExtractedData>[] = [];
    
    // Extracteur spécialisé
    switch (site) {
      case 'leboncoin':
        const lbcData = extractLeBonCoin($);
        if (lbcData) sources.push(lbcData);
        break;
      case 'seloger':
        const selogerData = extractSeLoger($);
        if (selogerData) sources.push(selogerData);
        break;
      case 'pap':
        const papData = extractPAP($);
        if (papData) sources.push(papData);
        break;
      default:
        // Pas d'extracteur spécialisé
        break;
    }
    
    // Sources génériques (JSON-LD, Meta, Texte)
    const jsonLdData = extractJsonLd($);
    if (jsonLdData) sources.push(jsonLdData);
    
    sources.push(extractMeta($));
    sources.push(extractFromText(bodyText));

    // 3. Fusionner les données
    const merged = mergeData(sources);
    merged.source_url = url;
    merged.source_site = site;

    // 4. Compléter les photos depuis HTML si nécessaire
    if (merged.photos.length < 5) {
      merged.photos = extractPhotosFromHtml($, site, merged.photos);
    }
    merged.cover_url = merged.photos[0] || null;

    // 5. Visite virtuelle
    if (!merged.visite_virtuelle_url) {
      merged.visite_virtuelle_url = extractVirtualTour($, bodyText);
    }

    // 6. Complétion CP <-> Ville
    if (merged.ville && !merged.code_postal) {
      merged.code_postal = findCPFromCity(merged.ville);
    }
    if (merged.code_postal && !merged.ville) {
      merged.ville = findCityFromCP(merged.code_postal);
    }

    // 7. Construire adresse complète
    const addrParts: string[] = [];
    if (merged.adresse) addrParts.push(merged.adresse);
    if (merged.code_postal) addrParts.push(merged.code_postal);
    if (merged.ville) addrParts.push(merged.ville);
    merged.adresse_complete = addrParts.length > 0 ? addrParts.join(', ') : null;

    // 8. Calculer le score final
    let finalScore = 0;
    const finalDetails: string[] = [];
    
    if (merged.loyer_hc) { finalScore += 15; finalDetails.push('✅ Prix'); }
    if (merged.surface) { finalScore += 15; finalDetails.push('✅ Surface'); }
    if (merged.nb_pieces) { finalScore += 10; finalDetails.push('✅ Pièces'); }
    if (merged.ville) { finalScore += 10; finalDetails.push('✅ Ville'); }
    if (merged.code_postal) { finalScore += 5; finalDetails.push('✅ CP'); }
    if (merged.dpe_classe_energie) { finalScore += 5; finalDetails.push('✅ DPE'); }
    if (merged.chauffage_type) { finalScore += 5; finalDetails.push('✅ Chauffage'); }
    if (merged.meuble !== null) { finalScore += 5; finalDetails.push('✅ Meublé'); }
    if (merged.photos.length > 0) { finalScore += 15; finalDetails.push(`✅ ${merged.photos.length} photos`); }
    if (merged.description && merged.description.length > 50) { finalScore += 10; finalDetails.push('✅ Description'); }
    if (merged.visite_virtuelle_url) { finalScore += 5; finalDetails.push('✅ Visite 3D'); }

    merged.extraction_quality = {
      source: site,
      score: Math.min(100, finalScore),
      details: finalDetails,
    };

    const duration = Date.now() - startTime;
    
    // Log final
    console.log(`[Scrape] ✅ Terminé en ${duration}ms`);
    console.log(`[Scrape] 💰 Prix: ${merged.loyer_hc || '?'}€ | 📐 Surface: ${merged.surface || '?'}m² | 🚪 Pièces: ${merged.nb_pieces || '?'}`);
    console.log(`[Scrape] 📍 ${merged.ville || '?'} ${merged.code_postal || ''}`);
    console.log(`[Scrape] 📷 ${merged.photos.length} photos | 🏷️ DPE: ${merged.dpe_classe_energie || '?'} | 🔥 ${merged.chauffage_type || '?'}`);
    console.log(`[Scrape] 📊 Score: ${merged.extraction_quality.score}/100`);

    return NextResponse.json({ 
      success: true, 
      data: merged,
    });

  } catch (error: unknown) {
    console.error("[Scrape] ❌ Erreur:", error.message);
    return NextResponse.json(
      { error: "Erreur lors de l'analyse de l'annonce", details: error.message },
      { status: 500 }
    );
  }
}
