/**
 * Page Pricing — Server Component (SSG)
 *
 * Structure statique pré-rendue (hero, trust, FAQ, legal, JSON-LD).
 * L'interactivité (toggle, TVA, plan cards) est déléguée à PricingClient.
 *
 * Conformité :
 * - Art. L112-1 Code de la Consommation (affichage HT/TTC)
 * - Art. L221-18 Code de la Consommation (droit de rétractation 14 jours)
 * - LCEN (accès CGV/CGU)
 * - WCAG 2.2 AA (accessibilité)
 */

import { Suspense } from "react";
import Link from "next/link";
import { PricingClient } from "./PricingClient";
import { PublicFooter } from "@/components/layout/public-footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Sparkles, Shield, Users, Home, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ============================================
// JSON-LD STRUCTURED DATA
// ============================================

function buildJsonLd() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://talok.fr";

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Talok",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${baseUrl}/pricing`,
    description:
      "Logiciel de gestion locative en ligne pour propriétaires bailleurs. Gestion des biens, loyers, baux et comptabilité.",
    offers: [
      {
        "@type": "Offer",
        name: "Gratuit",
        price: "0",
        priceCurrency: "EUR",
        description: "Jusqu'à 2 biens — Idéal pour découvrir Talok",
      },
      {
        "@type": "Offer",
        name: "Starter",
        price: "9.90",
        priceCurrency: "EUR",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "9.90",
          priceCurrency: "EUR",
          unitCode: "MON",
          referenceQuantity: { "@type": "QuantitativeValue", value: "1", unitCode: "MON" },
        },
        description: "Jusqu'à 5 biens — Pour bien démarrer",
      },
      {
        "@type": "Offer",
        name: "Confort",
        price: "24.90",
        priceCurrency: "EUR",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "24.90",
          priceCurrency: "EUR",
          unitCode: "MON",
          referenceQuantity: { "@type": "QuantitativeValue", value: "1", unitCode: "MON" },
        },
        description: "Jusqu'à 10 biens — Le plus populaire",
      },
      {
        "@type": "Offer",
        name: "Pro",
        price: "59.90",
        priceCurrency: "EUR",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "59.90",
          priceCurrency: "EUR",
          unitCode: "MON",
          referenceQuantity: { "@type": "QuantitativeValue", value: "1", unitCode: "MON" },
        },
        description: "Jusqu'à 50 biens — Pour les professionnels",
      },
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "1200",
      bestRating: "5",
    },
  };
}

// ============================================
// STATIC DATA
// ============================================

const FAQ_ITEMS = [
  {
    question: "Puis-je changer de forfait à tout moment ?",
    answer:
      "Oui, vous pouvez upgrader ou downgrader votre forfait à tout moment. En cas d'upgrade, vous ne payez que la différence au prorata. En cas de downgrade, le nouveau tarif s'applique à la prochaine période de facturation.",
  },
  {
    question: "Comment fonctionne le 1er mois offert ?",
    answer:
      "Le 1er mois est entièrement offert sur tous les forfaits payants. Vous enregistrez votre moyen de paiement à l'inscription mais vous ne serez prélevé qu'à partir du 2ème mois. Vous pouvez annuler à tout moment pendant le mois offert.",
  },
  {
    question: "Quels sont les tarifs des différents plans ?",
    answer:
      "Gratuit (2 biens), Confort 24,90\u00a0€ HT/mois (10 biens + 5 signatures), Pro 59,90\u00a0€ HT/mois (50 biens + signatures illimitées). Enterprise sur devis. -17\u00a0% sur l'abonnement annuel (249\u00a0€/an Confort, 599\u00a0€/an Pro). TVA en sus selon votre localisation (20\u00a0% métropole, 8,5\u00a0% Martinique/Guadeloupe/Réunion, 2,1\u00a0% Guyane, 0\u00a0% Mayotte).",
  },
  {
    question: "Y a-t-il des frais cachés ?",
    answer:
      "Non, aucun frais caché. Le prix affiché est le prix hors taxes. Les seuls coûts supplémentaires sont les biens au-delà du quota (+2\u00a0€ à +3\u00a0€/bien selon le plan) et les signatures électroniques au-delà du quota inclus. La TVA applicable s'ajoute selon votre localisation.",
  },
  {
    question: "Comment fonctionne la collecte de loyers ?",
    answer:
      "À partir du plan Confort, vos locataires paient par prélèvement automatique. Une commission de 2,5\u00a0% (Confort) ou 1,5\u00a0% (Pro) est prélevée sur chaque loyer collecté. Le montant net est reversé sous 5-7 jours ouvrés.",
  },
  {
    question: "Puis-je récupérer mes données si je résilie ?",
    answer:
      "Absolument. Conformément à l'Art. 20 du RGPD (droit à la portabilité), vous pouvez exporter toutes vos données à tout moment depuis la section Abonnement. Après résiliation, vos données sont conservées 30 jours avant suppression définitive.",
  },
  {
    question: "Comment fonctionne la réduction GLI ?",
    answer:
      "Selon votre forfait, vous bénéficiez de -5\u00a0% à -25\u00a0% sur les primes d'assurance Garantie Loyers Impayés de nos partenaires. Enterprise XL offre le meilleur taux à -25\u00a0%.",
  },
  {
    question: "Quel est le droit de rétractation ?",
    answer:
      "Conformément à l'Art. L221-18 du Code de la Consommation, vous disposez d'un droit de rétractation de 14 jours à compter de la souscription. Vous pouvez exercer ce droit directement depuis votre espace de gestion ou en nous contactant.",
  },
];

