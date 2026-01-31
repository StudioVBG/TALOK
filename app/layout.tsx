export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { Metadata, Viewport } from "next";
import { Inter, Dancing_Script, Great_Vibes, Pacifico, Satisfy } from "next/font/google";
import "./globals.css";

/**
 * Configuration des polices avec next/font pour éviter le FOUC
 * Les polices sont préchargées et injectées de manière optimale
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  preload: true,
});

const dancingScript = Dancing_Script({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dancing-script",
  weight: ["400", "500", "600", "700"],
  preload: false,
});

const greatVibes = Great_Vibes({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-great-vibes",
  weight: "400",
  preload: false,
});

const pacifico = Pacifico({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-pacifico",
  weight: "400",
  preload: false,
});

const satisfy = Satisfy({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-satisfy",
  weight: "400",
  preload: false,
});

/**
 * Normalise l'URL de base pour les métadonnées.
 * Ajoute le protocole https:// si manquant pour éviter les erreurs new URL().
 */
function getMetadataBaseUrl(): URL {
  const rawUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  return new URL(normalizedUrl);
}

import "@/lib/utils/console-filter"; // Filtre les erreurs d'extensions
import { Toaster } from "@/components/ui/toaster";
import { Navbar } from "@/components/layout/navbar";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PageTransition } from "@/components/ui/page-transition";
import { SubscriptionProvider } from "@/components/subscription/subscription-provider";
import { PostHogProvider } from "@/components/analytics/posthog-provider";
import { AIProvider } from "@/components/providers/ai-provider";
import { CapacitorProvider } from "@/components/providers/capacitor-provider";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

/**
 * Métadonnées SEO SOTA 2026
 *
 * Optimisations :
 * - Title template avec branding
 * - Description orientée conversion
 * - Keywords longue traîne
 * - Open Graph complet
 * - Twitter Cards optimisées
 */
export const metadata: Metadata = {
  metadataBase: getMetadataBaseUrl(),
  other: {
    "mobile-web-app-capable": "yes",
    "google-site-verification": process.env.GOOGLE_SITE_VERIFICATION || "",
  },
  title: {
    default: "Talok | Logiciel de Gestion Locative n°1 en France",
    template: "%s | Talok - Gestion Locative",
  },
  description:
    "Logiciel de gestion locative tout-en-un pour propriétaires. Baux automatiques ALUR, signatures électroniques, scoring IA locataires, Open Banking. +10 000 propriétaires en France et DROM. 1er mois offert.",
  keywords: [
    // Mots-clés principaux (volume élevé)
    "logiciel gestion locative",
    "gestion locative en ligne",
    "application gestion locative",
    "logiciel bailleur",
    // Mots-clés secondaires
    "bail location automatique",
    "quittance de loyer",
    "signature électronique bail",
    "état des lieux numérique",
    // Mots-clés longue traîne
    "gestion locative DROM",
    "gestion locative Martinique",
    "gestion locative Guadeloupe",
    "scoring locataire IA",
    "open banking immobilier",
    // Marque
    "talok",
  ],
  authors: [{ name: "Talok", url: "https://talok.fr" }],
  creator: "Talok",
  publisher: "Talok",
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/icons/icon-152x152.svg", sizes: "152x152", type: "image/svg+xml" },
      { url: "/icons/icon-192x192.svg", sizes: "192x192", type: "image/svg+xml" },
    ],
  },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://talok.fr",
    siteName: "Talok",
    title: "Talok | Logiciel de Gestion Locative n°1 en France",
    description:
      "Gérez vos locations comme un pro. Baux ALUR, e-signatures, scoring IA, Open Banking. Rejoignez +10 000 propriétaires. 1er mois offert.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Talok - Logiciel de gestion locative",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@talok_fr",
    creator: "@talok_fr",
    title: "Talok | Logiciel de Gestion Locative n°1",
    description:
      "Baux ALUR, e-signatures, scoring IA, Open Banking. +10 000 propriétaires en France. 1er mois offert.",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Talok",
  },
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
  category: "business",
  classification: "Property Management Software",
  referrer: "origin-when-cross-origin",
  alternates: {
    canonical: "https://talok.fr",
    languages: {
      "fr-FR": "https://talok.fr",
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
};

/**
 * Script inline pour prévenir le flash de thème (FOUC)
 * S'exécute avant le rendu du DOM pour appliquer immédiatement le bon thème
 */
const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('theme');
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = theme === 'dark' || (!theme && systemDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${inter.variable} ${dancingScript.variable} ${greatVibes.variable} ${pacifico.variable} ${satisfy.variable}`}
    >
      <head>
        {/* Script anti-flash de thème - s'exécute avant le rendu */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <CapacitorProvider>
            <QueryProvider>
              <PostHogProvider>
                <SubscriptionProvider>
                  <AIProvider showCopilotButton={true}>
                    <div className="min-h-screen flex flex-col">
                      {/* Skip to content - Accessibility WCAG 2.1 */}
                      <a
                        href="#main-content"
                        className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-all"
                      >
                        Aller au contenu principal
                      </a>
                      <Navbar />
                      <PageTransition>
                        <main id="main-content" className="flex-1" tabIndex={-1}>{children}</main>
                      </PageTransition>
                      <Toaster />
                    </div>
                  </AIProvider>
                </SubscriptionProvider>
              </PostHogProvider>
            </QueryProvider>
          </CapacitorProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
