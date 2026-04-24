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
          "/app/",
          "/admin/",
          "/api/",
          "/auth/",
          "/signature/",
          "/_next/",
          // Espaces authentifiés par rôle — ne doivent pas être crawlés
          "/owner/",
          "/tenant/",
          "/agency/",
          "/provider/",
          "/copro/",
          "/syndic/",
          "/guarantor/",
          // Route de redirection, pas indexable
          "/essai-gratuit",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: ["/", "/blog/", "/legal/"],
        disallow: [
          "/app/",
          "/admin/",
          "/api/",
          "/auth/",
          "/signature/",
          "/owner/",
          "/tenant/",
          "/agency/",
          "/provider/",
          "/copro/",
          "/syndic/",
          "/guarantor/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}



