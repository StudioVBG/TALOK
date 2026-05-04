import type { Metadata } from "next";
import { PLANS } from "@/lib/subscriptions/plans";
import { PricingClient } from "./PricingClient";
import { safeJsonLd } from "@/lib/seo/safe-json-ld";

// ============================================
// SEO — generateMetadata (SSG)
// ============================================

export const metadata: Metadata = {
  // NB : le layout racine applique `title.template: "%s | Talok"`. Ne pas
  // ajouter "| Talok" ici pour éviter le double suffixe "| Talok | Talok".
  title: "Tarifs — Gestion locative simple et abordable",
  description:
    "Decouvrez les tarifs Talok : de 0 a 69 EUR/mois pour gerer vos biens locatifs. Quittances, baux, paiements en ligne, EDL numerique. 1er mois offert, sans engagement.",
  openGraph: {
    title: "Tarifs Talok — Gestion locative a partir de 0 EUR",
    description:
      "Gerez vos biens locatifs simplement. Plans Gratuit, Starter, Confort et Pro. 1er mois offert sur tous les plans payants.",
    type: "website",
    url: "https://talok.fr/pricing",
  },
  alternates: {
    canonical: "https://talok.fr/pricing",
  },
};

// ============================================
// PLANS DATA — Statique, calcule cote serveur
// ============================================

const DISPLAYED_PLANS = (
  ["gratuit", "starter", "confort", "pro"] as const
).map((slug) => {
  const plan = PLANS[slug];
  return {
    slug,
    name: plan.name,
    description: plan.description,
    tagline: plan.tagline,
    priceMonthly: plan.price_monthly ?? 0,
    priceYearly: plan.price_yearly ?? 0,
    highlights: plan.highlights,
    isPopular: plan.is_popular,
    ctaText: plan.cta_text,
    badge: plan.badge,
    trialDays: plan.trial_days,
    maxProperties: plan.limits.max_properties,
    extraPropertyPrice: plan.limits.extra_property_price,
  };
});

// ============================================
// FEATURE COMPARISON TABLE DATA
// ============================================

type FeatureValue = boolean | string | number;

interface ComparisonRow {
  label: string;
  gratuit: FeatureValue;
  starter: FeatureValue;
  confort: FeatureValue;
  pro: FeatureValue;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    label: "Biens inclus",
    gratuit: "1",
    starter: "3",
    confort: "10",
    pro: "50",
  },
  {
    label: "Bien supplementaire",
    gratuit: false,
    starter: "+3 EUR/bien",
    confort: "+2,50 EUR/bien",
    pro: "+2 EUR/bien",
  },
  {
    label: "Signatures electroniques",
    gratuit: "5,90 EUR/sign.",
    starter: "4,90 EUR/sign.",
    confort: "2 incluses",
    pro: "10 incluses",
  },
  {
    label: "Stockage documents",
    gratuit: "100 Mo",
    starter: "1 Go",
    confort: "5 Go",
    pro: "30 Go",
  },
  {
    label: "Utilisateurs",
    gratuit: "1",
    starter: "1",
    confort: "2",
    pro: "5",
  },
  {
    label: "Paiement en ligne (CB/SEPA)",
    gratuit: false,
    starter: true,
    confort: true,
    pro: true,
  },
  {
    label: "Open Banking",
    gratuit: false,
    starter: false,
    confort: true,
    pro: true,
  },
  {
    label: "Quittances automatiques",
    gratuit: true,
    starter: true,
    confort: true,
    pro: true,
  },
  {
    label: "Generation de bail",
    gratuit: true,
    starter: true,
    confort: true,
    pro: true,
  },
  {
    label: "Relances automatiques",
    gratuit: false,
    starter: "Email",
    confort: "Email",
    pro: "Email + SMS",
  },
  {
    label: "Scoring locataire IA",
    gratuit: false,
    starter: false,
    confort: true,
    pro: true,
  },
  {
    label: "EDL numerique",
    gratuit: false,
    starter: false,
    confort: true,
    pro: true,
  },
  {
    label: "Gestion prestataires",
    gratuit: false,
    starter: false,
    confort: false,
    pro: true,
  },
  {
    label: "Acces API",
    gratuit: false,
    starter: false,
    confort: false,
    pro: "Lecture + ecriture",
  },
  {
    label: "Reduction assurance GLI",
    gratuit: false,
    starter: "-5 %",
    confort: "-10 %",
    pro: "-15 %",
  },
];

// ============================================
// FAQ DATA
// ============================================

const FAQ_ITEMS = [
  {
    question: "Puis-je changer de plan a tout moment ?",
    answer:
      "Oui, vous pouvez passer a un plan superieur ou inferieur a tout moment. Le changement prend effet immediatement et la facturation est ajustee au prorata.",
  },
  {
    question: "Y a-t-il un engagement ?",
    answer:
      "Non, tous nos plans sont sans engagement. Vous pouvez resilier a tout moment depuis vos parametres. En annuel, vous beneficiez de 20 % de reduction.",
  },
  {
    question: "Que se passe-t-il si je depasse ma limite de biens ?",
    answer:
      "Sur les plans payants (Starter, Confort, Pro), vous pouvez ajouter des biens supplementaires au tarif indique. Le montant est ajoute a votre prochaine facture.",
  },
  {
    question: "Le 1er mois offert, comment ca marche ?",
    answer:
      "Sur les plans Starter, Confort et Pro, votre premier mois est entierement gratuit. Aucun prelevement avant la fin de la periode d'essai. Vous pouvez annuler a tout moment.",
  },
  {
    question: "Les prix sont-ils HT ou TTC ?",
    answer:
      "Les prix affiches sont hors taxes (HT). La TVA applicable depend de votre territoire : 20 % en metropole, 8,5 % en Martinique/Guadeloupe/Reunion, 2,1 % en Guyane, 0 % a Mayotte. Utilisez le selecteur de territoire pour voir les prix TTC.",
  },
  {
    question: "Proposez-vous des offres pour les agences et gestionnaires ?",
    answer:
      "Oui, nos plans Enterprise (a partir de 249 EUR/mois) sont concus pour les gestionnaires professionnels avec 50 a 500+ biens, account manager dedie, API complete, et SLA garanti. Contactez-nous pour une offre personnalisee.",
  },
];

// ============================================
// JSON-LD STRUCTURED DATA
// ============================================

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Talok",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Plateforme de gestion locative pour proprietaires et gestionnaires en France",
  url: "https://talok.fr",
  offers: DISPLAYED_PLANS.filter((p) => p.slug !== "gratuit").map((plan) => ({
    "@type": "Offer",
    name: `Talok ${plan.name}`,
    price: (plan.priceMonthly / 100).toFixed(2),
    priceCurrency: "EUR",
    description: plan.description,
    priceValidUntil: new Date(
      new Date().getFullYear() + 1,
      0,
      1
    ).toISOString(),
    availability: "https://schema.org/InStock",
    url: `https://talok.fr/signup/plan?plan=${plan.slug}`,
  })),
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "500",
    bestRating: "5",
    worstRating: "1",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

// ============================================
// PAGE COMPONENT (Server — SSG)
// ============================================

export default function PricingPage() {
  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }}
      />

      {/* Interactive Client Component */}
      <PricingClient
        plans={DISPLAYED_PLANS}
        comparisonRows={COMPARISON_ROWS}
        faqItems={FAQ_ITEMS}
      />
    </>
  );
}
