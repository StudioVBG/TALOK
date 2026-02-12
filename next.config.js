/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

// next-pwa@5.6.0 — n'est appliqué que si NON désactivé.
// Sur Netlify (NETLIFY=true) et en dev, on saute complètement le wrapper
// pour éviter les interférences avec @netlify/plugin-nextjs.
const isPWADisabled = process.env.NODE_ENV === 'development' || process.env.NETLIFY === 'true';
const withPWA = isPWADisabled
  ? (config) => config  // no-op wrapper
  : require('next-pwa')({
      dest: 'public',
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
  
  // TypeScript & ESLint - Configuration SOTA 2026
  // ✅ AUDIT 2026-02-12: ignoreBuildErrors désactivé.
  // Les fichiers avec @ts-nocheck restent protégés individuellement.
  // Tout nouveau code DOIT passer la vérification TypeScript.
  // Stratégie de migration progressive:
  // - Les 417 fichiers @ts-nocheck existants compilent grâce à la directive
  // - Chaque fichier édité doit retirer son @ts-nocheck et corriger ses types
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    // ESLint activé en build pour détecter les erreurs critiques
    ignoreDuringBuilds: false,
  },
  
  // Transpiler les packages qui posent problème avec ESM
  transpilePackages: ['zod'],
  
  // Fix pour Zod v3.24+ avec Next.js (problème de module resolution)
  webpack: (config, { isServer }) => {
    // Fix pour les exports ESM de Zod
    const path = require('path');
    config.resolve.alias = {
      ...config.resolve.alias,
      'zod': path.resolve(__dirname, 'node_modules/zod'),
      'zod/v3': path.resolve(__dirname, 'node_modules/zod'),
    };
    
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
      // Supabase storage - wildcard pour supporter tous les projets
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
    serverComponentsExternalPackages: ['cheerio', 'undici'],
    
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
      "zod",
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

  // Redirections pour dédupliquer les routes, consolider les doublons et gérer les routes legacy
  async redirects() {
    return [
      // === Doublons internes ===
      // /owner → /owner/dashboard
      { source: "/owner", destination: "/owner/dashboard", permanent: true },
      // /tenant → /tenant/dashboard
      { source: "/tenant", destination: "/tenant/dashboard", permanent: true },
      // /dashboard → /owner/dashboard (legacy)
      { source: "/dashboard", destination: "/owner/dashboard", permanent: true },

      // === Consolidation anglais → français pour les pages marketing ===
      { source: '/features', destination: '/fonctionnalites', permanent: true },
      { source: '/features/:path*', destination: '/fonctionnalites/:path*', permanent: true },

      // === Routes anglais → français unifiées (owner) ===
      // /owner/contracts → /owner/leases
      { source: "/owner/contracts", destination: "/owner/leases", permanent: true },
      { source: "/owner/contracts/:path*", destination: "/owner/leases/:path*", permanent: true },
      // /owner/finances → /owner/money
      { source: "/owner/finances", destination: "/owner/money", permanent: true },
      { source: "/owner/finances/:path*", destination: "/owner/money/:path*", permanent: true },
      // /owner/settings → /owner/profile
      { source: "/owner/settings", destination: "/owner/profile", permanent: true },

      // === Routes tenant legacy ===
      // /tenant/tickets → /tenant/requests
      { source: "/tenant/tickets", destination: "/tenant/requests", permanent: true },
      { source: "/tenant/tickets/:path*", destination: "/tenant/requests/:path*", permanent: true },
      // /tenant/home → /tenant/lease
      { source: "/tenant/home", destination: "/tenant/lease", permanent: true },

      // === Routes billing unifiées ===
      // /owner/billing → /settings/billing
      { source: "/owner/billing", destination: "/settings/billing", permanent: true },
      // /billing → /settings/billing
      { source: "/billing", destination: "/settings/billing", permanent: true },

      // === Routes legacy / doublons dashboard ===
      { source: '/dashboard/biens', destination: '/owner/properties', permanent: true },
      { source: '/dashboard/biens/:path*', destination: '/owner/properties/:path*', permanent: true },
      { source: '/dashboard/locataires', destination: '/owner/tenants', permanent: true },
      { source: '/dashboard/locataires/:path*', destination: '/owner/tenants/:path*', permanent: true },
      { source: '/dashboard/settings', destination: '/owner/profile', permanent: true },
      { source: '/dashboard/documents', destination: '/owner/documents', permanent: true },
      { source: '/dashboard/finances', destination: '/owner/money', permanent: true },
      { source: '/dashboard/tickets', destination: '/owner/tickets', permanent: true },

      // === Routes settings éparses → profil du rôle ===
      { source: '/settings/billing', destination: '/owner/money', permanent: false },

      // === Routes anglaises legacy → routes françaises (SEO + UX) ===
      { source: '/properties', destination: '/owner/properties', permanent: true },
      { source: '/properties/:path*', destination: '/owner/properties/:path*', permanent: true },
      { source: '/tenants', destination: '/owner/leases', permanent: true },
      { source: '/tenants/:path*', destination: '/owner/leases/:path*', permanent: true },
      { source: '/settings', destination: '/owner/profile', permanent: true },
      { source: '/settings/:path*', destination: '/owner/profile', permanent: true },

      // === Route /profile legacy → rôle-spécifique (non-permanent car dépend du rôle) ===
      { source: '/profile', destination: '/owner/profile', permanent: false },
    ];
  },

  // Headers de sécurité — source unique de vérité (pas de duplication dans netlify.toml)
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
          // Headers de sécurité (anciennement dans netlify.toml)
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      // Cache long pour les assets statiques Next.js
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

module.exports = withBundleAnalyzer(withPWA(nextConfig));
