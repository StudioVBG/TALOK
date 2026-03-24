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
 * Génère automatiquement les URLs pour :
 * - Pages statiques publiques
 * - Articles de blog dynamiques
 * - Pages marketing
 * - Pages légales
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // ============================================
  // PAGES PRINCIPALES (Priorité haute)
  // ============================================
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
    {
      url: `${BASE_URL}/a-propos`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/temoignages`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/faq`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  // ============================================
  // FONCTIONNALITÉS (pages détaillées)
  // ============================================
  const featurePages: MetadataRoute.Sitemap = [
    "gestion-biens",
    "gestion-locataires",
    "etats-des-lieux",
    "signature-electronique",
    "quittances-loyers",
    "comptabilite-fiscalite",
    "paiements-en-ligne",
  ].map((slug) => ({
    url: `${BASE_URL}/fonctionnalites/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  // ============================================
  // SOLUTIONS
  // ============================================
  const solutionPages: MetadataRoute.Sitemap = [
    "proprietaires-particuliers",
    "investisseurs",
    "administrateurs-biens",
    "sci-familiales",
    "dom-tom",
  ].map((slug) => ({
    url: `${BASE_URL}/solutions/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  // ============================================
  // OUTILS GRATUITS (Lead magnets SEO)
  // ============================================
  const toolPages: MetadataRoute.Sitemap = [
    "calcul-rendement-locatif",
    "calcul-revision-irl",
    "calcul-frais-notaire",
    "simulateur-charges",
  ].map((slug) => ({
    url: `${BASE_URL}/outils/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  // ============================================
  // PAGES AUTHENTIFICATION
  // ============================================
  const authPages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/auth/signin`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/signup/role`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  // ============================================
  // BLOG / HELP CENTER
  // ============================================
  const blogIndexPage: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/blog`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  // Articles de blog dynamiques
  const blogPosts = await getBlogPosts();
  const blogPages: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // ============================================
  // GUIDES
  // ============================================
  const guidePages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/guides`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  // ============================================
  // PAGES LÉGALES
  // ============================================
  const legalPages: MetadataRoute.Sitemap = [
    "privacy",
    "terms",
    "cgu",
    "cgv",
    "cookies",
    "mentions",
  ].map((slug) => ({
    url: `${BASE_URL}/legal/${slug}`,
    lastModified: now,
    changeFrequency: "yearly" as const,
    priority: 0.3,
  }));

  // ============================================
  // ASSEMBLAGE FINAL
  // ============================================
  return [
    ...mainPages,
    ...featurePages,
    ...solutionPages,
    ...toolPages,
    ...authPages,
    ...blogIndexPage,
    ...blogPages,
    ...guidePages,
    ...legalPages,
  ];
}
