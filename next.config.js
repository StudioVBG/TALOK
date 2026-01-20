/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development' || process.env.NETLIFY === 'true',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 an
        },
      },
    },
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'supabase-storage',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 jours
        },
      },
    },
    {
      urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-images',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60, // 24 heures
        },
      },
    },
  ],
});

const nextConfig = {
  output: process.env.NEXT_PUBLIC_CAPACITOR === 'true' ? 'export' : undefined,
  // Server Actions are available by default in Next.js 14
  
  // TypeScript & ESLint - Configuration SOTA 2025
  // ⚠️ AUDIT 2025-12-05: 417 fichiers avec @ts-nocheck détectés
  // Stratégie: Activer la vérification progressive
  // - Phase 1: Garder ignoreBuildErrors temporairement (en cours)
  // - Phase 2: Corriger les fichiers critiques (@ts-nocheck supprimés des layouts)
  // - Phase 3: Désactiver ignoreBuildErrors une fois tous les fichiers corrigés
  typescript: {
    // TODO: Mettre à false une fois tous les @ts-nocheck supprimés
    // Progression: ~5 fichiers corrigés sur 417
    ignoreBuildErrors: true,
  },
  eslint: {
    // TODO: Mettre à false une fois le lint propre
    ignoreDuringBuilds: true,
  },
  
  // Configuration webpack
  webpack: (config, { isServer }) => {
    // Éviter les problèmes de résolution de modules côté serveur
    if (isServer) {
      config.resolve.extensionAlias = {
        '.js': ['.js', '.ts', '.tsx'],
        '.mjs': ['.mjs', '.mts'],
      };
    }

    return config;
  },
  
  // Configuration des images (Next/Image)
  images: {
    unoptimized: process.env.NEXT_PUBLIC_CAPACITOR === 'true',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'poeijjosocmqlhgsacud.supabase.co',
      },
      // Fallback générique pour Supabase
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      }
    ],
  },

  // Optimisations pour développement
  ...(process.env.NODE_ENV === "development" && {
    // Optimiser le cache des pages
    onDemandEntries: {
      // Garder les pages en mémoire pendant 60 secondes
      maxInactiveAge: 60 * 1000,
      // Augmenter le buffer pour réduire les recompilations
      pagesBufferLength: 10,
    },
    
    // Optimiser la compilation
    swcMinify: true,
    
    // Réduire les vérifications strictes en dev (gain de temps)
    reactStrictMode: false,
  }),
  
  // Optimisations générales
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ["error", "warn"],
    } : false,
  },
  
  // Optimisations expérimentales pour améliorer les performances
  experimental: {
    // Packages à ne pas bundler côté serveur (résout les problèmes de syntaxe moderne)
    // zod ajouté pour éviter les problèmes avec .partial() lors du bundling
    serverComponentsExternalPackages: ['cheerio', 'undici', 'zod'],
    
    // Optimiser le tree-shaking et réduire la taille des bundles
    optimizePackageImports: [
      // Lucide icons - très important car très lourd
      "lucide-react",
      // Tous les composants Radix UI
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-dialog",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-switch",
      "@radix-ui/react-progress",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-separator",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-popover",
      "@radix-ui/react-label",
      "@radix-ui/react-slot",
      // Autres packages lourds
      "framer-motion",
      "date-fns",
      // Note: zod retiré car cause des problèmes avec .partial() lors du bundling
      "@tanstack/react-query",
      "class-variance-authority",
      "clsx",
      "tailwind-merge",
      "recharts",
      "stripe",
      "resend",
    ],
    
    // Note: modularizeImports supprimé car obsolète dans Next.js 14+
    // Les imports sont optimisés via optimizePackageImports ci-dessus
  },

  // Headers de sécurité (CSP)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "frame-ancestors 'self'",
              "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.googleapis.com https://api-adresse.data.gouv.fr https://nominatim.openstreetmap.org https://*.tile.openstreetmap.org https://api.stripe.com",
              "img-src 'self' blob: data: https://*.supabase.co https://*.googleapis.com https://images.unsplash.com https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org https://unpkg.com https://*.stripe.com",
              "font-src 'self' https://fonts.gstatic.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = withBundleAnalyzer(withPWA(nextConfig));
