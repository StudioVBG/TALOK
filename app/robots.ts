import { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://gestion-locative.com";

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



