/**
 * Tests unitaires pour les helpers purs de l'import d'annonce.
 *
 * Cible: app/api/scrape/extractors.ts
 *
 * Ces helpers sont la fondation déterministe de l'import (POST /api/scrape) :
 * SSRF guard, lookups CP/Ville, détection site source, validation des URLs
 * de photos, sanitizers numériques. Toute régression ici casse silencieusement
 * la création de bien depuis une annonce externe.
 */

import { describe, expect, it } from "vitest";
import {
  ALLOWED_DOMAINS,
  CP_TO_CITY,
  cleanDPE,
  cleanPrice,
  cleanRooms,
  cleanSurface,
  detectSourceSite,
  findCityFromCP,
  findCPFromCity,
  isUrlAllowed,
  isValidPhotoUrl,
  normalizeText,
} from "@/app/api/scrape/extractors";

describe("isUrlAllowed (SEC-002 SSRF)", () => {
  it("autorise les URLs HTTPS sur des domaines whitelistés", () => {
    expect(isUrlAllowed("https://www.pap.fr/annonces/123").allowed).toBe(true);
    expect(isUrlAllowed("https://www.leboncoin.fr/ad/locations/456").allowed).toBe(true);
    expect(isUrlAllowed("https://www.seloger.com/annonces/789").allowed).toBe(true);
    expect(isUrlAllowed("https://www.orpi.com/annonce/abc").allowed).toBe(true);
  });

  it("autorise les sous-domaines de domaines whitelistés", () => {
    expect(isUrlAllowed("https://immobilier.lefigaro.fr/annonces/1").allowed).toBe(true);
  });

  it("rejette les protocoles non HTTP(S)", () => {
    const result = isUrlAllowed("file:///etc/passwd");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/protocole/i);
  });

  it("rejette ftp://", () => {
    expect(isUrlAllowed("ftp://www.pap.fr/file").allowed).toBe(false);
  });

  it("bloque localhost et 127.0.0.1 (boucle locale)", () => {
    expect(isUrlAllowed("http://localhost/admin").allowed).toBe(false);
    expect(isUrlAllowed("http://127.0.0.1:8080/").allowed).toBe(false);
    expect(isUrlAllowed("http://0.0.0.0/").allowed).toBe(false);
  });

  it("bloque les endpoints metadata cloud (AWS/GCP/Azure)", () => {
    const aws = isUrlAllowed("http://169.254.169.254/latest/meta-data/");
    expect(aws.allowed).toBe(false);
    expect(aws.reason).toMatch(/IP privée|Host bloqué/);

    expect(isUrlAllowed("http://metadata.google.internal/").allowed).toBe(false);
  });

  it("bloque les ranges IP privées RFC1918", () => {
    expect(isUrlAllowed("http://10.0.0.1/").allowed).toBe(false);
    expect(isUrlAllowed("http://172.16.0.1/").allowed).toBe(false);
    expect(isUrlAllowed("http://172.31.255.255/").allowed).toBe(false);
    expect(isUrlAllowed("http://192.168.1.1/").allowed).toBe(false);
  });

  it("bloque le link-local IPv4 (169.254/16)", () => {
    expect(isUrlAllowed("http://169.254.10.20/").allowed).toBe(false);
  });

  it("rejette les domaines hors whitelist", () => {
    const result = isUrlAllowed("https://evil.example.com/payload");
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/non autorisé/i);
  });

  it("rejette les URLs malformées", () => {
    expect(isUrlAllowed("not-a-url").allowed).toBe(false);
    expect(isUrlAllowed("").allowed).toBe(false);
  });

  it("matche le domaine exact, pas une simple inclusion (anti-spoofing)", () => {
    // pap.fr.evil.com ne doit PAS être considéré comme pap.fr
    expect(isUrlAllowed("https://pap.fr.evil.com/").allowed).toBe(false);
    // evil-pap.fr ne doit PAS matcher pap.fr
    expect(isUrlAllowed("https://evil-pap.fr/").allowed).toBe(false);
  });
});

describe("detectSourceSite", () => {
  it("identifie les sites supportés depuis l'hôte", () => {
    expect(detectSourceSite("https://www.leboncoin.fr/ad/123")).toBe("leboncoin");
    expect(detectSourceSite("https://www.seloger.com/x")).toBe("seloger");
    expect(detectSourceSite("https://www.pap.fr/annonces")).toBe("pap");
    expect(detectSourceSite("https://www.logic-immo.com/x")).toBe("logic-immo");
    expect(detectSourceSite("https://www.bien-ici.com/x")).toBe("bienici");
    expect(detectSourceSite("https://www.orpi.com/x")).toBe("orpi");
    expect(detectSourceSite("https://www.century21.fr/x")).toBe("century21");
    expect(detectSourceSite("https://www.laforet.com/x")).toBe("laforet");
    expect(detectSourceSite("https://immobilier.lefigaro.fr/x")).toBe("figaro");
  });

  it("retourne 'generic' pour les sites inconnus", () => {
    expect(detectSourceSite("https://example.com/x")).toBe("generic");
    expect(detectSourceSite("https://www.guy-hoquet.com/x")).toBe("generic");
  });
});

