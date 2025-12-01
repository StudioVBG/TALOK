import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@/lib/utils/console-filter"; // Filtre les erreurs d'extensions
import { Toaster } from "@/components/ui/toaster";
import { Navbar } from "@/components/layout/navbar";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PageTransition } from "@/components/ui/page-transition";

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
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  other: {
    "mobile-web-app-capable": "yes",
  },
  title: {
    default: "Gestion Locative",
    template: "%s | Gestion Locative",
  },
  description: "Application SaaS de gestion locative pour la France et les DROM. Gérez vos biens, locataires, loyers et documents en toute simplicité.",
  keywords: ["gestion locative", "immobilier", "location", "propriétaire", "locataire", "loyer", "bail", "France", "DROM"],
  authors: [{ name: "Gestion Locative" }],
  creator: "Gestion Locative",
  publisher: "Gestion Locative",
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
    url: "https://gestion-locative.app",
    siteName: "Gestion Locative",
    title: "Gestion Locative - Simplifiez la gestion de vos biens",
    description: "Application SaaS de gestion locative pour la France et les DROM",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Gestion Locative",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Gestion Locative",
    description: "Application SaaS de gestion locative pour la France et les DROM",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Gestion Locative",
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
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <PageTransition>
                <main className="flex-1">{children}</main>
              </PageTransition>
              <Toaster />
            </div>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