const TRUST_SIGNALS = [
  { icon: "shield", label: "Paiement sécurisé", sublabel: "via Stripe" },
  { icon: "users", label: "+10 000", sublabel: "propriétaires" },
  { icon: "home", label: "+50 000", sublabel: "biens gérés" },
  { icon: "star", label: "4.8/5", sublabel: "satisfaction" },
] as const;

function TrustIcon({ name }: { name: string }) {
  const iconClass = "w-6 h-6 text-violet-400";
  switch (name) {
    case "shield":
      return <Shield className={iconClass} aria-hidden="true" />;
    case "users":
      return <Users className={iconClass} aria-hidden="true" />;
    case "home":
      return <Home className={iconClass} aria-hidden="true" />;
    case "star":
      return <Star className={iconClass} aria-hidden="true" />;
    default:
      return null;
  }
}

// ============================================
// PAGE (Server Component)
// ============================================

export default function PricingPage() {
  const jsonLd = buildJsonLd();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 relative">
          <div className="text-center max-w-3xl mx-auto">
            <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 mb-4">
              <Sparkles className="w-3 h-3 mr-1" aria-hidden="true" />
              Tarification simple et transparente
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Le bon forfait pour{" "}
              <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                votre gestion locative
              </span>
            </h1>
            <p className="text-lg text-slate-400 mb-8">
              Choisissez le forfait adapté à votre portefeuille.
              <br />
              <span
                className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold text-base border border-emerald-500/30"
                role="status"
                aria-label="Offre spéciale : premier mois offert sur tous les plans payants"
              >
                1er mois offert
              </span>{" "}
              sur tous les plans.
            </p>

            {/* Interactive pricing controls + plan cards */}
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
                </div>
              }
            >
              <PricingClient />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="py-16 bg-slate-900/50" aria-label="Indicateurs de confiance">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {TRUST_SIGNALS.map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center">
                  <TrustIcon name={item.icon} />
                </div>
                <div className="font-semibold text-white">{item.label}</div>
                <div className="text-sm text-slate-400">{item.sublabel}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20" aria-label="Questions fréquentes">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Questions fréquentes
            </h2>
            <p className="text-slate-400">
              Tout ce que vous devez savoir sur nos forfaits
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <Accordion type="single" collapsible className="space-y-4">
              {FAQ_ITEMS.map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="bg-slate-800/30 border border-slate-700/50 rounded-xl px-6 overflow-hidden"
                >
                  <AccordionTrigger className="text-left text-white hover:no-underline py-4">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-400 pb-4">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* Legal & CGV section */}
      <section className="py-8 border-t border-slate-800" aria-label="Mentions légales tarifaires">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-xs text-slate-500 space-y-2 text-center">
            <p>
              Tous les prix sont affichés hors taxes (HT). TVA applicable selon votre territoire :
              20&nbsp;% (métropole), 8,5&nbsp;% (Martinique, Guadeloupe, Réunion), 2,1&nbsp;% (Guyane), 0&nbsp;% (Mayotte).
            </p>
            <p>
              Conformément à l&apos;Art. L221-18 du Code de la Consommation, vous disposez d&apos;un droit de rétractation de 14 jours
              à compter de la souscription.
            </p>
            <p>
              <Link href="/legal/cgv" className="underline hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
                Conditions Générales de Vente
              </Link>
              {" — "}
              <Link href="/legal/cgu" className="underline hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
                Conditions Générales d&apos;Utilisation
              </Link>
              {" — "}
              <Link href="/legal/privacy" className="underline hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
                Politique de confidentialité
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter variant="dark" />
    </div>
  );
}
