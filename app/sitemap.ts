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
 * Sitemap dynamique pour le SEO
 * Génère automatiquement les URLs pour les pages publiques
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Pages statiques publiques
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/auth/signin`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/auth/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/legal/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // TODO: Ajouter les articles de blog dynamiquement
  // const blogPosts = await getBlogPosts();
  // const blogUrls = blogPosts.map(post => ({
  //   url: `${BASE_URL}/blog/${post.slug}`,
  //   lastModified: post.updated_at,
  //   changeFrequency: "weekly" as const,
  //   priority: 0.6,
  // }));

  return [...staticPages];
}



