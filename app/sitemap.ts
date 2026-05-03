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
    "documents",
    "etats-des-lieux",
    "gestion-biens",
    "gestion-des-baux",
    "gestion-locataires",
    "immeuble-copropriete",
    "paiements-en-ligne",
    "quittances-loyers",
    "signature-electronique",
    "tickets-et-travaux",
  ].map((slug) => ({
    url: `${BASE_URL}/fonctionnalites/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const solutionPages: MetadataRoute.Sitemap = [
    "administrateurs-biens",
    "outre-mer",
    "investisseurs",
    "proprietaires-particuliers",
    "sci-familiales",
    "syndics",
  ].map((slug) => ({
    url: `${BASE_URL}/solutions/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const toolPages: MetadataRoute.Sitemap = [
    { slug: "", priority: 0.8 },
    { slug: "calcul-frais-notaire", priority: 0.7 },
    { slug: "calcul-rendement-locatif", priority: 0.7 },
    { slug: "calcul-revision-irl", priority: 0.7 },
    { slug: "simulateur-charges", priority: 0.7 },
  ].map(({ slug, priority }) => ({
    url: slug ? `${BASE_URL}/outils/${slug}` : `${BASE_URL}/outils`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority,
  }));

  const roiCalculatorPage: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/calculateur-roi`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  const corporatePages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/presse`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/statut`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/accessibilite`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/securite`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const templatePages: MetadataRoute.Sitemap = [
    { slug: "", priority: 0.7 },
    { slug: "etat-des-lieux", priority: 0.6 },
    { slug: "quittance-loyer", priority: 0.6 },
  ].map(({ slug, priority }) => ({
    url: slug ? `${BASE_URL}/modeles/${slug}` : `${BASE_URL}/modeles`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority,
  }));

  // /auth/signup redirige (307) vers /signup/role. Seule la cible finale
  // est listee pour eviter un redirect dans le sitemap.
  const authPages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/signup/role`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  const contentHubPages: MetadataRoute.Sitemap = [
    // /blog retire du sitemap tant que la page est en noindex (stub).
    // A reintegrer des que le feed dynamique est branche.
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
    ...roiCalculatorPage,
    ...corporatePages,
    ...templatePages,
    ...authPages,
    ...contentHubPages,
    ...blogPages,
    ...legalPages,
  ];
}
