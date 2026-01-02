"use client";
// @ts-nocheck

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

/**
 * Redirection vers la page de détails du bien
 * 
 * L'édition se fait maintenant directement sur la page de détails
 * via le bouton "Modifier le bien"
 */
export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    if (params.id && typeof params.id === "string") {
      // Redirection vers la page de détails où l'édition est intégrée
      router.replace(`/owner/properties/${params.id}`);
    }
  }, [router, params.id]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
        <p className="text-muted-foreground">Redirection vers le bien...</p>
      </div>
    </div>
  );
}
