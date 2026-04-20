import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

/**
 * Normalise l'URL de base.
 * Ajoute le protocole https:// si manquant.
 */
function getBaseUrl(): string {
  const rawUrl = process.env.NEXT_PUBLIC_APP_URL || "https://talok.fr";
  return /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
}

const BASE_URL = getBaseUrl();

/**
 * Récupère les articles de blog publiés depuis Supabase
 */
async function getBlogPosts(): Promise<Array<{ slug: string; updated_at: string }>> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return [];
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("blog_posts")
      .select("slug, updated_at")
      .eq("status", "published")
      .order("updated_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    return data;
  } catch {
    return [];
  }
}

/**
 * Sitemap dynamique SOTA 2026 pour le SEO
 *
 * Seules les routes EXISTANTES (200) sont listées. Ajouter une entrée
 * implique que la page soit livrée en prod ; sinon on pollue le sitemap
 * avec des 404 (rapport audit SEO 2026-04-20).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const mainPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/fonctionnalites`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];

  const featureSubpages: MetadataRoute.Sitemap = [
    "comptabilite-fiscalite",
    "etats-des-lieux",
    "gestion-biens",
    "gestion-locataires",
    "paiements-en-ligne",
    "quittances-loyers",
    "signature-electronique",
  ].map((slug) => ({
    url: `${BASE_URL}/fonctionnalites/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const solutionPages: MetadataRoute.Sitemap = [
    "administrateurs-biens",
    "dom-tom",
    "investisseurs",
    "proprietaires-particuliers",
    "sci-familiales",
  ].map((slug) => ({
    url: `${BASE_URL}/solutions/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const toolPages: MetadataRoute.Sitemap = [
    "calcul-frais-notaire",
    "calcul-rendement-locatif",
    "calcul-revision-irl",
    "simulateur-charges",
  ].map((slug) => ({
    url: `${BASE_URL}/outils/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const authPages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/auth/signup`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/signup/role`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  const contentHubPages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/blog`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/guides`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/temoignages`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  const blogPosts = await getBlogPosts();
  const blogPages: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const legalPages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/legal/mentions`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/cgu`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/cgv`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/cookies`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${BASE_URL}/faq`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/a-propos`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];

  return [
    ...mainPages,
    ...featureSubpages,
    ...solutionPages,
    ...toolPages,
    ...authPages,
    ...contentHubPages,
    ...blogPages,
    ...legalPages,
  ];
}