describe("findCityFromCP / findCPFromCity", () => {
  it("résout les arrondissements de Paris (75001-75020)", () => {
    expect(findCityFromCP("75001")).toBe("Paris");
    expect(findCityFromCP("75008")).toBe("Paris");
    expect(findCityFromCP("75020")).toBe("Paris");
  });

  it("résout les arrondissements de Lyon et Marseille", () => {
    expect(findCityFromCP("69001")).toBe("Lyon");
    expect(findCityFromCP("69009")).toBe("Lyon");
    expect(findCityFromCP("13001")).toBe("Marseille");
    expect(findCityFromCP("13016")).toBe("Marseille");
  });

  it("résout les communes des DROM (Martinique, Guadeloupe, Réunion, Guyane, Mayotte)", () => {
    expect(findCityFromCP("97200")).toBe("Fort-de-France");
    expect(findCityFromCP("97232")).toBe("Le Lamentin");
    expect(findCityFromCP("97110")).toBe("Pointe-à-Pitre");
    expect(findCityFromCP("97400")).toBe("Saint-Denis");
    expect(findCityFromCP("97300")).toBe("Cayenne");
    expect(findCityFromCP("97600")).toBe("Mamoudzou");
  });

  it("retourne null pour un CP inconnu", () => {
    expect(findCityFromCP("00000")).toBeNull();
    expect(findCityFromCP("99999")).toBeNull();
    expect(findCityFromCP("")).toBeNull();
  });

  it("résout les villes vers leur CP de référence (insensible aux accents/casse)", () => {
    expect(findCPFromCity("Paris")).toBe("75000");
    expect(findCPFromCity("PARIS")).toBe("75000");
    expect(findCPFromCity("Fort-de-France")).toBe("97200");
    // Saint-André avec accent => même résultat que sans accent
    expect(findCPFromCity("Saint-André")).toBe("97440");
    expect(findCPFromCity("Saint-Andre")).toBe("97440");
    // Trois-Rivières (Guadeloupe)
    expect(findCPFromCity("Trois-Rivières")).toBe("97114");
  });

  it("retourne null pour une ville inconnue", () => {
    expect(findCPFromCity("Atlantis")).toBeNull();
    expect(findCPFromCity("")).toBeNull();
  });
});

describe("normalizeText", () => {
  it("retire les diacritiques et passe en minuscules", () => {
    expect(normalizeText("Saint-André")).toBe("saint-andre");
    expect(normalizeText("Pointe-à-Pitre")).toBe("pointe-a-pitre");
    expect(normalizeText("L'Étang-Salé")).toBe("l'etang-sale");
  });

  it("trim les espaces et conserve les apostrophes", () => {
    expect(normalizeText("  Morne-à-l'Eau  ")).toBe("morne-a-l'eau");
  });
});

describe("cleanPrice", () => {
  it("accepte les prix dans la plage [50, 50000]", () => {
    expect(cleanPrice(800)).toBe(800);
    expect(cleanPrice("1 250 €")).toBe(1250);
    expect(cleanPrice("3.500€/mois")).toBe(3500);
    expect(cleanPrice(50)).toBe(50);
    expect(cleanPrice(50000)).toBe(50000);
  });

  it("rejette les valeurs hors plage (probablement parasites)", () => {
    expect(cleanPrice(10)).toBeNull(); // trop bas, < 50
    expect(cleanPrice(99999)).toBeNull(); // trop haut, > 50000
    expect(cleanPrice(0)).toBeNull(); // falsy court-circuit
  });

  it("rejette les entrées vides ou non parsables", () => {
    expect(cleanPrice(null)).toBeNull();
    expect(cleanPrice(undefined)).toBeNull();
    expect(cleanPrice("")).toBeNull();
    expect(cleanPrice("abc")).toBeNull();
  });
});

describe("cleanSurface", () => {
  it("accepte les surfaces dans la plage [5, 2000]", () => {
    expect(cleanSurface(45)).toBe(45);
    expect(cleanSurface("82 m²")).toBe(82);
    expect(cleanSurface(5)).toBe(5);
    expect(cleanSurface(2000)).toBe(2000);
  });

  it("rejette les surfaces hors plage", () => {
    expect(cleanSurface(2)).toBeNull();
    expect(cleanSurface(2500)).toBeNull();
  });
});

