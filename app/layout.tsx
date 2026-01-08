export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { Metadata, Viewport } from "next";
import { Inter, Dancing_Script, Great_Vibes, Pacifico, Satisfy } from "next/font/google";
import "./globals.css";

/**
 * Normalise l'URL de base pour les métadonnées.
 * Ajoute le protocole https:// si manquant pour éviter les erreurs new URL().
 */
function getMetadataBaseUrl(): URL {
  const rawUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  return new URL(normalizedUrl);
}

// Polices cursives pour les signatures
const dancingScript = Dancing_Script({ 
  subsets: ["latin"], 
  variable: "--font-dancing-script",
  display: "swap",
});
const greatVibes = Great_Vibes({ 
  weight: "400",
  subsets: ["latin"], 
  variable: "--font-great-vibes",
  display: "swap",
});
const pacifico = Pacifico({ 
  weight: "400",
  subsets: ["latin"], 
  variable: "--font-pacifico",
  display: "swap",
});
const satisfy = Satisfy({ 
  weight: "400",
  subsets: ["latin"], 
  variable: "--font-satisfy",
  display: "swap",
});
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

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap", // Optimisation du chargement de la police
  preload: true,
});

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

export const metadata: Metadata = {
  metadataBase: getMetadataBaseUrl(),
  other: {
    "mobile-web-app-capable": "yes",
  },
  title: {
    default: "Talok",
    template: "%s | Talok",
  },
  description: "Application SaaS de gestion locative pour la France et les DROM. Gérez vos biens, locataires, loyers et documents en toute simplicité.",
  keywords: ["talok", "gestion locative", "immobilier", "location", "propriétaire", "locataire", "loyer", "bail", "France", "DROM"],
  authors: [{ name: "Talok" }],
  creator: "Talok",
  publisher: "Talok",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
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
    title: "Talok - Simplifiez la gestion de vos biens",
    description: "Application SaaS de gestion locative pour la France et les DROM",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Talok",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Talok",
    description: "Application SaaS de gestion locative pour la France et les DROM",
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${inter.className} ${dancingScript.variable} ${greatVibes.variable} ${pacifico.variable} ${satisfy.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <CapacitorProvider>
            <QueryProvider>
              <PostHogProvider>
                <SubscriptionProvider>
                  <AIProvider showCopilotButton={true}>
                    <div className="min-h-screen flex flex-col">
                      <Navbar />
                      <PageTransition>
                        <main className="flex-1">{children}</main>
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

