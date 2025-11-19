/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server Actions are available by default in Next.js 14
  
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
    // Optimiser le tree-shaking et réduire la taille des bundles
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-dialog",
      "@radix-ui/react-select",
    ],
  },

  // Headers de sécurité pour réduire les erreurs CSP
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self'; default-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://*.googleapis.com; img-src 'self' blob: data: https://*.supabase.co https://*.googleapis.com;",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