describe("cleanRooms", () => {
  it("accepte 1 à 20 pièces", () => {
    expect(cleanRooms(1)).toBe(1);
    expect(cleanRooms("3")).toBe(3);
    expect(cleanRooms(20)).toBe(20);
  });

  it("rejette les valeurs hors plage", () => {
    expect(cleanRooms(0)).toBeNull();
    expect(cleanRooms(21)).toBeNull();
  });
});

describe("cleanDPE", () => {
  it("normalise une lettre A-G isolée (cas usuel — JSON-LD, data-attrs)", () => {
    expect(cleanDPE("A")).toBe("A");
    expect(cleanDPE("d")).toBe("D");
    expect(cleanDPE(" g ")).toBe("G");
    expect(cleanDPE("c ")).toBe("C");
  });

  it("retourne null en l'absence de lettre A-G", () => {
    expect(cleanDPE(null)).toBeNull();
    expect(cleanDPE("")).toBeNull();
    expect(cleanDPE("123")).toBeNull();
    expect(cleanDPE("XYZ")).toBeNull();
    // H ne fait pas partie de l'échelle DPE
    expect(cleanDPE("H")).toBeNull();
  });

  it("ne tente pas de comprendre une phrase: matche la PREMIÈRE lettre A-G venue", () => {
    // "CLASSE G" → match au C de CLASSE, pas au G final.
    // Limitation acceptée du fallback regex; les callers passent des valeurs
    // isolées en amont (JSON-LD, attributs data-*).
    expect(cleanDPE("Classe G")).toBe("C");
    expect(cleanDPE("DPE B")).toBe("D");
  });
});

describe("isValidPhotoUrl", () => {
  it("accepte les URLs d'images réalistes", () => {
    expect(isValidPhotoUrl("https://cdn.pap.fr/listing/photo-1.jpg")).toBe(true);
    expect(isValidPhotoUrl("https://images.seloger.com/listings/abc.webp")).toBe(true);
    expect(isValidPhotoUrl("https://photos.example.com/big-living-room.jpeg")).toBe(true);
    expect(isValidPhotoUrl("https://media.cdn.com/listing/img.png?w=1200")).toBe(true);
  });

  it("rejette les URLs invalides ou trop courtes", () => {
    expect(isValidPhotoUrl("")).toBe(false);
    expect(isValidPhotoUrl("http://x.fr")).toBe(false); // trop courte
    expect(isValidPhotoUrl("/relative/path.jpg")).toBe(false); // pas http
  });

  it("filtre les logos, icônes, pixels de tracking et placeholders", () => {
    expect(isValidPhotoUrl("https://cdn.example.com/logo-pap.png")).toBe(false);
    expect(isValidPhotoUrl("https://cdn.example.com/icon-home.png")).toBe(false);
    expect(isValidPhotoUrl("https://cdn.example.com/avatar-user.jpg")).toBe(false);
    expect(isValidPhotoUrl("https://tracking.com/pixel.gif")).toBe(false);
    expect(isValidPhotoUrl("https://cdn.example.com/placeholder.jpg")).toBe(false);
    expect(isValidPhotoUrl("https://cdn.example.com/illustration.svg")).toBe(false);
  });

  it("filtre les assets statiques LeBonCoin (mode site=leboncoin)", () => {
    expect(isValidPhotoUrl("https://static.lbc.fr/img.jpg", "leboncoin")).toBe(false);
    expect(isValidPhotoUrl("https://assets.lbc.fr/img.jpg", "leboncoin")).toBe(false);
    // Mais accepté en mode generic
    expect(isValidPhotoUrl("https://static.lbc.fr/listing-photo-1234.jpg", "generic")).toBe(true);
  });
});

describe("ALLOWED_DOMAINS / CP_TO_CITY (sanity checks sur les constantes)", () => {
  it("inclut les principaux sites d'annonces immobilières", () => {
    expect(ALLOWED_DOMAINS).toContain("pap.fr");
    expect(ALLOWED_DOMAINS).toContain("www.leboncoin.fr");
    expect(ALLOWED_DOMAINS).toContain("seloger.com");
    expect(ALLOWED_DOMAINS).toContain("orpi.com");
  });

  it("couvre les 5 DROM principaux", () => {
    // Au moins une commune représentative de chaque DROM
    expect(CP_TO_CITY["97200"]).toBeDefined(); // Martinique
    expect(CP_TO_CITY["97110"]).toBeDefined(); // Guadeloupe
    expect(CP_TO_CITY["97400"]).toBeDefined(); // Réunion
    expect(CP_TO_CITY["97300"]).toBeDefined(); // Guyane
    expect(CP_TO_CITY["97600"]).toBeDefined(); // Mayotte
  });

  it("couvre les 20 arrondissements de Paris + le 75116", () => {
    for (let i = 1; i <= 20; i++) {
      const cp = `750${String(i).padStart(2, "0")}`;
      expect(CP_TO_CITY[cp]).toBe("Paris");
    }
    expect(CP_TO_CITY["75116"]).toBe("Paris");
  });
});
