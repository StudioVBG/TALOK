import { Metadata } from "next";
import FeaturesClient from "./features-client";
import { BreadcrumbSchema } from "@/components/seo/JsonLd";

/**
 * Métadonnées SEO optimisées pour la page Features
 *
 * Mots-clés ciblés:
 * - logiciel gestion locative (2,400/mois)
 * - gestion locative en ligne (1,900/mois)
 * - application gestion locative (1,300/mois)
 */
export const metadata: Metadata = {
  title: "Fonctionnalités | Logiciel de Gestion Locative Complet",
  description:
    "Découvrez toutes les fonctionnalités de Talok : baux automatiques conformes ALUR, signatures électroniques légales, scoring IA locataires, Open Banking et portail locataire. La solution n°1 en France.",
  keywords: [
    "logiciel gestion locative",
    "gestion locative en ligne",
    "application gestion locative",
    "bail location automatique",
    "signature électronique bail",
    "scoring locataire",
    "open banking immobilier",
    "quittance de loyer automatique",
    "état des lieux numérique",
    "portail locataire",
    "gestion locative DROM",
  ],
  openGraph: {
    title: "Fonctionnalités Talok | Gestion Locative Complète",
    description:
      "Baux ALUR, e-signatures, scoring IA, Open Banking. Découvrez pourquoi +10 000 propriétaires nous font confiance.",
    type: "website",
    url: "https://talok.fr/features",
    images: [
      {
        url: "/og-features.png",
        width: 1200,
        height: 630,
        alt: "Fonctionnalités Talok - Gestion locative",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fonctionnalités Talok | Gestion Locative Complète",
    description:
      "Baux ALUR, e-signatures, scoring IA, Open Banking. La solution n°1 des propriétaires.",
  },
  alternates: {
    canonical: "https://talok.fr/features",
  },
};

export default function FeaturesPage() {
  return (
    <>
      {/* Breadcrumb Schema pour SEO */}
      <BreadcrumbSchema
        items={[
          { name: "Accueil", url: "https://talok.fr" },
          { name: "Fonctionnalités", url: "https://talok.fr/features" },
        ]}
      />
      <FeaturesClient />
    </>
  );
}
