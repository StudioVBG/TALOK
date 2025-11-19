"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirection vers la route canonique d'ajout de logement
 * 
 * Route legacy : /properties/new
 * Route canonique : /app/owner/property/new
 */
export default function LegacyNewPropertyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/app/owner/property/new");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
        <p className="text-muted-foreground">Redirection...</p>
      </div>
    </div>
  );
}

