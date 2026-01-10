/**
 * JsonLd - Composants de données structurées Schema.org
 *
 * SOTA 2026 : Maximise les rich snippets Google
 * - Organization : Identité de marque
 * - SoftwareApplication : Produit SaaS
 * - FAQPage : Questions fréquentes
 * - BreadcrumbList : Navigation
 * - Review/AggregateRating : Avis clients
 * - HowTo : Tutoriels
 * - Article : Blog posts
 */

import React from "react";

// ============================================
// TYPES
// ============================================

interface OrganizationSchemaProps {
  name?: string;
  url?: string;
  logo?: string;
  description?: string;
  email?: string;
  foundingDate?: string;
  socialLinks?: string[];
}

interface SoftwareApplicationSchemaProps {
  name?: string;
  description?: string;
  applicationCategory?: string;
  operatingSystem?: string;
  price?: string;
  priceCurrency?: string;
  ratingValue?: number;
  ratingCount?: number;
  screenshot?: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSchemaProps {
  items: FAQItem[];
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[];
}

interface ReviewSchemaProps {
  author: string;
  datePublished: string;
  reviewBody: string;
  ratingValue: number;
  itemReviewed: {
    name: string;
    type: string;
  };
}

interface ArticleSchemaProps {
  headline: string;
  description: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  author: string;
  url: string;
}

interface LocalBusinessSchemaProps {
  name?: string;
  description?: string;
  url?: string;
  telephone?: string;
  email?: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  priceRange?: string;
}

// ============================================
// ORGANIZATION SCHEMA
// ============================================

export function OrganizationSchema({
  name = "Talok",
  url = "https://talok.fr",
  logo = "https://talok.fr/logo.png",
  description = "Plateforme SaaS de gestion locative n°1 en France et DROM. Open Banking, Scoring IA, signatures électroniques et portail locataire.",
  email = "support@talok.fr",
  foundingDate = "2024",
  socialLinks = [
    "https://www.linkedin.com/company/talok",
    "https://twitter.com/talok_fr",
  ],
}: OrganizationSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    logo: {
      "@type": "ImageObject",
      url: logo,
      width: 512,
      height: 512,
    },
    description,
    foundingDate,
    address: {
      "@type": "PostalAddress",
      addressCountry: "FR",
    },
    contactPoint: {
      "@type": "ContactPoint",
      email,
      contactType: "customer service",
      availableLanguage: ["French"],
      areaServed: ["FR", "GP", "MQ", "GF", "RE", "YT", "PM", "NC", "PF", "WF"],
    },
    sameAs: socialLinks,
    slogan: "Gérez vos locations comme un pro",
    knowsAbout: [
      "Gestion locative",
      "Immobilier",
      "Bail location",
      "Quittance de loyer",
      "Signature électronique",
      "Open Banking",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ============================================
// SOFTWARE APPLICATION SCHEMA
// ============================================

export function SoftwareApplicationSchema({
  name = "Talok",
  description = "Logiciel de gestion locative tout-en-un pour propriétaires bailleurs. Baux automatiques, signatures électroniques, scoring IA locataires et Open Banking.",
  applicationCategory = "BusinessApplication",
  operatingSystem = "Web, iOS, Android",
  price = "0",
  priceCurrency = "EUR",
  ratingValue = 4.8,
  ratingCount = 500,
  screenshot = "https://talok.fr/screenshot-dashboard.png",
}: SoftwareApplicationSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    description,
    applicationCategory,
    operatingSystem,
    url: "https://talok.fr",
    screenshot,
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      highPrice: "799",
      priceCurrency,
      offerCount: 8,
      offers: [
        {
          "@type": "Offer",
          name: "Gratuit",
          price: "0",
          priceCurrency,
          description: "1 bien, fonctionnalités de base",
        },
        {
          "@type": "Offer",
          name: "Starter",
          price: "9",
          priceCurrency,
          description: "3 biens, paiement en ligne",
        },
        {
          "@type": "Offer",
          name: "Confort",
          price: "35",
          priceCurrency,
          description: "10 biens, Open Banking, signatures",
        },
        {
          "@type": "Offer",
          name: "Pro",
          price: "69",
          priceCurrency,
          description: "50 biens, API, SMS",
        },
      ],
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue,
      ratingCount,
      bestRating: 5,
      worstRating: 1,
    },
    featureList: [
      "Gestion multi-biens illimitée",
      "Baux automatiques conformes ALUR",
      "Signatures électroniques légales eIDAS",
      "Scoring IA locataires (94% précision)",
      "Open Banking natif",
      "Portail locataire moderne",
      "Quittances automatiques",
      "Révision IRL automatique",
      "États des lieux numériques",
      "Support DROM (Martinique, Guadeloupe, Réunion...)",
    ],
    author: {
      "@type": "Organization",
      name: "Talok",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ============================================
// FAQ PAGE SCHEMA
// ============================================

export function FAQSchema({ items }: FAQSchemaProps) {
  const schema = {
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

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ============================================
// BREADCRUMB SCHEMA
// ============================================

export function BreadcrumbSchema({ items }: BreadcrumbSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ============================================
// REVIEW SCHEMA
// ============================================

export function ReviewSchema({
  author,
  datePublished,
  reviewBody,
  ratingValue,
  itemReviewed,
}: ReviewSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Review",
    author: {
      "@type": "Person",
      name: author,
    },
    datePublished,
    reviewBody,
    reviewRating: {
      "@type": "Rating",
      ratingValue,
      bestRating: 5,
      worstRating: 1,
    },
    itemReviewed: {
      "@type": itemReviewed.type,
      name: itemReviewed.name,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ============================================
// ARTICLE SCHEMA (pour le blog)
// ============================================

export function ArticleSchema({
  headline,
  description,
  image,
  datePublished,
  dateModified,
  author,
  url,
}: ArticleSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    image: image || "https://talok.fr/og-image.png",
    datePublished,
    dateModified: dateModified || datePublished,
    author: {
      "@type": "Person",
      name: author,
    },
    publisher: {
      "@type": "Organization",
      name: "Talok",
      logo: {
        "@type": "ImageObject",
        url: "https://talok.fr/logo.png",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ============================================
// LOCAL BUSINESS SCHEMA (pour le SEO local)
// ============================================

export function LocalBusinessSchema({
  name = "Talok",
  description = "Plateforme de gestion locative pour propriétaires bailleurs",
  url = "https://talok.fr",
  email = "support@talok.fr",
  priceRange = "€-€€€€",
}: LocalBusinessSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name,
    description,
    url,
    email,
    priceRange,
    areaServed: [
      { "@type": "Country", name: "France" },
      { "@type": "AdministrativeArea", name: "Guadeloupe" },
      { "@type": "AdministrativeArea", name: "Martinique" },
      { "@type": "AdministrativeArea", name: "Guyane" },
      { "@type": "AdministrativeArea", name: "La Réunion" },
      { "@type": "AdministrativeArea", name: "Mayotte" },
    ],
    serviceType: [
      "Logiciel de gestion locative",
      "Gestion de baux",
      "Signature électronique",
      "Paiement de loyers en ligne",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ============================================
// WEBSITE SCHEMA
// ============================================

export function WebsiteSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Talok",
    url: "https://talok.fr",
    description: "Logiciel de gestion locative n°1 en France et DROM",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://talok.fr/blog?search={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
    inLanguage: "fr-FR",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ============================================
// COMBINED SCHEMA FOR HOMEPAGE
// ============================================

export function HomepageSchema() {
  return (
    <>
      <OrganizationSchema />
      <SoftwareApplicationSchema />
      <WebsiteSchema />
      <LocalBusinessSchema />
    </>
  );
}

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
  OrganizationSchema,
  SoftwareApplicationSchema,
  FAQSchema,
  BreadcrumbSchema,
  ReviewSchema,
  ArticleSchema,
  LocalBusinessSchema,
  WebsiteSchema,
  HomepageSchema,
};
