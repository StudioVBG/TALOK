/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
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
  // Server Actions are available by default in Next.js 14
  
  // Ignorer les erreurs TypeScript et ESLint pendant le build
  // Note: À désactiver en production une fois les erreurs corrigées
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
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
    
    // Modularize imports pour tree-shaking optimal
    modularizeImports: {
      "date-fns": {
        transform: "date-fns/{{member}}",
      },
      "lodash": {
        transform: "lodash/{{member}}",
      },
    },
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
              "connect-src 'self' https://*.supabase.co https://*.googleapis.com https://api-adresse.data.gouv.fr",
              "img-src 'self' blob: data: https://*.supabase.co https://*.googleapis.com https://images.unsplash.com",
              "font-src 'self' https://fonts.gstatic.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

module.exports = withBundleAnalyzer(withPWA(nextConfig));
