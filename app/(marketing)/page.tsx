import type { Metadata } from "next"
import { getSiteConfig } from "@/lib/queries/site-config"
import { LandingPageClient } from "@/components/marketing/LandingPageClient"

export const revalidate = 3600

export const metadata: Metadata = {
  title: {
    absolute: "Talok — Logiciel de Gestion Locative (gratuit, sans agence)",
  },
  description:
    "Gérez vos locations, encaissez vos loyers et dormez tranquille. Tout ce qu'une agence fait à 8 % — vous le faites seul, pour moins de 35 €/mois. Gratuit pour 1 bien, sans carte bancaire. Né en Martinique.",
  keywords: [
    "gestion locative",
    "logiciel propriétaire bailleur",
    "bail ALUR",
    "signature électronique bail",
    "paiement loyer en ligne",
    "logiciel gestion locative gratuit",
    "alternative agence immobilière",
    "gestion locative Martinique",
    "logiciel bailleur DROM-COM",
  ],
  alternates: { canonical: "https://talok.fr/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://talok.fr/",
    siteName: "Talok",
    title: "Talok — Logiciel de Gestion Locative (gratuit, sans agence)",
    description:
      "Gérez vos locations, encaissez vos loyers et dormez tranquille. Gratuit pour 1 bien, sans carte bancaire.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Talok — Logiciel de Gestion Locative",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@talok_fr",
    title: "Talok — LE Logiciel de Gestion Locative",
    description:
      "Tout ce qu'une agence fait à 8 % — vous le faites seul, pour moins de 35 €/mois. Gratuit pour 1 bien.",
    images: ["/og-image.png"],
  },
}

export default async function LandingPage() {
  const config = await getSiteConfig([
    "landing_arg_time_img",
    "landing_arg_money_img",
    "landing_arg_contract_img",
    "landing_arg_sleep_img",
    "landing_profile_owner_img",
    "landing_profile_investor_img",
    "landing_profile_agency_img",
    "landing_beforeafter_img",
  ])

  return <LandingPageClient images={config} />
}
