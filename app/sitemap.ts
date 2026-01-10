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
 * - Pages marketing SEO
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
      url: `${BASE_URL}/features`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];

  // ============================================
  // PAGES SEO STRATÉGIQUES
  // ============================================
  const seoPages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/logiciel-gestion-locative`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/comparatif/rentila`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/comparatif/smovin`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/comparatif/hektor`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  // ============================================
  // OUTILS GRATUITS (Lead magnets SEO)
  // ============================================
  const toolPages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/outils/quittance-loyer`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/outils/modele-bail`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/outils/calculateur-rentabilite`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/outils/etat-des-lieux`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

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
  // PAGES LÉGALES
  // ============================================
  const legalPages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/legal/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/terms`,
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
  ];

  // ============================================
  // PAGES GUIDES (Contenu SEO)
  // ============================================
  const guidePages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/guide/proprietaire-bailleur`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/guide/bail-location`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/guide/gestion-locative-drom`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  // ============================================
  // ASSEMBLAGE FINAL
  // ============================================
  return [
    ...mainPages,
    ...seoPages,
    ...toolPages,
    ...authPages,
    ...blogIndexPage,
    ...blogPages,
    ...guidePages,
    ...legalPages,
  ];
}



