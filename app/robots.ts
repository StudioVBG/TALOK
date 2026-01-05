import { MetadataRoute } from "next";

/**
 * Normalise l'URL de base.
 * Ajoute le protocole https:// si manquant.
 */
function getBaseUrl(): string {
  const rawUrl = process.env.NEXT_PUBLIC_APP_URL || "https://gestion-locative.com";
  return /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
}

const BASE_URL = getBaseUrl();

/**
 * Robots.txt dynamique
 * Configure les règles d'exploration pour les moteurs de recherche
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/app/",        // Zones privées
          "/admin/",      // Administration
          "/api/",        // APIs
          "/auth/",       // Authentification (sauf signin/signup)
          "/signature/",  // Signatures privées
          "/_next/",      // Assets Next.js
        ],
      },
      {
        userAgent: "Googlebot",
        allow: ["/", "/blog/", "/legal/"],
        disallow: ["/app/", "/admin/", "/api/", "/signature/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}



