/**
 * Helpers pour generer des JSON-LD schema.org page-specifiques.
 *
 * Utilisation (Server Component) :
 *   import { safeJsonLd } from "@/lib/seo/safe-json-ld";
 *   const jsonLd = faqPageSchema(questions);
 *   <script
 *     type="application/ld+json"
 *     dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
 *   />
 *
 * IMPORTANT : toujours passer par safeJsonLd() (jamais JSON.stringify direct).
 * safeJsonLd() echappe "<" en "<" pour empecher un breakout de la balise
 * <script> si une valeur contient "</script>" (defense in depth contre XSS).
 *
 * Le root layout injecte deja Organization + WebSite schemas globaux.
 * N'utiliser ces helpers que pour les schemas page-specifiques
 * (FAQPage, Article, BreadcrumbList, Product, AggregateRating...).
 */

const RAW_SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://talok.fr";
const SITE_URL = /^https?:\/\//i.test(RAW_SITE_URL)
  ? RAW_SITE_URL
  : `https://${RAW_SITE_URL}`;

type FAQItem = {
  question: string;
  answer: string;
};

/**
 * FAQPage schema — affiche les questions dans les rich snippets Google.
 * Impact SEO : +20-30 % CTR sur requetes informatives (etudes Backlinko).
 */
export function faqPageSchema(items: FAQItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

type BreadcrumbItem = {
  name: string;
  path: string;
};

/**
 * BreadcrumbList schema — affiche un fil d'Ariane dans les SERPs.
 * Utile sur les pages profondes (/fonctionnalites/*, /solutions/*).
 */
export function breadcrumbListSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

type ArticleSchemaOptions = {
  title: string;
  description: string;
  slug: string;
  publishedAt: string;
  updatedAt?: string;
  image?: string;
  authorName?: string;
};

/**
 * Article schema — pour /blog/[slug] et /guides/[slug].
 * Eligibilite Google Discover + rich snippets article.
 */
export function articleSchema(opts: ArticleSchemaOptions) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    description: opts.description,
    datePublished: opts.publishedAt,
    dateModified: opts.updatedAt || opts.publishedAt,
    image: opts.image
      ? [opts.image.startsWith("http") ? opts.image : `${SITE_URL}${opts.image}`]
      : undefined,
    author: {
      "@type": "Organization",
      name: opts.authorName || "Talok",
    },
    publisher: {
      "@type": "Organization",
      name: "Talok",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/images/talok-logo-horizontal.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${opts.slug}`,
    },
  };
}

/**
 * Helper pour composer plusieurs schemas en un Graph unique
 * (evite plusieurs balises <script> quand une page a plusieurs schemas).
 */
export function schemaGraph(schemas: Array<Record<string, unknown>>) {
  return {
    "@context": "https://schema.org",
    "@graph": schemas.map(({ "@context": _ctx, ...rest }) => rest),
  };
}
