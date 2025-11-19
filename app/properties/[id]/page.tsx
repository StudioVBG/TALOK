"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

/**
 * Redirection vers la route canonique de détail d'un logement
 * 
 * Route legacy : /properties/[id]
 * Route canonique : /app/owner/properties/[id]
 */
export default function LegacyPropertyDetailPage() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    if (params.id && typeof params.id === "string") {
      router.replace(`/app/owner/properties/${params.id}`);
    }
  }, [router, params.id]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
        <p className="text-muted-foreground">Redirection...</p>
      </div>
    </div>
  );
}
